import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEnterprisePreflightClient} from '../src/enterprise-preflight.js';
const id='enterprise-11111111-1111-1111-1111-111111111111';
test('enterprise preflight requires private token file and no database or shared token',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'enterprise-preflight-'));
 const file=join(dir,'token');
 const env={ENTERPRISE_WORKER_TOKEN_FILE:file,ENTERPRISE_API_URL:'https://api.example.test',WORKER_ID:id};
 try{
  await writeFile(file,'a'.repeat(64)+'\n',{mode:0o600});
  assert.equal((await createEnterprisePreflightClient(env)).workerId,id);
  await assert.rejects(createEnterprisePreflightClient({...env,DATABASE_URL:'postgres://secret'}),/refuses DATABASE_URL/);
  await assert.rejects(createEnterprisePreflightClient({...env,WORKER_BRIDGE_TOKEN:'shared'}),/shared worker/);
  await chmod(file,0o644);
  await assert.rejects(createEnterprisePreflightClient(env),/private/);
  await chmod(file,0o600);
  await writeFile(file,'invalid');
  await assert.rejects(createEnterprisePreflightClient(env),/token/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
