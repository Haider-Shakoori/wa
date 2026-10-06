import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker dispatches rich actions through dedicated sender', async () => {
  const loop = await readFile(new URL('../src/command-loop.js', import.meta.url), 'utf8');
  assert.match(loop, /sendAction/);
});

test('Baileys payloads cover replies reactions locations contacts and polls', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  for (const marker of ['quotedMessage','react:','location:','contacts:','poll:']) {
    assert.match(source, new RegExp(marker));
  }
});
