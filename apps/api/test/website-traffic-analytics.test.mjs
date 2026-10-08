import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(file)=>readFile(new URL(file,import.meta.url),'utf8');

test('visitor collector is key protected, validates payload and does not persist raw IP or UA',async()=>{
  const controller=await read('../src/website-analytics/website-analytics.controller.ts');
  const service=await read('../src/website-analytics/website-analytics.service.ts');
  const dto=await read('../src/website-analytics/website-analytics.dto.ts');
  const schema=await read('../migrations/033_website_traffic_analytics.sql');
  assert.match(controller,/WEBSITE_ANALYTICS_INGEST_KEY/);
  assert.match(controller,/timingSafeEqual/);
  assert.match(controller,/UnauthorizedException/);
  assert.match(dto,/@IsIP\(\)/);
  assert.match(dto,/@Matches\(\/\^\[a-f0-9\]\{64\}\$\/\)/);
  assert.match(service,/INSERT INTO website_pageviews/);
  assert.match(service,/website_geoip_ranges/);
  assert.doesNotMatch(schema,/\bip_address\b|\buser_agent\b|\bquery_string\b/);
  assert.match(schema,/visitor_key char\(64\)/);
  assert.match(schema,/country_code char\(2\)/);
});

test('report offers country breakdowns, bots, visitor trends and bounded windows under platform auth',async()=>{
  const service=await read('../src/website-analytics/website-analytics.service.ts');
  const controller=await read('../src/platform/platform-admin.controller.ts');
  const platformModule=await read('../src/platform/platform-admin.module.ts');
  assert.match(controller,/@Get\('website-traffic'\)/);
  assert.match(controller,/@UseGuards\(JwtAuthGuard, PlatformAdminGuard\)/);
  assert.match(platformModule,/WebsiteAnalyticsModule/);
  assert.match(service,/\[7, 30, 90\]/);
  assert.match(service,/count\(DISTINCT \(visit_day, visitor_key\)\)/);
  assert.match(service,/GROUP BY country_code/);
  assert.match(service,/GROUP BY bot_family/);
  assert.match(service,/GROUP BY path/);
  assert.match(service,/GROUP BY source/);
});

test('country import is offline at request time and includes IPv4 and IPv6',async()=>{
 const importer=await read('../scripts/import-website-geoip.mjs');
 const service=await read('../src/website-analytics/website-analytics.service.ts');
 assert.match(importer,/ip2country-v4.tsv.gz/);
 assert.match(importer,/ip2country-v6.tsv.gz/);
 assert.match(importer,/TRUNCATE website_geoip_ranges/);
 assert.match(importer,/INSERT INTO website_geoip_ranges SELECT/);
 assert.match(service,/range_start <= \$1::inet AND range_end >= \$1::inet/);
});
