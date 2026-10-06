import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
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
