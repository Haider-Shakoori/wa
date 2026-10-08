import { Module } from '@nestjs/common';
import { WebsiteEventsController } from './website-analytics.controller';
import { WebsiteAnalyticsService } from './website-analytics.service';

@Module({
  controllers:[WebsiteEventsController],
  providers:[WebsiteAnalyticsService],
  exports:[WebsiteAnalyticsService],
})
export class WebsiteAnalyticsModule {}
