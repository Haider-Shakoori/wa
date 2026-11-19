import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const schema=read('../migrations/058_bot_paid_entitlements.sql');
const service=read('../src/bots/bots.service.ts');
const controller=read('../src/bots/bots.controller.ts');
test('three priced tiers have constrained capacities',()=>{
  assert.match(schema,/starter','pro','business'/);
  assert.match(schema,/max_bots IN \(1,3,10\)/);
  assert.match(schema,/monthly_reply_limit IN \(1000,5000,20000\)/);
});
test('no entitlement granted by default and expiry enforced',()=>{
  assert.doesNotMatch(schema,/INSERT INTO relaywa_bot_entitlements/);
  assert.match(service,/new Date\(row.current_period_end\).getTime\(\) > now/);
  assert.match(service,/new Date\(row.trial_ends_at\).getTime\(\) > now/);
});
test('API enforces paid entitlement and bot capacity',()=>{
  assert.match(service,/await this.requireEntitlement\(org\)/);
  assert.match(service,/Bot Builder subscription required/);
  assert.match(service,/Bot plan limit reached/);
  assert.match(controller,/@Get\('entitlement'\)/);
});
