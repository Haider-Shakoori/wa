import {EnterpriseSessionStore} from './enterprise-session-store.js';
import {EnterpriseBaileysSender} from './enterprise-baileys-sender.js';
import {processEnterpriseCommand} from './enterprise-command-loop.js';
import {processEnterpriseMessage} from './enterprise-message-loop.js';

/** API-only composition; never starts the legacy worker or a listener. */
export function createEnterpriseRuntime({client,sessionManager,leaseMs=30000}={}){
 if(!client||typeof client.heartbeat!=='function'||typeof client.commandPoll!=='function')throw Error('Enterprise API client required');
 if(!sessionManager||sessionManager.enterpriseIsolated!==true||!(sessionManager.sockets instanceof Map))throw Error('Isolated enterprise Baileys manager required');
 for(const method of ['connect','restart','logout']){
  if(typeof sessionManager[method]!=='function')throw Error('Missing isolated enterprise session operation');
 }
 const store=new EnterpriseSessionStore({client,leaseMs});
 const sender=new EnterpriseBaileysSender({manager:sessionManager});
 return Object.freeze({
  store,sender,
  processCommand:()=>processEnterpriseCommand({store,sessions:sessionManager}),
  processMessage:()=>processEnterpriseMessage({store,sessions:sender}),
 });
}
