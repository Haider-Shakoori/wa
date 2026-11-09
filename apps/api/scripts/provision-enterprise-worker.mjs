#!/usr/bin/env node
/**
 * Explicit, operator-only enterprise worker credential provisioning.
 * No HTTP route. No automatic activation. Requires a private output file.
 * Usage:
 *   DATABASE_URL=... node scripts/provision-enterprise-worker.mjs --worker-id enterprise-UUID --organization-id UUID --output /secure/worker-token
 * Optional: --rotate (replace active token); --revoke (no output needed).
 * Does not create containers or mark workers ready.
 */
import { createHash, randomBytes } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';

export function parseArgs(argv) {
 const flags = new Map();
 for(let i=0;i<argv.length;i++){
  const arg=argv[i];
  if(!['--worker-id','--organization-id','--output','--rotate','--revoke'].includes(arg)||flags.has(arg))throw Error('Invalid or repeated argument');
  if(arg==='--rotate'||arg==='--revoke'){flags.set(arg,true);continue;}
  if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing argument value');
  flags.set(arg,argv[++i]);
 }
 const workerId=flags.get('--worker-id'),organizationId=flags.get('--organization-id');
 const uuid=/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/;
 if(!uuid.test(organizationId??'')||workerId!=='enterprise-'+organizationId)throw Error('Worker and organization identity mismatch');
 if(flags.has('--rotate')&&flags.has('--revoke'))throw Error('Choose rotate or revoke');
 if(!flags.has('--revoke')&&!flags.has('--output'))throw Error('Private --output path is required');
 if(flags.has('--revoke')&&flags.has('--output'))throw Error('Revocation does not output credentials');
 if(!flags.has('--revoke')&&!flags.has('--rotate'))throw Error('Explicit --rotate is required to issue credentials');
 return {workerId,organizationId,output:flags.get('--output'),revoke:flags.has('--revoke')};
}
export async function provision(client,args,writeToken) {
 await client.query('BEGIN');
 try{
  const worker=await client.query(
   `SELECT worker_id,status FROM enterprise_workers WHERE worker_id=$1 AND organization_id=$2 FOR UPDATE`,
   [args.workerId,args.organizationId]);
  if(worker.rowCount!==1||!['pending','provisioning','ready','disabled'].includes(worker.rows[0].status))throw Error('Worker not provisionable');
  if(args.revoke){
   const result=await client.query(
    `UPDATE enterprise_worker_credentials SET revoked_at=now()
     WHERE worker_id=$1 AND revoked_at IS NULL RETURNING worker_id`,[args.workerId]);
   await client.query('COMMIT');
   return {action:'revoked',changed:result.rowCount===1};
  }
  const token=randomBytes(32).toString('hex');
  const digest=createHash('sha256').update(token).digest('hex');
  const existing=await client.query('SELECT worker_id FROM enterprise_worker_credentials WHERE worker_id=$1',[args.workerId]);
  // File must be securely created before committing token rotation.
  // If DB commit fails, the output is deleted by the caller.
  await writeToken(token);
  await client.query(
   `INSERT INTO enterprise_worker_credentials(worker_id,token_sha256,rotated_at,revoked_at)
    VALUES($1,$2,now(),NULL) ON CONFLICT(worker_id) DO UPDATE
    SET token_sha256=EXCLUDED.token_sha256,rotated_at=now(),revoked_at=NULL`,
   [args.workerId,digest]);
  await client.query('COMMIT');
  return {action:existing.rowCount?'rotated':'created',changed:true};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
}
async function main(){
 const args=parseArgs(process.argv.slice(2));
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
 let handle=null,outputCreated=false;
 const client=new Client({connectionString:process.env.DATABASE_URL});
 try{
  if(args.output){
   const file=resolve(args.output);
   handle=await open(file,'wx',0o600);outputCreated=true;
  }
  await client.connect();
  const result=await provision(client,args,async token=>{
   await handle.writeFile(token+'\n',{encoding:'utf8'});
   await handle.sync();
  });
  process.stdout.write(JSON.stringify({workerId:args.workerId,...result})+'\n');
 }catch(e){
  if(outputCreated)await unlink(resolve(args.output)).catch(()=>{});
  throw e;
 }finally{await handle?.close();await client.end().catch(()=>{});}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 main().catch(e=>{process.stderr.write('Provisioning failed: '+e.message+'\n');process.exitCode=1;});
}
