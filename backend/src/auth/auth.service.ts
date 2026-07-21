import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { OtpChannel, OtpPurpose, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, SafeUser } from '../users/users.service';
import { OtpService, OtpIssueResult } from '../otp/otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface PendingVerification {
  requiresVerification: true;
  otp: OtpIssueResult;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates the (unverified) account and texts an OTP to the phone. The
   * client moves to the verify screen; a token is only issued after
   * verify-otp succeeds.
   */
  async register(dto: RegisterDto): Promise<PendingVerification> {
    const [phoneTaken, emailTaken] = await Promise.all([
      this.users.findByPhone(dto.phone),
      dto.email ? this.users.findByEmail(dto.email) : null,
    ]);
    if (phoneTaken) {
      throw new ConflictException('Энэ утасны дугаар аль хэдийн бүртгэлтэй байна');
    }
    if (emailTaken) {
      throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.create({
      name: dto.name ?? null,
      phone: dto.phone,
      email: dto.email ?? null,
      passwordHash,
    });

    const issued = await this.issueOtpFor(user, OtpPurpose.VERIFY);
    return { requiresVerification: true, otp: issued };
  }

  /** Confirms the OTP, marks the account verified and signs the user in. */
  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResult> {
    const user = await this.users.findByIdentifier(dto.identifier);
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }

    await this.otp.verify(this.otpTarget(user), OtpPurpose.VERIFY, dto.code);

    const verified = user.verified ? user : await this.users.markVerified(user.id);
    return this.buildResult(verified);
  }

  async resendOtp(dto: ResendOtpDto): Promise<OtpIssueResult> {
    const user = await this.users.findByIdentifier(dto.identifier);
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }
    const purpose = dto.purpose ?? OtpPurpose.VERIFY;
    if (purpose === OtpPurpose.VERIFY && user.verified) {
      throw new ConflictException('Бүртгэл аль хэдийн баталгаажсан байна');
    }
    return this.issueOtpFor(user, purpose);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByIdentifier(dto.identifier.trim());
    if (!user) {
      throw new UnauthorizedException('Нэвтрэх мэдээлэл буруу байна');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Нэвтрэх мэдээлэл буруу байна');
    }

    // Unverified accounts are bounced to the verify screen; a fresh code is
    // sent automatically so the client only has to collect it.
    if (!user.verified) {
      const issued = await this.issueOtpFor(user, OtpPurpose.VERIFY).catch(
        () => null,
      );
      throw new ForbiddenException({
        statusCode: 403,
        error: 'ACCOUNT_NOT_VERIFIED',
        message: 'Бүртгэл баталгаажаагүй байна. Баталгаажуулах код илгээлээ.',
        otp: issued,
      });
    }

    return this.buildResult(user);
  }

  /**
   * Sends a password-reset code. Always responds success-shaped so account
   * existence can't be probed — but when the user exists the code is real.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ sent: boolean; otp?: OtpIssueResult }> {
    const user = await this.users.findByIdentifier(dto.identifier.trim());
    if (!user) {
      return { sent: true };
    }
    const issued = await this.issueOtpFor(user, OtpPurpose.RESET);
    return { sent: true, otp: issued };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<AuthResult> {
    const user = await this.users.findByIdentifier(dto.identifier.trim());
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }

    await this.otp.verify(this.otpTarget(user), OtpPurpose.RESET, dto.code);

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updated = await this.users.updatePassword(user.id, passwordHash);

    // A successful reset also proves ownership of the phone.
    const verified = updated.verified ? updated : await this.users.markVerified(user.id);
    return this.buildResult(verified);
  }

  // -------------------------------------------------------------------------

  /** Codes go to the phone; email is only a fallback if SMS has no target. */
  private otpTarget(user: User): string {
    return user.phone ?? user.email ?? '';
  }

  private issueOtpFor(user: User, purpose: OtpPurpose): Promise<OtpIssueResult> {
    const viaSms = Boolean(user.phone);
    return this.otp.issue(
      viaSms ? user.phone : (user.email ?? ''),
      viaSms ? OtpChannel.SMS : OtpChannel.EMAIL,
      purpose,
    );
  }

  private async buildResult(user: User): Promise<AuthResult> {
    const accessToken = this.jwt.sign(
      { sub: user.id, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        // Short-lived access token; the refresh token keeps the user signed in.
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '30m'),
      },
    );
    const refreshToken = await this.issueRefreshToken(user.id);
    return { user: UsersService.sanitize(user), accessToken, refreshToken };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Mint an opaque refresh token, storing only its hash. */
  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const days =
      Number(this.config.get<string>('JWT_REFRESH_EXPIRES_DAYS', '30')) || 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(raw), expiresAt },
    });
    return raw;
  }

  /**
   * Exchange a valid refresh token for a fresh access + refresh pair. The
   * presented token is single-use (rotated), so a stolen one stops working the
   * moment the real client refreshes.
   */
  async refresh(rawToken: string): Promise<AuthResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token шаардлагатай');
    }
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Сессийн хугацаа дууссан. Дахин нэвтэрнэ үү.');
    }
    // Rotation: retire the presented token before issuing the next one.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.buildResult(record.user);
  }

  /** Revoke a refresh token on logout. Silent if it's already gone. */
  async revokeRefreshToken(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken
      .updateMany({
        where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
}
