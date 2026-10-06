import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('recovery migration stores recovery diagnostics', async () => {
  const sql = await readFile(new URL('../migrations/006_session_recovery.sql', import.meta.url), 'utf8');
  assert.match(sql, /recovery_started_at/);
  assert.match(sql, /last_recovery_at/);
  assert.match(sql, /recovery_reason/);
});
