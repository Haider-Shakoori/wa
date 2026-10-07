import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard keeps watching after QR scan and shows connected number', async () => {
  const source = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /setInterval/);
  assert.match(source, /session\.status!=='connected'/);
  assert.match(source, /Phone number/);
  assert.match(source, /phone_number/);
  assert.match(source, /last_connected_at/);
});

test('dashboard exposes developer guide navigation', async () => {
  const source = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /API documentation/);
  assert.match(source, /\/api-docs/);
});
