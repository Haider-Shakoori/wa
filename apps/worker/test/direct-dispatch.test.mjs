import test from 'node:test';
import assert from 'node:assert/strict';
import { startDirectDispatch } from '../src/direct-dispatch.js';

test('direct dispatch authenticates, sends once immediately, and never retries or suppresses repeated content',async t=>{
 const rows=new Map();const sent=[];const failed=[];
 const store={claimDirectMessage:async id=>{const row=rows.get(id);if(!row||row.claimed)return null;row.claimed=true;return row;},markMessageFailed:async(id,error)=>failed.push([id,error.message])};
 const sessions=Object.fromEntries(['sendText','sendMedia','sendAction'].map(method=>[method,async(sessionId,message)=>{sent.push([method,message.id]);if(message.fail)throw new Error('Transport failed');}]));
 const dispatch=await startDirectDispatch({store,sessions,secret:'test-secret',port:0});
 t.after(()=>dispatch.close());
 const base=`http://127.0.0.1:${dispatch.server.address().port}`;
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const post=(n,secret='test-secret')=>fetch(base+'/dispatch/'+id(n),{method:'POST',headers:{authorization:'Bearer '+secret}});
 await t.test('unauthorized requests cannot claim or send',async()=>{
  rows.set(id(1),{id:id(1),message_type:'text',session_id:'session'});
  assert.equal((await post(1,'wrong')).status,401);assert.equal(sent.length,0);
 });
 await t.test('identical text in independent requests is sent without duplicate suppression',async()=>{
  rows.set(id(2),{id:id(2),message_type:'text',session_id:'session',text_body:'same text'});
  assert.equal((await post(1)).status,200);assert.equal((await post(2)).status,200);assert.equal(sent.length,2);
 });
 await t.test('a message cannot be claimed twice concurrently',async()=>{
  rows.set(id(3),{id:id(3),message_type:'text',session_id:'session'});
  const responses=await Promise.all([post(3),post(3)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(sent.filter(([,msg])=>msg===id(3)).length,1);
 });
 await t.test('failed transport is recorded once without automatic retry',async()=>{
  rows.set(id(4),{id:id(4),message_type:'text',session_id:'session',fail:true});
  assert.equal((await post(4)).status,502);assert.equal(sent.filter(([,msg])=>msg===id(4)).length,1);assert.deepEqual(failed,[[id(4),'Transport failed']]);
 });
 await t.test('media and actions use their direct transport methods',async()=>{
  rows.set(id(5),{id:id(5),message_type:'document',session_id:'session'});rows.set(id(6),{id:id(6),message_type:'reaction',session_id:'session'});
  assert.equal((await post(5)).status,200);assert.equal((await post(6)).status,200);
  assert.deepEqual(sent.slice(-2).map(([method])=>method),['sendMedia','sendAction']);
 });
 await t.test('unavailable session is rejected without sending',async()=>{assert.equal((await post(99)).status,409);});
});

test('worker no longer requires Redis queue packages',async()=>{
 const {readFile}=await import('node:fs/promises');
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.dependencies.bullmq,undefined);assert.equal(pkg.dependencies.ioredis,undefined);
});

test('uploaded files reach transport and are cleared on success and failure',async t=>{
 let captured; let shouldFail=false; let size=4;
 const store={claimDirectMessage:async id=>({id,session_id:'session',message_type:'document',media_size_bytes:size}),markMessageFailed:async()=>{}};
 const sessions={sendMedia:async(id,message,buffer)=>{captured=buffer;assert.deepEqual([...buffer],[1,2,3,4]);if(shouldFail)throw new Error('Send failed');}};
 const dispatch=await startDirectDispatch({store,sessions,secret:'test',port:0});t.after(()=>dispatch.close());
 const send=()=>fetch(`http://127.0.0.1:${dispatch.server.address().port}/dispatch/00000000-0000-4000-8000-000000000001`,{method:'POST',headers:{authorization:'Bearer test','content-type':'application/octet-stream'},body:Buffer.from([1,2,3,4])});
 assert.equal((await send()).status,200);assert.deepEqual([...captured],[0,0,0,0]);
 shouldFail=true;assert.equal((await send()).status,502);assert.deepEqual([...captured],[0,0,0,0]);
 size=5;captured=undefined;assert.equal((await send()).status,502);assert.equal(captured,undefined);
});
