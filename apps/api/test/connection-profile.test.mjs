import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('session profile migration persists identity and sync diagnostics', async () => {
  const sql = await readFile(new URL('../migrations/005_connection_profile_sync.sql', import.meta.url), 'utf8');
  for (const column of ['whatsapp_jid','profile_picture_url','profile_synced_at','reconnect_attempts','last_connection_error']) {
    assert.match(sql, new RegExp(column));
  }
});

test('session API returns synchronized identity fields', async () => {
  const source = await readFile(new URL('../src/sessions/sessions.service.ts', import.meta.url), 'utf8');
  assert.match(source, /phone_number/);
  assert.match(source, /display_name/);
  assert.match(source, /whatsapp_jid/);
  assert.match(source, /profile_synced_at/);
});
