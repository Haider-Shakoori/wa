import { Controller, Get } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions/subscriptions.service';

@Controller()
export class AppController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get(['public/plans','v1/public/plans'])
  plans() {
    return this.subscriptions.listPlans();
  }

  @Get('health')
  health() {
    return {
      service: 'relaywa-api',
      brand: 'relayWA',
      status: 'ok',
      architecture: 'whatsapp-session-relay',
    };
  }
}
