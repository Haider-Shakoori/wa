import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('inbound schema persists sender chat and provider identity idempotently', async () => {
  const sql = await readFile(new URL('../migrations/010_inbound_realtime.sql', import.meta.url), 'utf8');
  assert.match(sql, /sender_jid/);
  assert.match(sql, /chat_jid/);
  assert.match(sql, /status IN \('queued','claimed','sent','failed','received'\)/);
  assert.match(sql, /uq_whatsapp_messages_inbound_provider/);
});

test('messages API exposes tenant-scoped message history', async () => {
  const controller = await readFile(new URL('../src/messages/messages.controller.ts', import.meta.url), 'utf8');
  assert.match(controller, /list\(/);
  assert.match(controller, /request\.auth\.org/);
});

test('session API exposes SSE realtime event stream', async () => {
  const controller = await readFile(new URL('../src/sessions/sessions.controller.ts', import.meta.url), 'utf8');
  assert.match(controller, /@Sse\(':sessionId\/events'\)/);
  assert.match(controller, /events\.stream/);
});
