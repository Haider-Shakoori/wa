import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      service: 'wa-api',
      status: 'ok',
      architecture: 'wasender-style-session-gateway',
    };
  }
}
