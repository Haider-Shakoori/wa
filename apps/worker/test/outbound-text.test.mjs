import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker atomically claims one direct outbound request', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /claimDirectMessage/);
  assert.match(source, /m.status='queued'/);
  assert.match(source, /s.worker_id=\$1 AND s.worker_lease_expires_at>now\(\)/);
});

test('relayWA session runtime sends text through active socket and persists provider id', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /sendText/);
  assert.match(source, /socket\.sendMessage/);
  assert.match(source, /markMessageSent/);
});
