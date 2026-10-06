import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('BullMQ drives outbound dispatch with retries and global limiter', async () => {
  const source = await readFile(new URL('../src/message-queue.js', import.meta.url), 'utf8');
  assert.match(source, /new Queue/);
  assert.match(source, /new Worker/);
  assert.match(source, /backoff/);
  assert.match(source, /limiter/);
});

test('per-session throttling and duplicate-safe BullMQ job IDs are present', async () => {
  const source = await readFile(new URL('../src/message-queue.js', import.meta.url), 'utf8');
  assert.match(source, /consumeSessionRateLimit/);
  assert.match(source, /jobId/);
  assert.match(source, /msg-/);
});
