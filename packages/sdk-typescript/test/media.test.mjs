import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayWA, RelayWAError } from '../dist/index.js';

const input = {to:'12025550123',url:'https://example.com/photo.jpg',mimeType:'image/jpeg',mediaSizeBytes:1024,caption:'Hi'};
test('media helpers call the four backend legacy endpoints with bearer authentication', async () => {
  const calls=[];
  const sdk=new RelayWA({sessionKey:'offline',fetch:async (url,options)=>{calls.push({url,options});return new Response('{}',{status:200});}});
  for (const kind of ['Image','Video','Audio','Document']) await sdk.messages['send'+kind](input);
  assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/api/send-image','/api/send-video','/api/send-audio','/api/send-document']);
  assert.ok(calls.every(c=>c.options.method==='POST' && c.options.headers.Authorization==='Bearer offline'));
  assert.deepEqual(JSON.parse(calls[0].options.body),input);
});

test('media validation blocks bad URLs and invalid sizes without making requests', async () => {
  let calls=0;
  const sdk=new RelayWA({sessionKey:'offline',fetch:async ()=>{calls++;return new Response('{}');}});
  assert.throws(()=>sdk.messages.sendImage({...input,url:'http://example.com/a.jpg'}),/HTTPS/);
  assert.throws(()=>sdk.messages.sendImage({...input,mediaSizeBytes:16*1024*1024+1}),/size/);
  assert.throws(()=>sdk.messages.sendVideo({...input,mediaSizeBytes:0}),/size/);
  assert.throws(()=>sdk.messages.sendImage({...input,to:''}),/recipient/);
  assert.equal(calls,0);
});

test('media errors are typed and never automatically retried', async () => {
  let calls=0;
  const sdk=new RelayWA({sessionKey:'offline',fetch:async ()=>{calls++;return new Response('rate limited',{status:429});}});
  await assert.rejects(()=>sdk.messages.sendImage(input),e=>e instanceof RelayWAError && e.status===429);
  assert.equal(calls,1);
});
