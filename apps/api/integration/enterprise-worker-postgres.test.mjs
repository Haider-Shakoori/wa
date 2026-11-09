import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {Client}=require('pg');
const url=process.env.ENTERPRISE_TEST_DATABASE_URL;
function load(relative, exported) {
 const source=readFileSync(new URL(relative,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
 const mod={exports:{}};
 new Function('module','exports','require',js)(mod,mod.exports,(id)=>{
  if(id.startsWith('./enterprise-worker-'))return load('../src/worker-bridge/'+id.slice(2)+'.ts','unused');
  return require(id);
 });
 return exported==='unused'?mod.exports:mod.exports[exported];
}
const authorize=load('../src/worker-bridge/enterprise-worker-authorization.ts','authorizeEnterpriseWorker');
const Session=load('../src/worker-bridge/enterprise-worker-session.controller.ts','EnterpriseWorkerSessionController');
const Message=load('../src/worker-bridge/enterprise-worker-message.controller.ts','EnterpriseWorkerMessageController');
const Dispatch=load('../src/worker-bridge/enterprise-worker-dispatch.controller.ts','EnterpriseWorkerDispatchController');
const Credentials=load('../src/worker-bridge/enterprise-worker-credentials.ts','unused');
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222';
const sa='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',sb='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ma='cccccccc-cccc-cccc-cccc-cccccccccccc',mb='dddddddd-dddd-dddd-dddd-dddddddddddd';
const tokenA='a'.repeat(64),tokenB='b'.repeat(64);
test('real PostgreSQL: enterprise authorization, cross-tenant isolation, and revocation', {skip:!url&&'Set ENTERPRISE_TEST_DATABASE_URL for isolated disposable PostgreSQL'}, async()=>{
 const client=new Client({connectionString:url});
 await client.connect();
 try {
  await client.query('BEGIN');
  await client.query('CREATE TABLE enterprise_accounts(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL)');
  await client.query(readFileSync(new URL('../migrations/053_enterprise_worker_registry.sql',import.meta.url),'utf8'));
  await client.query(readFileSync(new URL('../migrations/054_enterprise_worker_credentials.sql',import.meta.url),'utf8'));
  await client.query(`CREATE TABLE whatsapp_sessions(id uuid PRIMARY KEY,organization_id text NOT NULL,worker_id text,status text,deleted_at timestamptz)`);
  await client.query(`CREATE TABLE whatsapp_session_commands(id uuid PRIMARY KEY,organization_id text NOT NULL,session_id uuid NOT NULL,worker_id text,status text,completed_at timestamptz)`);
  await client.query(`CREATE TABLE whatsapp_messages(id uuid PRIMARY KEY,organization_id text NOT NULL,session_id uuid,status text,direction text,message_type text)`);
  await client.query('INSERT INTO enterprise_accounts(id,organization_id) VALUES ($1,$2),($3,$4)', ['account-a',a,'account-b',b]);
  await client.query("UPDATE enterprise_workers SET status='ready'");
  for(const [org,t] of [[a,tokenA],[b,tokenB]])await client.query(
   'INSERT INTO enterprise_worker_credentials(worker_id,token_sha256) VALUES($1,$2)',
   ['enterprise-'+org,createHash('sha256').update(t).digest('hex')]);
  await client.query('INSERT INTO whatsapp_sessions(id,organization_id,worker_id,status) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',
   [sa,a,'enterprise-'+a,'connected',sb,b,'enterprise-'+b,'connected']);
  await client.query('INSERT INTO whatsapp_messages(id,organization_id,session_id,status,direction,message_type) VALUES($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)',
   [ma,a,sa,'queued','outbound','text',mb,b,sb,'queued','outbound','text']);
  const db={query:(sql,params)=>client.query(sql,params)};
  const h='Bearer '+tokenA, workerId='enterprise-'+a;
  assert.equal((await authorize(db,h,workerId)).organizationId,a);
  assert.equal((await new Session(db).lookup(h,{workerId,sessionId:sa})).session.id,sa);
  assert.equal((await new Session(db).lookup(h,{workerId,sessionId:sb})).session,null);
  assert.equal((await new Message(db).lookup(h,{workerId,messageId:ma})).message.id,ma);
  assert.equal((await new Message(db).lookup(h,{workerId,messageId:mb})).message,null);
  assert.equal((await new Dispatch(db).completeCommand(h,{workerId,commandId:ma})).updated,false);
  await assert.rejects(authorize(db,'Bearer '+tokenB,workerId));
  assert.equal(await Credentials.revokeEnterpriseWorkerCredential(db,workerId,a),true);
  await assert.rejects(authorize(db,h,workerId));
  const rotated=await Credentials.rotateEnterpriseWorkerCredential(db,workerId,a);
  assert.equal(rotated.length,64);
  assert.equal((await authorize(db,'Bearer '+rotated,workerId)).organizationId,a);
  await assert.rejects(authorize(db,h,workerId));
  await client.query('ROLLBACK');
 } catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;} finally {await client.end();}
});
