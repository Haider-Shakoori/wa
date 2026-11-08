import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const controller=readFileSync('apps/api/src/payments/payments.controller.ts','utf8');
const service=readFileSync('apps/api/src/payments/payments.service.ts','utf8');
test('pending checkout has separate signed transport endpoint',()=>{
  assert.match(controller,/@Post\('stripe\/pending-checkout'\)/);
  assert.match(controller,/verifyBillingTransport\(request, timestamp, signature\)/);
  assert.match(controller,/syncPendingStripeCheckout\(payload\)/);
});
test('pending checkout never activates payment',()=>{
  const block=service.split('async syncPendingStripeCheckout(input: any) {')[1].split('async handleForwardedStripeEvent')[0];
  assert.match(block,/status='pending'|\x27pending\x27/);
  assert.match(block,/FOR UPDATE/);
  assert.match(block,/Checkout does not match the plan catalog/);
  assert.match(block,/Pending checkout identity mismatch/);
  assert.doesNotMatch(block,/activatePaidPlan|status='paid'\s*,/);
});
test('pending checkout validates stripe mode and immutable checkout identity',()=>{
  const block=service.split('async syncPendingStripeCheckout(input: any) {')[1].split('async handleForwardedStripeEvent')[0];
  assert.match(block,/input\.livemode && !input\.checkoutId\.startsWith/);
  assert.match(block,/row\.provider_checkout_id!==input\.checkoutId/);
  assert.match(block,/row\.stripe_livemode!==input\.livemode/);
});

[executed on device: businessos-dev-vps (9b1cdbf1-1a02-4fe8-9e81-8871c3eca22c)]