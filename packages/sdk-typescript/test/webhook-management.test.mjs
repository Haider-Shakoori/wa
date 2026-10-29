import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayWA } from '../dist/index.js';

test('webhook create, update and delete use verified backend paths', async () => {
  const calls=[];
  const sdk=new RelayWA({sessionKey:'mock',fetch:async (url,options)=>{calls.push({url,options});return new Response('{}',{status:200});}});
  await sdk.webhooks.create({name:'My hook',url:'https://example.com/webhook',eventTypes:['message.received']});
  await sdk.webhooks.update('id/1',{enabled:false});
  await sdk.webhooks.remove('id/1');
  assert.deepEqual(calls.map(c=>[c.options.method,new URL(c.url).pathname]),[['POST','/api/webhooks'],['PATCH','/api/webhooks/id%2F1'],['DELETE','/api/webhooks/id%2F1']]);
  assert.equal(JSON.parse(calls[1].options.body).enabled,false);
  assert.ok(calls.every(c=>c.options.headers.Authorization==='Bearer mock'));
});

test('invalid webhook inputs fail before HTTP requests', () => {
  let calls=0;
  const sdk=new RelayWA({sessionKey:'mock',fetch:async ()=>{calls++;return new Response('{}');}});
  assert.throws(()=>sdk.webhooks.create({name:'x',url:'https://example.com'}),/name/);
  assert.throws(()=>sdk.webhooks.create({name:'valid',url:'http://example.com'}),/HTTPS/);
  assert.throws(()=>sdk.webhooks.update('id',{eventTypes:Array(33).fill('a')}),/event types/);
  assert.throws(()=>sdk.webhooks.update('id',{enabled:'yes'}),/boolean/);
  assert.equal(calls,0);
});
