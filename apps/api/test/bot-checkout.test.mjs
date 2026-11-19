import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const service=read('../src/bots/bots.service.ts');
const provider=read('../src/payments/stripe.provider.ts');
const controller=read('../src/bots/bots.controller.ts');
const schema=read('../migrations/059_bot_addon_checkout_orders.sql');
test('Bot checkout is separate from core subscription tables',()=>{
 assert.match(schema,/CREATE TABLE IF NOT EXISTS relaywa_bot_checkout_orders/);
 assert.doesNotMatch(schema,/organization_subscriptions|UPDATE payments/);
 assert.match(provider,/relaywa_product:'bot_addon'/);
});
test('Checkout requires billing permission and paid entitlement check',()=>{
 assert.match(controller,/@Post\('checkout'\)/);
 assert.match(controller,/@RequirePermissions\(PERMISSIONS.BILLING_MANAGE\)/);
 assert.match(service,/if \(access.entitled\) throw new ConflictException/);
 assert.match(service,/Bot Builder checkout already pending/);
});
test('Checkout does not activate subscription and uses Stripe recurring monthly',()=>{
 assert.match(provider,/recurring:\{interval:'month'\}/);
 assert.match(service,/status='expired'/);
 assert.doesNotMatch(service,/UPDATE relaywa_bot_entitlements|INSERT INTO relaywa_bot_entitlements/);
});
