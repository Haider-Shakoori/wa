import test from 'node:test';
import assert from 'node:assert/strict';
import {processEnterpriseMessage,runEnterpriseMessageLoop} from '../src/enterprise-message-loop.js';
const workerId='enterprise-11111111-1111-1111-1111-111111111111';
function setup(type='text'){
 const calls=[];const message={id:'msg-1',session_id:'session-1',message_type:type,text_body:'hello'};
 const store={workerId,pollMessage:async()=>message,claimMessage:async()=>message,
  lookupSession:async()=>({worker_id:workerId,status:'connected'}),
  markMessageSent:async(id,provider)=>calls.push(['sent',id,provider]),
  markMessageFailed:async(id,error)=>calls.push(['failed',id,error.message])};
 const sessions={sendText:async()=>{calls.push(['send']);return {key:{id:'wa-1'}};}};
 return {store,sessions,calls};
}
test('enterprise text dispatch requires claim and provider acknowledgement',async()=>{
 const t=setup();
 assert.equal(await processEnterpriseMessage(t),true);
 assert.deepEqual(t.calls,[['send'],['sent','msg-1','wa-1']]);
});
test('enterprise dispatch skips an empty queue or lost claim',async()=>{
 const t=setup();t.store.pollMessage=async()=>null;
 assert.equal(await processEnterpriseMessage(t),false);
 t.store.pollMessage=async()=>({id:'msg-1',session_id:'session-1'});
 t.store.claimMessage=async()=>null;
 assert.equal(await processEnterpriseMessage(t),true);
 assert.deepEqual(t.calls,[]);
});
test('enterprise dispatch refuses foreign worker session',async()=>{
 const t=setup();t.store.lookupSession=async()=>({worker_id:'foreign',status:'connected'});
 await processEnterpriseMessage(t);
 assert.equal(t.calls[0][0],'failed');
});
test('enterprise dispatch fails closed on missing provider ID',async()=>{
 const t=setup();t.sessions.sendText=async()=>({});
 await processEnterpriseMessage(t);
 assert.equal(t.calls[0][0],'failed');
});
test('enterprise media dispatch fails closed until authorized media transport exists',async()=>{
 const t=setup('image');
 await processEnterpriseMessage(t);
 assert.match(t.calls[0][2],/not yet enabled/);
});
test('enterprise outbound loop respects cancellation',async()=>{
 const t=setup();const c=new AbortController();c.abort();
 await runEnterpriseMessageLoop({...t,signal:c.signal});
 assert.deepEqual(t.calls,[]);
});
