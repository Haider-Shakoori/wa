import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public RelayWA hero is developer-focused and does not expose BusinessOS branding', async () => {
  const source = await readFile(new URL('../components/relay-home.tsx', import.meta.url), 'utf8');
  assert.match(source, /WhatsApp API/);
  assert.match(source, /Bring WhatsApp into your product/);
  assert.match(source, /rw-hero-visual/);
  assert.match(source, /\/api\/send-message/);
  assert.match(source, /rw-integration/);
  assert.doesNotMatch(source, /BusinessOS/i);
  assert.doesNotMatch(source, /93744119422/);
  assert.doesNotMatch(source, /Afghanistan|Afghan|Kabul|AFN/i);
});

test('tenant workspace and login use standalone RelayWA branding', async () => {
  const dashboard = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  const login = await readFile(new URL('../components/relay-auth.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /className="rw-brand"/);
  assert.match(login, /Brand/);
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


test('public docs and tenant developer guide avoid region-specific sample identities', async () => {
  const docs = await readFile(new URL('../app/docs/page.tsx', import.meta.url), 'utf8');
  const guide = await readFile(new URL('../components/developer-guide.tsx', import.meta.url), 'utf8');
  for (const source of [docs, guide]) {
    assert.doesNotMatch(source, /93744119422/);
    assert.doesNotMatch(source, /Afghanistan|Afghan|Kabul|AFN/i);
    assert.match(source, /E164_RECIPIENT_NUMBER/);
  }
});


test('all rendered web surfaces avoid legacy Afghanistan-specific and BusinessOS presentation', async () => {
  const paths = [
    '../components/relay-home.tsx',
    '../app/layout.tsx',
    '../components/relay-auth.tsx',
    '../app/onboarding/page.tsx',
    '../components/relay-workspace.tsx',
    '../app/docs/page.tsx',
    '../app/platform/login/page.tsx',
    '../app/platform/page.tsx',
    '../components/customer-operations.tsx',
    '../components/developer-guide.tsx',
    '../components/google-signin.tsx',
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /93744119422|Afghanistan|Afghan|Kabul|\bAFN\b|BusinessOS|wasender\.businessos\.af/i);
  }
});
