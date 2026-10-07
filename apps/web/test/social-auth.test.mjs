import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('tenant login and registration expose Google and GitHub without exposing Platform Admin', async () => {
  const auth = await readFile(new URL('../components/relay-auth.tsx', import.meta.url), 'utf8');
  const github = await readFile(new URL('../components/github-signin.tsx', import.meta.url), 'utf8');
  const google = await readFile(new URL('../components/google-signin.tsx', import.meta.url), 'utf8');

  assert.match(auth, /GoogleSignIn/);
  assert.match(auth, /GithubSignIn/);
  assert.match(auth, /\/auth\/github\/exchange/);
  assert.match(auth, /tenantDestination/);
  assert.match(google, /preservePlan/);
  assert.match(google, /result\.nextPath/);
  assert.match(github, /\/auth\/github\/start/);
  assert.match(github, /Continue with GitHub/);
  assert.doesNotMatch(auth, /platform administrator/i);
});

test('Platform Admin configures public OAuth IDs while keeping GitHub secret environment-only', async () => {
  const platform = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');

  assert.match(platform, /Save Google settings/);
  assert.match(platform, /Save GitHub settings/);
  assert.match(platform, /settings\/auth-providers\/github/);
  assert.match(platform, /https:\/\/relaywa\.com\/api\/auth\/github\/callback/);
  assert.match(platform, /GitHub Client Secret is configured on the server/);
  assert.doesNotMatch(platform, /type="password"[^>]*GITHUB_CLIENT_SECRET/);
});

test('GitHub callback stays on the canonical RelayWA origin', async () => {
  const github = await readFile(new URL('../components/github-signin.tsx', import.meta.url), 'utf8');
  const env = await readFile(new URL('../../../.env.example', import.meta.url), 'utf8');

  assert.doesNotMatch(github, /api\.relaywa\.com|app\.relaywa\.com|platform\.relaywa\.com/);
  assert.match(env, /GITHUB_CALLBACK_URL=https:\/\/relaywa\.com\/api\/auth\/github\/callback/);
  assert.match(env, /AUTH_FRONTEND_URL=https:\/\/relaywa\.com/);
});
