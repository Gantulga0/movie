import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { MeController } from './me.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
