import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/worker-bridge/enterprise-worker-message.controller.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,(id)=>{
 if(id==='./enterprise-worker-authorization')return {authorizeEnterpriseWorker:async()=>({workerId:'enterprise-org-a',organizationId:'org-a'})};
 return require(id);
});
const Controller=mod.exports.EnterpriseWorkerMessageController;
const messageId='22222222-2222-2222-2222-222222222222';
test('enterprise message lookup enforces organization on message, session and worker',async()=>{
 const db={query:async(sql,params)=>{
  assert.match(sql,/m\.organization_id=\$2/);
  assert.match(sql,/s\.organization_id=m\.organization_id/);
  assert.match(sql,/ew\.worker_id=\$3 AND ew\.organization_id=\$2/);
  assert.deepEqual(params,[messageId,'org-a','enterprise-org-a']);
  return {rows:[{id:messageId,status:'sent'}]};
 }};
 assert.equal((await new Controller(db).lookup('Bearer test',{workerId:'enterprise-org-a',messageId})).message.id,messageId);
});
test('foreign and missing messages have identical response',async()=>{
 const db={query:async()=>({rows:[]})};
 assert.deepEqual(await new Controller(db).lookup('Bearer test',{workerId:'enterprise-org-a',messageId}),{message:null});
});
test('invalid message identifiers fail closed',async()=>{
 await assert.rejects(new Controller({query:async()=>{throw Error('unexpected')}}).lookup('Bearer test',{workerId:'enterprise-org-a',messageId:'bad'}));
});
