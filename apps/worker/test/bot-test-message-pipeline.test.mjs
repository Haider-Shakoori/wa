import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestMessagePipeline } from '../src/bot/test-message-pipeline.js';
import { TEST_SESSION_ID } from '../src/bot/test-session-preflight.js';

const tenantId = 'test_tenant';
const session = {id:TEST_SESSION_ID,organization_id:tenantId,status:'connected',
  worker_id:'relaywa-vps-1',phone_number:'93707413263'};
const db = (row=session) => ({query:async()=>({rows:row?[row]:[]})});
const bot = {id:'bot_test',tenantId,sessionId:TEST_SESSION_ID,enabled:true,
  mode:'active',faqs:[{id:'faq_1',question:'hours',answer:'9 to 5'}]};
const event = {tenantId,sessionId:TEST_SESSION_ID,chatId:'test_chat',
  messageId:'msg_1',direction:'inbound',type:'text',text:'hours'};
test('approved inbound produces preview without sending',async()=>{
  const pipeline=createTestMessagePipeline({db:db(),bot});
  const result=await pipeline.inspect(event);
  assert.equal(result.action,'preview');
  assert.equal(result.text,'9 to 5');
  assert.equal(result.liveSendPermitted,false);
});
test('duplicate inbound does not generate another preview',async()=>{
  const pipeline=createTestMessagePipeline({db:db(),bot});
  await pipeline.inspect(event);
  assert.equal((await pipeline.inspect(event)).action,'ignore');
});
test('unknown session blocked without querying database',async()=>{
  const pipeline=createTestMessagePipeline({db:{query:()=>{throw Error('unexpected query');}},bot});
  assert.equal((await pipeline.inspect({...event,sessionId:'production'})).reason,'session_not_allowlisted');
});
test('changed worker ownership fails closed',async()=>{
  const pipeline=createTestMessagePipeline({db:db({...session,worker_id:'relaywa-worker-02'}),bot});
  assert.equal((await pipeline.inspect(event)).reason,'preflight_owner_changed');
});
test('wrong tenant cannot preview',async()=>{
  const pipeline=createTestMessagePipeline({db:db(),bot});
  assert.equal((await pipeline.inspect({...event,tenantId:'other'})).action,'ignore');
});
test('handoff blocks replies until explicit release',async()=>{
  const pipeline=createTestMessagePipeline({db:db(),bot});
  assert.equal((await pipeline.inspect({...event,text:'human'})).action,'handoff');
  assert.equal((await pipeline.inspect({...event,messageId:'msg_2'})).reason,'human_takeover');
  assert.equal(pipeline.releaseHandoff({tenantId,sessionId:TEST_SESSION_ID,chatId:'test_chat'}),true);
  assert.equal((await pipeline.inspect({...event,messageId:'msg_3'})).action,'preview');
});
