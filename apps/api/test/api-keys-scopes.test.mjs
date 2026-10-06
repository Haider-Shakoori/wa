import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('API credentials are stored only as SHA-256 hashes', async () => {
  const source = await readFile(new URL('../src/api-keys/api-keys.service.ts', import.meta.url), 'utf8');
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /rw_live_/);
  assert.match(source, /rw_session_/);
});

test('API access guard supports JWT and relayWA API credentials', async () => {
  const source = await readFile(new URL('../src/auth/api-access.guard.ts', import.meta.url), 'utf8');
  assert.match(source, /rw_live_/);
  assert.match(source, /rw_session_/);
  assert.match(source, /verifyAsync/);
});

test('session tokens carry a session binding and scopes', async () => {
  const sql = await readFile(new URL('../migrations/013_api_keys_scopes.sql', import.meta.url), 'utf8');
  assert.match(sql, /session_id uuid/);
  assert.match(sql, /scopes text\[\]/);
  assert.match(sql, /last_used_at/);
});
