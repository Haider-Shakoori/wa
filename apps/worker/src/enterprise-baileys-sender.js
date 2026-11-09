/**
 * Enterprise Baileys outbound sender. Uses the already connected socket,
 * never the legacy BaileysSessionManager.sendText path, which writes directly
 * to PostgreSQL and would double-acknowledge an API-claimed message.
 * Only text is enabled until media and action transport is audited.
 */
export class EnterpriseBaileysSender {
 constructor({manager}={}){
  if(!manager||!(manager.sockets instanceof Map))throw Error('Baileys socket manager required');
  this.manager=manager;
 }
 async sendText(sessionId,message){
  if(!message||message.session_id!==sessionId||message.message_type!=='text')throw Error('Invalid enterprise text message');
  if(typeof message.recipient_jid!=='string'||!/^\d{5,20}@(?:s\.whatsapp\.net|lid)$/.test(message.recipient_jid))throw Error('Invalid recipient JID');
  if(typeof message.text_body!=='string'||!message.text_body.length)throw Error('Enterprise text body required');
  const socket=this.manager.sockets.get(sessionId);
  if(!socket||typeof socket.sendMessage!=='function'||!socket.user)throw Error('Enterprise WhatsApp socket is not connected');
  const result=await socket.sendMessage(message.recipient_jid,{text:message.text_body});
  const providerMessageId=result?.key?.id;
  if(typeof providerMessageId!=='string'||!providerMessageId)throw Error('WhatsApp provider did not acknowledge message');
  return {providerMessageId};
 }
}
