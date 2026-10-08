import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { WebsiteAnalyticsModule } from '../website-analytics/website-analytics.module';
import { GoogleAnalyticsReportingService } from './google-analytics-reporting.service';

@Module({
  imports:[WebsiteAnalyticsModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService, GoogleAnalyticsReportingService],
})
export class PlatformAdminModule {}
