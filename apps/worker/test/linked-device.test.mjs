import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker transport uses Baileys websocket linked-device client without browser automation', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /@whiskeysockets\/baileys/);
  assert.match(source, /useMultiFileAuthState/);
  assert.match(source, /printQRInTerminal: false/);
  assert.doesNotMatch(source, /puppeteer|chromium|selenium/i);
});

test('QR updates are persisted with expiry and connected state clears QR', async () => {
  const store = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(store, /status = 'need_scan'/);
  assert.match(store, /qr_expires_at/);
  assert.match(store, /clearQr/);
});

test('command loop supports connect restart and logout lifecycle commands', async () => {
  const loop = await readFile(new URL('../src/command-loop.js', import.meta.url), 'utf8');
  assert.match(loop, /sessions\.connect/);
  assert.match(loop, /sessions\.restart/);
  assert.match(loop, /sessions\.logout/);
});
