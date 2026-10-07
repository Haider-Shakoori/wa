import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMedia } from '../src/media-fetch.js';

const message={message_type:'document',media_url:'https://files.example.com/invoice.pdf',media_mime_type:'application/pdf',media_size_bytes:4};
test('media transfer validates real bytes, MIME, emptiness and stream limits',async t=>{
 const original=globalThis.fetch;
 t.after(()=>{globalThis.fetch=original;});
 const reply=(body,headers={})=>{globalThis.fetch=async()=>new Response(body,{headers});};
 await t.test('valid transfer keeps returned bytes intact',async()=>{
  reply(new Uint8Array([1,2,3,4]),{'content-type':'application/pdf'});
  const bytes=await fetchMedia(message);
  assert.deepEqual([...bytes],[1,2,3,4]);
 });
 await t.test('rejects a different actual size',async()=>{
  reply(new Uint8Array([1,2,3]));
  await assert.rejects(fetchMedia(message),/size does not match/);
 });
 await t.test('rejects a different content type',async()=>{
  reply('html',{'content-type':'text/html'});
  await assert.rejects(fetchMedia(message),/MIME type does not match/);
 });
 await t.test('rejects empty files',async()=>{
  reply(new Uint8Array());
  await assert.rejects(fetchMedia(message),/empty/);
 });
 await t.test('rejects stream exceeding cap without content-length',async()=>{
  reply(new Uint8Array(16*1024*1024+1));
  await assert.rejects(fetchMedia({...message,message_type:'image',media_mime_type:'image/png'}),/allowed size while downloading/);
 });
 await t.test('cancels response when content-length exceeds cap',async()=>{
  let signal;
  globalThis.fetch=async(_url,options)=>{signal=options.signal;return new Response('data',{headers:{'content-length':'104857601'}});};
  await assert.rejects(fetchMedia(message),/allowed size/);
  assert.equal(signal.aborted,true);
 });
});
