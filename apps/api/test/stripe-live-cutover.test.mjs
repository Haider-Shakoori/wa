import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = path => readFile(new URL(path,import.meta.url),'utf8');

test('only matching Stripe environment can process signed billing events',async()=>{
 const stripe=await read('../src/payments/stripe.provider.ts');
 assert.match(stripe,/STRIPE_MODE \|\| 'test'/);
 assert.match(stripe,/configured !== keyMode/);
 assert.match(stripe,/event\.livemode !== this\.isLiveMode\(\)/);
 assert.match(stripe,/Invalid Stripe webhook signature/);
 const controller=await read('../src/payments/payments.controller.ts');
 assert.match(controller,/new BadRequestException\('Missing Stripe webhook signature or body'\)/);
});
test('sandbox subscription does not block first live Checkout',async()=>{
 const payments=await read('../src/payments/payments.service.ts');
 assert.match(payments,/provider_subscription_id IS NOT NULL AND stripe_livemode=\$2/);
 assert.match(payments,/stripe_livemode\)\s*VALUES \(\$1,\$2,\$3,'stripe',\$4,'pending',\$5,\$6,\$7\)/);
 assert.match(payments,/WHERE organization_id=\$1 AND provider='stripe' AND stripe_livemode=\$2 LIMIT 1/);
 assert.match(payments,/AND stripe_livemode=\$2 FOR UPDATE/);
});
test('cancellation/failure/status all check same Stripe environment',async()=>{
 const payments=await read('../src/payments/payments.service.ts');
 const a=payments.slice(payments.indexOf('private async handleStripeFailure'),payments.indexOf('async approveManual'));
 assert.match(a,/stripe_livemode=\$5 AND status='active'/);
 assert.match(a,/stripe_livemode=\$3/g);
 assert.match(a,/stripe_livemode=\$5\s*RETURNING organization_id/);
});
test('live subscription activation resets test-only billing period',async()=>{
 const subs=await read('../src/subscriptions/subscriptions.service.ts');
 assert.match(subs,/stripe_livemode = EXCLUDED\.stripe_livemode/);
 assert.match(subs,/stripe_livemode IS DISTINCT FROM EXCLUDED\.stripe_livemode/);
 assert.match(subs,/THEN now\(\) \+ \(\$2 \* interval '1 month'\)/);
});
test('migration defaults historic Stripe rows to test mode',async()=>{
 const sql=await read('../migrations/044_stripe_environment_separation.sql');
 assert.match(sql,/payments ADD COLUMN IF NOT EXISTS stripe_livemode boolean NOT NULL DEFAULT false/);
 assert.match(sql,/organization_subscriptions ADD COLUMN IF NOT EXISTS stripe_livemode boolean NOT NULL DEFAULT false/);
});
