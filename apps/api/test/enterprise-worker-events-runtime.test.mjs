import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/worker-bridge/enterprise-worker-events.controller.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,(id)=>{
 if(id==='./enterprise-worker-authorization')return {authorizeEnterpriseWorker:async()=>({workerId:'enterprise-org-a',organizationId:'org-a'})};
 return require(id);
});
const Controller=mod.exports.EnterpriseWorkerEventsController;
const id='11111111-1111-1111-1111-111111111111';
test('enterprise QR update and event use credential organization',async()=>{
 let calls=0;
 const db={transaction:async fn=>fn({query:async(sql,params)=>{
  calls++;
  assert.equal(params[1]=== 'org-a'||params[0]==='org-a',true);
  if(calls===1){assert.match(sql,/organization_id=\$2 AND worker_id=\$3/);return {rowCount:1,rows:[{id}]};}
  return {rowCount:1,rows:[]};
 }})};
 assert.deepEqual(await new Controller(db).qr('Bearer token',{workerId:'enterprise-org-a',sessionId:id,qr:'qr',ttlMs:60000}),{updated:true});
 assert.equal(calls,2);
});
test('enterprise inbound insert is tenant-bound and duplicate does not emit event',async()=>{
 let calls=0;
 const db={transaction:async fn=>fn({query:async(sql,params)=>{
  calls++;assert.match(sql,/s\.organization_id=\$2 AND s\.worker_id=\$3/);
  assert.equal(params[1],'org-a');return {rows:[],rowCount:0};
 }})};
 assert.deepEqual(await new Controller(db).inbound('Bearer token',{workerId:'enterprise-org-a',sessionId:id,message:{messageType:'text',providerMessageId:'msg1'}}),{saved:null});
 assert.equal(calls,1);
});
test('enterprise status write includes org and worker',async()=>{
 const db={query:async(sql,params)=>{
  assert.match(sql,/organization_id=\$2 AND worker_id=\$3/);
  assert.deepEqual(params.slice(0,3),[id,'org-a','enterprise-org-a']);
  return {rowCount:0};
 }};
 assert.deepEqual(await new Controller(db).status('Bearer token',{workerId:'enterprise-org-a',sessionId:id,status:'connected'}),{updated:false});
});
test('enterprise event endpoints reject invalid inputs',async()=>{
 const c=new Controller({});
 await assert.rejects(c.qr('Bearer token',{workerId:'enterprise-org-a',sessionId:id,qr:'x',ttlMs:100}));
 await assert.rejects(c.status('Bearer token',{workerId:'enterprise-org-a',sessionId:id,status:'superadmin'}));
 await assert.rejects(c.inbound('Bearer token',{workerId:'enterprise-org-a',sessionId:id,message:{messageType:'text'}}));
});
