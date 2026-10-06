import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('connected session profile is retried instead of relying on a single socket.user read', async () => {
  const source = await readFile(new URL('../src/profile-sync.js', import.meta.url), 'utf8');
  assert.match(source, /PROFILE_RETRY_DELAYS_MS/);
  assert.match(source, /profilePictureUrl/);
  assert.match(source, /store\.syncProfile/);
});

test('transient disconnects schedule authenticated reconnect instead of forcing a new QR', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /scheduleReconnect/);
  assert.match(source, /reconnecting/);
  assert.match(source, /DisconnectReason\.loggedOut/);
});

test('contact updates can enrich a connected session display name', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /contacts\.upsert/);
  assert.match(source, /updateProfileFromContact/);
});
