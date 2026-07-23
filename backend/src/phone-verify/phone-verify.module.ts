import { Module } from '@nestjs/common';
import { PhoneVerifyController } from './phone-verify.controller';
import { PhoneVerificationService } from './phone-verification.service';
import { VerifyMnService } from './verify-mn.service';

// PrismaModule and ConfigModule are global, so no imports are needed here.
@Module({
  controllers: [PhoneVerifyController],
  providers: [PhoneVerificationService, VerifyMnService],
  // Exported so other modules (auth, billing) can call verifyPhone() directly.
  exports: [PhoneVerificationService],
})
export class PhoneVerifyModule {}
