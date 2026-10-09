import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('renewal card portal belongs to authenticated billing-managed organization', async () => {
  const c = await readFile(new URL('../src/payments/payments.controller.ts', import.meta.url), 'utf8');
  const s = await readFile(new URL('../src/payments/payments.service.ts', import.meta.url), 'utf8');
  const p = await readFile(new URL('../src/payments/stripe.provider.ts', import.meta.url), 'utf8');
  assert.match(c, /@Post\('stripe\/billing-portal'\)/);
  assert.match(c, /@RequirePermissions\(PERMISSIONS\.BILLING_MANAGE\)/);
  assert.match(c, /createStripeBillingPortal\(request\.auth\.org\)/);
  assert.match(s, /WHERE organization_id=\$1 AND provider='stripe'/);
  assert.match(p, /billingPortal\.sessions\.create/);
  assert.match(p, /customer: customerId/);
});

test('card entry stays on Stripe and is offered in subscription settings', async () => {
  const view = await readFile(new URL('../../web/components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(view, /Manage renewal card/);
  assert.match(view, /\/billing\/stripe\/billing-portal/);
  assert.match(view, /billing\.stripe\.com/);
});
