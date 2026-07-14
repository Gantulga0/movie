import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { EntitlementGuard } from '../billing/guards/entitlement.guard';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [ContentController],
  providers: [ContentService, EntitlementGuard],
  exports: [ContentService],
})
export class ContentModule {}
