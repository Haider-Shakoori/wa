import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PhoneVerificationController, MetaPhoneVerificationWebhookController } from './phone-verification.controller';
import { PhoneVerificationService } from './phone-verification.service';

@Module({
  imports: [AuthModule],
  controllers: [PhoneVerificationController, MetaPhoneVerificationWebhookController],
  providers: [PhoneVerificationService],
})
export class PhoneVerificationModule {}
