import { Module } from '@nestjs/common';
import { BotsController } from './bots.controller';
import { StripeProvider } from '../payments/stripe.provider';
import { BotsService } from './bots.service';

@Module({controllers:[BotsController],providers:[BotsService,StripeProvider]})
export class BotsModule {}
