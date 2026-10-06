import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('media schema supports image video audio and documents', async () => {
  const sql = await readFile(new URL('../migrations/008_media_messages.sql', import.meta.url), 'utf8');
  for (const type of ['image','video','audio','document']) assert.match(sql, new RegExp(type));
  assert.match(sql, /media_size_bytes/);
  assert.match(sql, /voice_note/);
});

test('API media policy requires HTTPS and blocks private address literals', async () => {
  const source = await readFile(new URL('../src/messages/media-policy.ts', import.meta.url), 'utf8');
  assert.match(source, /parsed\.protocol !== 'https:'/);
  assert.match(source, /192\\\.168/);
  assert.match(source, /MEDIA_LIMITS/);
});

test('media endpoints require message send permission', async () => {
  const source = await readFile(new URL('../src/messages/messages.controller.ts', import.meta.url), 'utf8');
  for (const route of ['image','video','audio','document']) assert.match(source, new RegExp(`@Post\\('${route}'\\)`));
  assert.match(source, /PERMISSIONS\.MESSAGES_SEND/);
});
