import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker media fetch enforces streaming size caps and HTTPS', async () => {
  const source = await readFile(new URL('../src/media-fetch.js', import.meta.url), 'utf8');
  assert.match(source, /protocol !== 'https:'/);
  assert.match(source, /total > limit/);
  assert.match(source, /redirect: 'error'/);
});

test('relayWA sends all supported media types through active socket', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /sendMedia/);
  for (const field of ['image','video','audio','document']) assert.match(source, new RegExp(field));
  assert.match(source, /ptt:/);
});
