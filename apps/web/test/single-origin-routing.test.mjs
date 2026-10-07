import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const webSources = [
  '../app/platform/page.tsx',
  '../app/platform/login/page.tsx',
  '../app/docs/page.tsx',
  '../components/relay-auth.tsx',
  '../components/relay-home.tsx',
  '../components/relay-workspace.tsx',
  '../lib/api.ts',
  '../lib/integration-examples.ts',
  '../lib/seo.ts',
];

test('RelayWA customer-facing code uses a single canonical origin', async () => {
  for (const relative of webSources) {
    const source = await readFile(new URL(relative, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /https:\/\/(?:api|app|platform)\.relaywa\.com/i, relative);
  }
});

test('platform and tenant paths live on relaywa.com instead of subdomains', async () => {
  const platform = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  const platformLogin = await readFile(new URL('../app/platform/login/page.tsx', import.meta.url), 'utf8');

  assert.match(platform, /href="\/dashboard"/);
  assert.match(platform, /<code>https:\/\/relaywa\.com<\/code>/);
  assert.match(platformLogin, /relaywa\.com\/login/);
  assert.match(platformLogin, /router\.replace\('\/platform'\)/);
});

test('production API documentation uses relaywa.com/api', async () => {
  const publicApi = await readFile(new URL('../../../docs/public-api.md', import.meta.url), 'utf8');
  const apiClient = await readFile(new URL('../lib/api.ts', import.meta.url), 'utf8');

  assert.match(publicApi, /https:\/\/relaywa\.com\/api/);
  assert.doesNotMatch(publicApi, /https:\/\/api\.relaywa\.com/);
  assert.match(apiClient, /NEXT_PUBLIC_API_BASE_URL \?\? '\/api'/);
});
