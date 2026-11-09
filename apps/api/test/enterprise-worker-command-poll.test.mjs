import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/worker-bridge/enterprise-worker-dispatch.controller.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,id=>{
 if(id==='./enterprise-worker-authorization')return {authorizeEnterpriseWorker:async()=>({workerId:'enterprise-worker-a',organizationId:'org-a'})};
 if(id==='./enterprise-worker-billing-mode')return {trustedEnterpriseStripeLivemode:()=>false};
 return require(id);
});
const Controller=mod.exports.EnterpriseWorkerDispatchController;
test('enterprise command poll uses tenant and lease predicates in atomic transaction',async()=>{
 let calls=0;
 const db={transaction:async fn=>fn({query:async(sql,params)=>{
  calls++;
  if(calls===1){
   assert.match(sql,/c.organization_id=\$1/);
   assert.match(sql,/s.worker_id=\$2/);
   assert.match(sql,/worker_lease_expires_at>now\(\)/);
   assert.match(sql,/SKIP LOCKED/);
   assert.deepEqual(params,['org-a','enterprise-worker-a']);
   return {rows:[{id:'command-1',session_id:'session-1',command:'connect'}]};
  }
  assert.match(sql,/status='queued'/);
  assert.deepEqual(params,['command-1','enterprise-worker-a']);
  return {rows:[{id:'command-1',session_id:'session-1',command:'connect'}]};
 }})};
 assert.equal((await new Controller(db).pollCommand('Bearer test',{workerId:'enterprise-worker-a'})).command.id,'command-1');
 assert.equal(calls,2);
});
test('enterprise command poll leaves empty queue unchanged',async()=>{
 let calls=0;
 const db={transaction:async fn=>fn({query:async()=>{calls++;return {rows:[]};}})};
 assert.equal((await new Controller(db).pollCommand('Bearer test',{workerId:'enterprise-worker-a'})).command,null);
 assert.equal(calls,1);
});
