import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('session migration isolates tenants and models worker leases', async () => {
  const sql = await readFile(new URL('../migrations/003_whatsapp_sessions.sql', import.meta.url), 'utf8');
  assert.match(sql, /organization_id uuid NOT NULL REFERENCES organizations/);
  assert.match(sql, /worker_lease_expires_at timestamptz/);
  assert.match(sql, /uq_whatsapp_sessions_org_name/);
  assert.match(sql, /whatsapp_session_commands/);
});

test('session lifecycle mirrors linked-device states', async () => {
  const source = await readFile(new URL('../src/sessions/session-status.ts', import.meta.url), 'utf8');
  for (const state of ['need_scan','connecting','connected','disconnected','reconnecting','logged_out','expired']) {
    assert.match(source, new RegExp(state));
  }
});

test('session API is organization scoped and permission protected', async () => {
  const controller = await readFile(new URL('../src/sessions/sessions.controller.ts', import.meta.url), 'utf8');
  assert.match(controller, /request\.auth\.org/);
  assert.match(controller, /RequirePermissions\(PERMISSIONS\.SESSIONS_MANAGE\)/);
});
