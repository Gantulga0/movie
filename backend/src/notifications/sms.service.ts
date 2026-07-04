import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS sender with pluggable providers, selected via SMS_PROVIDER.
 *
 * - "console" (default): logs the message — used until a real gateway is set.
 * - "messagepro": Mongolian SMS gateway (messagepro.mn). Needs SMS_API_KEY
 *   and SMS_FROM (the short number).
 *
 * Adding a provider = add a case in `send`; callers never change.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return this.config.get('SMS_PROVIDER', 'console') !== 'console';
  }

  async send(to: string, text: string): Promise<void> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'console');

    switch (provider) {
      case 'messagepro':
        return this.sendMessagePro(to, text);
      case 'console':
      default:
        this.logger.warn(`[DEV SMS] to=${to} text="${text}"`);
        return;
    }
  }

  private async sendMessagePro(to: string, text: string): Promise<void> {
    const key = this.config.get<string>('SMS_API_KEY', '');
    const from = this.config.get<string>('SMS_FROM', '');
    const url = new URL('https://api.messagepro.mn/send');
    url.searchParams.set('key', key);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to.replace(/^\+976/, ''));
    url.searchParams.set('text', text);

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`SMS send failed (${res.status}): ${body}`);
      throw new Error('SMS delivery failed');
    }
  }
}
