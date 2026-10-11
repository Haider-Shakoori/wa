import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login supports sign in, registration and Google', async () => {
  const login = await readFile(new URL('../components/relay-auth.tsx', import.meta.url), 'utf8');
  const google = (await readFile(new URL('../components/google-signin.tsx', import.meta.url), 'utf8')) + (await readFile(new URL('../lib/auth-providers.ts', import.meta.url), 'utf8'));
  assert.match(login,/Create your account/);
  assert.match(login,/\/auth\//);
  assert.match(login,/GoogleSignIn/);
  assert.match(google,/\/auth\/google/);
  assert.match(google,/\/auth\/providers/);
  assert.doesNotMatch(google,/NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
});

test('legacy onboarding URL redirects to the workspace instead of showing a setup wizard', async () => {
  const source = await readFile(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /redirect\('\/dashboard'\)/);
  assert.doesNotMatch(source, /\/onboarding\/state|Choose plan|Test message/);
});

test('dashboard provides guided setup without blocking the workspace', async () => {
  const source = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source,/Build your integration/);
  assert.match(source,/Create a session/);
});
