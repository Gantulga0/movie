import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { WireService } from './wire.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, WireService],
  exports: [BillingService],
})
export class BillingModule {}
