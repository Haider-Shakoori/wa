import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('per-session engine handover never interrupts a live authenticated session', async () => {
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../migrations/020_session_engine_handover.sql', import.meta.url), 'utf8');

  assert.match(controller, /sessions\/:sessionId\/engine/);
  assert.match(service, /next_engine/);
  assert.match(service, /requiresQrNow: false/);
  assert.match(service, /current authenticated engine stays active/);
  assert.doesNotMatch(service, /updateSessionEngine[\s\S]*sessionAction\(sessionId, 'logout'\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS next_engine/);
});
