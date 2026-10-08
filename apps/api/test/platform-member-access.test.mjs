import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('platform membership controls require scoped targets and an audited reason', async () => {
  const [controller, service, dto] = await Promise.all([
    source('../src/platform/platform-admin.controller.ts'),
    source('../src/platform/platform-admin.service.ts'),
    source('../src/platform/platform-admin.dto.ts'),
  ]);
  assert.match(controller, /tenants\/:organizationId\/members\/:membershipId\/status/);
  assert.match(controller, /ParseUUIDPipe/);
  assert.match(controller, /request\.auth\.sub/);
  assert.match(dto, /class UpdateTenantMemberStatusDto/);
  assert.match(dto, /@IsIn\(\['active', 'suspended'\]\)/);
  assert.match(dto, /@MinLength\(8\)/);
  assert.match(service, /FOR UPDATE OF m/);
  assert.match(service, /FROM organizations WHERE id = \$1 FOR UPDATE/);
  assert.match(service, /Cannot suspend the final active organization owner/);
  assert.match(service, /Cannot suspend your own membership/);
  assert.match(service, /Cannot suspend a platform administrator/);
  assert.match(service, /tenant\.member\.suspended/);
  assert.match(service, /tenant\.member\.reactivated/);
  assert.match(service, /this\.recordAudit/);
});

test('suspended members cannot keep using previously issued dashboard JWTs', async () => {
  const [jwtGuard, apiGuard] = await Promise.all([
    source('../src/auth/jwt-auth.guard.ts'),
    source('../src/auth/api-access.guard.ts'),
  ]);
  for (const guard of [jwtGuard, apiGuard]) {
    assert.match(guard, /organization_memberships m/);
    assert.match(guard, /m\.status = 'active'/);
    assert.match(guard, /u\.disabled_at IS NULL/);
    assert.match(guard, /Organization access is inactive/);
  }
  assert.match(apiGuard, /token\.startsWith\('rw_live_'\)/);
  assert.match(apiGuard, /return true;/);
});
