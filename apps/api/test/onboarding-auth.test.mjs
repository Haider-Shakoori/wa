import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('new accounts are onboarding-aware and no longer auto-create trials', async () => {
  const source = await readFile(new URL('../src/auth/auth.service.ts', import.meta.url), 'utf8');
  assert.match(source,/nextPath/);
  assert.match(source,/\/onboarding/);
  assert.doesNotMatch(source,/subscriptions\.createTrial/);
});

test('Google identity tokens are verified server-side against configured audience', async () => {
  const source = await readFile(new URL('../src/auth/auth.service.ts', import.meta.url), 'utf8');
  assert.match(source,/oauth2\.googleapis\.com\/tokeninfo/);
  assert.match(source,/GOOGLE_CLIENT_ID/);
  assert.match(source,/profile\.aud !== clientId/);
  assert.match(source,/user_auth_identities/);
});

test('onboarding requires plan, connection, API key and test message in sequence', async () => {
  const source = await readFile(new URL('../src/onboarding/onboarding.service.ts', import.meta.url), 'utf8');
  for (const step of ['plan','payment','workspace','connect','api_key','test','webhook','complete']) {
    assert.match(source,new RegExp("'" + step + "'"));
  }
  assert.match(source,/Connect a WhatsApp session before continuing/);
  assert.match(source,/Create an API key before continuing/);
  assert.match(source,/Send a test message before continuing/);
});

test('paid activation can create the subscription row directly', async () => {
  const source = await readFile(new URL('../src/subscriptions/subscriptions.service.ts', import.meta.url), 'utf8');
  assert.match(source,/INSERT INTO organization_subscriptions/);
  assert.match(source,/ON CONFLICT \(organization_id\)/);
});

test('returning logins go directly to dashboard even when onboarding is incomplete', async () => {
  const source = await readFile(new URL('../src/auth/auth.service.ts', import.meta.url), 'utf8');
  assert.match(source, /nextPath: isPlatformAdmin \? '\/platform' : loginMethod === 'register' && onboardingStep !== 'complete' \? '\/onboarding' : '\/dashboard'/);
  assert.match(source, /this\.issueTokens\(user, membership, 'password', context\)/);
  assert.match(source, /this\.issueTokens\(account\.user, account\.membership, 'google',context\)/);
  assert.match(source, /this\.issueTokens\(user, membership, 'github',context\)/);
});
