import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTestInbound, previewTestInbound } from '../src/bot/test-inbound-adapter.js';
import { TEST_SESSION_ID, EXPECTED_WORKER } from '../src/bot/test-session-preflight.js';
const snapshot={sessionId:TEST_SESSION_ID,sourceWorker:EXPECTED_WORKER,
  tenantId:'tenant_1',chatId:'test_contact',messageId:'msg_1',
  direction:'inbound',type:'text',text:'hours'};
test('approved test snapshot normalizes to inbound event',()=>{
  const result=normalizeTestInbound(snapshot);
  assert.equal(result.accepted,true);
  assert.equal(result.event.sessionId,TEST_SESSION_ID);
  assert.equal(result.event.text,'hours');
});
test('different worker or session blocked',()=>{
  for(const change of [{sessionId:'other'},{sourceWorker:'relaywa-worker-02'}])
    assert.equal(normalizeTestInbound({...snapshot,...change}).reason,'source_not_allowlisted');
});
test('outbound, self and group messages blocked',()=>{
  for(const change of [{direction:'outbound'},{fromMe:true},{isGroup:true}])
    assert.equal(normalizeTestInbound({...snapshot,...change}).reason,'not_customer_inbound');
});
test('invalid message and oversized text blocked',()=>{
  for(const change of [{messageId:'bad id'},{chatId:''},{text:'x'.repeat(4001)}])
    assert.equal(normalizeTestInbound({...snapshot,...change}).accepted,false);
});
test('approved snapshot reaches injected preview pipeline only',async()=>{
  let calls=0;
  const pipeline={inspect:async event=>{calls++;return {action:'preview',text:event.text,liveSendPermitted:false};}};
  assert.equal((await previewTestInbound({pipeline,snapshot})).action,'preview');
  assert.equal(calls,1);
  assert.equal((await previewTestInbound({pipeline,snapshot:{...snapshot,sessionId:'other'}})).action,'ignore');
  assert.equal(calls,1);
});
