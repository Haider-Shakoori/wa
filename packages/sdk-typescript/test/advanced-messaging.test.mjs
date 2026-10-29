import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayWA } from '../dist/index.js';

test('advanced messages map to verified send-action routes', async () => {
 const calls=[];
 const sdk=new RelayWA({sessionKey:'test',fetch:async (url,options)=>{calls.push({url,options});return new Response('{}',{status:200});}});
 await sdk.messages.sendLocation({to:'1234567890',latitude:34.5,longitude:69.2});
 await sdk.messages.sendContact({to:'1234567890',displayName:'Test',vcard:'BEGIN:VCARD\\nEND:VCARD'});
 await sdk.messages.sendPoll({to:'1234567890',question:'Choose?',options:['A','B'],selectableCount:1});
 await sdk.messages.sendReply({to:'1234567890',text:'Hi',quotedMessageId:'abc'});
 await sdk.messages.sendReaction({to:'1234567890',emoji:'👍',targetMessageId:'abc'});
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/api/send-location','/api/send-contact','/api/send-poll','/api/send-reply','/api/send-reaction']);
 assert.ok(calls.every(c=>c.options.method==='POST' && c.options.headers.Authorization==='Bearer test'));
});

test('invalid advanced messages fail before HTTP',()=>{
 let calls=0;
 const sdk=new RelayWA({sessionKey:'test',fetch:async ()=>{calls++;return new Response('{}');}});
 assert.throws(()=>sdk.messages.sendLocation({to:'1234567890',latitude:100,longitude:0}),/coordinates/);
 assert.throws(()=>sdk.messages.sendPoll({to:'1234567890',question:'?',options:['A'],selectableCount:1}),/poll/);
 assert.throws(()=>sdk.messages.sendReply({to:'1234567890',text:'',quotedMessageId:'x'}),/reply/);
 assert.equal(calls,0);
});
