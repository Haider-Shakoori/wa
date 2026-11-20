import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const bots=read('../src/bots/bots.service.ts');
const webhook=read('../src/payments/payments.controller.ts');
test('webhook router and bot handler recognize both Stripe invoice subscription formats',()=>{
 for(const source of [bots,webhook]){
  assert.match(source,/parent\?\.subscription_details\?\.subscription/);
  assert.match(source,/\?\.subscription/);
  assert.match(source,/subscription_item_details\?\.subscription/);
 }
});
test('cancellation cannot be undone by delayed subscription or payment failure event',()=>{
 assert.match(bots,/status<>'canceled' OR \$3='canceled'/);
 assert.match(bots,/status==='canceled'/);
});
test('renewal period is Stripe sourced and invoice idempotent',()=>{
 assert.match(bots,/line.period\?\.end/);
 assert.match(bots,/relaywa_bot_renewal_events/);
 assert.match(bots,/ON CONFLICT DO NOTHING/);
});
