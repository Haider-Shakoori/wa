import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth service routes platform admins to the platform control plane', async () => {
  const source = await readFile(new URL('../src/auth/auth.service.ts', import.meta.url), 'utf8');
  assert.match(source, /SELECT is_platform_admin, mfa_enabled_at, token_version FROM users/);
  assert.match(source, /isPlatformAdmin/);
  assert.match(source, /nextPath: isPlatformAdmin \? '\/platform'/);
});
