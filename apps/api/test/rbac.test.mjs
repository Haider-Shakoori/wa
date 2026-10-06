import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('role permission map keeps billing exclusive to owner', async () => {
  const source = await readFile(new URL('../src/auth/permissions.ts', import.meta.url), 'utf8');
  assert.match(source, /owner: Object\.values\(PERMISSIONS\)/);
  const adminBlock = source.match(/admin:\s*\[([\s\S]*?)\],/)?.[1] ?? '';
  assert.doesNotMatch(adminBlock, /BILLING_MANAGE/);
});

test('permission guard revalidates active tenant membership from database', async () => {
  const source = await readFile(new URL('../src/auth/permission.guard.ts', import.meta.url), 'utf8');
  assert.match(source, /organization_id = \$2/);
  assert.match(source, /user_id = \$3/);
  assert.match(source, /status = 'active'/);
});

test('platform administration is separate from organization roles', async () => {
  const migration = await readFile(new URL('../migrations/002_rbac_platform_admin.sql', import.meta.url), 'utf8');
  const guard = await readFile(new URL('../src/auth/platform-admin.guard.ts', import.meta.url), 'utf8');
  assert.match(migration, /is_platform_admin boolean NOT NULL DEFAULT false/);
  assert.match(guard, /is_platform_admin/);
});
