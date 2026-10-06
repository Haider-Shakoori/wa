import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('session rate limiter uses an explicit ioredis client', async () => {
  const source = await readFile(new URL('../src/message-queue.js', import.meta.url), 'utf8');
  assert.match(source, /import IORedis from 'ioredis'/);
  assert.match(source, /new IORedis\(redisUrl/);
  assert.match(source, /consumeSessionRateLimit\(\s*rateClient/);
  assert.doesNotMatch(source, /queue\.client/);
});
