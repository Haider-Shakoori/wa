import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UpdatePlatformSubscriptionDto } from './platform-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Controller('v1/platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platform: PlatformAdminService) {}

  @Get('overview')
  overview() { return this.platform.overview(); }

  @Get('tenants')
  tenants() { return this.platform.tenants(); }

  @Get('sessions')
  sessions() { return this.platform.sessions(); }

  @Get('subscriptions')
  subscriptions() { return this.platform.subscriptions(); }

  @Post('sessions/:sessionId/connect')
  connectSession(@Param('sessionId') sessionId: string) {
    return this.platform.sessionAction(sessionId, 'connect');
  }

  @Post('sessions/:sessionId/restart')
  restartSession(@Param('sessionId') sessionId: string) {
    return this.platform.sessionAction(sessionId, 'restart');
  }

  @Post('sessions/:sessionId/logout')
  logoutSession(@Param('sessionId') sessionId: string) {
    return this.platform.sessionAction(sessionId, 'logout');
  }

  @Patch('subscriptions/:organizationId')
  updateSubscription(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdatePlatformSubscriptionDto,
  ) {
    return this.platform.updateSubscription(organizationId, body);
  }

  @Get('workers')
  workers() { return this.platform.workers(); }

  @Get('queues')
  queues() { return this.platform.queues(); }

  @Get('payments')
  payments() { return this.platform.payments(); }

  @Get('errors')
  errors() { return this.platform.recentErrors(); }
}
