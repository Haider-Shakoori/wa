import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform exposes a persisted messaging engine switcher', async () => {
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const sessions = await readFile(new URL('../src/sessions/sessions.service.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../migrations/019_messaging_engine_settings.sql', import.meta.url), 'utf8');

  assert.match(controller, /settings\/messaging-engine/);
  assert.match(service, /default_engine/);
  assert.match(service, /Existing sessions keep their assigned engine/);
  assert.match(sessions, /messaging_engine_settings/);
  assert.match(sessions, /status, engine/);
  assert.match(migration, /CHECK \(engine IN \('baileys', 'chromium'\)\)/);
});
