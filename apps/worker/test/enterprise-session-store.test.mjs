import test from 'node:test';
import assert from 'node:assert/strict';
import {EnterpriseSessionStore} from '../src/enterprise-session-store.js';
const id='11111111-1111-1111-1111-111111111111';
test('enterprise lifecycle adapter uses API only and validates acknowledgements',async()=>{
 const calls=[];
 const client={workerId:'enterprise-'+id,
  heartbeat:async()=>({ok:true}),
  sessionHeartbeat:async(...a)=>{calls.push(['heartbeat',...a]);return {updated:true}},
  sessionLookup:async()=>({session:{id}}),
  recoverable:async()=>({sessions:[{id}]}),
  sessionStatus:async()=>({updated:true}),
  sessionQr:async()=>({updated:true}),
  inbound:async()=>({saved:null}),
  contact:async()=>({updated:true}),chat:async()=>({updated:true}),group:async()=>({updated:true}),
  messagePoll:async()=>({message:null}),
  messageClaim:async()=>({message:null}),
  messageSent:async()=>({updated:true}),
  messageFailed:async()=>({updated:true}),
  commandComplete:async()=>({updated:true}),
  commandFail:async()=>({updated:true}),
 };
 const store=new EnterpriseSessionStore({client});
 await store.heartbeatWorker();
 await store.heartbeat(id);
 assert.deepEqual(calls,[['heartbeat',id,30000]]);
 assert.equal((await store.lookupSession(id)).id,id);
 assert.equal((await store.claimRecoverableSessions()).length,1);
 await store.setStatus(id,'connected');
 await store.setQr(id,'qr');
 await store.upsertContact(id,{id:'123@s.whatsapp.net'});
 await store.upsertChat(id,{id:'123@s.whatsapp.net'});
 await store.upsertGroup(id,{id:'123@g.us'});
 assert.equal(await store.saveInboundMessage(id,{providerMessageId:'msg'}),null);
 assert.equal(await store.pollMessage(),null);
 assert.equal(await store.claimMessage(id),null);
 await store.markMessageSent(id,'sent');
 await store.markMessageFailed(id,Error('failed'));
 await store.completeCommand(id);
 await store.failCommand(id,'failed');
 assert.equal('pool' in store,false);
});
test('enterprise lifecycle adapter fails closed on stale lease and missing acknowledgements',async()=>{
 const client={workerId:'enterprise-'+id,heartbeat:async()=>({ok:false}),sessionLookup:async()=>({session:null}),sessionHeartbeat:async()=>({updated:false}),sessionStatus:async()=>({updated:false}),inbound:async()=>({})};
 const store=new EnterpriseSessionStore({client});
 await assert.rejects(store.heartbeatWorker(),/not acknowledged/);
 await assert.rejects(store.heartbeat(id),/not renewed/);
 await assert.rejects(store.setStatus(id,'connected'),/not updated/);
 await assert.rejects(store.saveInboundMessage(id,{}),/acknowledgement/);
});
