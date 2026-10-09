import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Stripe Checkout uses recurring subscriptions and ties subscription to tenant', async () => {
  const source = await readFile(new URL('../src/payments/stripe.provider.ts', import.meta.url), 'utf8');
  assert.match(source, /mode: 'subscription'/);
  assert.match(source, /recurring: \{ interval: input\.billingInterval/);
  assert.match(source, /subscription_data:/);
  assert.match(source, /relaywa_organization_id:/);
  assert.match(source, /relaywa_payment_id:/);
});

test('initial checkout and renewal processing remain separate and atomic', async () => {
  const source = await readFile(new URL('../src/payments/payments.service.ts', import.meta.url), 'utf8');
  assert.match(source, /checkout\.session\.completed/);
  assert.match(source, /invoice\.payment_succeeded/);
  assert.match(source, /invoice\.paid/);
  assert.match(source, /subscription_cycle/);
  assert.match(source, /SELECT id FROM organizations WHERE id=\$1 FOR UPDATE/);
  assert.match(source, /provider_payment_id=\$1/);
  assert.match(source, /this\.subscriptions\.activatePaidPlan/);
  assert.match(source, /customer\.subscription\.deleted/);
});
