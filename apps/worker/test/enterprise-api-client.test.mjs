import test from 'node:test';
import assert from 'node:assert/strict';
import {EnterpriseWorkerApiClient} from '../src/enterprise-api-client.js';
const id='11111111-1111-1111-1111-111111111111',token='a'.repeat(64);
const options={apiUrl:'https://api.example.test',workerId:'enterprise-'+id,token};
test('enterprise API transport enforces TLS and scoped credentials',()=>{
 assert.throws(()=>new EnterpriseWorkerApiClient({...options,apiUrl:'http://example.test'}),/HTTPS/);
 assert.throws(()=>new EnterpriseWorkerApiClient({...options,token:'shared-secret'}),/token/);
 assert.throws(()=>new EnterpriseWorkerApiClient({...options,workerId:'shared-worker'}),/identity/);
 assert.doesNotThrow(()=>new EnterpriseWorkerApiClient({...options,apiUrl:'http://127.0.0.1:3000'}));
});
test('enterprise API transport binds worker identity and never sends shared secret',async()=>{
 let count=0;
 const client=new EnterpriseWorkerApiClient({...options,fetchImpl:async(url,init)=>{
  count++;assert.equal(url,'https://api.example.test/internal/enterprise-worker/heartbeat');
  assert.equal(init.headers.authorization,'Bearer '+token);
  assert.equal(init.redirect,'error');
  assert.deepEqual(JSON.parse(init.body),{workerId:'enterprise-'+id});
  return {ok:true,json:async()=>({ok:true})};
 }});
 assert.deepEqual(await client.heartbeat(),{ok:true});assert.equal(count,1);
});
test('enterprise API transport refuses identity override, unapproved paths, HTTP failures',async()=>{
 const client=new EnterpriseWorkerApiClient({...options,fetchImpl:async()=>({ok:false,status:403})});
 await assert.rejects(client.request('heartbeat',{workerId:'enterprise-other'}),/mismatch/);
 await assert.rejects(client.request('../admin'),/Unapproved/);
 await assert.rejects(client.heartbeat(),/HTTP 403/);
});
test('enterprise API transport does not follow redirects',async()=>{
 const client=new EnterpriseWorkerApiClient({...options,fetchImpl:async(_url,init)=>{
  assert.equal(init.redirect,'error');throw Error('redirect blocked');
 }});
 await assert.rejects(client.heartbeat(),/redirect blocked/);
});
