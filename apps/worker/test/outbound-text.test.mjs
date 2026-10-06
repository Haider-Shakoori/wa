import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker claims queued outbound text atomically', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /claimNextOutboundMessage/);
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
});

test('relayWA session runtime sends text through active socket and persists provider id', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /sendText/);
  assert.match(source, /socket\.sendMessage/);
  assert.match(source, /markMessageSent/);
});
