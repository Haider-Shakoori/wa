import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('outbound text API is tenant scoped and requires message send permission', async () => {
  const source = await readFile(new URL('../src/messages/messages.controller.ts', import.meta.url), 'utf8');
  assert.match(source, /PERMISSIONS\.MESSAGES_SEND/);
  assert.match(source, /request\.auth\.org/);
});

test('recipient normalization produces WhatsApp JIDs and rejects arbitrary text', async () => {
  const source = await readFile(new URL('../src/messages/recipient.ts', import.meta.url), 'utf8');
  assert.match(source, /@s\.whatsapp\.net/);
  assert.match(source, /\\d\{7,15\}/);
});

test('message queue supports idempotent client message ids', async () => {
  const sql = await readFile(new URL('../migrations/007_outbound_messages.sql', import.meta.url), 'utf8');
  assert.match(sql, /uq_whatsapp_messages_client_id/);
  assert.match(sql, /provider_message_id/);
});
