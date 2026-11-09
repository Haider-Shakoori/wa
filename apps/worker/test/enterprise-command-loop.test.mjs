import test from 'node:test';
import assert from 'node:assert/strict';
import {processEnterpriseCommand,runEnterpriseCommandLoop} from '../src/enterprise-command-loop.js';
const workerId='enterprise-11111111-1111-1111-1111-111111111111';
function setup(command='connect',owner=workerId){
 const calls=[];
 const store={workerId,pollCommand:async()=>({id:'cmd-1',session_id:'session-1',command}),
  lookupSession:async()=>({worker_id:owner}),
  completeCommand:async id=>calls.push(['complete',id]),
  failCommand:async(id,error)=>calls.push(['fail',id,error.message])};
 const sessions={connect:async id=>calls.push(['connect',id]),
  restart:async id=>calls.push(['restart',id]),
  logout:async id=>calls.push(['logout',id])};
 return {store,sessions,calls};
}
for(const command of ['connect','restart','logout']){
 test('enterprise '+command+' executes and acknowledges only owned session',async()=>{
  const t=setup(command);
  assert.equal(await processEnterpriseCommand(t),true);
  assert.deepEqual(t.calls,[[command,'session-1'],['complete','cmd-1']]);
 });
}
test('enterprise command refuses foreign lease and marks command failed',async()=>{
 const t=setup('connect','enterprise-foreign');
 await processEnterpriseCommand(t);
 assert.equal(t.calls.length,1);
 assert.equal(t.calls[0][0],'fail');
});
test('enterprise command refuses unknown operations',async()=>{
 const t=setup('delete-everything');
 await processEnterpriseCommand(t);
 assert.equal(t.calls[0][0],'fail');
});
test('enterprise command reports execution errors without completion',async()=>{
 const t=setup();
 t.sessions.connect=async()=>{throw Error('socket unavailable');};
 await processEnterpriseCommand(t);
 assert.deepEqual(t.calls,[['fail','cmd-1','socket unavailable']]);
});
test('empty enterprise command queue performs no operation',async()=>{
 const t=setup();
 t.store.pollCommand=async()=>null;
 assert.equal(await processEnterpriseCommand(t),false);
 assert.deepEqual(t.calls,[]);
});
test('enterprise loop honors aborted signal without polling',async()=>{
 const t=setup();
 const controller=new AbortController();
 controller.abort();
 await runEnterpriseCommandLoop({...t,signal:controller.signal});
 assert.deepEqual(t.calls,[]);
});
