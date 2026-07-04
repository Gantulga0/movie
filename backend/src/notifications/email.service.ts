import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * SMTP email sender. When SMTP_* env vars are missing the service runs in
 * dev mode and logs the message to the console instead of sending it.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get('SMTP_HOST') && this.config.get('SMTP_USER'),
    );
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: Number(this.config.get('SMTP_PORT', 587)),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
    return this.transporter;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.configured) {
      this.logger.warn(`[DEV EMAIL] to=${to} subject="${subject}"\n${html}`);
      return;
    }
    await this.getTransporter().sendMail({
      from: this.config.get<string>(
        'SMTP_FROM',
        this.config.get<string>('SMTP_USER', ''),
      ),
      to,
      subject,
      html,
    });
  }
}
