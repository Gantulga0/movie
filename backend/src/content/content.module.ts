import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { SubscriptionGuard } from '../billing/guards/subscription.guard';

@Module({
  controllers: [ContentController],
  providers: [ContentService, SubscriptionGuard],
  exports: [ContentService],
})
export class ContentModule {}
