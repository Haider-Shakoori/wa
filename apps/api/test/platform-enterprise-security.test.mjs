import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('platform admin role changes and tenant suspension are authorization gated and audited', async () => {
  const [controller, service, guard, roles, migration] = await Promise.all([
    load('../src/platform/platform-admin.controller.ts'),
    load('../src/platform/platform-admin.service.ts'),
    load('../src/auth/platform-admin.guard.ts'),
    load('../src/auth/platform-roles.decorator.ts'),
    load('../migrations/030_platform_security.sql'),
  ]);
  assert.match(controller, /@PlatformRoles\('super_admin'\)/);
  assert.match(controller, /tenants\/:organizationId\/suspension/);
  assert.match(controller, /administrators\/:userId\/role/);
  assert.match(guard, /Insufficient platform administrator role/);
  assert.match(guard, /PLATFORM_ROLES_KEY/);
  assert.match(roles, /billing_admin/);
  assert.match(roles, /support_admin/);
  assert.match(service, /Cannot suspend an organization containing a platform administrator/);
  assert.match(service, /Last super administrator must remain/);
  assert.match(service, /tenant\.suspended/);
  assert.match(service, /tenant\.reactivated/);
  assert.match(service, /platform\.admin\.role\.updated/);
  assert.match(service, /FOR UPDATE/);
  assert.match(migration, /UPDATE users SET platform_role = 'super_admin'/);
  assert.match(migration, /suspended_at/);
});

test('tenant suspension blocks API keys, JWTs, fresh logins, worker claims and webhooks', async () => {
  const [jwt, api, auth, worker] = await Promise.all([
    load('../src/auth/jwt-auth.guard.ts'),
    load('../src/auth/api-access.guard.ts'),
    load('../src/auth/auth.service.ts'),
    load('../../worker/src/session-store.js'),
  ]);
  assert.match(jwt, /o\.suspended_at IS NULL/);
  assert.match(api, /o\.suspended_at IS NULL/);
  assert.match(api, /o\.id = api_keys\.organization_id/);
  assert.match(auth, /SELECT onboarding_step FROM organizations WHERE id = \$1 AND suspended_at IS NULL/);
  assert.match(worker, /o\.id=m\.organization_id AND o\.suspended_at IS NULL/);
  assert.match(worker, /o\.id = c\.organization_id AND o\.suspended_at IS NULL/);
  assert.match(worker, /o\.id = d\.organization_id AND o\.suspended_at IS NULL/);
  assert.match(worker, /o\.id = e\.organization_id AND o\.suspended_at IS NULL/);
});

test('platform administrator sign-in events and audit filters avoid password material', async () => {
  const [auth, controller, service, migration] = await Promise.all([
    load('../src/auth/auth.service.ts'),
    load('../src/platform/platform-admin.controller.ts'),
    load('../src/platform/platform-admin.service.ts'),
    load('../migrations/030_platform_security.sql'),
  ]);
  assert.match(auth, /recordPlatformLogin/);
  assert.match(auth, /'failed', 'password'/);
  assert.match(auth, /'success', loginMethod/);
  assert.match(controller, /security\/login-events/);
  assert.match(controller, /@Query\('action'\)/);
  assert.match(service, /action ILIKE/);
  assert.match(service, /ORDER BY e\.created_at DESC LIMIT 100/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_login_events/);
  assert.doesNotMatch(migration, /password_hash|secret_encrypted/);
});
