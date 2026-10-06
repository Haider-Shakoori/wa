import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('outbound messages support scheduling priority and retry policy', async () => {
  const sql = await readFile(new URL('../migrations/014_message_queueing.sql', import.meta.url), 'utf8');
  assert.match(sql, /scheduled_at/);
  assert.match(sql, /priority integer/);
  assert.match(sql, /max_attempts integer/);
  assert.match(sql, /retrying/);
});

test('send DTOs expose scheduledAt for delayed dispatch', async () => {
  const source = await readFile(new URL('../src/messages/messages.dto.ts', import.meta.url), 'utf8');
  assert.match(source, /scheduledAt/);
});
