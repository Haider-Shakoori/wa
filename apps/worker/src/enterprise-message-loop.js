/**
 * Dedicated enterprise outbound dispatcher. The API is authoritative for
 * message claiming, billing eligibility and session lease ownership.
 * This executor is not enabled until the enterprise Baileys runtime is wired.
 */
export async function processEnterpriseMessage({store,sessions}){
 if(!store||typeof store.pollMessage!=='function'||typeof store.claimMessage!=='function')throw Error('Enterprise message store required');
 if(!sessions)throw Error('Enterprise messaging manager required');
 const candidate=await store.pollMessage();
 if(!candidate)return false;
 if(typeof candidate.id!=='string'||typeof candidate.session_id!=='string')throw Error('Malformed enterprise message candidate');
 const message=await store.claimMessage(candidate.id);
 if(!message)return true; // Another worker won the claim, or eligibility changed.
 if(message.id!==candidate.id||message.session_id!==candidate.session_id)throw Error('Enterprise message claim mismatch');
 try{
  const session=await store.lookupSession(message.session_id);
  if(!session||session.worker_id!==store.workerId||session.status!=='connected')throw Error('Enterprise message session unavailable');
  let result;
  if(message.message_type==='text')result=await sessions.sendText(message.session_id,message);
  else if(['image','video','audio','document'].includes(message.message_type)){
   // Media needs a separate authorized, size-limited transfer endpoint.
   throw Error('Enterprise media delivery is not yet enabled');
  }else{
   throw Error('Enterprise action delivery is not yet enabled');
  }
  const providerId=typeof result==='string'?result:result?.providerMessageId??result?.key?.id??result?.id;
  if(typeof providerId!=='string'||!providerId)throw Error('WhatsApp send returned no provider message ID');
  await store.markMessageSent(message.id,providerId);
 }catch(error){
  await store.markMessageFailed(message.id,error);
 }
 return true;
}
export async function runEnterpriseMessageLoop({store,sessions,signal,pollMs=1000}){
 if(!signal||typeof signal.aborted!=='boolean')throw Error('Abort signal required');
 if(!Number.isSafeInteger(pollMs)||pollMs<100||pollMs>60000)throw Error('Invalid poll interval');
 while(!signal.aborted){
  const processed=await processEnterpriseMessage({store,sessions});
  if(processed)continue;
  await new Promise(resolve=>{
   if(signal.aborted)return resolve();
   const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},pollMs);
   timer.unref();
   const stop=()=>{clearTimeout(timer);resolve();};
   signal.addEventListener('abort',stop,{once:true});
  });
 }
}
