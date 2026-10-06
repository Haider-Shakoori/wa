import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('directory schema stores contacts chats and groups', async () => {
  const sql = await readFile(new URL('../migrations/011_chats_contacts_groups.sql', import.meta.url), 'utf8');
  assert.match(sql, /whatsapp_contacts/);
  assert.match(sql, /whatsapp_chats/);
  assert.match(sql, /whatsapp_groups/);
});

test('directory endpoints are tenant scoped', async () => {
  const controller = await readFile(new URL('../src/directory/directory.controller.ts', import.meta.url), 'utf8');
  for (const route of ['contacts','chats','groups']) assert.match(controller, new RegExp(route));
  assert.match(controller, /request\.auth\.org/);
});
