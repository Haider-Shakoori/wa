import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public site presents the five RelayWA pricing tiers', async () => {
  const source = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  for (const name of ['Trial','Basic','Pro','Plus','Business']) assert.match(source, new RegExp("name:'" + name + "'"));
  assert.match(source, /monthly:3\.99/);
  assert.match(source, /monthly:8\.99/);
  assert.match(source, /monthly:16\.99/);
  assert.match(source, /monthly:24\.99/);
  assert.match(source, /Save 15%/);
  assert.match(source, /50 messages per day/);
});

test('tenant and platform authentication have separate entry points', async () => {
  const tenant = await readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
  const platform = await readFile(new URL('../app/platform/login/page.tsx', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  assert.match(tenant, /Tenant workspace/);
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
