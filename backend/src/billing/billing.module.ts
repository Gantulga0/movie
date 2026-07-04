import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { QpayService } from './qpay.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, QpayService],
  exports: [BillingService],
})
export class BillingModule {}
