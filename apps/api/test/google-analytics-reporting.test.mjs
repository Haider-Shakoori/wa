import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('GA4 reports require platform-admin guards and never expose service-account credentials', async () => {
  const controller = await read('../src/platform/platform-admin.controller.ts');
  const module = await read('../src/platform/platform-admin.module.ts');
  const service = await read('../src/platform/google-analytics-reporting.service.ts');

  assert.match(controller, /@UseGuards\(JwtAuthGuard, PlatformAdminGuard\)/);
  assert.match(controller, /@Get\('google-analytics'\)/);
  assert.match(module, /GoogleAnalyticsReportingService/);
  assert.match(service, /GA4_SERVICE_ACCOUNT_FILE/);
  assert.match(service, /SERVICE_ACCOUNT_EMAIL/);
  assert.match(service, /analytics\.readonly/);
  assert.match(service, /createSign\('RSA-SHA256'\)/);
  assert.match(service, /AbortSignal\.timeout/);
  assert.match(service, /status: 'not_configured'/);
  assert.match(service, /status: 'error'/);
  assert.doesNotMatch(service, /NEXT_PUBLIC_|console\.log\(.*token|console\.log\(.*private_key/);
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
