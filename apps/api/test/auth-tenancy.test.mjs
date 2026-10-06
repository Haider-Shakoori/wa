import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth tenancy migration enforces unique memberships and organization ownership', async () => {
  const sql = await readFile(new URL('../migrations/001_auth_tenancy.sql', import.meta.url), 'utf8');
  assert.match(sql, /UNIQUE \(organization_id, user_id\)/);
  assert.match(sql, /organization_id uuid NOT NULL REFERENCES organizations/);
  assert.match(sql, /user_id uuid NOT NULL REFERENCES users/);
});

test('auth routes expose register, login and protected me endpoint', async () => {
  const controller = await readFile(new URL('../src/auth/auth.controller.ts', import.meta.url), 'utf8');
  assert.match(controller, /@Post\('register'\)/);
  assert.match(controller, /@Post\('login'\)/);
  assert.match(controller, /@UseGuards\(JwtAuthGuard\)/);
});
