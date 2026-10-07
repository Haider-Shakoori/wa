import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messaging safety migration enforces a non-zero hard delay floor', async () => {
  const sql = await readFile(new URL('../migrations/022_messaging_safety_governor.sql', import.meta.url), 'utf8');
  assert.match(sql, /min_delay_ms integer NOT NULL DEFAULT 2500/);
  assert.match(sql, /min_delay_ms >= 1000/);
  assert.match(sql, /messages_per_minute/);
  assert.match(sql, /messages_per_hour/);
  assert.match(sql, /duplicate_window_seconds/);
  assert.match(sql, /messaging_paused_until/);
});

test('platform API exposes hot-reloadable messaging safety settings', async () => {
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  assert.match(controller, /settings\/messaging-safety/);
  assert.match(service, /messagingSafetySettings/);
  assert.match(service, /updateMessagingSafety/);
  assert.match(service, /hardMinimumDelayMs: 1000/);
  assert.match(service, /resumeSessionMessaging/);
});
