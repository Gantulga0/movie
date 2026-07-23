/**
 * Runs on Node's built-in test runner (no jest) via ts-node:
 *   npm test
 *
 * verify.mn is reached through global `fetch`, which we stub per test. Prisma is
 * replaced by a tiny in-memory store so no database is needed.
 */
import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerifyMnService } from './verify-mn.service';
import { PhoneVerificationService } from './phone-verification.service';

type FetchHandler = (url: string, init: RequestInit) => { status?: number; body: unknown };

/** Install a fetch stub for the duration of one test; returns a restore fn. */
function stubFetch(handler: FetchHandler): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    const { status = 200, body } = handler(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function makeConfig(overrides: Record<string, unknown>): ConfigService {
  return {
    get: (key: string, def?: unknown) => (key in overrides ? overrides[key] : def),
  } as unknown as ConfigService;
}

/** In-memory PhoneVerification table backing the service under test. */
function makePrisma() {
  const rows: Array<Record<string, any>> = [];
  const find = (where: { sessionId?: string; id?: string }) =>
    rows.find(
      (r) =>
        (where.sessionId && r.sessionId === where.sessionId) ||
        (where.id && r.id === where.id),
    ) ?? null;
  const prisma = {
    phoneVerification: {
      create: async ({ data }: { data: Record<string, any> }) => {
        rows.push({ ...data });
        return data;
      },
      findUnique: async ({ where }: { where: any }) => find(where),
      update: async ({ where, data }: { where: any; data: Record<string, any> }) => {
        const row = find(where);
        Object.assign(row!, data);
        return row;
      },
    },
  } as unknown as PrismaService;
  return { prisma, rows };
}

const BASE = 'https://api.verify.mn';

function session(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 's1',
    phone: '99112233',
    shortcode: '144773',
    text: '482916',
    smsUri: 'sms:144773?body=482916',
    displayInstruction: '482916 гэсэн кодыг 144773 руу илгээнэ үү',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    ...overrides,
  };
}

function build(overrides: Record<string, unknown> = {}) {
  const config = makeConfig({
    VERIFY_MN_API_KEY: 'sk_test_123',
    VERIFY_MN_POLL_INTERVAL_MS: 5,
    ...overrides,
  });
  const verifyMn = new VerifyMnService(config);
  const { prisma, rows } = makePrisma();
  const svc = new PhoneVerificationService(prisma, config, verifyMn);
  return { svc, verifyMn, rows };
}

// 1. PENDING -> VERIFIED: the user's SMS lands on the second poll.
test('verifyPhone resolves true once the session becomes VERIFIED', async () => {
  const { svc, rows } = build();
  let getCalls = 0;
  const restore = stubFetch((url, init) => {
    if (init.method === 'POST' && url.endsWith('/sessions')) {
      return { body: session() };
    }
    // GET /sessions/s1 — PENDING first, then VERIFIED.
    getCalls += 1;
    return {
      body: {
        sessionId: 's1',
        phone: '99112233',
        sessionStatus: getCalls >= 2 ? 'VERIFIED' : 'PENDING',
        callbackStatus: 'SENT',
        verifiedAt: getCalls >= 2 ? new Date().toISOString() : null,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
    };
  });

  try {
    const ok = await svc.verifyPhone('+976 9911 2233');
    assert.equal(ok, true);
    assert.ok(getCalls >= 2, 'should poll until VERIFIED');
    assert.equal(rows[0].status, 'VERIFIED');
    // "+" and spaces stripped to bare digits; 8-16 range keeps the 976 prefix.
    assert.equal(rows[0].phone, '97699112233', 'phone normalized to bare digits');
  } finally {
    restore();
  }
});

// 2. EXPIRED timeout: SMS never arrives before expiresAt.
test('verifyPhone resolves false when the session expires before VERIFIED', async () => {
  const { svc, rows } = build();
  const restore = stubFetch((url, init) => {
    if (init.method === 'POST' && url.endsWith('/sessions')) {
      // Very short TTL so the poll loop's deadline passes quickly.
      return { body: session({ sessionId: 's2', expiresAt: new Date(Date.now() + 40).toISOString() }) };
    }
    return {
      body: {
        sessionId: 's2',
        phone: '99112233',
        sessionStatus: 'PENDING',
        callbackStatus: 'PENDING',
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 40).toISOString(),
      },
    };
  });

  try {
    const ok = await svc.verifyPhone('99112233');
    assert.equal(ok, false);
    assert.equal(rows[0].status, 'EXPIRED');
  } finally {
    restore();
  }
});

// 3. 401 on a bad key: createSession surfaces UnauthorizedException.
test('createSession throws UnauthorizedException on a 401 (bad key)', async () => {
  const { verifyMn } = build({ VERIFY_MN_API_KEY: 'sk_bad' });
  const restore = stubFetch(() => ({ status: 401, body: { message: 'invalid api key' } }));
  try {
    await assert.rejects(
      () => verifyMn.createSession({ phone: '99112233', text: '482916' }),
      UnauthorizedException,
    );
  } finally {
    restore();
  }
});

// Bonus: fail loudly when the key is missing entirely (no network call).
test('createSession fails loudly when VERIFY_MN_API_KEY is missing', async () => {
  const verifyMn = new VerifyMnService(makeConfig({ VERIFY_MN_API_KEY: '' }));
  await assert.rejects(
    () => verifyMn.createSession({ phone: '99112233', text: '482916' }),
    InternalServerErrorException,
  );
});
