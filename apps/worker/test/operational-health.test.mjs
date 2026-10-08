import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('background health scan checks stale WhatsApp leases and delayed queue without changing records',async()=>{
  const store=await read('../src/session-store.js');
  assert.match(store,/async scanOperationalHealth\(/);
  const start=store.indexOf('  async scanOperationalHealth(');
  const end=store.indexOf('  async queueSystemAlert(',start);
  const section=store.slice(start,end);
  assert.match(section,/worker\.session_lease_expired/);
  assert.match(section,/messaging\.queue_stalled/);
  assert.match(section,/s\.worker_lease_expires_at < now\(\) - interval '1 minute'/);
  assert.match(section,/m\.queued_at < now\(\) - interval '10 minutes'/);
  assert.match(section,/o\.suspended_at IS NULL/);
  assert.match(section,/cooldownSeconds:900/);
  assert.match(section,/cooldownSeconds:1800/);
  assert.doesNotMatch(section, /UPDATE whatsapp_sessions|DELETE FROM whatsapp_messages|UPDATE whatsapp_messages/);
});

test('health scan failures are isolated from WhatsApp command and webhook processing',async()=>{
  const loop=await read('../src/command-loop.js');
  assert.match(loop,/let nextHealthScan = 0/);
  assert.match(loop,/Math\.max\(30_000/);
  assert.match(loop,/await store\.scanOperationalHealth\(\)/);
  assert.match(loop,/catch \(error\)/);
  assert.match(loop,/await store\.claimNextCommand\(\)/);
  assert.match(loop,/await store\.claimNextWebhookDelivery\(\)/);
});
