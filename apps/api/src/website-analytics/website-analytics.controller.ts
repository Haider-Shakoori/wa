import { Body, Controller, Headers, HttpCode, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { RecordWebsiteViewDto } from './website-analytics.dto';
import { WebsiteAnalyticsService } from './website-analytics.service';

@Controller('website-events')
export class WebsiteEventsController {
  constructor(private readonly traffic: WebsiteAnalyticsService) {}

  /**
   * Private web-to-API lookup. Never accepts a visitor cookie or reports
   * this information to browser clients. Guarded by the same long random
   * internal token as the existing first-party event collector.
   */
  @Post('resolve-country')
  @HttpCode(200)
  async resolveCountry(
    @Headers('x-website-analytics-key') provided: string | undefined,
    @Body() body: { clientIp?: unknown },
  ) {
    this.assertInternalAnalyticsKey(provided);
    const countryCode=await this.traffic.resolveVisitorCountry(body?.clientIp);
    return { countryCode };
  }

  private assertInternalAnalyticsKey(provided: string | undefined) {
    const secret=process.env.WEBSITE_ANALYTICS_INGEST_KEY;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('Website analytics not configured');
    const received=Buffer.from(provided??'');
    const expected=Buffer.from(secret);
    if (received.length!==expected.length || !timingSafeEqual(received,expected)) {
      throw new UnauthorizedException('Invalid event collector credential');
    }
  }

  @Post('collect')
  @HttpCode(204)
  async collect(
    @Headers('x-website-analytics-key') provided: string | undefined,
    @Body() body: RecordWebsiteViewDto,
  ) {
    this.assertInternalAnalyticsKey(provided);
    await this.traffic.collect(body);
  }
}
