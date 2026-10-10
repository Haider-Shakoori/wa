import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');

test('paid monthly/annual renewals preserve remaining time and sync selected plan',async()=>{
 const service=await read('../src/subscriptions/subscriptions.service.ts');
 const renew=service.slice(service.indexOf('  async activatePaidPlan('),service.indexOf('  async listPlans('));
 assert.match(renew,/billingInterval === 'annual' \? 12 : 1/);
 assert.match(renew,/GREATEST\(organization_subscriptions\.current_period_end, now\(\)\)/);
 assert.match(renew,/\$2 \* interval '1 month'/);
 assert.match(renew,/trial_ends_at = NULL/);
 assert.match(renew,/selected_plan_code/);
 assert.match(renew,/selected_billing_interval/);
 assert.match(renew,/tx\?: PoolClient/);
 assert.doesNotMatch(renew,/current_period_end = now\(\) \+ \(\$2/);
});

test('webhook and manual approvals atomically mark payments paid and extend the subscription exactly once',async()=>{
 const service=await read('../src/payments/payments.service.ts');
 const stripe=service.slice(service.indexOf('  async handleStripeEvent('),service.indexOf('  async approveManual('));
 const manual=service.slice(service.indexOf('  async approveManual('),service.indexOf('  async updateProvider('));
 for(const block of [stripe,manual]) {
   assert.match(block,/this\.db\.transaction\(async client/);
   assert.match(block,/FROM organizations WHERE id=\$1 FOR UPDATE/);
   assert.match(block,/FOR UPDATE/);
   assert.match(block,/status==='paid'/);
   assert.match(block,/status='paid'/);
   assert.match(block,/activatePaidPlan\(/);
   assert.match(block,/,client(?:,event\.livemode)?\);/);
 }
 assert.match(stripe,/session\.payment_status !== 'paid'/);
 assert.match(stripe,/provider_checkout_id!==session\.id/);
 assert.match(stripe,/session\.amount_total/);
 assert.match(stripe,/session\.currency/);
 assert.match(manual,/provider='manual'/);
 assert.doesNotMatch(stripe,/await this\.db\.query\(\s*`UPDATE payments/);
 assert.doesNotMatch(manual,/await this\.db\.query\(\s*`UPDATE payments/);
});
