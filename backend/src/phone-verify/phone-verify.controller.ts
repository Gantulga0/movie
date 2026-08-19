import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../users/users.service';
import { PhoneVerificationService } from './phone-verification.service';
import { VerifyMnService } from './verify-mn.service';

// Opening a session sends the user an SMS prompt — throttle like the OTP routes.
const START_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('phone-verify')
export class PhoneVerifyController {
  constructor(
    private readonly verification: PhoneVerificationService,
    private readonly verifyMn: VerifyMnService,
  ) {}

  /** Open a verify.mn session and return the SMS prompt to show the user. */
  @Post('start')
  @UseGuards(JwtAuthGuard)
  @Throttle(START_THROTTLE)
  start(@CurrentUser() user: SafeUser) {
    // Always verify the account's OWN phone — never a client-supplied number.
    // Otherwise a user could mark their account "verified" with a burner phone.
    return this.verification.start(user.phone, { userId: user.id });
  }

  /** Client polls this to learn whether the user's SMS has landed. */
  @Get('status/:sessionId')
  @UseGuards(JwtAuthGuard)
  async status(
    @CurrentUser() user: SafeUser,
    @Param('sessionId') sessionId: string,
  ) {
    // Scope the lookup to the caller so one user can't poll another's session.
    return this.verification.checkStatusForUser(sessionId, user.id);
  }

  /**
   * verify.mn calls this (bare GET, no body, no signature) when the SMS
   * arrives. Only a wake-up hint — the service re-checks the real status. Must
   * answer 2xx fast, so we do a single quick status GET and return. Callers
   * from outside verify.mn's IPs get 403 (whitelist).
   */
  @Get('callback/:ref')
  @HttpCode(HttpStatus.OK)
  callback(@Param('ref') ref: string, @Req() req: Request) {
    // `trust proxy` (main.ts) makes req.ip the real client, not a spoofable
    // X-Forwarded-For hop — the only control on this unauthenticated route.
    this.verifyMn.assertAllowedIp(req.ip);
    return this.verification.handleCallback(ref);
  }
}
