import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform Ops Assistant is private, read-only and backed by live operational state', async () => {
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const dto = await readFile(new URL('../src/platform/platform-admin.dto.ts', import.meta.url), 'utf8');

  assert.match(controller, /@Post\('support\/ask'\)/);
  assert.match(controller, /PlatformAdminGuard/);
  assert.match(controller, /supportAnswer\(body\.message\)/);

  assert.match(service, /async supportAnswer/);
  assert.match(service, /this\.overview\(\)/);
  assert.match(service, /this\.sessions\(\)/);
  assert.match(service, /this\.workers\(\)/);
  assert.match(service, /this\.queues\(\)/);
  assert.match(service, /this\.recentErrors\(\)/);
  assert.match(service, /this\.messagingSafetySettings\(\)/);
  assert.match(service, /this\.messagingEngineSettings\(\)/);
  assert.match(service, /intent: 'sessions'/);
  assert.match(service, /intent: 'messaging'/);
  assert.match(service, /intent: 'safety'/);
  assert.match(service, /intent: 'infrastructure'/);

  assert.match(dto, /class PlatformSupportQuestionDto/);
  assert.match(dto, /@MaxLength\(500\)/);
});

test('Ops Assistant does not expose mutation commands', async () => {
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const supportStart = service.indexOf('async supportAnswer');
  const supportEnd = service.indexOf('private async count', supportStart);
  const supportSource = service.slice(supportStart, supportEnd);
  assert.doesNotMatch(supportSource, /UPDATE whatsapp_sessions/);
  assert.doesNotMatch(supportSource, /INSERT INTO whatsapp_session_commands/);
  assert.doesNotMatch(supportSource, /DELETE FROM/);
});
