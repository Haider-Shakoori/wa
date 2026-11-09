import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/worker-bridge/enterprise-worker-billing-mode.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,require);
const mode=mod.exports.trustedEnterpriseStripeLivemode;
test('enterprise billing mode comes from server key only and fails closed',()=>{
 const previous=process.env.STRIPE_SECRET_KEY;
 try{
  delete process.env.STRIPE_SECRET_KEY;
  assert.throws(()=>mode());
  process.env.STRIPE_SECRET_KEY='sk_test_serverconfigured';
  assert.equal(mode(),false);
  process.env.STRIPE_SECRET_KEY='sk_live_serverconfigured';
  assert.equal(mode(),true);
  process.env.STRIPE_SECRET_KEY='invalid';
  assert.throws(()=>mode());
 }finally{
  if(previous===undefined)delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY=previous;
 }
});
