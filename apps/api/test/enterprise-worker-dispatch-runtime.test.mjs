import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/worker-bridge/enterprise-worker-dispatch.controller.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,(id)=>{
 if(id==='./enterprise-worker-authorization')return {authorizeEnterpriseWorker:async()=>({workerId:'enterprise-org-a',organizationId:'org-a'})};
 if(id==='./enterprise-worker-billing-mode')return {trustedEnterpriseStripeLivemode:()=>false};
 return require(id);
});
const Controller=mod.exports.EnterpriseWorkerDispatchController;
const id='11111111-1111-1111-1111-111111111111';
const cases=[
 ['claimCommand','commandId',false],
 ['completeCommand','commandId',false],
 ['claimMessage','messageId',true],
 ['sent','messageId',false],
 ['failed','messageId',false],
];
for(const [method,key,needsMode] of cases){
 test(method+' enforces org and worker SQL predicates',async()=>{
  const db={query:async(sql,params)=>{
   assert.match(sql,/organization_id=\$2/);
   assert.match(sql,/worker_id=\$3/);
   assert.equal(params[0],id);
   assert.equal(params[1],'org-a');
   assert.equal(params[2],'enterprise-org-a');
   if(needsMode)assert.equal(params[3],false);
   return {rows:[],rowCount:0};
  }};
  const input={workerId:'enterprise-org-a',[key]:id,...(needsMode?{stripeLivemode:false}:{})};
  const response=await new Controller(db)[method]('Bearer token',input);
  assert.ok(response.command===null||response.message===null||response.updated===false);
 });
 test(method+' rejects malformed identifiers',async()=>{
  const db={query:async()=>{throw Error('unexpected query')}};
  await assert.rejects(new Controller(db)[method]('Bearer token',{workerId:'enterprise-org-a',[key]:'invalid',stripeLivemode:false}));
 });
}
