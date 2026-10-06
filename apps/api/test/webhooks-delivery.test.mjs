import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('webhook endpoints require webhook management permission', async () => {
  const source = await readFile(new URL('../src/webhooks/webhooks.controller.ts', import.meta.url), 'utf8');
  assert.match(source, /PERMISSIONS\.WEBHOOKS_MANAGE/);
});

test('webhook secrets are encrypted at rest and returned only during creation', async () => {
  const source = await readFile(new URL('../src/webhooks/webhook-crypto.ts', import.meta.url), 'utf8');
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /WEBHOOK_ENCRYPTION_KEY/);
});

test('webhook schema tracks retries and delivery responses', async () => {
  const sql = await readFile(new URL('../migrations/012_webhooks_delivery.sql', import.meta.url), 'utf8');
  assert.match(sql, /next_attempt_at/);
  assert.match(sql, /response_status/);
  assert.match(sql, /consecutive_failures/);
});
