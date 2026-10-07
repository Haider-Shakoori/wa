import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform Messaging page exposes Safety Governor controls', async () => {
  const source = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /Safety Governor/);
  assert.match(source, /settings\/messaging-safety/);
  assert.match(source, /Minimum delay between messages/);
  assert.match(source, /Messages per minute/);
  assert.match(source, /Duplicate suppression window/);
  assert.match(source, /Auto-pause after final failures/);
});

test('platform can visibly resume a safety-paused session', async () => {
  const source = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /safety_paused/);
  assert.match(source, /Resume sending/);
  assert.match(source, /messaging\/resume/);
});
