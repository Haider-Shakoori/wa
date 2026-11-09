/**
 * Dedicated enterprise worker API transport.
 * No direct PostgreSQL access, no fallback to shared-worker secret.
 * This module is intentionally not wired to the live Baileys runtime until
 * all session-store operations are migrated and end-to-end tested.
 */
const UUID=/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/;
const WORKER=/^enterprise-[a-zA-Z0-9-]{1,110}$/;
const TOKEN=/^[0-9a-fA-F]{64}$/;
const PATHS=new Set([
 'heartbeat','sessions/heartbeat','sessions/recoverable','sessions/lookup',
 'sessions/qr','sessions/status','sessions/inbound','messages/lookup',
 'messages/poll','messages/claim','messages/sent','messages/failed',
 'commands/claim','commands/complete','commands/fail',
]);
export class EnterpriseWorkerApiClient {
 constructor({apiUrl,workerId,token,fetchImpl=globalThis.fetch,timeoutMs=10000}={}){
  if(typeof apiUrl!=='string')throw Error('API URL required');
  const url=new URL(apiUrl);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Invalid API URL');
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname))throw Error('Enterprise API requires HTTPS outside loopback');
  if(!WORKER.test(workerId)||!UUID.test(workerId.slice(11)))throw Error('Invalid enterprise worker identity');
  if(!TOKEN.test(token))throw Error('Invalid enterprise worker token');
  if(typeof fetchImpl!=='function')throw Error('fetch implementation required');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000)throw Error('Invalid request timeout');
  this.url=url;this.workerId=workerId;this.token=token;this.fetchImpl=fetchImpl;this.timeoutMs=timeoutMs;
 }
 async request(path,payload={}){
  if(!PATHS.has(path))throw Error('Unapproved enterprise API path');
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid enterprise API payload');
  if(Object.hasOwn(payload,'workerId')&&payload.workerId!==this.workerId)throw Error('Worker identity mismatch');
  const endpoint=new URL(this.url.href);
  endpoint.pathname=endpoint.pathname.replace(/\/$/,'')+'/internal/enterprise-worker/'+path;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
  try{
   const response=await this.fetchImpl(endpoint.href,{
    method:'POST',redirect:'error',signal:controller.signal,
    headers:{authorization:'Bearer '+this.token,'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify({...payload,workerId:this.workerId}),
   });
   if(!response.ok)throw Error('Enterprise API request failed (HTTP '+response.status+')');
   const data=await response.json();
   if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid enterprise API response');
   return data;
  }finally{clearTimeout(timer);}
 }
 heartbeat(){return this.request('heartbeat');}
 sessionHeartbeat(sessionId,leaseMs){return this.request('sessions/heartbeat',{sessionId,leaseMs});}
 recoverable(limit,connectingStaleMs,leaseMs){return this.request('sessions/recoverable',{limit,connectingStaleMs,leaseMs});}
 sessionLookup(sessionId){return this.request('sessions/lookup',{sessionId});}
 messageLookup(messageId){return this.request('messages/lookup',{messageId});}
 commandClaim(commandId){return this.request('commands/claim',{commandId});}
 commandComplete(commandId){return this.request('commands/complete',{commandId});}
 commandFail(commandId,error){return this.request('commands/fail',{commandId,error});}
 messagePoll(){return this.request('messages/poll');}
 messageClaim(messageId){return this.request('messages/claim',{messageId});}
 messageSent(messageId,providerMessageId){return this.request('messages/sent',{messageId,providerMessageId});}
 messageFailed(messageId,error){return this.request('messages/failed',{messageId,error});}
 sessionStatus(sessionId,status,details={}){return this.request('sessions/status',{sessionId,status,details});}
 sessionQr(sessionId,qr,ttlMs){return this.request('sessions/qr',{sessionId,qr,ttlMs});}
 inbound(sessionId,message){return this.request('sessions/inbound',{sessionId,message});}
}
