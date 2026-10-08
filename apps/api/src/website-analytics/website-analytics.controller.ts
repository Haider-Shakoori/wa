import { Body, Controller, Headers, HttpCode, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { RecordWebsiteViewDto } from './website-analytics.dto';
import { WebsiteAnalyticsService } from './website-analytics.service';

@Controller('website-events')
export class WebsiteEventsController {
  constructor(private readonly traffic: WebsiteAnalyticsService) {}

  @Post('collect')
  @HttpCode(204)
  async collect(
    @Headers('x-website-analytics-key') provided: string | undefined,
    @Body() body: RecordWebsiteViewDto,
  ) {
    const secret=process.env.WEBSITE_ANALYTICS_INGEST_KEY;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('Website analytics not configured');
    const received=Buffer.from(provided??'');
    const expected=Buffer.from(secret);
    if (received.length!==expected.length || !timingSafeEqual(received,expected)) {
      throw new UnauthorizedException('Invalid event collector credential');
    }
    await this.traffic.collect(body);
  }
}
