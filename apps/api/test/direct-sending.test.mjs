import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText,filename);
const {MessagesService}=require('../src/messages/messages.service.ts');

test('API immediately dispatches, reports failures, and rejects application scheduling',async t=>{
 const original=globalThis.fetch;const previous=process.env.WORKER_DISPATCH_SECRET;
 process.env.WORKER_DISPATCH_SECRET='test-secret';t.after(()=>{globalThis.fetch=original;if(previous===undefined)delete process.env.WORKER_DISPATCH_SECRET;else process.env.WORKER_DISPATCH_SECRET=previous;});
 const rows=new Map();let dispatches=0;
 const db={query:async(sql,args)=>{
  if(sql.includes('SELECT id, status'))return {rows:[{id:'session',status:'connected'}]};
  if(sql.includes('SELECT worker_id'))return {rows:[{worker_id:'worker'}]};
  if(sql.includes('client_message_id ='))return {rows:[...rows.values()].filter(row=>row.client_message_id===args[2])};
  if(sql.includes('INSERT INTO whatsapp_messages')){const row={id:args[0],session_id:args[2],client_message_id:args[4],status:'queued'};rows.set(row.id,row);return {rows:[row]};}
  if(sql.includes("UPDATE whatsapp_messages SET status='failed'")){const row=rows.get(args[0]);if(row.status==='queued')row.status='failed';return {rows:[]};}
  return {rows:[rows.get(args[0])]};
 }};
 const service=new MessagesService(db,{assertCanSendMessage:async()=>{},recordOutboundMessage:async()=>{}});
 globalThis.fetch=async(url)=>{dispatches++;const row=rows.get(url.split('/').pop());row.status='sent';return new Response('{}');};
 const first=await service.sendText('org','user','session',{to:'12025550123',text:'Hello',clientMessageId:'one'});
 assert.equal(first.status,'sent');assert.equal(dispatches,1);
 const existing=await service.sendText('org','user','session',{to:'12025550123',text:'Hello',clientMessageId:'one'});
 assert.equal(existing.id,first.id);assert.equal(dispatches,1);
 const next=await service.sendText('org','user','session',{to:'12025550123',text:'Hello',clientMessageId:'two'});
 assert.equal(next.status,'sent');assert.equal(dispatches,2);
 for(const option of [{scheduledAt:new Date().toISOString()},{priority:5},{maxAttempts:3}])await assert.rejects(service.sendText('org','user','session',{to:'12025550123',text:'Hello',...option}),/handled by your application/);
 globalThis.fetch=async()=>new Response(JSON.stringify({message:'Transport failed'}),{status:502});
 await assert.rejects(service.sendText('org','user','session',{to:'12025550123',text:'Hello'}),error=>error.getStatus()===502&&Boolean(error.getResponse().messageId));
 globalThis.fetch=async url=>{rows.get(url.split('/').pop()).status='claimed';throw new Error('timeout');};
 await assert.rejects(service.sendText('org','user','session',{to:'12025550123',text:'Hello'}),error=>error.getStatus()===503);
 assert.equal([...rows.values()].at(-1).status,'claimed');
});
