/**
 * API-only session lifecycle adapter for the dedicated enterprise runtime.
 * This deliberately covers only endpoints implemented by the API. No SQL
 * fallback or simulated success for unsupported SessionStore operations.
 */
export class EnterpriseSessionStore {
 constructor({client,leaseMs=30000}={}){
  if(!client||typeof client.sessionLookup!=='function'||typeof client.heartbeat!=='function')throw Error('Enterprise API client required');
  if(!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>300000)throw Error('Invalid enterprise lease');
  this.client=client;
  this.workerId=client.workerId;
  this.leaseMs=leaseMs;
 }
 async heartbeatWorker(){
  const response=await this.client.heartbeat();
  if(response.ok!==true)throw Error('Enterprise worker heartbeat not acknowledged');
 }
 async heartbeat(sessionId){
  const response=await this.client.sessionHeartbeat(sessionId,this.leaseMs);
  if(response.updated!==true)throw Error('Enterprise session lease not renewed');
 }
 async lookupSession(sessionId){
  const result=await this.client.sessionLookup(sessionId);
  return result.session??null;
 }
 async claimRecoverableSessions({limit=10,connectingStaleMs=30000}={}){
  const response=await this.client.recoverable(limit,connectingStaleMs,this.leaseMs);
  if(!Array.isArray(response.sessions))throw Error('Invalid enterprise recovery response');
  return response.sessions;
 }
 async setStatus(sessionId,status,details={}){
  const response=await this.client.sessionStatus(sessionId,status,details);
  if(response.updated!==true)throw Error('Enterprise session status not updated');
 }
 async setQr(sessionId,qr,ttlMs=60000){
  const response=await this.client.sessionQr(sessionId,qr,ttlMs);
  if(response.updated!==true)throw Error('Enterprise session QR not updated');
 }
 async saveInboundMessage(sessionId,message){
  const response=await this.client.inbound(sessionId,message);
  // null is an idempotent duplicate; never retry a successful duplicate.
  if(!Object.hasOwn(response,'saved'))throw Error('Invalid enterprise inbound acknowledgement');
  return response.saved;
 }
 async pollMessage(){
  const response=await this.client.messagePoll();
  return response.message??null;
 }
 async claimMessage(messageId){
  const response=await this.client.messageClaim(messageId);
  return response.message??null;
 }
 async markMessageSent(messageId,providerMessageId){
  const response=await this.client.messageSent(messageId,providerMessageId);
  if(response.updated!==true)throw Error('Enterprise sent acknowledgement rejected');
 }
 async markMessageFailed(messageId,error){
  const response=await this.client.messageFailed(messageId,String(error?.message??error).slice(0,2000));
  if(response.updated!==true)throw Error('Enterprise failure acknowledgement rejected');
 }
 async completeCommand(commandId){
  const response=await this.client.commandComplete(commandId);
  if(response.updated!==true)throw Error('Enterprise command completion rejected');
 }
 async failCommand(commandId,error){
  const response=await this.client.commandFail(commandId,String(error?.message??error).slice(0,2000));
  if(response.updated!==true)throw Error('Enterprise command failure rejected');
 }
 async close(){}
}
