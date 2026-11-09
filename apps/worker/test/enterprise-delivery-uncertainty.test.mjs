import test from 'node:test';
import assert from 'node:assert/strict';
import {processEnterpriseMessage} from '../src/enterprise-message-loop.js';
const workerId='enterprise-11111111-1111-1111-1111-111111111111';
const message={id:'msg-1',session_id:'session-1',message_type:'text',recipient_jid:'1234567890@s.whatsapp.net',text_body:'hello'};
function setup(){
 const calls=[];
 const store={
  workerId,
  pollMessage:async()=>message,
  claimMessage:async()=>message,
  lookupSession:async()=>({worker_id:workerId,status:'connected'}),
  markMessageSent:async()=>{calls.push('ack');throw Error('API unavailable');},
  markMessageFailed:async()=>calls.push('failed'),
 };
 const sessions={sendText:async()=>{calls.push('sent');return {providerMessageId:'wa-123'};}};
 return {store,sessions,calls};
}
test('provider-success API failure never marks message failed or retries send',async()=>{
 const t=setup();
 await assert.rejects(processEnterpriseMessage(t),/manual reconciliation required/);
 assert.deepEqual(t.calls,['sent','ack']);
});
test('pre-send socket error is marked failed without false provider success',async()=>{
 const t=setup();
 t.sessions.sendText=async()=>{throw Error('socket closed');};
 assert.equal(await processEnterpriseMessage(t),true);
 assert.deepEqual(t.calls,['failed']);
});
