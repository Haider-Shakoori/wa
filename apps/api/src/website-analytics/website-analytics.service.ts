import { Injectable, BadRequestException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { isIP } from 'node:net';

export type WebsiteView = {
  visitorKey: string;
  path: string;
  countryCode: string;
  clientIp?: string | null;
  isExcluded?: boolean;
  trafficType: 'human' | 'bot' | 'suspected_bot';
  botFamily?: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'other';
  referrerHost?: string | null;
};

@Injectable()
export class WebsiteAnalyticsService implements OnModuleInit, OnModuleDestroy {
  private pruneTimer?: ReturnType<typeof setInterval>;
  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    // Rolling 90-day retention; once daily, without changing API response times.
    this.pruneTimer=setInterval(()=>void this.pruneOldEvents(),24*60*60*1000);
    this.pruneTimer.unref();
  }

  onModuleDestroy() {
    if(this.pruneTimer)clearInterval(this.pruneTimer);
  }

  private async pruneOldEvents() {
    try {
      await this.db.query(`DELETE FROM website_pageviews
        WHERE visit_day < (now() AT TIME ZONE 'UTC')::date - 90`);
    } catch (error) {
      console.error('[website-analytics] retention cleanup failed:',error instanceof Error?error.message:'database error');
    }
  }

  async collect(view: WebsiteView) {
    // Keyed daily visitor hash is generated in the website server;
    // raw IP addresses, browser fingerprints and query strings never reach storage.
    let country=view.countryCode;
    if (!view.isExcluded && country==='ZZ' && view.clientIp && isIP(view.clientIp)) {
      const lookup=await this.db.query<{country_code:string}>(`SELECT country_code
        FROM website_geoip_ranges WHERE range_start <= $1::inet AND range_end >= $1::inet
        ORDER BY range_start DESC LIMIT 1`,[view.clientIp]);
      country=lookup.rows[0]?.country_code?.trim()??'ZZ';
    }
    let verification:'verified'|'unverified'|'not_checked'='not_checked';
    // A single local indexed query for declared Google/Bing/Apple crawlers.
    // No DNS lookups or network access on page load or in the event collector.
    if(!view.isExcluded && view.trafficType==='bot' && view.clientIp &&
       isIP(view.clientIp) && ['Googlebot','Bingbot','Applebot'].includes(view.botFamily??'')) {
      const check=await this.db.query<{status:'verified'|'unverified'|'not_checked'}>(`
        SELECT CASE WHEN EXISTS(
          SELECT 1 FROM website_bot_range_sources
          WHERE family=$1 AND refreshed_at>now()-interval '48 hours'
        ) THEN CASE WHEN EXISTS(
          SELECT 1 FROM website_bot_ranges
          WHERE family=$1 AND $2::inet <<= address_range
        ) THEN 'verified' ELSE 'unverified' END
        ELSE 'not_checked' END AS status`,[view.botFamily,view.clientIp]);
      verification=check.rows[0]?.status??'not_checked';
    }
    await this.db.query(`INSERT INTO website_pageviews
      (visitor_key,path,country_code,traffic_type,bot_family,device_type,referrer_host,
       is_excluded,bot_verification)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
        view.visitorKey, view.path, country,
        view.trafficType, view.botFamily ?? null,
        view.deviceType, view.referrerHost ?? null,
        view.isExcluded===true, verification,
      ]);
  }

  async report(daysInput: string | undefined) {
    const days = Number(daysInput ?? 30);
    if (![7, 30, 90].includes(days)) {
      throw new BadRequestException('Days must be 7, 30, or 90');
    }
    // Visitors are estimated distinct per UTC day, not cross-day identities.
    const [summary, trend, countries, bots, botCountries, pages, sources, devices] = await Promise.all([
      this.db.query(`SELECT count(*) FILTER (WHERE NOT is_excluded)::int AS pageviews,
        count(*) FILTER (WHERE traffic_type='human' AND NOT is_excluded)::int AS human_pageviews,
        count(*) FILTER (WHERE traffic_type='bot' AND NOT is_excluded)::int AS declared_bot_hits,
        count(*) FILTER (WHERE traffic_type='suspected_bot' AND NOT is_excluded)::int AS suspected_bot_hits,
        count(*) FILTER (WHERE bot_verification='verified' AND NOT is_excluded)::int AS verified_bot_hits,
        count(*) FILTER (WHERE bot_verification='unverified' AND NOT is_excluded)::int AS unverified_bot_hits,
        count(*) FILTER (WHERE is_excluded)::int AS excluded_hits,
        count(DISTINCT (visit_day, visitor_key)) FILTER (WHERE traffic_type='human' AND NOT is_excluded)::int AS daily_unique_visitors
        FROM website_pageviews WHERE visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)`,[days]),
      this.db.query(`SELECT to_char(d.day::date,'YYYY-MM-DD') AS day,
        count(v.id) FILTER (WHERE v.traffic_type='human')::int AS human,
        count(v.id) FILTER (WHERE v.traffic_type='bot')::int AS bots,
        count(v.id) FILTER (WHERE v.traffic_type='suspected_bot')::int AS suspected,
        count(DISTINCT v.visitor_key) FILTER (WHERE v.traffic_type='human')::int AS unique_visitors
        FROM generate_series((now() AT TIME ZONE 'UTC')::date - ($1::int-1),
          (now() AT TIME ZONE 'UTC')::date,interval '1 day') d(day)
        LEFT JOIN website_pageviews v ON v.visit_day=d.day::date AND NOT v.is_excluded
        GROUP BY d.day ORDER BY d.day`,[days]),
      this.db.query(`SELECT country_code,
        count(*) FILTER (WHERE traffic_type='human')::int AS human,
        count(*) FILTER (WHERE traffic_type='bot')::int AS bots,
        count(*) FILTER (WHERE traffic_type='suspected_bot')::int AS suspected,
        count(DISTINCT (visit_day,visitor_key)) FILTER (WHERE traffic_type='human')::int AS daily_unique_visitors
        FROM website_pageviews WHERE NOT is_excluded AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY country_code ORDER BY count(*) DESC LIMIT 50`,[days]),
      this.db.query(`SELECT bot_family, count(*)::int AS hits,
        count(DISTINCT country_code)::int AS countries
        FROM website_pageviews WHERE NOT is_excluded AND traffic_type IN ('bot','suspected_bot')
          AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY bot_family ORDER BY hits DESC LIMIT 25`,[days]),
      this.db.query(`SELECT coalesce(bot_family,'Other automation') AS bot_family,
        country_code, count(*)::int AS hits
        FROM website_pageviews WHERE NOT is_excluded AND traffic_type<>'human'
          AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY bot_family,country_code ORDER BY hits DESC LIMIT 80`,[days]),
      this.db.query(`SELECT path,
        count(*) FILTER (WHERE traffic_type='human')::int AS human,
        count(*) FILTER (WHERE traffic_type<>'human')::int AS automated
        FROM website_pageviews WHERE NOT is_excluded AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY path ORDER BY count(*) DESC LIMIT 25`,[days]),
      this.db.query(`SELECT coalesce(referrer_host,'Direct / unknown') AS source,
        count(*)::int AS hits FROM website_pageviews
        WHERE NOT is_excluded AND traffic_type='human' AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY source ORDER BY hits DESC LIMIT 15`,[days]),
      this.db.query(`SELECT device_type, count(*)::int AS hits FROM website_pageviews
        WHERE NOT is_excluded AND traffic_type='human' AND visit_day >= (now() AT TIME ZONE 'UTC')::date - ($1::int-1)
        GROUP BY device_type ORDER BY hits DESC`,[days]),
    ]);
    return {
      days, since: new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0,10),
      generatedAt: new Date().toISOString(),
      summary: summary.rows[0], trend:trend.rows, countries:countries.rows,
      bots:bots.rows, botCountries:botCountries.rows, pages:pages.rows, sources:sources.rows, devices:devices.rows,
      note:'First-party server page requests; visitors are approximate daily unique hashes. Bot identities are user-agent claims. Googlebot, Bingbot and Applebot claims can be checked against official IP ranges (verified, unverified or not checked). Unverified does not necessarily mean spoofed. Country is derived from the local offline IP country dataset or a configured trusted CDN header; Unknown indicates missing or unresolvable location.',
    };
  }
}
