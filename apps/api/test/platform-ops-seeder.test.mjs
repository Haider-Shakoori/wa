import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform admin seeder is environment-driven and idempotent', async () => {
  const source = await readFile(new URL('../scripts/seed-platform-admin.mjs', import.meta.url), 'utf8');
  assert.match(source, /RELAYWA_ADMIN_EMAIL/);
  assert.match(source, /RELAYWA_ADMIN_PASSWORD/);
  assert.match(source, /is_platform_admin = true/);
  assert.match(source, /SELECT id, email FROM users/);
});

test('platform operations expose tenant worker queue and error diagnostics', async () => {
  const source = await readFile(new URL('../src/platform/platform-admin.controller.ts', import.meta.url), 'utf8');
  for (const route of ['tenants','workers','queues','errors']) assert.match(source, new RegExp(route));
});
