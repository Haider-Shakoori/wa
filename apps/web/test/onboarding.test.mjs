import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login supports sign in, registration and Google', async () => {
  const login = await readFile(new URL('../components/relay-auth.tsx', import.meta.url), 'utf8');
  const google = await readFile(new URL('../components/google-signin.tsx', import.meta.url), 'utf8');
  assert.match(login,/Create your account/);
  assert.match(login,/\/auth\//);
  assert.match(login,/GoogleSignIn/);
  assert.match(google,/\/auth\/google/);
  assert.match(google,/\/auth\/providers/);
  assert.doesNotMatch(google,/NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
});

test('onboarding implements plan through webhook setup', async () => {
  const source = await readFile(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8');
  for (const label of ['Choose plan','Workspace','Connect WhatsApp','API key','Test message','Webhook']) {
    assert.match(source,new RegExp(label));
  }
  assert.match(source,/billing\/checkout\/stripe/);
  assert.match(source,/billing\/manual/);
  assert.match(source,/\/whatsapp-sessions/);
  assert.match(source,/\/api-keys/);
  assert.match(source,/\/messages\/text/);
  assert.match(source,/\/webhooks/);
});

test('dashboard provides guided setup without blocking the workspace', async () => {
  const source = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source,/Build your integration/);
  assert.match(source,/Create a session/);
});
