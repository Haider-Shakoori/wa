import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/worker-bridge/enterprise-worker-lifecycle.controller.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,(id)=>{
 if(id==='./enterprise-worker-authorization')return {authorizeEnterpriseWorker:async()=>({workerId:'enterprise-org-a',organizationId:'org-a'})};
 return require(id);
});
const Controller=mod.exports.EnterpriseWorkerLifecycleController;
const id='11111111-1111-1111-1111-111111111111';
for(const [method,body] of [
 ['heartbeat',{sessionId:id,leaseMs:30000}],
 ['recoverable',{limit:10,connectingStaleMs:30000,leaseMs:30000}],
 ['failCommand',{commandId:id,error:'test'}],
]){
 test(method+' binds enterprise organization and worker in write SQL',async()=>{
  const db={query:async(sql,params)=>{
   assert.match(sql,/organization_id=\$[123]/);
   assert.match(sql,/worker_id=\$[123]/);
   assert.ok(params.includes('org-a'));
   assert.ok(params.includes('enterprise-org-a'));
   return {rows:[],rowCount:0};
  }};
  await new Controller(db)[method]('Bearer token',{workerId:'enterprise-org-a',...body});
 });
}
test('enterprise poll selects and updates only authenticated organization',async()=>{
 let calls=0;
 const db={transaction:async fn=>fn({query:async(sql,params)=>{
  calls++;
  assert.match(sql,/organization_id/);
  assert.ok(params.includes('org-a'));
  assert.ok(params.includes('enterprise-org-a'));
  if(calls===1)return {rows:[{id}]};
  return {rows:[{id}]};
 }})};
 const result=await new Controller(db).poll('Bearer token',{workerId:'enterprise-org-a',stripeLivemode:false});
 assert.equal(result.message.id,id);
 assert.equal(calls,2);
});
test('enterprise poll rejects invalid billing mode',async()=>{
 await assert.rejects(new Controller({}).poll('Bearer token',{workerId:'enterprise-org-a',stripeLivemode:'false'}));
});
test('enterprise recoverable rejects invalid limits',async()=>{
 await assert.rejects(new Controller({}).recoverable('Bearer token',{workerId:'enterprise-org-a',limit:1000,connectingStaleMs:0,leaseMs:30000}));
});
