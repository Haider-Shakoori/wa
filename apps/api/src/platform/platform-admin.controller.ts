import { Controller, Get, UseGuards } from '@nestjs/common';
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

  @Get('workers')
  workers() { return this.platform.workers(); }

  @Get('queues')
  queues() { return this.platform.queues(); }

  @Get('errors')
  errors() { return this.platform.recentErrors(); }
}
