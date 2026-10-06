import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker startup recovery claims only expired or stale sessions', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /claimRecoverableSessions/);
  assert.match(source, /worker_lease_expires_at IS NULL OR worker_lease_expires_at <= now\(\)/);
  assert.match(source, /status IN \('connecting','connected','reconnecting','disconnected'\)/);
});

test('recovery watchdog restores sessions after worker restart', async () => {
  const source = await readFile(new URL('../src/recovery.js', import.meta.url), 'utf8');
  assert.match(source, /recoverSessions/);
  assert.match(source, /sessions\.restore/);
  assert.match(source, /SESSION_RECOVERY_WATCHDOG_MS/);
});

test('corrupt auth state is quarantined and forces a clean scan state', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /quarantineAuth/);
  assert.match(source, /auth_corrupt/);
  assert.match(source, /need_scan/);
});

test('reconnect delay grows with persisted attempt count', async () => {
  const source = await readFile(new URL('../src/baileys-session.js', import.meta.url), 'utf8');
  assert.match(source, /reconnectAttempts/);
  assert.match(source, /RECONNECT_DELAYS_MS/);
});
