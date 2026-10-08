import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(file)=>readFile(new URL(file,import.meta.url),'utf8');

test('crawler verification uses local CIDR index and no request-time network access',async()=>{
 const service=await read('../src/website-analytics/website-analytics.service.ts');
 const migration=await read('../migrations/034_website_bot_verification.sql');
 const importer=await read('../scripts/refresh-website-bot-ranges.mjs');
 const collector=service.slice(service.indexOf('  async collect('),service.indexOf('  async report('));
 assert.match(collector,/website_bot_ranges/);
 assert.match(collector,/website_bot_range_sources/);
 assert.match(collector,/refreshed_at>now\(\)-interval '48 hours'/);
 assert.match(collector,/\$2::inet <<= address_range/);
 assert.match(collector,/bot_verification/);
 assert.doesNotMatch(collector,/\bfetch\(|\blookup\(|dns\.reverse|https:\/\//);
 assert.match(migration,/USING GIST \(address_range inet_ops\)/);
 assert.match(importer,/google\.com/);
 assert.match(importer,/bingbot\.json/);
 assert.match(importer,/applebot\.json/);
 assert.match(importer,/TRUNCATE|DELETE FROM website_bot_ranges/);
});

test('exclusion audit flag survives reports but does not pollute geo or human visitor metrics',async()=>{
 const service=await read('../src/website-analytics/website-analytics.service.ts');
 const schema=await read('../migrations/034_website_bot_verification.sql');
 assert.match(service,/if \(!view\.isExcluded && country==='ZZ'/);
 assert.match(service,/is_excluded/);
 assert.match(service,/excluded_hits/);
 assert.match(service,/AND NOT v\.is_excluded/);
 assert.match(schema,/website_pageviews/);
});
