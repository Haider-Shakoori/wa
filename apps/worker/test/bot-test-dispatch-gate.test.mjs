import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDispatchGate } from '../src/bot/test-dispatch-gate.js';
import { createIsolatedBotRuntime } from '../src/bot/isolated-runtime.js';

const token='test-approval-token-at-least-24-characters';
const bot={id:'bot_1',tenantId:'tenant_1',sessionId:'test_session',
  mode:'active',enabled:true,faqs:[{id:'faq_1',question:'hours',answer:'9 to 5'}]};
const event={tenantId:'tenant_1',sessionId:'test_session',chatId:'test_contact',
  messageId:'msg_1',direction:'inbound',type:'text',text:'hours'};
const message={sessionId:'test_session',recipientId:'test_contact',
  inboundMessageId:'msg_1',text:'9 to 5',approvalToken:token};
test('dry run cannot call transport',async()=>{
 let calls=0;
 const gate=createTestDispatchGate({sessionId:'test_session',recipientId:'test_contact',
   confirmationToken:token,transport:async()=>{calls++;return {accepted:true};}});
 assert.equal((await gate.dispatch(message)).status,'dry_run');
 assert.equal(calls,0);
});
test('wrong session, recipient and token are blocked',async()=>{
 let calls=0;
 const gate=createTestDispatchGate({sessionId:'test_session',recipientId:'test_contact',
   confirmationToken:token,transport:async()=>{calls++;return {accepted:true};},dryRun:false});
 for(const changes of [{sessionId:'production'},{recipientId:'other'},{approvalToken:'wrong'}]) {
   assert.equal((await gate.dispatch({...message,...changes})).status,'blocked');
 }
 assert.equal(calls,0);
});
test('mock transport accepts one approved reply and rejects replay',async()=>{
 let calls=0;
 const gate=createTestDispatchGate({sessionId:'test_session',recipientId:'test_contact',
   confirmationToken:token,transport:async()=>{calls++;return {accepted:true};},dryRun:false});
 const runtime=createIsolatedBotRuntime({allowedSessionIds:['test_session']});
 const decision=runtime.inspect({bot,event});
 assert.equal(decision.action,'reply');
 assert.equal((await gate.dispatch({...message,text:decision.text})).status,'accepted');
 assert.equal((await gate.dispatch({...message,text:decision.text})).reason,'duplicate');
 assert.equal(calls,1);
});
test('unaccepted transport cannot mark a message sent',async()=>{
 const gate=createTestDispatchGate({sessionId:'test_session',recipientId:'test_contact',
   confirmationToken:token,transport:async()=>({accepted:false}),dryRun:false});
 await assert.rejects(gate.dispatch(message),/did not accept/);
});
test('invalid test gate configuration is rejected',()=>{
 assert.throws(()=>createTestDispatchGate({sessionId:'test',recipientId:'recipient',
   confirmationToken:'short',transport:async()=>({accepted:true})}));
});
