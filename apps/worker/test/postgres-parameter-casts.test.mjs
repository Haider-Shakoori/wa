import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('reused status parameters are explicitly cast for PostgreSQL', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /status = \$1::varchar\(24\)/);
  assert.match(source, /\$1::varchar\(24\) = 'connected'/);
  assert.match(source, /\$1::varchar\(24\) = 'retrying'/);
  assert.match(source, /\$1::varchar\(24\) = 'queued'/);
});
