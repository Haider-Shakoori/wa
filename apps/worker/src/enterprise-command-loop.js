/**
 * Enterprise-only command executor. Commands are claimed atomically by the
 * API, never through the legacy database store. A missing session lease
 * prevents a stale worker from executing a WhatsApp command.
 */
export async function processEnterpriseCommand({store,sessions}){
 if(!store||typeof store.pollCommand!=='function'||typeof store.lookupSession!=='function')throw Error('Enterprise store required');
 if(!sessions)throw Error('Session manager required');
 const command=await store.pollCommand();
 if(!command)return false;
 if(typeof command.id!=='string'||typeof command.session_id!=='string')throw Error('Malformed claimed enterprise command');
 try{
  const owned=await store.lookupSession(command.session_id);
  if(!owned||owned.worker_id!==store.workerId)throw Error('Enterprise session lease ownership lost');
  const operation={
   connect:()=>sessions.connect(command.session_id),
   restart:()=>sessions.restart(command.session_id),
   logout:()=>sessions.logout(command.session_id),
  }[command.command];
  if(!operation)throw Error('Unsupported enterprise command');
  await operation();
  await store.completeCommand(command.id);
 }catch(error){
  await store.failCommand(command.id,error);
 }
 return true;
}

/** Only run with an enterprise API-backed store and isolated session manager. */
export async function runEnterpriseCommandLoop({store,sessions,signal,pollMs=1000}){
 if(!signal||typeof signal.aborted!=='boolean')throw Error('Abort signal required');
 if(!Number.isSafeInteger(pollMs)||pollMs<100||pollMs>60000)throw Error('Invalid poll interval');
 while(!signal.aborted){
  const processed=await processEnterpriseCommand({store,sessions});
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
