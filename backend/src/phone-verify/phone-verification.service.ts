import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhoneVerificationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { generateOtpCode } from '../common/ids';
import { VerifyMnService, VerifySession } from './verify-mn.service';

/** verify.mn phone numbers are 8-16 digits (bare, no leading +). */
const PHONE_RE = /^[0-9]{8,16}$/;
/** verify.mn sessions live ~300s; never wait longer than this regardless. */
const MAX_WAIT_MS = 300_000;

/** The subset of a session the client needs to render the SMS prompt. */
export interface VerificationPrompt {
  sessionId: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

/**
 * Drives a verify.mn MO-SMS verification end to end.
 *
 * `verifyPhone()` is the blocking convenience: open a session, then poll until
 * the user's SMS lands (VERIFIED) or the session expires. For an interactive
 * UI, use `start()` to show the prompt, let the callback / `checkStatus()`
 * report progress, and read the stored row when done.
 */
@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly verifyMn: VerifyMnService,
  ) {}

  /** Seconds between status polls; overridable for tests. Default 3000ms. */
  private get pollIntervalMs(): number {
    return this.config.get<number>('VERIFY_MN_POLL_INTERVAL_MS', 3000);
  }

  /**
   * Public https base verify.mn should call back on when the SMS arrives, e.g.
   * "https://api.example.com/api". Empty ⇒ poll-only (recommended for dev): we
   * never register a fake URL, since verify.mn retries failed callbacks.
   */
  private get callbackBase(): string {
    return this.config.get<string>('VERIFY_MN_CALLBACK_BASE', '').replace(/\/$/, '');
  }

  /**
   * Callback URL for a session, keyed by our own `ref` (the row id we mint
   * before creation). verify.mn's callback is a bare GET with no body, so the
   * URL itself must identify the session — and the verify.mn sessionId does not
   * exist until POST returns, so we use a ref we control. Undefined ⇒ no public
   * base configured ⇒ poll only (we never register a fake URL).
   */
  private callbackUrlFor(ref: string): string | undefined {
    const base = this.callbackBase;
    if (!base) return undefined;
    return `${base}/phone-verify/callback/${encodeURIComponent(ref)}`;
  }

  private normalizePhone(phone: string): string {
    // Accept the app's "+976xxxxxxxx" / spaced forms, hand verify.mn bare digits.
    const bare = phone.replace(/^\+/, '').replace(/\D/g, '');
    if (!PHONE_RE.test(bare)) {
      throw new BadRequestException('Утасны дугаар буруу байна (8-16 орон).');
    }
    return bare;
  }

  // ---------------------------------------------------------------- start

  /**
   * Opens a session and stores it (optionally linked to a user/order id).
   * Returns the prompt to show the user. Does not wait for the SMS.
   */
  async start(phone: string, opts?: { userId?: string }): Promise<VerificationPrompt> {
    const normalized = this.normalizePhone(phone);
    // Fresh 4-6 digit numeric code per session (6-digit, never reused).
    const code = generateOtpCode();
    // Our stable handle, known before creation so it can go in the callback URL.
    const ref = randomUUID();

    const session: VerifySession = await this.verifyMn.createSession({
      phone: normalized,
      text: code,
      callback: this.callbackUrlFor(ref),
    });

    await this.prisma.phoneVerification.create({
      data: {
        id: ref,
        sessionId: session.sessionId,
        phone: normalized,
        code,
        userId: opts?.userId,
        status: PhoneVerificationStatus.PENDING,
        expiresAt: new Date(session.expiresAt),
      },
    });

    this.logger.log(
      `verify.mn session ${session.sessionId} for ${normalized}: ${session.displayInstruction}`,
    );

    return {
      sessionId: session.sessionId,
      smsUri: session.smsUri,
      displayInstruction: session.displayInstruction,
      expiresAt: session.expiresAt,
    };
  }

  // --------------------------------------------------------------- verify

  /**
   * Blocking verify: open a session for `phone`, then poll every ~3s until the
   * user's SMS is confirmed (VERIFIED → true) or the session expires / times
   * out (→ false).
   */
  async verifyPhone(phone: string, opts?: { userId?: string }): Promise<boolean> {
    const prompt = await this.start(phone, opts);

    // Show `prompt.displayInstruction` to the user via your UI before this
    // resolves — the code is sent from their phone, not by us.
    const deadline = Math.min(
      new Date(prompt.expiresAt).getTime(),
      Date.now() + MAX_WAIT_MS,
    );

    while (Date.now() < deadline) {
      const state = await this.verifyMn.getSession(prompt.sessionId);

      if (state.sessionStatus === 'VERIFIED') {
        await this.markVerified(prompt.sessionId, state.verifiedAt);
        return true;
      }
      if (state.sessionStatus === 'EXPIRED') {
        await this.markExpired(prompt.sessionId);
        return false;
      }

      await this.delay(this.pollIntervalMs);
    }

    // Deadline reached while still PENDING.
    await this.markExpired(prompt.sessionId);
    this.logger.warn(`verify.mn session ${prompt.sessionId} timed out (still PENDING)`);
    return false;
  }

  // ------------------------------------------------------------- callback

  /**
   * Handle a verify.mn callback (a bare GET wake-up — no body, no signature),
   * keyed by the `ref` we embedded in the callback URL. The callback is only a
   * "check now" hint, so we re-verify via GET /sessions/{id} and update the row.
   * The caller must return 2xx fast; this stays a single quick GET.
   */
  async handleCallback(ref: string): Promise<{ status: PhoneVerificationStatus }> {
    const row = await this.prisma.phoneVerification.findUnique({ where: { id: ref } });
    if (!row) {
      // Unknown ref — nothing to do, but still answer 2xx so verify.mn does not
      // keep retrying a callback we can't act on.
      this.logger.warn(`verify.mn callback for unknown ref ${ref}`);
      return { status: PhoneVerificationStatus.PENDING };
    }
    return { status: await this.recheck(row.sessionId, row.status) };
  }

  /**
   * On-demand status for a client that polls our API instead of blocking.
   * Reads the stored row and, while still pending, re-checks verify.mn.
   */
  async checkStatus(sessionId: string): Promise<{ status: PhoneVerificationStatus; verified: boolean }> {
    const row = await this.prisma.phoneVerification.findUnique({ where: { sessionId } });
    if (!row) throw new BadRequestException('Session олдсонгүй');

    const status = await this.recheck(row.sessionId, row.status);
    return { status, verified: status === PhoneVerificationStatus.VERIFIED };
  }

  /**
   * Re-derive a row's status: returns the stored one if already settled;
   * otherwise asks verify.mn and persists the result.
   */
  private async recheck(
    sessionId: string,
    current: PhoneVerificationStatus,
  ): Promise<PhoneVerificationStatus> {
    if (current !== PhoneVerificationStatus.PENDING) return current;

    const state = await this.verifyMn.getSession(sessionId);
    if (state.sessionStatus === 'VERIFIED') {
      await this.markVerified(sessionId, state.verifiedAt);
      return PhoneVerificationStatus.VERIFIED;
    }
    if (state.sessionStatus === 'EXPIRED') {
      await this.markExpired(sessionId);
      return PhoneVerificationStatus.EXPIRED;
    }
    return PhoneVerificationStatus.PENDING;
  }

  // ------------------------------------------------------------- internal

  private async markVerified(sessionId: string, verifiedAt: string | null): Promise<void> {
    await this.prisma.phoneVerification.update({
      where: { sessionId },
      data: {
        status: PhoneVerificationStatus.VERIFIED,
        verifiedAt: verifiedAt ? new Date(verifiedAt) : new Date(),
      },
    });
    this.logger.log(`verify.mn session ${sessionId} VERIFIED`);
  }

  private async markExpired(sessionId: string): Promise<void> {
    await this.prisma.phoneVerification.update({
      where: { sessionId },
      data: { status: PhoneVerificationStatus.EXPIRED },
    });
  }

  /** setTimeout as a promise; isolated so tests can shrink the poll interval. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
