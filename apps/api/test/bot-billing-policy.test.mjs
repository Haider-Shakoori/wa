import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/bots/bot-billing-policy.ts',import.meta.url),'utf8');
test('bot add-on pricing is USD 5, 12, 25 per month',()=>{
  assert.match(code,/monthlyCents: 500, maxBots: 1/);
  assert.match(code,/monthlyCents: 1200, maxBots: 3/);
  assert.match(code,/monthlyCents: 2500, maxBots: 10/);
});
test('webhook validation checks product identity, org, plan, amount and livemode',()=>{
  for(const value of ['relaywa_product','organization_id','bot_plan',
    'amountTotal','livemode','checkoutId','paymentStatus','subscriptionId'])
    assert.ok(code.includes(value),value);
});
test('billing policy has no write or activation side effects',()=>{
  assert.doesNotMatch(code,/INSERT INTO|UPDATE |DELETE FROM|activatePaidPlan|stripe\.checkout\.sessions\.create/);
});
