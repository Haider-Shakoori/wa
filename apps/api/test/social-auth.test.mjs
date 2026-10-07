import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('GitHub OAuth routes and single-use login-code exchange are present', async () => {
  const controller = await readFile(new URL('../src/auth/auth.controller.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/auth/auth.service.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../migrations/028_oauth_login_codes.sql', import.meta.url), 'utf8');

  assert.match(controller, /github\/start/);
  assert.match(controller, /github\/callback/);
  assert.match(controller, /github\/exchange/);

  assert.match(service, /github\.com\/login\/oauth\/authorize/);
  assert.match(service, /github\.com\/login\/oauth\/access_token/);
  assert.match(service, /api\.github\.com\/user\/emails/);
  assert.match(service, /item\.primary && item\.verified/);
  assert.match(service, /oauth_login_codes/);
  assert.match(service, /SET used_at = now\(\)/);
  assert.match(service, /expires_at > now\(\)/);
  assert.match(service, /createHash\('sha256'\)/);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS oauth_login_codes/);
  assert.match(migration, /code_hash char\(64\) NOT NULL UNIQUE/);
  assert.match(migration, /used_at timestamptz/);
});

test('Google and GitHub social identities link only after provider verification', async () => {
  const service = await readFile(new URL('../src/auth/auth.service.ts', import.meta.url), 'utf8');

  assert.match(service, /profile\.aud !== clientId/);
  assert.match(service, /profile\.email_verified !== 'true'/);
  assert.match(service, /GitHub account does not have a verified email address/);
  assert.match(service, /user_auth_identities/);
  assert.match(service, /ON CONFLICT \(user_id, provider\)/);
});

test('GitHub secret remains server-side and platform only stores public client configuration', async () => {
  const service = await readFile(new URL('../src/platform/platform-admin.service.ts', import.meta.url), 'utf8');
  const env = await readFile(new URL('../../../.env.example', import.meta.url), 'utf8');

  assert.match(service, /GITHUB_CLIENT_SECRET/);
  assert.match(service, /secretConfigured/);
  assert.match(service, /settings\/auth-providers\/github|provider = 'github'/);
  assert.match(env, /GITHUB_CLIENT_ID=/);
  assert.match(env, /GITHUB_CLIENT_SECRET=/);
  assert.match(env, /GITHUB_CALLBACK_URL=https:\/\/relaywa\.com\/api\/auth\/github\/callback/);
});
