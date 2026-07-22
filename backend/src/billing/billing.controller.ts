import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CheckoutDto, RentDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../users/users.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.listPlans();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SafeUser) {
    return this.billing.mySubscription(user.id);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: SafeUser, @Body() dto: CheckoutDto) {
    return this.billing.checkout(user, dto.planId);
  }

  /** One-time rental purchase for a single title. */
  @Post('rent')
  @UseGuards(JwtAuthGuard)
  rent(@CurrentUser() user: SafeUser, @Body() dto: RentDto) {
    return this.billing.rentCheckout(user, dto.contentId);
  }

  /** The caller's rentals (active and expired). */
  @Get('rentals')
  @UseGuards(JwtAuthGuard)
  rentals(@CurrentUser() user: SafeUser) {
    return this.billing.myRentals(user.id);
  }

  @Post('payments/:id/check')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  check(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.billing.checkPayment(id, user);
  }

  /** Dev-only: settle a mock invoice. Rejected in production. */
  @Post('payments/:id/mock-pay')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  mockPay(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.billing.mockPay(id, user);
  }

  // wire.mn posts here when a payment intent settles. Verified by signature
  // against the raw body (see main.ts `rawBody: true`).
  @Post('wire/webhook')
  @HttpCode(HttpStatus.OK)
  wireWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('wirepayment-signature') signature: string,
    @Headers('x-forwarded-for') forwardedFor: string,
  ) {
    // Behind Render's proxy the real client IP is the first X-Forwarded-For hop.
    const clientIp = forwardedFor?.split(',')[0]?.trim() || req.ip;
    return this.billing.handleWireWebhook(
      req.rawBody ?? Buffer.from(''),
      signature,
      clientIp,
    );
  }
}
