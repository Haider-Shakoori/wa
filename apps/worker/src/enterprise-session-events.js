/**
 * Enterprise session persistence facade for the API-backed runtime.
 * No database connection and no implicit fallback to the shared worker store.
 * A failed/missing acknowledgement is fatal, preventing silent state loss.
 */
export class EnterpriseSessionEvents {
 constructor({client}={}){
  if(!client||typeof client.sessionLookup!=='function'||typeof client.sessionStatus!=='function'||typeof client.sessionQr!=='function'||typeof client.inbound!=='function'||typeof client.sessionHeartbeat!=='function')throw Error('Enterprise API client required');
  this.client=client;
 }
 async requireOwnedSession(sessionId){
  const result=await this.client.sessionLookup(sessionId);
  if(!result?.session||result.session.id!==sessionId||result.session.worker_id!==this.client.workerId)throw Error('Enterprise session not owned by worker');
  return result.session;
 }
 async setStatus(sessionId,status,details={}){
  await this.requireOwnedSession(sessionId);
  const result=await this.client.sessionStatus(sessionId,status,details);
  if(result?.updated!==true)throw Error('Enterprise session status was not persisted');
 }
 async setQr(sessionId,qr,ttlMs=60000){
  await this.requireOwnedSession(sessionId);
  const result=await this.client.sessionQr(sessionId,qr,ttlMs);
  if(result?.updated!==true)throw Error('Enterprise QR was not persisted');
 }
 async saveInboundMessage(sessionId,message){
  await this.requireOwnedSession(sessionId);
  const result=await this.client.inbound(sessionId,message);
  if(!result||!Object.hasOwn(result,'saved'))throw Error('Enterprise inbound was not acknowledged');
  // A null saved record means a duplicate provider message, already persisted.
  return result.saved;
 }
 async heartbeat(sessionId,leaseMs){
  await this.requireOwnedSession(sessionId);
  const result=await this.client.sessionHeartbeat(sessionId,leaseMs);
  if(result?.updated!==true)throw Error('Enterprise session heartbeat was not persisted');
 }
}
