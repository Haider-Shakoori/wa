import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('payment schema supports configurable Stripe and manual providers', async () => {
  const sql = await readFile(new URL('../migrations/016_payments.sql', import.meta.url), 'utf8');
  assert.match(sql, /payment_provider_settings/);
  assert.match(sql, /'stripe'/);
  assert.match(sql, /'manual'/);
  assert.match(sql, /manual_reference/);
});

test('Stripe webhook uses raw body signature verification', async () => {
  const controller = await readFile(new URL('../src/payments/payments.controller.ts', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(controller, /request\.rawBody/);
  assert.match(controller, /stripe-signature/);
  assert.match(main, /rawBody: true/);
});

test('manual payment approval is platform-admin guarded', async () => {
  const source = await readFile(new URL('../src/payments/payments.controller.ts', import.meta.url), 'utf8');
  assert.match(source, /PlatformAdminGuard/);
  assert.match(source, /approveManual/);
});
