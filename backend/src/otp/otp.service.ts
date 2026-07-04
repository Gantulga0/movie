import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { generateOtpCode } from '../common/ids';

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
/** Minimum seconds between two codes for the same target+purpose. */
const RESEND_COOLDOWN_SECONDS = 60;

export interface OtpIssueResult {
  target: string;
  channel: OtpChannel;
  expiresInMinutes: number;
  /** The raw code — only exposed outside production for testing. */
  devCode?: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private get isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  /** Create a fresh code, invalidating any previous ones for this purpose. */
  async issue(
    target: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
  ): Promise<OtpIssueResult> {
    const recent = await this.prisma.otp.findFirst({
      where: {
        target,
        purpose,
        consumedAt: null,
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
      },
    });
    if (recent) {
      throw new BadRequestException(
        `Код аль хэдийн илгээгдсэн. ${RESEND_COOLDOWN_SECONDS} секундын дараа дахин оролдоно уу.`,
      );
    }

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);

    await this.prisma.$transaction([
      // Old unconsumed codes die the moment a new one is issued.
      this.prisma.otp.deleteMany({ where: { target, purpose, consumedAt: null } }),
      this.prisma.otp.create({
        data: {
          target,
          channel,
          purpose,
          codeHash,
          expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
        },
      }),
    ]);

    await this.notifications.sendOtp(target, channel, purpose, code, OTP_TTL_MINUTES);

    return {
      target,
      channel,
      expiresInMinutes: OTP_TTL_MINUTES,
      ...(this.isProduction ? {} : { devCode: code }),
    };
  }

  /** Check a submitted code; consumes it on success. Throws on any failure. */
  async verify(target: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.prisma.otp.findFirst({
      where: { target, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Код олдсонгүй. Шинэ код авна уу.');
    }
    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('Кодын хугацаа дууссан. Шинэ код авна уу.');
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Хэт олон буруу оролдлого. Шинэ код авна уу.',
      );
    }

    const valid = await bcrypt.compare(code, otp.codeHash);
    if (!valid) {
      await this.prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Код буруу байна.');
    }

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
}
