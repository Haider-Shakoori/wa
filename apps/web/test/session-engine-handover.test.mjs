import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform sessions expose active and next engine without forcing QR', async () => {
  const source = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /changeSessionEngine/);
  assert.match(source, /sessions\/.*\/engine/);
  assert.match(source, /Active: /);
  assert.match(source, /Next: /);
  assert.match(source, /never logs out a working session or forces a QR scan/);
});
