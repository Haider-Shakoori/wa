import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login supports sign in, registration and Google', async () => {
  const login = await readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
  const google = await readFile(new URL('../components/google-signin.tsx', import.meta.url), 'utf8');
  assert.match(login,/Create account/);
  assert.match(login,/\/v1\/auth\/register/);
  assert.match(login,/GoogleSignIn/);
  assert.match(google,/\/v1\/auth\/google/);
  assert.match(google,/\/v1\/auth\/providers/);
  assert.doesNotMatch(google,/NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
});

test('onboarding implements plan through webhook setup', async () => {
  const source = await readFile(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8');
  for (const label of ['Choose plan','Workspace','Connect WhatsApp','API key','Test message','Webhook']) {
    assert.match(source,new RegExp(label));
  }
  assert.match(source,/billing\/checkout\/stripe/);
  assert.match(source,/billing\/manual/);
  assert.match(source,/\/v1\/sessions/);
  assert.match(source,/\/v1\/api-keys/);
  assert.match(source,/\/messages\/text/);
  assert.match(source,/\/v1\/webhooks/);
});

test('dashboard redirects incomplete organizations back to onboarding', async () => {
  const source = await readFile(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(source,/\/v1\/onboarding\/state/);
  assert.match(source,/router\.replace\('\/onboarding'\)/);
});
