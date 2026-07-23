import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../users/users.service';
import { PhoneVerificationService } from './phone-verification.service';
import { StartVerificationDto } from './dto/start-verification.dto';

// Opening a session sends the user an SMS prompt — throttle like the OTP routes.
const START_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('phone-verify')
export class PhoneVerifyController {
  constructor(private readonly verification: PhoneVerificationService) {}

  /** Open a verify.mn session and return the SMS prompt to show the user. */
  @Post('start')
  @UseGuards(JwtAuthGuard)
  @Throttle(START_THROTTLE)
  start(@CurrentUser() user: SafeUser, @Body() dto: StartVerificationDto) {
    return this.verification.start(dto.phone, { userId: user.id });
  }

  /** Client polls this to learn whether the user's SMS has landed. */
  @Get('status/:sessionId')
  @UseGuards(JwtAuthGuard)
  status(@Param('sessionId') sessionId: string) {
    return this.verification.checkStatus(sessionId);
  }

  /**
   * verify.mn calls this (bare GET, no body, no signature) when the SMS
   * arrives. Only a wake-up hint — the service re-checks the real status. Must
   * answer 2xx fast, so we do a single quick status GET and return.
   */
  @Get('callback/:ref')
  @HttpCode(HttpStatus.OK)
  callback(@Param('ref') ref: string) {
    return this.verification.handleCallback(ref);
  }
}
