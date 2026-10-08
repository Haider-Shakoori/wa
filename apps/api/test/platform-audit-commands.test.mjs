import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform session commands and audit events commit atomically with actor identity', async () => {
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const code = service.slice(service.indexOf('async sessionAction('), service.indexOf('async updateSessionEngine('));
  assert.match(code, /this\.db\.transaction\(async \(client\)/);
  assert.match(code, /INSERT INTO whatsapp_session_commands/);
  assert.match(code, /INSERT INTO platform_admin_audit_logs/);
  assert.match(code, /actorUserId/);
  assert.match(controller, /sessionAction\(sessionId, 'connect', request\.auth\.sub\)/);
  assert.match(controller, /sessionAction\(sessionId, 'restart', request\.auth\.sub\)/);
  assert.match(controller, /sessionAction\(sessionId, 'logout', request\.auth\.sub\)/);
});

test('audit history is protected by platform-wide authentication guards', async () => {
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  assert.match(controller, /@UseGuards\(JwtAuthGuard, PlatformAdminGuard\)/);
  assert.match(controller, /@Get\('audit-logs'\)/);
});

test('default messaging engine changes are audited with the acting administrator', async () => {
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const body = service.slice(service.indexOf('async updateMessagingEngine('), service.indexOf('async messagingSafetySettings('));
  assert.match(body, /this\.db\.transaction/);
  assert.match(body, /messaging\.default_engine\.updated/);
  assert.match(body, /actorUserId/);
  assert.match(controller, /updateMessagingEngine\(body, request\.auth\.sub\)/);
});

test('messaging safety governor changes and audit record are atomic', async () => {
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const block = service.slice(service.indexOf('async updateMessagingSafety('), service.indexOf('async workers()'));
  assert.match(block, /this\.db\.transaction\(async \(client\)/);
  assert.match(block, /FOR UPDATE/);
  assert.match(block, /messaging\.safety\.updated/);
  assert.match(block, /INSERT INTO platform_admin_audit_logs/);
  assert.match(controller, /updateMessagingSafety\(body, request\.auth\.sub\)/);
});

test('OAuth configuration records only public settings with administrator identity', async () => {
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  for (const provider of ['Google', 'Github']) {
    const from = service.indexOf('async update' + provider + 'AuthProvider(');
    const to = service.indexOf('\n  async ', from + 6);
    const block = service.slice(from, to);
    assert.match(block, /this\.db\.transaction/);
    assert.match(block, /authentication\.provider\.updated/);
    assert.match(block, /actorUserId/);
    assert.match(block, /enabled, public_config/);
    assert.match(controller, new RegExp('update' + provider + 'AuthProvider\\(body, request\\.auth\\.sub\\)'));
  }
});
