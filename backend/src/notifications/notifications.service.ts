import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

const PURPOSE_TITLES: Record<OtpPurpose, string> = {
  VERIFY: 'Бүртгэл баталгаажуулах код',
  RESET: 'Нууц үг сэргээх код',
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  private get appName(): string {
    return this.config.get<string>('APP_NAME', 'Infinite');
  }

  async sendOtp(
    target: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    code: string,
    ttlMinutes: number,
  ): Promise<void> {
    const title = PURPOSE_TITLES[purpose];

    if (channel === OtpChannel.SMS) {
      await this.sms.send(
        target,
        `${this.appName}: ${title} — ${code}. ${ttlMinutes} минутын дотор хүчинтэй.`,
      );
      return;
    }

    await this.email.send(
      target,
      `${this.appName} — ${title}`,
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#e50914;margin-bottom:4px">${this.appName}</h2>
        <p style="font-size:15px;color:#333">${title}:</p>
        <p style="font-size:34px;font-weight:bold;letter-spacing:10px;color:#111;margin:16px 0">${code}</p>
        <p style="font-size:13px;color:#777">
          Энэ код ${ttlMinutes} минутын дотор хүчинтэй.
          Хэрэв та энэ хүсэлтийг илгээгээгүй бол үл хэрэгсээрэй.
        </p>
      </div>`,
    );
  }
}
