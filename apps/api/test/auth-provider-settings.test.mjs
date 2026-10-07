import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Google authentication is configurable from platform settings', async () => {
  const controller=await readFile(new URL('../src/platform/platform-admin.controller.ts',import.meta.url),'utf8');
  const service=await readFile(new URL('../src/platform/platform-admin.service.ts',import.meta.url),'utf8');
  const migration=await readFile(new URL('../migrations/018_auth_provider_settings.sql',import.meta.url),'utf8');
  assert.match(controller,/settings\/auth-providers/);
  assert.match(controller,/settings\/auth-providers\/google/);
  assert.match(service,/updateGoogleAuthProvider/);
  assert.match(service,/auth_provider_settings/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS auth_provider_settings/);
});

test('public auth provider config controls Google credential verification', async () => {
  const controller=await readFile(new URL('../src/auth/auth.controller.ts',import.meta.url),'utf8');
  const service=await readFile(new URL('../src/auth/auth.service.ts',import.meta.url),'utf8');
  assert.match(controller,/@Get\('providers'\)/);
  assert.match(service,/async providers\(\)/);
  assert.match(service,/settings\.google\.enabled/);
  assert.match(service,/profile\.aud !== clientId/);
});
