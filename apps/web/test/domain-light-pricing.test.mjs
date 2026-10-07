import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public pricing is loaded from the backend catalog', async () => {
  const source = await readFile(new URL('../components/relay-home.tsx', import.meta.url), 'utf8');
  assert.match(source, /public\/plans/);
  assert.match(source, /PlanCards/);
  assert.match(source, /Save 15%/);
  assert.match(source, /50 messages per day/);
});

test('tenant and platform authentication have separate entry points', async () => {
  const tenant = await readFile(new URL('../components/relay-auth.tsx', import.meta.url), 'utf8');
  const platform = await readFile(new URL('../app/platform/login/page.tsx', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  assert.match(tenant, /manage your sessions/);
  assert.doesNotMatch(tenant, /platform\.relaywa\.com/);
  assert.match(platform, /Platform administrator/);
  assert.match(platform, /isPlatformAdmin/);
  assert.match(admin, /\/platform\/login/);
});

test('light SaaS theme and public domain surfaces are present', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /relayWA Light SaaS v4/);
  assert.match(css, /\.public-shell/);
  assert.match(css, /\.platform-shell/);
  assert.match(css, /\.split-login-shell/);
  assert.match(css, /\.pricing-grid/);
});
