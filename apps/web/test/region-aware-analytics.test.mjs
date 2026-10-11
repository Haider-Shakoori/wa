import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const EEA = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  'IS','LI','NO',
];

test('EEA 30, UK and Switzerland require consent; verified Afghanistan does not', async () => {
  const compiled = ts.transpileModule(await read('../lib/regional-analytics-policy.ts'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const exports = {};
  runInNewContext(compiled,{exports});
  const decide = exports.resolveRegionalAnalyticsPolicy;
  for(const code of [...EEA,'GB','UK','CH']) {
    assert.equal(decide(code),'consent',code);
    assert.equal(decide(code.toLowerCase()),'consent',code+' lower-case');
  }
  assert.equal(EEA.length,30);
  for(const code of ['AF','PK','IN','US','BR','AE','SA','NG','ID','MX','ZA']) {
    assert.equal(decide(code),'auto',code);
  }
  for(const country of ['',null,undefined,'ZZ','XX','EU','AP','T1','A1','???','AF,CH']) {
    assert.equal(decide(country),'consent',String(country));
  }
});

test('visitor country is read only through attested ingress and authenticated internal offline lookup', async () => {
  const route=await read('../app/analytics-policy/route.ts');
  const api=await read('../../api/src/website-analytics/website-analytics.controller.ts');
  const database=await read('../../api/src/website-analytics/website-analytics.service.ts');
  const env=await read('../../../.env.example');
  assert.match(route,/GA4_REGION_IP_LOOKUP_ENABLED === 'true'/);
  assert.match(route,/GA4_REGION_PROXY_SECRET/);
  assert.match(route,/timingSafeEqual/);
  assert.match(route,/request\.headers\.get\('x-forwarded-for'\)/);
  assert.match(route,/isIP\(ip\)/);
  assert.match(route,/WEBSITE_ANALYTICS_INGEST_KEY/);
  assert.match(route,/website-events\/resolve-country/);
  assert.match(route,/signal:AbortSignal\.timeout\(1800\)/);
  assert.match(route,/private, no-store/);
  assert.match(route,/NextResponse\.json\(\{ policy \}/);
  assert.doesNotMatch(route,/request\.nextUrl\.searchParams\.get\('country'/);
  assert.match(api,/@Post\('resolve-country'\)/);
  assert.match(api,/this\.assertInternalAnalyticsKey\(provided\)/);
  assert.match(database,/async resolveVisitorCountry\(clientIp: unknown\)/);
  assert.match(database,/FROM website_geoip_ranges WHERE range_start/);
  assert.match(env,/^GA4_REGION_IP_LOOKUP_ENABLED=false$/m);
  assert.match(env,/^GA4_REGION_PROXY_SECRET=$/m);
});

test('old explicit declines remain stronger than country automatic decisions and sensitive routes are excluded',async()=>{
  const tracker=await read('../components/google-analytics.tsx');
  const privateRegistry=await read('../lib/public-pages.ts');
  assert.match(tracker,/storedChoice \?\?/);
  assert.match(tracker,/regionPolicy === 'auto'/);
  assert.match(tracker,/setStoredChoice\(value\)/);
  assert.match(tracker,/setShowPreferences\(true\)/);
  assert.match(tracker,/fetch\('\/analytics-policy'/);
  assert.match(tracker,/\.catch\(\(\) => 'consent'/);
  assert.match(tracker,/isIndexablePublicPath/);
  assert.match(privateRegistry,/isIndexablePublicPath/);
  assert.doesNotMatch(tracker,/ad_storage: 'granted'/);
});
