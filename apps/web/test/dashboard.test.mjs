import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard contains core relayWA customer areas', async () => {
  const source = await readFile(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  for (const label of ['Sessions','Messages','API Keys','Webhooks','Billing']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Connect WhatsApp/);
  assert.match(source, /billing\/subscription/);
});

test('dashboard QR flow calls session lifecycle and QR endpoints', async () => {
  const source = await readFile(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /\/connect/);
  assert.match(source, /\/qr/);
  assert.match(source, /dataUrl/);
});

test('login persists relayWA access token and routes to dashboard', async () => {
  const source = await readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /relaywa_access_token/);
  assert.match(source, /router\.push\('\/dashboard'\)/);
});
