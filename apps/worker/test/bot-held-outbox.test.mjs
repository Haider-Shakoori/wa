import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holdTestReply } from '../src/bot/held-outbox.js';
const bot={id:'bot_1',tenantId:'tenant_1',sessionId:'test_1',enabled:true,mode:'standby',
 faqs:[{id:'faq_1',question:'hours',answer:'9 to 5'}]};
const event={tenantId:'tenant_1',sessionId:'test_1',chatId:'chat_1',
 messageId:'msg_1',direction:'inbound',type:'text',text:'hours'};
function mockDb({ duplicate=false, takeover=false, owned=true }={}) {
 const queries=[];
 const client={
  async query(sql) {
   queries.push(sql);
   if(sql.includes('SELECT id FROM relaywa_bots'))return {rowCount:owned?1:0,rows:owned?[{id:'bot_1'}]:[]};
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
