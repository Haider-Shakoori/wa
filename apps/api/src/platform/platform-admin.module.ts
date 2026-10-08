import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { WebsiteAnalyticsModule } from '../website-analytics/website-analytics.module';

@Module({
  imports:[WebsiteAnalyticsModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
