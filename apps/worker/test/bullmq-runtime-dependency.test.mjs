import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker ships ioredis because BullMQ needs it at runtime', async () => {
  const raw = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  const pkg = JSON.parse(raw);
  assert.ok(pkg.dependencies?.ioredis, 'ioredis must be a worker runtime dependency');
});
