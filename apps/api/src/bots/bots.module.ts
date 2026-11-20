import { Module } from '@nestjs/common';
import { BotsController, PlatformBotSubscriptionsController } from './bots.controller';
import { StripeProvider } from '../payments/stripe.provider';
import { BotsService } from './bots.service';

@Module({controllers:[BotsController,PlatformBotSubscriptionsController],providers:[BotsService,StripeProvider]})
export class BotsModule {}
