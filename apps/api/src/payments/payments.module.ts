import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BotsService } from '../bots/bots.service';
import { StripeProvider } from './stripe.provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeProvider, BotsService],
})
export class PaymentsModule {}
