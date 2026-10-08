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
