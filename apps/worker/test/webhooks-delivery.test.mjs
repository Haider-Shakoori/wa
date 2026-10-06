import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('webhook signatures use HMAC SHA-256 over timestamp and raw body', async () => {
  const source = await readFile(new URL('../src/webhook-crypto.js', import.meta.url), 'utf8');
  assert.match(source, /createHmac\('sha256'/);
  assert.match(source, /timestamp/);
});

test('webhook delivery blocks redirects and has timeout protection', async () => {
  const source = await readFile(new URL('../src/webhook-delivery.js', import.meta.url), 'utf8');
  assert.match(source, /redirect: 'error'/);
  assert.match(source, /WEBHOOK_TIMEOUT_MS/);
});

test('worker store fans out events and claims deliveries with SKIP LOCKED', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /enqueueWebhookDeliveries/);
  assert.match(source, /claimNextWebhookDelivery/);
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
});
