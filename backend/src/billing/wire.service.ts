import {
  BadRequestException,
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
  urls: Array<{ name: string; description: string; link: string }>;
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

/** A verified webhook event (Stripe-style envelope). */
export interface WireEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * wire.mn unified payment gateway client.
 *
 * Uses the hosted-checkout flow: create a PaymentIntent, open a checkout
 * session, and redirect the customer to wire's hosted page (QR + bank
 * deeplinks live there). Settlement is confirmed by the
 * `payment_intent.succeeded` webhook and by polling the intent status.
 *
 * Runs in MOCK mode until WIRE_API_KEY is set — no real network calls, and
 * payments are settled through the dev-only mock-pay endpoint, exactly like
 * the QPay mock. Switching to real wire.mn = filling the env vars.
 */
@Injectable()
export class WireService {
  private readonly logger = new Logger(WireService.name);

  constructor(private readonly config: ConfigService) {}

  get isMock(): boolean {
    return !this.config.get('WIRE_API_KEY');
  }

  private get baseUrl(): string {
    return this.config
      .get<string>('WIRE_BASE_URL', 'https://api.wire.mn/v1')
      .replace(/\/$/, '');
  }

  private get apiKey(): string {
    return this.config.get<string>('WIRE_API_KEY', '');
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

    // 1. PaymentIntent — amount is in minor units (×100), unlike QPay.
    const intent = await this.request<{ id: string }>(
      'POST',
      '/payment_intents',
      {
        amount: params.amount * 100,
        currency: 'MNT',
        description: params.description,
        idempotency_key: `pi-${params.paymentId}`,
      },
      `pi-${params.paymentId}`,
    );

    // 2. Hosted checkout session for that intent.
    const session = await this.request<{ url: string }>(
      'POST',
      '/checkout/sessions',
      {
        payment_intent: intent.id,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      },
      `sess-${params.paymentId}`,
    );

    return {
      invoiceId: intent.id,
      qrText: null,
      qrImage: null,
      urls: [],
      shortUrl: null,
      checkoutUrl: session.url,
      mock: false,
    };
  }

  // ----------------------------------------------------------------- check

  async checkPayment(intentId: string): Promise<PaymentCheckResult> {
    if (this.isMock) {
      return { paid: false, paidAmount: 0, transactionId: null };
    }

    const intent = await this.request<{
      status: string;
      amount?: number;
      amount_received?: number;
      latest_charge?: string;
    }>('GET', `/payment_intents/${intentId}`);

    const paid = intent.status === 'succeeded';
    const minor = intent.amount_received ?? intent.amount ?? 0;
    return {
      paid,
      // Back to whole ₮ to compare against the stored payment amount.
      paidAmount: paid ? Math.round(minor / 100) : 0,
      transactionId: intent.latest_charge ?? intentId,
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
      }),
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
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      this.logger.error(
        `wire ${method} ${path} failed: ${res.status} ${await res.text()}`,
      );
      throw new InternalServerErrorException('Төлбөрийн систем холбогдсонгүй');
    }
    return (await res.json()) as T;
  }
}
