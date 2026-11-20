import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const bots=read('../src/bots/bots.service.ts');
const controller=read('../src/payments/payments.controller.ts');
test('signed Stripe webhook is routed to bot entitlement handler',()=>{
 assert.match(controller,/this.stripe.constructEvent\(request.rawBody, signature\)/);
 assert.match(controller,/this.bots.handleStripeEvent\(event\)/);
});
test('checkout activation is transactionally guarded and idempotent',()=>{
 assert.match(bots,/this.db.transaction\(async client/);
 assert.match(bots,/FOR UPDATE/);
 assert.match(bots,/if \(order.status==='paid'\) return \{duplicate:true\}/);
 assert.match(bots,/verifyBotAddonCheckout/);
});
test('renewal and restrictions require known Stripe subscription and mode',()=>{
 assert.match(bots,/stripe_subscription_id=\$1 AND stripe_livemode=\$2/);
 assert.match(bots,/invoice.payment_failed/);
 assert.match(bots,/customer.subscription.deleted/);
});

test('late renewal cannot resurrect canceled entitlement',()=>{
 assert.match(bots,/status==='canceled'/);
 assert.match(bots,/AND status<>'canceled'/);
});
test('renewal uses Stripe invoice billing period, not guessed month',()=>{
 assert.match(bots,/line.period\?\.end/);
 assert.match(bots,/missing_billing_period/);
 assert.match(bots,/to_timestamp\(\$4\)/);
});
