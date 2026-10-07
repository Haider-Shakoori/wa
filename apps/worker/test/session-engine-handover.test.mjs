import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker promotes a deferred engine only after auth is inactive', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /SELECT engine, next_engine, status/);
  assert.match(source, /\['pending', 'logged_out'\]\.includes\(session\.status\)/);
  assert.match(source, /SET engine = next_engine, next_engine = NULL/);
  assert.doesNotMatch(source, /\['connected'.*\]\.includes\(session\.status\)/);
});
