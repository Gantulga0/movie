import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';
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
    return this.billing.checkout(user, dto.planId, dto.method);
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

  // QPay calls this server-to-server after the customer pays.
  @Get('callback')
  callbackGet(@Query('paymentId') paymentId: string) {
    return this.billing.handleCallback(paymentId);
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  callbackPost(@Query('paymentId') paymentId: string) {
    return this.billing.handleCallback(paymentId);
  }
}
