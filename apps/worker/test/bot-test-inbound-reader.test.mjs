import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectStoredTestInbound } from '../src/bot/test-inbound-reader.js';
import { TEST_SESSION_ID } from '../src/bot/test-session-preflight.js';
const session={id:TEST_SESSION_ID,organization_id:'tenant_1',status:'connected',
  worker_id:'relaywa-vps-1',phone_number:'93707413263'};
const inbound={organization_id:'tenant_1',session_id:TEST_SESSION_ID,
  provider_message_id:'msg_1',chat_jid:'123@s.whatsapp.net',
  message_type:'text',text_body:'hours',direction:'inbound'};
const since=new Date('2026-11-19T00:00:00Z');
test('reads only allowed stored inbound messages and previews without sending',async()=>{
  const queries=[];
  const db={query:async(sql,args)=>{queries.push({sql,args});
    return queries.length===1?{rows:[session]}:{rows:[inbound]};}};
  const pipeline={inspect:async event=>({action:'preview',text:event.text})};
  const result=await inspectStoredTestInbound({db,pipeline,since});
  assert.equal(result.inspected,1);
  assert.equal(result.decisions[0].action,'preview');
  assert.equal(result.liveSendPermitted,false);
  assert.match(queries[1].sql,/direction='inbound'/);
  assert.match(queries[1].sql,/chat_jid NOT LIKE/);
  assert.doesNotMatch(queries[1].sql,/raw_payload/);
  assert.deepEqual(queries[1].args,[TEST_SESSION_ID,'tenant_1',since,10]);
});
test('ownership change stops before reading messages',async()=>{
  let calls=0;
  const db={query:async()=>{calls++;return {rows:[{...session,worker_id:'other'}]};}};
  const result=await inspectStoredTestInbound({db,pipeline:{inspect:()=>{}},since});
  assert.equal(result.ready,false);
  assert.equal(calls,1);
});
test('rejects unbounded scans and missing cutoff',async()=>{
  const db={query:async()=>{throw Error('should not query');}};
  for(const opts of [{since:null},{since,limit:21},{since,limit:0}])
    await assert.rejects(inspectStoredTestInbound({db,pipeline:{inspect:()=>{}},...opts}));
});
test('group chats are never previewed',async()=>{
  let calls=0;
  const db={query:async(sql)=>sql.includes('FROM whatsapp_sessions')
    ?{rows:[session]}:{rows:[{...inbound,chat_jid:'group@g.us'}]}};
  const result=await inspectStoredTestInbound({db,pipeline:{inspect:()=>{calls++;}},since});
  assert.equal(calls,0);
  assert.equal(result.decisions[0].action,'ignore');
});
