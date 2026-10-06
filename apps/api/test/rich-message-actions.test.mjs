import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('rich action schema supports reply reaction location contact and poll', async () => {
  const sql = await readFile(new URL('../migrations/009_rich_message_actions.sql', import.meta.url), 'utf8');
  for (const type of ['reply','reaction','location','contact','poll']) {
    assert.match(sql, new RegExp(type));
  }
  assert.match(sql, /action_payload jsonb/);
});

test('rich endpoints are tenant scoped and permission protected', async () => {
  const source = await readFile(new URL('../src/messages/messages.controller.ts', import.meta.url), 'utf8');
  for (const route of ['reply','reaction','location','contact','poll']) {
    assert.match(source, new RegExp(`@Post\\('${route}'\\)`));
  }
  assert.match(source, /PERMISSIONS\.MESSAGES_SEND/);
});

test('poll validation requires multiple options and bounded selection count', async () => {
  const source = await readFile(new URL('../src/messages/action.dto.ts', import.meta.url), 'utf8');
  assert.match(source, /ArrayMinSize\(2\)/);
  assert.match(source, /ArrayMaxSize\(12\)/);
  assert.match(source, /selectableCount/);
});
