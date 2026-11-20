import test from 'node:test';
import assert from 'node:assert/strict';
import { createIsolatedBotRuntime } from '../src/bot/isolated-runtime.js';
import { matchFlow, validateFlow } from '../src/bot/flow-engine.js';

const bot = {id:'bot_1',tenantId:'tenant_1',sessionId:'test_session',mode:'active',enabled:true,
  faqs:[{id:'faq_1',question:'hours',answer:'9 to 5'}]};
const event = {tenantId:'tenant_1',sessionId:'test_session',chatId:'contact_1',messageId:'m_1',
  direction:'inbound',type:'text',text:'hours'};
test('empty allowlist blocks all sessions',()=>{
  const runtime=createIsolatedBotRuntime();
  assert.equal(runtime.inspect({bot,event}).reason,'session_not_allowlisted');
});
test('only explicitly allowlisted test session can be inspected',()=>{
  const runtime=createIsolatedBotRuntime({allowedSessionIds:['test_session']});
  assert.equal(runtime.inspect({bot,event}).action,'reply');
  assert.equal(runtime.inspect({bot,event:{...event,sessionId:'production_session'}}).reason,'ownership_mismatch');
});
test('replay of message does not trigger second decision',()=>{
  const runtime=createIsolatedBotRuntime({allowedSessionIds:['test_session']});
  assert.equal(runtime.inspect({bot,event}).action,'reply');
  assert.equal(runtime.inspect({bot,event}).reason,'duplicate_or_invalid_message');
});
test('human takeover stops replies until explicit release',()=>{
  const runtime=createIsolatedBotRuntime({allowedSessionIds:['test_session']});
  assert.equal(runtime.inspect({bot,event:{...event,messageId:'m_2',text:'agent'}}).action,'handoff');
  assert.equal(runtime.inspect({bot,event}).reason,'human_takeover');
  assert.equal(runtime.releaseHandoff(event),true);
  assert.equal(runtime.inspect({bot,event}).action,'reply');
});
test('tenant mismatch cannot affect another tenant handoff',()=>{
  const runtime=createIsolatedBotRuntime({allowedSessionIds:['test_session']});
  assert.equal(runtime.inspect({bot,event:{...event,tenantId:'tenant_2'}}).reason,'ownership_mismatch');
});
test('test runtime exposes no sending or session management methods',()=>{
  const runtime=createIsolatedBotRuntime({allowedSessionIds:['test_session']});
  assert.deepEqual(Object.keys(runtime).sort(),['inspect','releaseHandoff']);
});
test('flow engine only matches approved exact triggers',()=>{
  const flow={steps:[{id:'menu',trigger:'1',reply:'Opening hours'}]};
  assert.deepEqual(matchFlow(flow,' 1 '),{action:'reply',stepId:'menu',text:'Opening hours'});
  assert.equal(matchFlow(flow,'2').action,'unmatched');
});
test('invalid flows rejected',()=>{
  assert.throws(()=>validateFlow({steps:[{id:'x',trigger:'1',reply:'ok'},{id:'x',trigger:'2',reply:'ok'}]}));
});
