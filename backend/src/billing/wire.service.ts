import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/** What the client needs to complete a payment. */
export interface PaymentInvoice {
  /** Provider reference used for polling — wire.mn PaymentIntent id. */
  invoiceId: string;
  qrText: string | null;
  qrImage: string | null;
  urls: Array<{
    name: string;
    description: string;
    link: string;
    logo?: string;
  }>;
  shortUrl: string | null;
  /** Hosted-checkout URL to redirect to; null in mock mode. */
  checkoutUrl: string | null;
  mock: boolean;
}

export interface PaymentCheckResult {
  paid: boolean;
  paidAmount: number;
  transactionId: string | null;
}

/** The QR payload wire returns after confirm (QPay-style). */
interface WireNextAction {
  type?: string;
  qr?: {
    text?: string;
    image_url?: string;
    deeplinks?: Array<{
      name: string;
      description: string;
      logo?: string;
      link: string;
    }>;
  };
}

/** Subset of the wire.mn PaymentIntent object we rely on. */
interface WirePaymentIntent {
  id: string;
  status: string;
  amount?: number;
  next_action?: Record<string, unknown> | null;
}

/** A verified webhook event. `data` carries the affected resource. */
export interface WireEvent {
  type: string;
  data: Record<string, unknown> & { object?: Record<string, unknown> };
}

/**
 * wire.mn (api.wirepayment.mn) gateway client.
 *
 * Flow: create a PaymentIntent, confirm it (wire dispatches to an operator
 * such as QPay), then hand the customer the `next_action` redirect URL.
 * Settlement is confirmed by the `payment_intent.succeeded` webhook and by
 * polling the intent status (`succeeded`).
 *
 * Runs in MOCK mode until WIRE_API_KEY is set — no real network calls, and
 * payments are settled through the dev-only mock-pay endpoint. Switching to
 * real wire.mn = filling the env vars.
 */
@Injectable()
export class WireService {
  private readonly logger = new Logger(WireService.name);

  constructor(private readonly config: ConfigService) {}

  get isMock(): boolean {
    return !this.config.get('WIRE_API_KEY');
  }

  private get baseUrl(): string {
    return this.config.get<string>('WIRE_BASE_URL', 'https://api.wire.mn/v1').replace(/\/$/, '');
  }

  private get apiKey(): string {
    return this.config.get<string>('WIRE_API_KEY', '');
  }

  /** Source IPs wire.mn sends webhooks from; empty env disables the check. */
  private get allowedIps(): string[] {
    return this.config
      .get<string>('WIRE_WEBHOOK_IP', '65.109.117.186')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Rejects webhook deliveries from any IP other than wire.mn's. */
  assertAllowedIp(ip: string | undefined): void {
    const allowed = this.allowedIps;
    if (allowed.length === 0) return; // check disabled (e.g. local dev)
    // Express reports IPv4 over IPv6 as "::ffff:1.2.3.4" — strip the prefix.
    const normalized = (ip ?? '').replace(/^::ffff:/, '');
    if (!allowed.includes(normalized)) {
      this.logger.warn(`wire webhook from disallowed ip: ${ip}`);
      throw new ForbiddenException('Webhook эх сурвалж зөвшөөрөгдөөгүй');
    }
  }

  // -------------------------------------------------------------- checkout

  async createCheckout(params: {
    paymentId: string;
    amount: number;
    description: string;
    successUrl: string;
    cancelUrl?: string;
  }): Promise<PaymentInvoice> {
    if (this.isMock) {
      // No hosted page in mock mode — the client falls back to the mock-pay
      // button, just like QPay's mock invoices.
      return {
        invoiceId: `MOCK-WIRE-${params.paymentId}`,
        qrText: `MOCK-WIRE:${params.paymentId}:${params.amount}`,
        qrImage: null,
        urls: [],
        shortUrl: null,
        checkoutUrl: null,
        mock: true,
      };
    }

    // 1. Create the intent. amount is whole MNT ₮ (wire routes to QPay/bank
    //    operators, which all work in whole tögrög). metadata keeps our id.
    const intent = await this.request<WirePaymentIntent>(
      'POST',
      '/payment_intents',
      {
        amount: params.amount,
        currency: 'MNT',
        description: params.description,
        automatic_operator: true,
        metadata: { paymentId: params.paymentId },
      },
      `pi-${params.paymentId}`
    );

    // 2. Confirm → wire dispatches to an operator and returns next_action,
    //    which carries how the customer completes payment (a redirect URL).
    const confirmed = await this.request<WirePaymentIntent>(
      'POST',
      `/payment_intents/${intent.id}/confirm`,
      { return_url: params.successUrl },
      `confirm-${params.paymentId}`
    );

    // wire returns a QPay-style QR payload: a QR image, its raw text, and a
    // list of bank-app deeplinks. The client renders these in-app (no redirect).
    const action = (confirmed.next_action ?? intent.next_action) as WireNextAction | null;
    const qr = action?.qr;
    if (!qr) {
      this.logger.warn(
        `wire confirm: no qr in next_action. status=${confirmed.status} ` +
          `full=${JSON.stringify(confirmed)}`
      );
    }

    // image_url is a full data URI ("data:image/png;base64,…"); the client
    // re-adds that prefix, so store the bare base64 payload only.
    const img = qr?.image_url ?? '';
    const qrImage = img.startsWith('data:') ? img.slice(img.indexOf(',') + 1) : img || null;

    return {
      invoiceId: intent.id,
      qrText: qr?.text ?? null,
      qrImage,
      urls: (qr?.deeplinks ?? []).map((d) => ({
        name: d.name,
        description: d.description,
        link: d.link,
        logo: d.logo,
      })),
      shortUrl: null,
      checkoutUrl: null,
      mock: false,
    };
  }

  // ----------------------------------------------------------------- check

  async checkPayment(intentId: string): Promise<PaymentCheckResult> {
    if (this.isMock) {
      return { paid: false, paidAmount: 0, transactionId: null };
    }

    const intent = await this.request<WirePaymentIntent>('GET', `/payment_intents/${intentId}`);

    const paid = intent.status === 'succeeded';
    return {
      paid,
      // amount is whole ₮, matching the stored payment amount directly.
      paidAmount: paid ? (intent.amount ?? 0) : 0,
      transactionId: intentId,
    };
  }

  // -------------------------------------------------------------- webhook

  /**
   * Verifies a webhook delivery against its `WirePayment-Signature` header
   * and returns the parsed event. Throws on any signature mismatch — the
   * caller must not act on an unverified body.
   */
  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): WireEvent {
    const secret = this.config.get<string>('WIRE_WEBHOOK_SECRET', '');
    if (!secret || !signatureHeader) {
      throw new BadRequestException('Гарын үсэг дутуу байна');
    }

    // Header form: "t=1717000000,v1=5257a869e7ec..."
    const parts = new Map(
      signatureHeader.split(',').map((kv) => {
        const [k, v] = kv.split('=');
        return [k.trim(), (v ?? '').trim()] as const;
      })
    );
    const t = parts.get('t');
    const v1 = parts.get('v1');
    if (!t || !v1) {
      throw new BadRequestException('Гарын үсэг буруу байна');
    }

    const expected = createHmac('sha256', secret)
      .update(`${t}.${rawBody.toString('utf8')}`)
      .digest('hex');

    const a = Buffer.from(v1, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Гарын үсэг таарсангүй');
    }

    return JSON.parse(rawBody.toString('utf8')) as WireEvent;
  }

  // -------------------------------------------------------------- internal

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      // Transport-level failure (DNS, TLS, wrong/empty base URL) — never
      // reached the server, so there's no HTTP status to read. undici puts
      // the real reason (ENOTFOUND, ECONNREFUSED, …) on `.cause`.
      const err = e as Error & { cause?: unknown };
      const cause = err.cause instanceof Error ? err.cause.message : String(err.cause ?? '');
      this.logger.error(`wire ${method} ${url} network error: ${err.message} ${cause}`);
      throw new InternalServerErrorException(
        `wire.mn-руу холбогдсонгүй (${this.baseUrl || 'BASE URL хоосон'})`
      );
    }
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`wire ${method} ${path} failed: ${res.status} ${text}`);
      // Surface wire's own error code/message so the reason is visible while
      // setting the gateway up (e.g. operator not connected, amount invalid).
      let detail = `${res.status}`;
      try {
        const parsed = JSON.parse(text) as {
          error?: { code?: string; message?: string };
        };
        if (parsed.error) {
          detail = [parsed.error.code, parsed.error.message].filter(Boolean).join(': ');
        }
      } catch {
        if (text) detail = text.slice(0, 200);
      }
      throw new InternalServerErrorException(`wire.mn: ${detail}`);
    }
    return (await res.json()) as T;
  }
}
