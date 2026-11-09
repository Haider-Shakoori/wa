import test from 'node:test';
import assert from 'node:assert/strict';
import {EnterpriseBaileysSender} from '../src/enterprise-baileys-sender.js';
const id='11111111-1111-1111-1111-111111111111';
const msg={session_id:id,message_type:'text',recipient_jid:'12345678901@s.whatsapp.net',text_body:'hello'};
test('enterprise Baileys sender sends without legacy store acknowledgements',async()=>{
 const calls=[];
 const manager={sockets:new Map([[id,{user:{id:'me'},sendMessage:async(...args)=>{calls.push(args);return {key:{id:'provider-1'}};}}]])};
 const result=await new EnterpriseBaileysSender({manager}).sendText(id,msg);
 assert.deepEqual(result,{providerMessageId:'provider-1'});
 assert.deepEqual(calls,[[msg.recipient_jid,{text:'hello'}]]);
});
test('enterprise sender refuses disconnected socket and invalid recipients',async()=>{
 const manager={sockets:new Map()};
 const sender=new EnterpriseBaileysSender({manager});
 await assert.rejects(sender.sendText(id,msg),/not connected/);
 await assert.rejects(sender.sendText(id,{...msg,recipient_jid:'evil@example.com'}),/Invalid recipient/);
});
test('enterprise sender requires WhatsApp provider acknowledgement',async()=>{
 const manager={sockets:new Map([[id,{user:{id:'me'},sendMessage:async()=>({})}]])};
 await assert.rejects(new EnterpriseBaileysSender({manager}).sendText(id,msg),/did not acknowledge/);
});
