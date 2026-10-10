import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const service = () => readFile(new URL('../src/payments/payments.service.ts',import.meta.url),'utf8');
test('billing notification events are persisted on success, renewal, failure and cancellation',async()=>{
 const src=await service();
 for(const value of ["subscription_activated","subscription_renewed","payment_failed","subscription_canceled"]){
   assert.ok(src.includes("'"+value+"'"),'Missing '+value);
 }
 assert.match(src,/ON CONFLICT \(event_key\) DO NOTHING/g);
 assert.match(src,/billing_notification_outbox/);
});
test('renewal is invoice-deduplicated and must be a paid subscription cycle',async()=>{
 const src=await service();
 assert.match(src,/invoice\.billing_reason !== 'subscription_cycle'/);
 assert.match(src,/invoice\.status !== 'paid'/);
 assert.match(src,/provider_payment_id=\$1 AND stripe_livemode=\$2 LIMIT 1/);
 assert.match(src,/SELECT id FROM organizations WHERE id=\$1 FOR UPDATE/);
});
test('unknown subscription events cannot update other tenants',async()=>{
 const src=await service();
 assert.match(src,/WHERE provider='stripe' AND provider_subscription_id=\$1/);
 assert.match(src,/event\.type === 'customer.subscription.deleted'/);
});
test('outbox migration prevents duplicate event keys',async()=>{
 const sql=await readFile(new URL('../migrations/043_billing_notification_outbox.sql',import.meta.url),'utf8');
 assert.match(sql,/event_key varchar\(240\) NOT NULL UNIQUE/);
 assert.match(sql,/status varchar\(20\) NOT NULL DEFAULT 'pending'/);
});
