import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public RelayWA hero is developer-focused and does not expose BusinessOS branding', async () => {
  const source = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /Developer-first WhatsApp API/);
  assert.match(source, /Ship WhatsApp messaging from your app/);
  assert.match(source, /hero-product-grid/);
  assert.match(source, /message\.sent/);
  assert.match(source, /integration-section/);
  assert.doesNotMatch(source, /BusinessOS/i);
  assert.doesNotMatch(source, /93744119422/);
  assert.doesNotMatch(source, /Afghanistan|Afghan|Kabul|AFN/i);
});

test('tenant workspace and login use standalone RelayWA branding', async () => {
  const dashboard = await readFile(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  const login = await readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /<strong>RelayWA<\/strong><span>Customer workspace<\/span>/);
  assert.match(login, /<strong>RelayWA<\/strong><span>WhatsApp API workspace<\/span>/);
  assert.doesNotMatch(dashboard, /by BusinessOS/i);
  assert.doesNotMatch(login, /by BusinessOS/i);
});

test('platform remains a separate control plane while sharing the unified visual system', async () => {
  const platform = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  const platformLogin = await readFile(new URL('../app/platform/login/page.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(platform, /RelayWA control plane/);
  assert.match(platformLogin, /Private administration/);
  assert.match(css, /RelayWA Unified Light System v5/);
  assert.match(css, /\.platform-shell/);
  assert.match(css, /\.auth-v2-shell/);
  assert.match(css, /\.hero-product/);
});


test('onboarding uses neutral international E.164 recipient guidance', async () => {
  const source = await readFile(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /E\.164 international format/);
  assert.doesNotMatch(source, /93744119422/);
  assert.doesNotMatch(source, /Afghanistan|Afghan|Kabul|AFN/i);
});
