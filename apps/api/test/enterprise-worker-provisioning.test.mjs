import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs,provision} from '../scripts/provision-enterprise-worker.mjs';
const org='11111111-1111-1111-1111-111111111111',workerId='enterprise-'+org;
test('provisioning requires matching identity and explicit secure output',()=>{
 assert.throws(()=>parseArgs(['--worker-id',workerId,'--organization-id',org]));
 assert.throws(()=>parseArgs(['--worker-id','enterprise-wrong','--organization-id',org,'--rotate','--output','/tmp/token']));
 assert.throws(()=>parseArgs(['--worker-id',workerId,'--organization-id',org,'--rotate','--revoke']));
 assert.deepEqual(parseArgs(['--worker-id',workerId,'--organization-id',org,'--rotate','--output','/tmp/token']),
 {workerId,organizationId:org,output:'/tmp/token',revoke:false});
});
test('provisioning writes only digest to DB and token to private writer',async()=>{
 let plaintext,stored,committed=false;
 const db={query:async(sql,params)=>{
  if(sql.includes('SELECT worker_id,status'))return {rowCount:1,rows:[{worker_id:workerId,status:'pending'}]};
  if(sql.includes('SELECT worker_id FROM enterprise_worker_credentials'))return {rowCount:0,rows:[]};
  if(sql.includes('INSERT INTO enterprise_worker_credentials')){stored=params[1];return {rowCount:1};}
  if(sql==='COMMIT')committed=true;
  return {rowCount:0,rows:[]};
 }};
 const result=await provision(db,{workerId,organizationId:org,revoke:false},async token=>{plaintext=token;});
 assert.equal(plaintext.length,64);assert.match(stored,/^[0-9a-f]{64}$/);
 assert.notEqual(plaintext,stored);assert.equal(committed,true);
 assert.equal(result.action,'created');
});
test('provisioning fails closed for missing worker and rolls back',async()=>{
 let rolledBack=false;
 const db={query:async sql=>{
  if(sql.includes('SELECT worker_id,status'))return {rowCount:0,rows:[]};
  if(sql==='ROLLBACK')rolledBack=true;
  return {rowCount:0,rows:[]};
 }};
 await assert.rejects(provision(db,{workerId,organizationId:org,revoke:false},async()=>{}));
 assert.equal(rolledBack,true);
});
test('revocation never issues token',async()=>{
 const db={query:async sql=>{
  if(sql.includes('SELECT worker_id,status'))return {rowCount:1,rows:[{status:'ready'}]};
  if(sql.includes('UPDATE enterprise_worker_credentials'))return {rowCount:1};
  return {rowCount:0};
 }};
 const result=await provision(db,{workerId,organizationId:org,revoke:true},async()=>{throw Error('unexpected token')});
 assert.deepEqual(result,{action:'revoked',changed:true});
});
