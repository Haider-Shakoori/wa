import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/worker-bridge/enterprise-worker-session.controller.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,(id)=>{
 if(id==='./enterprise-worker-authorization')return {authorizeEnterpriseWorker:async()=>({workerId:'enterprise-org-a',organizationId:'org-a'})};
 return require(id);
});
const Controller=mod.exports.EnterpriseWorkerSessionController;
const sessionId='11111111-1111-1111-1111-111111111111';
test('enterprise session lookup binds both organization and worker identity in SQL',async()=>{
 const db={query:async(sql,params)=>{
  assert.match(sql,/organization_id=\$2/);
  assert.match(sql,/ew\.worker_id=\$3/);
  assert.match(sql,/ew\.organization_id=\$2/);
  assert.deepEqual(params,[sessionId,'org-a','enterprise-org-a']);
  return {rows:[{id:sessionId,status:'connected',worker_id:'enterprise-org-a'}]};
 }};
 const result=await new Controller(db).lookup('Bearer test',{workerId:'enterprise-org-a',sessionId});
 assert.equal(result.session.id,sessionId);
});
test('foreign or missing sessions are indistinguishable',async()=>{
 const db={query:async()=>({rows:[]})};
 assert.deepEqual(await new Controller(db).lookup('Bearer test',{workerId:'enterprise-org-a',sessionId}),{session:null});
});
test('invalid session ID is rejected before query',async()=>{
 const db={query:async()=>{throw new Error('unexpected query')}};
 await assert.rejects(new Controller(db).lookup('Bearer test',{workerId:'enterprise-org-a',sessionId:'bad'}));
});
