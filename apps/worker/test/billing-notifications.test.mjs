import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverBillingNotificationsOnce} from '../src/billing-notifications.js';
function fixture({row,recipient='owner@example.test',deliveryFails=false}={}) {
 const calls=[];
 const client={query:async(sql,params=[])=>{
   calls.push({sql,params});
   if(sql.startsWith('SELECT id,organization_id'))return {rows:row?[row]:[]};
   if(sql.startsWith('SELECT u.email'))return {rows:recipient?[{email:recipient}]:[]};
   return {rows:[]};
 },release(){}};
 const pool={connect:async()=>client};
 const transport={sendMail:async(input)=>{
   if(deliveryFails)throw new Error('SMTP offline');
   calls.push({mail:{to:input.to,subject:input.subject,messageId:input.messageId}});
 }};
 return {calls,pool,transport};
}
const event={id:'00000000-0000-4000-8000-000000000001',organization_id:'00000000-0000-4000-8000-000000000002',
kind:'subscription_activated',payload:{planCode:'growth'},attempts:0};
test('pending billing event sends to an active organization owner and marks sent',async()=>{
 const f=fixture({row:event});
 await deliverBillingNotificationsOnce(f);
 assert.equal(f.calls.find(x=>x.mail)?.mail.to,'owner@example.test');
 assert.ok(f.calls.some(x=>x.sql.includes("SET status='sent'")));
 assert.equal(f.calls.find(x=>x.mail)?.mail.messageId,'<relaywa-billing-'+event.id+'@relaywa.com>');
});
test('SMTP failure schedules retry and does not mark notification sent',async()=>{
 const f=fixture({row:event,deliveryFails:true});
 await deliverBillingNotificationsOnce(f);
 assert.equal(f.calls.some(x=>x.sql.includes("SET status='sent'")),false);
 assert.ok(f.calls.some(x=>x.sql.includes("next_attempt_at=now()")));
});
test('empty notification queue does not send messages',async()=>{
 const f=fixture();
 assert.equal(await deliverBillingNotificationsOnce(f),false);
 assert.equal(f.calls.some(x=>x.mail),false);
});
