import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker listens for contact chat and group metadata updates', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /contacts\.upsert/);
  assert.match(source, /chats\.upsert/);
  assert.match(source, /groups\.upsert/);
});

test('store upserts directory records', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /upsertContact/);
  assert.match(source, /upsertChat/);
  assert.match(source, /upsertGroup/);
});
