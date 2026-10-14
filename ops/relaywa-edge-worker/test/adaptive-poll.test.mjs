import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hasActiveSessions, boundedInterval } from '../adaptive-poll.js';

const passive=()=>({engines:new Map([
  ['baileys', {sockets:new Map()}],
  ['chromium', {clients:new Map()}],
])});
test('worker uses idle polling only when both session engines are empty',()=>{
  const worker=passive();
  assert.equal(hasActiveSessions(worker),false);
  worker.engines.get('baileys').sockets.set('abc',{connected:true});
  assert.equal(hasActiveSessions(worker),true);
  worker.engines.get('baileys').sockets.clear();
  worker.engines.get('chromium').clients.set('def',{});
  assert.equal(hasActiveSessions(worker),true);
});
test('unknown or malformed session runtime never slows messaging',()=>{
  assert.equal(hasActiveSessions(null),true);
  assert.equal(hasActiveSessions({}),true);
  assert.equal(hasActiveSessions({engines:new Map([['custom',{}]])}),true);
});
test('minimum, default and maximum polling intervals are bounded',()=>{
  assert.equal(boundedInterval(undefined,30000),30000);
  assert.equal(boundedInterval('1000',30000),15000);
  assert.equal(boundedInterval('60000',30000),60000);
  assert.equal(boundedInterval('Infinity',30000),30000);
  assert.equal(boundedInterval('10000000',30000),300000);
});
test('production command/webhook loop keeps active responsiveness while backing off idle',async()=>{
  const code=await readFile(new URL('../command-loop.js',import.meta.url),'utf8');
  assert.match(code,/SESSION_IDLE_COMMAND_POLL_MS.*30000/);
  assert.match(code,/SESSION_IDLE_WEBHOOK_POLL_MS.*60000/);
  assert.match(code,/activeSessions \? ACTIVE_POLL_MS : IDLE_WEBHOOK_POLL_MS/);
  assert.match(code,/const activeSessions = hasActiveSessions\(sessions\)/);
  assert.match(code,/nextCommandPoll = Date\.now\(\) \+ \(activeSessions \? ACTIVE_POLL_MS : IDLE_POLL_MS\)/);
  assert.match(code,/await sleep\(ACTIVE_POLL_MS, signal\)/);
  assert.match(code,/signal\.removeEventListener\('abort', finish\)/);
  assert.match(code,/await store\.claimNextCommand\(\)/);
  assert.match(code,/await store\.heartbeatWorker\(\)/);
  assert.match(code,/await store\.claimNextWebhookDelivery\(\)/);
});
test('outbound direct dispatch continues while passive worker polls less',async()=>{
  const code=await readFile(new URL('../outbound-poll.js',import.meta.url),'utf8');
  assert.match(code,/OUTBOUND_IDLE_POLL_MS.*60000/);
  assert.match(code,/hasActiveSessions\(sessions\) \? POLL_MS : IDLE_POLL_MS/);
  assert.match(code,/await store\.pollDirectMessage\(\)/);
  assert.match(code,/sessions\.sendText\(/);
  assert.match(code,/sessions\.sendMedia\(/);
  assert.match(code,/signal\?\.removeEventListener\('abort', finish\)/);
});
