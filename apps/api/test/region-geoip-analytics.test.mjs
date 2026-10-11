import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');

test('visitor GeoIP resolution is authenticated and read-only',async()=>{
  const controller=await read('../src/website-analytics/website-analytics.controller.ts');
  const service=await read('../src/website-analytics/website-analytics.service.ts');
  assert.match(controller,/@Post\('resolve-country'\)/);
  assert.match(controller,/@Headers\('x-website-analytics-key'\)/);
  assert.match(controller,/this\.assertInternalAnalyticsKey\(provided\)/);
  assert.match(controller,/timingSafeEqual\(received,expected\)/);
  assert.match(service,/async resolveVisitorCountry\(clientIp: unknown\)/);
  assert.match(service,/clientIp\.length > 45/);
  assert.match(service,/!isIP\(clientIp\)/);
  assert.match(service,/FROM website_geoip_ranges WHERE range_start <= \$1::inet/);
  assert.match(service,/lookup\.rows\[0\]\?\.country_code/);
  const block=service.slice(service.indexOf('async resolveVisitorCountry'),service.indexOf('async collect'));
  assert.doesNotMatch(block,/INSERT|UPDATE|DELETE|http:|https:|fetch\(/);
});

test('first-party page collector remains unchanged and no public unauthenticated country resolution',async()=>{
  const controller=await read('../src/website-analytics/website-analytics.controller.ts');
  const service=await read('../src/website-analytics/website-analytics.service.ts');
  assert.match(controller,/@Post\('collect'\)/);
  assert.match(controller,/this\.assertInternalAnalyticsKey\(provided\)/);
  assert.match(service,/async collect\(view: WebsiteView\)/);
  assert.doesNotMatch(controller,/@Get\('resolve-country'\)/);
});
