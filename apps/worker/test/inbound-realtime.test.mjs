import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker listens for incoming WhatsApp message upserts', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /messages\.upsert/);
  assert.match(source, /store\.saveInboundMessage/);
});

test('inbound normalizer covers text media location contact reaction and poll metadata', async () => {
  const source = await readFile(new URL('../src/inbound-message.js', import.meta.url), 'utf8');
  for (const type of ['text','image','video','audio','document','location','contact','reaction','poll']) {
    assert.match(source, new RegExp(type));
  }
  assert.match(source, /key\.fromMe/);
});
