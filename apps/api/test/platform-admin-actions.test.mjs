import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform admin exposes cross-tenant session controls', async () => {
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  for (const action of ['connect','restart','logout']) {
    assert.match(controller, new RegExp("sessions/:sessionId/" + action));
  }
  assert.match(service, /sessionAction/);
  assert.match(service, /whatsapp_session_commands/);
});

test('platform admin can update plan status and extend periods', async () => {
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  assert.match(controller, /subscriptions\/:organizationId/);
  assert.match(service, /updateSubscription/);
  assert.match(service, /extendDays/);
  assert.match(service, /subscription_plans/);
});
