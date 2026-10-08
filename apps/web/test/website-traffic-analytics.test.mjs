import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(file)=>readFile(new URL(file,import.meta.url),'utf8');

test('server-side proxy records crawler pages without exposing secret or query parameters',async()=>{
  const proxy=await read('../proxy.ts');
  assert.match(proxy,/export function proxy\(/);
  assert.match(proxy,/event\.waitUntil\(/);
  assert.match(proxy,/createHmac\('sha256',secret\)/);
  assert.match(proxy,/WEBSITE_ANALYTICS_INGEST_KEY/);
  assert.match(proxy,/\bgooglebot\b/i);
  assert.match(proxy,/\bchatgpt-user\b/i);
  assert.match(proxy,/countryFromTrustedHeader/);
  assert.match(proxy,/request\.nextUrl\.pathname\.slice\(0,240\)/);
  assert.doesNotMatch(proxy,/request\.nextUrl\.searchParams|localStorage|document\.cookie/);
});

test('mobile platform navigation offers separate website analytics, including countries and bots',async()=>{
  const page=await read('../app/platform/page.tsx');
  const analytics=await read('../components/platform-website-traffic.tsx');
  assert.match(page,/Website traffic/);
  assert.match(page,/PlatformWebsiteTraffic/);
  assert.match(analytics,/countryName/);
  assert.match(analytics,/Declared crawler hits/);
  assert.match(analytics,/Suspected automated hits/);
  assert.match(analytics,/Daily unique visitors/);
  assert.match(analytics,/Unknown \/ unavailable/);
  assert.match(analytics,/7,30,90/);
});

test('crawler countries are available as a cross-tabulated report',async()=>{
 const screen=await read('../components/platform-website-traffic.tsx');
 assert.match(screen,/Bot activity by country/);
 assert.match(screen,/botCountries/);
});
