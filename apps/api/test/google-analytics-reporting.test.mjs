import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('GA4 reports require platform-admin guards and never expose service-account credentials', async () => {
  const controller = await read('../src/platform/platform-admin.controller.ts');
  const module = await read('../src/platform/platform-admin.module.ts');
  const service = await read('../src/platform/google-analytics-reporting.service.ts');
  const signer = await read('../src/platform/ga4-service-account.ts');

  assert.match(controller, /@UseGuards\(JwtAuthGuard, PlatformAdminGuard\)/);
  assert.match(controller, /@Get\('google-analytics'\)/);
  assert.match(module, /GoogleAnalyticsReportingService/);
  assert.match(service, /GA4_SERVICE_ACCOUNT_FILE/);
  assert.match(service, /GA4_SERVICE_ACCOUNT_JSON/);
  assert.match(signer, /relaywa-analytics@relaywa-analytics\.iam\.gserviceaccount\.com/);
  assert.match(signer, /analytics\.readonly/);
  assert.match(signer, /crypto\.subtle\.sign/);
  assert.match(signer, /crypto\.subtle\.importKey/);
  assert.match(signer, /AbortSignal\.timeout/);
  assert.match(service, /status: 'not_configured'/);
  assert.match(service, /status: 'error'/);
  assert.doesNotMatch(service + signer, /NEXT_PUBLIC_|console\.log\(.*token|console\.log\(.*private_key/);
});

test('GA4 reads real reports, not mocked traffic, with caching and restricted time windows', async () => {
  const source = await read('../src/platform/google-analytics-reporting.service.ts');
  assert.match(source, /558119248/);
  assert.match(source, /\[7, 30, 90\]/);
  assert.match(source, /reportCache/);
  assert.match(source, /reportInFlight/);
  assert.match(source, /:runReport/);
  assert.match(source, /:runRealtimeReport/);
  assert.match(source, /activeUsers/);
  assert.match(source, /screenPageViews/);
  assert.match(source, /sessionDefaultChannelGroup/);
  assert.match(source, /engagementRate/);
});


test('GA4 service account is portable and no Google credential leaks into client bundles', async () => {
  const signer = await read('../src/platform/ga4-service-account.ts');
  const service = await read('../src/platform/google-analytics-reporting.service.ts');
  assert.match(signer, /export async function getGa4AccessToken/);
  assert.match(signer, /RSASSA-PKCS1-v1_5/);
  assert.match(signer, /service_account/);
  assert.match(signer, /private_key/);
  assert.doesNotMatch(signer, /from ['"]node:/);
  assert.match(service, /GA4_SERVICE_ACCOUNT_FILE/);
  assert.match(service, /GA4_SERVICE_ACCOUNT_JSON/);
  assert.doesNotMatch(service, /NEXT_PUBLIC_GA4_SERVICE_ACCOUNT_JSON/);
});
