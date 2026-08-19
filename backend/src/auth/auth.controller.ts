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
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyRestartDto } from './dto/verify-restart.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshDto, LogoutDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SafeUser } from '../users/users.service';

// Endpoints that open a (paid) verify.mn session get a tighter rate limit;
// status polls run on the default global limit so 3s polling isn't blocked.
const VERIFY_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
// Login/reset are per-IP (trust proxy is set): tight enough to stop password
// spraying, loose enough not to lock out a NAT'd office/carrier of real users.
const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle(VERIFY_THROTTLE)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /** Poll while the user texts the code to 144773; returns tokens once verified. */
  @Get('verify/status/:sessionId')
  @HttpCode(HttpStatus.OK)
  verifyStatus(@Param('sessionId') sessionId: string) {
    return this.auth.verifyStatus(sessionId);
  }

  /** MO-SMS "resend": open a fresh session (e.g. after the code expired). */
  @Post('verify/restart')
  @HttpCode(HttpStatus.OK)
  @Throttle(VERIFY_THROTTLE)
  verifyRestart(@Body() dto: VerifyRestartDto) {
    return this.auth.restartVerification(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(LOGIN_THROTTLE)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(VERIFY_THROTTLE)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  /** Poll while the user proves phone ownership for a reset. */
  @Get('reset/status/:sessionId')
  @HttpCode(HttpStatus.OK)
  resetStatus(@Param('sessionId') sessionId: string) {
    return this.auth.resetStatus(sessionId);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(LOGIN_THROTTLE)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(VERIFY_THROTTLE)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  // Revokes the refresh token server-side so the session can't be resumed.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: SafeUser, @Body() dto: LogoutDto) {
    await this.auth.revokeRefreshToken(user.id, dto.refreshToken);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SafeUser) {
    return user;
  }
}
