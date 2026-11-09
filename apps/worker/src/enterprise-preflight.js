import {readFile,stat} from 'node:fs/promises';
import {EnterpriseWorkerApiClient} from './enterprise-api-client.js';

/** Diagnostic-only: authenticates dedicated worker, never starts WhatsApp sessions. */
export async function createEnterprisePreflightClient(env=process.env){
 if(env.DATABASE_URL)throw Error('Enterprise preflight refuses DATABASE_URL');
 if(env.WORKER_BRIDGE_TOKEN)throw Error('Enterprise preflight refuses shared worker credentials');
 const file=env.ENTERPRISE_WORKER_TOKEN_FILE;
 if(!file||!file.startsWith('/'))throw Error('Absolute ENTERPRISE_WORKER_TOKEN_FILE required');
 const info=await stat(file);
 if(!info.isFile()||(info.mode&0o077)!==0)throw Error('Enterprise credential file must be private (0600)');
 const token=(await readFile(file,'utf8')).trim();
 return new EnterpriseWorkerApiClient({
  apiUrl:env.ENTERPRISE_API_URL,workerId:env.WORKER_ID,token,
 });
}
export async function runEnterprisePreflight(env=process.env){
 const client=await createEnterprisePreflightClient(env);
 const response=await client.heartbeat();
 if(response.ok!==true)throw Error('Enterprise heartbeat was not acknowledged');
 return {workerId:client.workerId,authenticated:true,runtime:'disabled'};
}
if(import.meta.url===`file://${process.argv[1]}`){
 runEnterprisePreflight().then(result=>console.log(JSON.stringify(result))).catch(error=>{
  console.error('Enterprise preflight failed:',error instanceof Error?error.message:'unknown error');
  process.exitCode=1;
 });
}
