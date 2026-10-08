import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard contains core relayWA customer areas', async () => {
  const source = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  for (const label of ['QuickSend','MessageHistory','/api-keys','API documentation','Webhooks','Subscription']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /lifecycle\('connect'\)/);
  assert.match(source, /billing\/subscription/);
  assert.match(source, /QuickSend/);
});

test('dashboard QR flow calls session lifecycle and QR endpoints', async () => {
  const source = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /lifecycle\('connect'\)/);
  assert.match(source, /\/qr/);
  assert.match(source, /dataUrl/);
});

test('tenant login persists access token and stays in tenant routing', async () => {
  const source = await readFile(new URL('../components/relay-auth.tsx', import.meta.url), 'utf8');
  assert.match(source, /relaywa_access_token/);
  assert.match(source, /register/);
  assert.match(source, /\/dashboard/);
  assert.match(source, /\/register/);
});
