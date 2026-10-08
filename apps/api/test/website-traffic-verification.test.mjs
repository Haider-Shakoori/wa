import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('verified bot identity checks only occur for supported agents and use local CIDRs',async()=>{
 const service=await read('../src/website-analytics/website-analytics.service.ts');
 const migration=await read('../migrations/034_website_bot_verification.sql');
 assert.match(service,/\['Googlebot','Bingbot','Applebot'\]/);
 assert.match(service,/family=\$1 AND \$2::inet <<= address_range/);
 assert.match(service,/refreshed_at>now\(\)-interval '48 hours'/);
 assert.match(service,/not_checked/);
 assert.match(service,/isExcluded/);
 assert.match(migration,/is_excluded boolean NOT NULL DEFAULT false/);
 assert.match(migration,/bot_verification/);
 assert.match(migration,/address_range cidr/);
 assert.match(migration,/PRIMARY KEY\(family,address_range\)/);
 const collector=service.slice(service.indexOf('  async collect('),service.indexOf('  async report('));
 assert.doesNotMatch(collector, /fetch\(|lookup\(|reverse\(|dns\.resolve/);
});
test('official CIDRs are imported outside page handling, with failure rollback and source freshness',async()=>{
 const importer=await read('../scripts/refresh-website-bot-ranges.mjs');
 assert.match(importer,/common-crawlers\.json/);
 assert.match(importer,/bingbot\.json/);
 assert.match(importer,/applebot\.json/);
 assert.match(importer,/AbortSignal\.timeout\(15000\)/);
 assert.match(importer,/ROLLBACK/);
 assert.match(importer,/Retained prior/);
});
test('excluded traffic leaves audit totals but is omitted from country, trends and device totals',async()=>{
 const service=await read('../src/website-analytics/website-analytics.service.ts');
 assert.match(service,/count\(\*\) FILTER \(WHERE is_excluded\)::int AS excluded_hits/);
 assert.match(service,/WHERE NOT is_excluded AND visit_day/);
 assert.match(service,/LEFT JOIN website_pageviews v ON v.visit_day=d.day::date AND NOT v.is_excluded/);
 assert.match(service,/WHERE NOT is_excluded AND traffic_type='human'/);
});
