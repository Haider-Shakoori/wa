import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform admin exposes global session and subscription oversight', async () => {
  const controller = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  assert.match(controller, /@Get\('sessions'\)/);
  assert.match(controller, /@Get\('subscriptions'\)/);
  assert.match(service, /organization_name/);
  assert.match(service, /phone_number/);
});
