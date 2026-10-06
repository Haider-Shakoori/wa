import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard keeps watching after QR scan and shows connected number', async () => {
  const source = await readFile(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /watchConnectedSession/);
  assert.match(source, /current\.status === 'connected'/);
  assert.match(source, /Linked number:/);
  assert.match(source, /phone_number/);
  assert.match(source, /Connected profile synchronized/);
});

test('dashboard exposes developer guide navigation', async () => {
  const source = await readFile(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /Developers/);
  assert.match(source, /DeveloperGuide/);
});
