import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface QpayInvoice {
  invoiceId: string;
  qrText: string | null;
  /** Base64 PNG of the QR code (QPay returns it inline). */
  qrImage: string | null;
  /** Bank deep-links returned by QPay. */
  urls: Array<{ name: string; description: string; link: string }>;
  shortUrl: string | null;
  mock: boolean;
}

export interface QpayCheckResult {
  paid: boolean;
  paidAmount: number;
  transactionId: string | null;
}

/**
 * QPay v2 merchant API client.
 *
 * Runs in MOCK mode until QPAY_USERNAME/QPAY_PASSWORD/QPAY_INVOICE_CODE are
 * set — invoices get a fake id and payments are confirmed via the dev-only
 * mock-pay endpoint. Switching to real QPay = filling the env vars.
 */
@Injectable()
export class QpayService {
  private readonly logger = new Logger(QpayService.name);
  private token?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  get isMock(): boolean {
    return !this.config.get('QPAY_USERNAME');
  }

  private get baseUrl(): string {
    return this.config
      .get<string>('QPAY_BASE_URL', 'https://merchant.qpay.mn')
      .replace(/\/$/, '');
  }

  // ------------------------------------------------------------------ auth

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }

    const username = this.config.get<string>('QPAY_USERNAME', '');
    const password = this.config.get<string>('QPAY_PASSWORD', '');
    const res = await fetch(`${this.baseUrl}/v2/auth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      },
    });
    if (!res.ok) {
      this.logger.error(`QPay auth failed: ${res.status} ${await res.text()}`);
      throw new InternalServerErrorException('Төлбөрийн систем холбогдсонгүй');
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return this.token.value;
  }

  // --------------------------------------------------------------- invoice

  async createInvoice(params: {
    paymentId: string;
    userPublicId: string;
    amount: number;
    description: string;
  }): Promise<QpayInvoice> {
    if (this.isMock) {
      return {
        invoiceId: `MOCK-${params.paymentId}`,
        qrText: `MOCK-QPAY:${params.paymentId}:${params.amount}`,
        qrImage: null,
        urls: [],
        shortUrl: null,
        mock: true,
      };
    }

    const token = await this.getToken();
    const callbackBase = this.config.get<string>('QPAY_CALLBACK_URL', '');
    const res = await fetch(`${this.baseUrl}/v2/invoice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice_code: this.config.get<string>('QPAY_INVOICE_CODE'),
        sender_invoice_no: params.paymentId,
        invoice_receiver_code: params.userPublicId,
        invoice_description: params.description,
        amount: params.amount,
        callback_url: `${callbackBase}?paymentId=${params.paymentId}`,
      }),
    });
    if (!res.ok) {
      this.logger.error(`QPay invoice failed: ${res.status} ${await res.text()}`);
      throw new InternalServerErrorException('Нэхэмжлэл үүсгэж чадсангүй');
    }

    const data = (await res.json()) as {
      invoice_id: string;
      qr_text?: string;
      qr_image?: string;
      qPay_shortUrl?: string;
      urls?: Array<{ name: string; description: string; link: string }>;
    };
    return {
      invoiceId: data.invoice_id,
      qrText: data.qr_text ?? null,
      qrImage: data.qr_image ?? null,
      urls: data.urls ?? [],
      shortUrl: data.qPay_shortUrl ?? null,
      mock: false,
    };
  }

  // ----------------------------------------------------------------- check

  async checkPayment(invoiceId: string): Promise<QpayCheckResult> {
    if (this.isMock) {
      // Mock invoices are only ever settled through the mock-pay endpoint.
      return { paid: false, paidAmount: 0, transactionId: null };
    }

    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/v2/payment/check`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 },
      }),
    });
    if (!res.ok) {
      this.logger.error(`QPay check failed: ${res.status} ${await res.text()}`);
      throw new InternalServerErrorException('Төлбөр шалгаж чадсангүй');
    }

    const data = (await res.json()) as {
      paid_amount?: number;
      rows?: Array<{ payment_id: string; payment_status: string }>;
    };
    const paidRow = data.rows?.find((r) => r.payment_status === 'PAID');
    return {
      paid: Boolean(paidRow),
      paidAmount: data.paid_amount ?? 0,
      transactionId: paidRow?.payment_id ?? null,
    };
  }
}
