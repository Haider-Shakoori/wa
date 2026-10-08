import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type WebsiteView = {
  visitorKey: string;
  path: string;
  countryCode: string;
  trafficType: 'human' | 'bot' | 'suspected_bot';
  botFamily?: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'other';
  referrerHost?: string | null;
};

@Injectable()
export class WebsiteAnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  async collect(view: WebsiteView) {
    // Keyed daily visitor hash is generated in the website server;
    // raw IP addresses, browser fingerprints and query strings never reach storage.
    await this.db.query(`INSERT INTO website_pageviews
      (visitor_key,path,country_code,traffic_type,bot_family,device_type,referrer_host)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
        view.visitorKey, view.path, view.countryCode,
        view.trafficType, view.botFamily ?? null,
        view.deviceType, view.referrerHost ?? null,
      ]);
  }

  async report(daysInput: string | undefined) {
    const days = Number(daysInput ?? 30);
    if (![7, 30, 90].includes(days)) {
      throw new BadRequestException('Days must be 7, 30, or 90');
    }
    // Visitors are estimated distinct per UTC day, not cross-day identities.
    const [summary, trend, countries, bots, pages, sources, devices] = await Promise.all([
      this.db.query(`SELECT count(*)::int AS pageviews,
        count(*) FILTER (WHERE traffic_type='human')::int AS human_pageviews,
        count(*) FILTER (WHERE traffic_type='bot')::int AS declared_bot_hits,
        count(*) FILTER (WHERE traffic_type='suspected_bot')::int AS suspected_bot_hits,
        count(DISTINCT (visit_day, visitor_key)) FILTER (WHERE traffic_type='human')::int AS daily_unique_visitors
        FROM website_pageviews WHERE visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)`,[days]),
      this.db.query(`SELECT to_char(d.day::date,'YYYY-MM-DD') AS day,
        count(v.id) FILTER (WHERE v.traffic_type='human')::int AS human,
        count(v.id) FILTER (WHERE v.traffic_type='bot')::int AS bots,
        count(v.id) FILTER (WHERE v.traffic_type='suspected_bot')::int AS suspected,
        count(DISTINCT v.visitor_key) FILTER (WHERE v.traffic_type='human')::int AS unique_visitors
        FROM generate_series((now() AT TIME ZONE 'UTC')::date - ($1::int-1),
          (now() AT TIME ZONE 'UTC')::date,interval '1 day') d(day)
        LEFT JOIN website_pageviews v ON v.visit_day=d.day::date
        GROUP BY d.day ORDER BY d.day`,[days]),
      this.db.query(`SELECT country_code,
        count(*) FILTER (WHERE traffic_type='human')::int AS human,
        count(*) FILTER (WHERE traffic_type='bot')::int AS bots,
        count(*) FILTER (WHERE traffic_type='suspected_bot')::int AS suspected,
        count(DISTINCT (visit_day,visitor_key)) FILTER (WHERE traffic_type='human')::int AS daily_unique_visitors
        FROM website_pageviews WHERE visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY country_code ORDER BY count(*) DESC LIMIT 50`,[days]),
      this.db.query(`SELECT bot_family, count(*)::int AS hits,
        count(DISTINCT country_code)::int AS countries
        FROM website_pageviews WHERE traffic_type IN ('bot','suspected_bot')
          AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY bot_family ORDER BY hits DESC LIMIT 25`,[days]),
      this.db.query(`SELECT path,
        count(*) FILTER (WHERE traffic_type='human')::int AS human,
        count(*) FILTER (WHERE traffic_type<>'human')::int AS automated
        FROM website_pageviews WHERE visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY path ORDER BY count(*) DESC LIMIT 25`,[days]),
      this.db.query(`SELECT coalesce(referrer_host,'Direct / unknown') AS source,
        count(*)::int AS hits FROM website_pageviews
        WHERE traffic_type='human' AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY source ORDER BY hits DESC LIMIT 15`,[days]),
      this.db.query(`SELECT device_type, count(*)::int AS hits FROM website_pageviews
        WHERE traffic_type='human' AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY device_type ORDER BY hits DESC`,[days]),
    ]);
    return {
      days, since: new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0,10),
      generatedAt: new Date().toISOString(),
      summary: summary.rows[0], trend:trend.rows, countries:countries.rows,
      bots:bots.rows, pages:pages.rows, sources:sources.rows, devices:devices.rows,
      note:'First-party server page requests; visitors are approximate daily unique hashes. Bots are user-agent based, not independently verified. Country is Unknown unless a trusted CDN country header is configured.',
    };
  }
}
