import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('homepage shell renders on the server, not a monolithic client component', () => {
  const home = read('components/relay-home.tsx');
  const client = read('components/relay-home-interactive.tsx');
  assert.doesNotMatch(home, /^['"]use client['"]/);
  assert.match(client, /^'use client';/);
  assert.match(home, /<PublicHeader\s*\/>/);
  assert.match(home, /<PricingSection\s*\/>/);
  assert.match(home, /export \{ PublicHeader, PublicFooter, PricingSection \}/);
  assert.match(home, /<CodeShowcase /);
  assert.doesNotMatch(home, /onClick=|window\.|localStorage|useState\(/);
});

test('sign-in does not wait for an unnecessary CAPTCHA status request', () => {
  const auth = read('components/relay-auth.tsx');
  const backend = readFileSync(new URL('../../api/src/auth/auth.service.ts', import.meta.url), 'utf8');
  assert.match(auth, /const result=await api<any>\('\/auth\/\/);
  assert.doesNotMatch(auth, /const challenge=await captcha\.check\(email\)/);
  assert.match(auth, /captcha\.risk\?\.captchaRequired/);
  assert.match(auth, /router\.prefetch\('\/dashboard'\)/);
  assert.match(backend, /await this\.loginProtection\.requireChallenge\(email,input\.captchaToken,context\)/);
});

test('social login buttons share one short-lived provider configuration request', () => {
  const providers = read('lib/auth-providers.ts');
  const google = read('components/google-signin.tsx');
  const github = read('components/github-signin.tsx');
  assert.match(providers, /if \(pending\) return pending/);
  assert.match(providers, /api<AuthProviders>\('\/auth\/providers'\)/);
  assert.match(google, /getAuthProviders\(\)/);
  assert.match(github, /getAuthProviders\(\)/);
  assert.doesNotMatch(google + github, /api<AuthProviders>\('\/auth\/providers'\)/);
});

test('brand cache cannot accidentally cache HTML, sessions or auth responses', () => {
  const config=read('next.config.ts');
  assert.match(config, /source: '\/brand\/:asset\*'/);
  assert.doesNotMatch(config, /source: '\/api\//);
  assert.doesNotMatch(config, /source: '\/login'/);
});
