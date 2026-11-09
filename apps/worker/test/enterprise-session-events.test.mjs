import test from 'node:test';
import assert from 'node:assert/strict';
import {EnterpriseSessionEvents} from '../src/enterprise-session-events.js';
const id='11111111-1111-1111-1111-111111111111';
const workerId='enterprise-22222222-2222-2222-2222-222222222222';
const client=()=>({
 workerId,
 sessionLookup:async()=>({session:{id,worker_id:workerId}}),
 sessionStatus:async()=>({updated:true}),
 sessionQr:async()=>({updated:true}),
 inbound:async()=>({saved:{id:'message'}}),
 sessionHeartbeat:async()=>({updated:true}),
});
test('enterprise session events persist through owned API session',async()=>{
 const api=client();const events=new EnterpriseSessionEvents({client:api});
 await events.setStatus(id,'connected',{clearQr:true});
 await events.setQr(id,'qr',60000);
 assert.deepEqual(await events.saveInboundMessage(id,{providerMessageId:'x',messageType:'text'}),{id:'message'});
 await events.heartbeat(id,30000);
});
test('enterprise session events reject cross-worker ownership and missing acknowledgements',async()=>{
 const api=client();api.sessionLookup=async()=>({session:{id,worker_id:'enterprise-other'}});
 await assert.rejects(new EnterpriseSessionEvents({client:api}).setStatus(id,'connected'),/not owned/);
 api.sessionLookup=async()=>({session:{id,worker_id:workerId}});
 api.sessionStatus=async()=>({updated:false});
 await assert.rejects(new EnterpriseSessionEvents({client:api}).setStatus(id,'connected'),/not persisted/);
 api.sessionQr=async()=>({updated:false});
 await assert.rejects(new EnterpriseSessionEvents({client:api}).setQr(id,'qr'),/not persisted/);
 api.sessionHeartbeat=async()=>({updated:false});
 await assert.rejects(new EnterpriseSessionEvents({client:api}).heartbeat(id,30000),/not persisted/);
 api.inbound=async()=>({});
 await assert.rejects(new EnterpriseSessionEvents({client:api}).saveInboundMessage(id,{}),/not acknowledged/);
 api.inbound=async()=>({saved:null});
 assert.equal(await new EnterpriseSessionEvents({client:api}).saveInboundMessage(id,{}),null);
});
