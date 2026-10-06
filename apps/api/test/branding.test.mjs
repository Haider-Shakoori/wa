import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public API health identifies relayWA brand', async () => {
  const source = await readFile(new URL('../src/app.controller.ts', import.meta.url), 'utf8');
  assert.match(source, /relayWA/);
  assert.match(source, /relaywa-api/);
});
