import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('platform navigation adds a GA4 dashboard without replacing existing first-party statistics', async () => {
  const page = await read('../app/platform/page.tsx');
  const dashboard = await read('../components/platform-google-analytics.tsx');
  assert.match(page, /PlatformGoogleAnalytics/);
  assert.match(page, /PlatformWebsiteTraffic/);
  assert.match(page, /'Website traffic','Google Analytics','Analytics'/);
  assert.match(page, /active === 'Google Analytics'/);
  assert.match(dashboard, /\/platform\/google-analytics\?days=/);
  assert.match(dashboard, /status === 'ready'/);
  assert.match(dashboard, /status === 'not_configured'/);
  assert.match(dashboard, /Realtime active users/);
  assert.match(dashboard, /Acquisition channels/);
  assert.match(dashboard, /GA4 property/);
  assert.doesNotMatch(dashboard, /private_key|service.account.json|NEXT_PUBLIC_GOOGLE/);
});
