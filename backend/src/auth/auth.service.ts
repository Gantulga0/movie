import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PhoneVerificationStatus, PhoneVerifyPurpose, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, SafeUser } from '../users/users.service';
import {
  PhoneVerificationService,
  VerificationPrompt,
} from '../phone-verify/phone-verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyRestartDto } from './dto/verify-restart.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

/** Returned by register/login: the account exists but the phone isn't confirmed. */
export interface PendingVerification {
  requiresVerification: true;
  verification: VerificationPrompt;
}

/** Polled by the client while it waits for the user's SMS to land. */
export interface VerifyStatusResult {
  status: PhoneVerificationStatus;
  verified: boolean;
  /** Present once verified: the tokens that sign the user in. */
  auth?: AuthResult;
}

/**
 * Phone ownership is proven with verify.mn Mobile-Originated SMS: the user texts
 * a per-session code to shortcode 144773 and the client polls a status endpoint.
 * There is no "we send you a code" OTP anymore — registration, the unverified-
 * login bounce, and password reset all run through this MO-SMS flow.
 */
@Injectable()
export class AuthService {
  /** A valid bcrypt hash no user password matches — compared against on the
   *  login "unknown identifier" path to keep response timing uniform. */
  private readonly dummyPasswordHash = bcrypt.hashSync(
    'login-timing-equalizer',
    12,
  );

  constructor(
    private readonly users: UsersService,
    private readonly phoneVerification: PhoneVerificationService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates the (unverified) account and opens a verify.mn session. The client
   * shows the returned code + "text it to 144773" prompt and polls
   * `verifyStatus`; a token is only issued once the SMS is confirmed.
   */
  async register(dto: RegisterDto): Promise<PendingVerification> {
    const existing = await this.users.findByPhone(dto.phone);
    // Only a *verified* account blocks the number. An unverified one means a
    // previous signup was never confirmed, so we let this attempt take it over
    // (below) instead of dead-ending the user on "already registered".
    if (existing?.verified) {
      throw new ConflictException('Энэ утасны дугаар аль хэдийн бүртгэлтэй байна');
    }

    if (dto.email) {
      const emailOwner = await this.users.findByEmail(dto.email);
      if (emailOwner && emailOwner.id !== existing?.id && emailOwner.verified) {
        throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = existing
      ? await this.users.reregister(existing.id, {
          name: dto.name ?? null,
          email: dto.email ?? null,
          passwordHash,
        })
      : await this.users.create({
          name: dto.name ?? null,
          phone: dto.phone,
          email: dto.email ?? null,
          passwordHash,
        });

    const verification = await this.phoneVerification.start(user.phone, {
      userId: user.id,
      purpose: PhoneVerifyPurpose.VERIFY,
    });
    return { requiresVerification: true, verification };
  }

  /**
   * Status of a verification session. Once verify.mn reports VERIFIED, marks the
   * linked account verified and returns the sign-in tokens. Safe to poll.
   */
  async verifyStatus(sessionId: string): Promise<VerifyStatusResult> {
    const { status, verified } = await this.phoneVerification.checkStatus(sessionId);
    if (!verified) return { status, verified: false };

    const row = await this.phoneVerification.find(sessionId);
    // Only a fresh, unconsumed VERIFY session mints sign-in tokens. A RESET
    // session belongs to the reset flow (never issues tokens here), a consumed
    // one is spent, and one verified long ago is stale — together these stop a
    // leaked sessionId from being replayed into an account takeover. The window
    // runs from verification (not session creation) so a slow texter isn't cut
    // off at the ~300s session boundary.
    const TOKEN_WINDOW_MS = 15 * 60 * 1000;
    const freshlyVerified =
      row?.verifiedAt != null
        ? Date.now() - row.verifiedAt.getTime() <= TOKEN_WINDOW_MS
        : row != null && row.expiresAt >= new Date();
    if (
      !row?.userId ||
      row.purpose !== PhoneVerifyPurpose.VERIFY ||
      row.consumedAt !== null ||
      !freshlyVerified
    ) {
      return { status, verified: true };
    }
    // Claim the session so it can issue tokens exactly once.
    const claimed = await this.phoneVerification.claim(sessionId);
    if (!claimed) {
      return { status, verified: true };
    }
    const user = await this.users.markVerified(row.userId);
    return { status, verified: true, auth: await this.buildResult(user) };
  }

  /** MO-SMS "resend": open a fresh session for the same phone (e.g. on expiry). */
  restartVerification(dto: VerifyRestartDto): Promise<VerificationPrompt> {
    return this.phoneVerification.restart(dto.sessionId);
  }

  async login(dto: LoginDto): Promise<AuthResult | PendingVerification> {
    const user = await this.users.findByIdentifier(dto.identifier.trim());
    // Always run one bcrypt comparison — against a fixed dummy hash when the
    // identifier is unknown — so login takes the same time whether or not the
    // account exists (no timing side-channel to enumerate users).
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyPasswordHash,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Нэвтрэх мэдээлэл буруу байна');
    }

    // Unverified accounts are bounced to the verify screen with a fresh session
    // so the client can show the code to text and start polling.
    if (!user.verified) {
      const verification = await this.phoneVerification
        .start(user.phone, { userId: user.id, purpose: PhoneVerifyPurpose.VERIFY })
        .catch(() => null);
      throw new ForbiddenException({
        statusCode: 403,
        error: 'ACCOUNT_NOT_VERIFIED',
        message: 'Бүртгэл баталгаажаагүй байна. Утсаа баталгаажуулна уу.',
        verification,
      });
    }

    return this.buildResult(user);
  }

  /**
   * Starts a reset by opening a verify.mn session for the account's phone. The
   * user proves ownership via SMS, then `resetPassword` sets the new password.
   * Requires the account to exist — we never open a (paid) session for an
   * unknown phone.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ verification: VerificationPrompt }> {
    const user = await this.users.findByIdentifier(dto.identifier.trim());
    if (!user) {
      throw new NotFoundException('Бүртгэлтэй хэрэглэгч олдсонгүй');
    }
    const verification = await this.phoneVerification.start(user.phone, {
      userId: user.id,
      purpose: PhoneVerifyPurpose.RESET,
    });
    return { verification };
  }

  /** Poll target for the reset screen — reports whether the SMS has landed. */
  resetStatus(sessionId: string): Promise<{ status: PhoneVerificationStatus; verified: boolean }> {
    return this.phoneVerification.checkStatus(sessionId);
  }

  /**
   * Applies the new password once its reset session is VERIFIED. Consuming the
   * session (one-time) proves phone ownership, so it also signs the user in.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<AuthResult> {
    const { userId, phone } = await this.phoneVerification.consume(
      dto.sessionId,
      PhoneVerifyPurpose.RESET,
    );
    // Resolve by the session's bound userId (reliable); fall back to the phone
    // only for legacy sessions that predate userId binding. Using userId avoids
    // phone-format mismatches ("99112233" vs "+97699112233") resolving wrong.
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : await this.users.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updated = await this.users.updatePassword(user.id, passwordHash);

    // Changing the password ends every existing session: revoke all refresh
    // tokens so a prior compromise can't keep refreshing after the reset.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // A successful reset also proves ownership of the phone.
    const verified = updated.verified ? updated : await this.users.markVerified(user.id);
    return this.buildResult(verified);
  }

  // -------------------------------------------------------------------------

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
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Сессийн хугацаа дууссан. Дахин нэвтэрнэ үү.');
    }
    // Reuse of an ALREADY-rotated token signals theft (the real client and the
    // thief both hold a copy of the same token). Kill the whole family so
    // neither side keeps a working session.
    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Сессийн хугацаа дууссан. Дахин нэвтэрнэ үү.');
    }
    // Rotation: retire the presented token before issuing the next one.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.buildResult(record.user);
  }

  /**
   * Log out the caller. Revokes the presented refresh token (scoped to the
   * user so nobody can revoke another account's token), or, if none is given,
   * every active token for the user — so logout always ends the session.
   */
  async revokeRefreshToken(userId: string, rawToken?: string): Promise<void> {
    await this.prisma.refreshToken
      .updateMany({
        where: rawToken
          ? { userId, tokenHash: this.hashToken(rawToken), revokedAt: null }
          : { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
}
