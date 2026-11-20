import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holdTestReply } from '../src/bot/held-outbox.js';
const bot={id:'bot_1',tenantId:'tenant_1',sessionId:'test_1',enabled:true,mode:'standby',
 faqs:[{id:'faq_1',question:'hours',answer:'9 to 5'}]};
const event={tenantId:'tenant_1',sessionId:'test_1',chatId:'chat_1',
 messageId:'msg_1',direction:'inbound',type:'text',text:'hours'};
function mockDb({ duplicate=false, takeover=false, owned=true, entitled=true, used=0, limit=1000, invalidPeriod=false }={}) {
 const queries=[];
 const client={
  async query(sql) {
   queries.push(sql);
   if(sql.includes('SELECT id FROM relaywa_bots'))return {rowCount:owned?1:0,rows:owned?[{id:'bot_1'}]:[]};
   if(sql.includes('SELECT monthly_reply_limit'))return {rowCount:entitled?1:0,rows:entitled?[{monthly_reply_limit:limit,current_period_start:invalidPeriod?null:new Date(Date.now()-20*86400000).toISOString(),period_end:new Date(Date.now()+10*86400000).toISOString()}]:[]};
   if(sql.includes('SELECT count(*)::int AS used'))return {rowCount:1,rows:[{used}]};
   if(sql.includes('SELECT human_takeover'))return {rowCount:1,rows:[{human_takeover:takeover}]};
   if(sql.includes('INSERT INTO relaywa_bot_outbox'))return {rowCount:duplicate?0:1,rows:duplicate?[]:[{id:'held_1'}]};
   return {rowCount:1,rows:[]};
  },release(){}
 };
 return {queries,db:{connect:async()=>client}};
}
test('non-allowlisted sessions never access database',async()=>{
 const {db,queries}=mockDb();
 assert.equal((await holdTestReply({db,bot,event,allowedSessionIds:[]})).reason,'session_not_allowlisted');
 assert.equal(queries.length,0);
});
test('approved test inbound response is HELD, never sent',async()=>{
 const {db,queries}=mockDb();
 const result=await holdTestReply({db,bot,event,allowedSessionIds:['test_1']});
 assert.equal(result.action,'held');
 assert.ok(queries.some(q=>q.includes('INSERT INTO relaywa_bot_outbox')));
 assert.ok(queries.some(q=>q.includes("'held'")));
 assert.ok(queries.includes('COMMIT'));
});
test('database unique constraint suppresses duplicates',async()=>{
 const {db}=mockDb({duplicate:true});
 assert.equal((await holdTestReply({db,bot,event,allowedSessionIds:['test_1']})).reason,'duplicate_message');
});
test('human takeover suppresses bot answer',async()=>{
 const {db,queries}=mockDb({takeover:true});
 assert.equal((await holdTestReply({db,bot,event,allowedSessionIds:['test_1']})).reason,'human_takeover');
 assert.ok(!queries.some(q=>q.includes('INSERT INTO relaywa_bot_outbox')));
});
test('handoff persists takeover state',async()=>{
 const {db,queries}=mockDb();
 assert.equal((await holdTestReply({db,bot,event:{...event,text:'agent'},allowedSessionIds:['test_1']})).action,'handoff');
 assert.ok(queries.some(q=>q.includes('INSERT INTO relaywa_bot_conversations')));
});
test('unowned bot cannot write',async()=>{
 const {db,queries}=mockDb({owned:false});
 assert.equal((await holdTestReply({db,bot,event,allowedSessionIds:['test_1']})).reason,'bot_not_standby_or_not_owned');
 assert.ok(!queries.some(q=>q.includes('INSERT INTO relaywa_bot_outbox')));
});
test('outbox is permanently held by schema and has no dispatch integration',()=>{
 const schema=readFileSync(new URL('../../api/migrations/057_bot_isolated_conversations.sql',import.meta.url),'utf8');
 assert.match(schema,/CHECK\(status='held'\)/);
 assert.match(schema,/UNIQUE\(organization_id,bot_id,inbound_message_id\)/);
});

test('expired or absent subscription blocks held reply',async()=>{
 const {db,queries}=mockDb({entitled:false});
 assert.equal((await holdTestReply({db,bot,event,allowedSessionIds:['test_1']})).reason,'subscription_required');
 assert.ok(!queries.some(q=>q.includes('INSERT INTO relaywa_bot_outbox')));
});
test('monthly allowance blocks extra reply without sending',async()=>{
 const {db,queries}=mockDb({used:1000,limit:1000});
 assert.equal((await holdTestReply({db,bot,event,allowedSessionIds:['test_1']})).reason,'monthly_reply_limit_reached');
 assert.ok(!queries.some(q=>q.includes('INSERT INTO relaywa_bot_outbox')));
});
test('quota reservations lock entitlement and count active billing period',async()=>{
 const {db,queries}=mockDb({used:999,limit:1000});
 assert.equal((await holdTestReply({db,bot,event,allowedSessionIds:['test_1']})).action,'held');
 assert.ok(queries.some(q=>q.includes('relaywa_bot_entitlements')&&q.includes('FOR UPDATE')));
 assert.ok(queries.some(q=>q.includes("period_end") && q.includes("FOR UPDATE")));
 assert.ok(queries.some(q=>q.includes("created_at>=$2::timestamptz") && q.includes("created_at<$3::timestamptz")));
});

test('missing authoritative billing period fails closed before counting quota',async()=>{
 const {db,queries}=mockDb({invalidPeriod:true});
 const result=await holdTestReply({db,bot,event,allowedSessionIds:['test_1']});
 assert.deepEqual(result,{action:'ignore',reason:'invalid_billing_period'});
 assert.ok(!queries.some(q=>q.includes('SELECT count(*)::int AS used')));
 assert.ok(queries.includes('ROLLBACK'));
});
