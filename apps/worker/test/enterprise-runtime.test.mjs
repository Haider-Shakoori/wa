import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnterpriseRuntime} from '../src/enterprise-runtime.js';
const id='enterprise-11111111-1111-1111-1111-111111111111';
const client={workerId:id,heartbeat:async()=>({ok:true}),commandPoll:async()=>({command:null}),sessionLookup:async()=>({session:null}),messagePoll:async()=>({message:null})};
test('enterprise runtime refuses legacy or incomplete Baileys managers',()=>{
 const manager={sockets:new Map(),connect(){},restart(){},logout(){}};
 assert.throws(()=>createEnterpriseRuntime({client,sessionManager:manager}),/Isolated/);
 assert.throws(()=>createEnterpriseRuntime({client,sessionManager:{...manager,enterpriseIsolated:true,logout:null}}),/Missing/);
});
test('enterprise runtime composes API-only command and message paths without starting sockets',async()=>{
 const manager={enterpriseIsolated:true,sockets:new Map(),connect(){},restart(){},logout(){}};
 const runtime=createEnterpriseRuntime({client,sessionManager:manager});
 assert.equal(await runtime.processCommand(),false);
 assert.equal(await runtime.processMessage(),false);
 assert.equal(runtime.store.workerId,id);
});
