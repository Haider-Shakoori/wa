import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=path=>readFile(new URL(path,import.meta.url),'utf8');

test('adaptive login policy stores only HMAC pseudonyms with atomic shared counters',async()=>{
 const [service,migration]=await Promise.all([
  load('../src/auth/adaptive-login-protection.service.ts'),
  load('../migrations/042_adaptive_login_challenge.sql'),
 ]);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS auth_login_attempt_windows/);
 assert.match(migration,/lookup_hash char\(64\) PRIMARY KEY/);
 assert.doesNotMatch(migration,/email varchar|ip_address varchar|password_hash/);
 assert.match(service,/createHmac\('sha256'/);
 assert.match(service,/ACCOUNT_IP_THRESHOLD=3/);
 assert.match(service,/IP_THRESHOLD=12/);
 assert.match(service,/ACCOUNT_THRESHOLD=8/);
 assert.match(service,/IP_HARD_LIMIT=60/);
 assert.match(service,/ON CONFLICT\(lookup_hash\) DO UPDATE SET/);
 assert.match(service,/last_failed_at>now\(\)-interval '15 minutes'/);
 assert.match(service,/failed_count\+1/);
 assert.match(service,/recordFailure\(/);
 assert.match(service,/recordSuccess\(/);
});

test('risk-based CAPTCHA verification is server-side, token-limited and fail closed',async()=>{
 const service=await load('../src/auth/adaptive-login-protection.service.ts');
 assert.match(service,/TURNSTILE_SITE_KEY/);
 assert.match(service,/TURNSTILE_SECRET_KEY/);
 assert.match(service,/TURNSTILE_EXPECTED_HOSTNAME/);
 assert.match(service,/if\(!status\.captchaRequired\)return/);
 assert.match(service,/captchaRequired:true/);
 assert.match(service,/https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
 assert.match(service,/AbortSignal\.timeout\(6000\)/);
 assert.match(service,/verdict\.success===true/);
 assert.match(service,/return false/);
 assert.doesNotMatch(service,/Math\.random\(\).*captcha|captcha.*Math\.random/);
});

test('shared protection covers both customer and administrator password routes',async()=>{
 const [controller,auth,types,module]=await Promise.all([
  load('../src/auth/auth.controller.ts'),load('../src/auth/auth.service.ts'),
  load('../src/auth/auth.dto.ts'),load('../src/auth/auth.module.ts'),
 ]);
 assert.match(controller,/@Get\('login-protection'\)/);
 assert.match(controller,/this\.loginProtection\.status\(/);
 assert.match(controller,/return this\.auth\.login\(body/);
 assert.match(auth,/this\.loginProtection\.requireChallenge\(email,input\.captchaToken,context\)/);
 assert.match(auth,/this\.loginProtection\.recordFailure\(email,context\)/);
 assert.match(auth,/this\.loginProtection\.recordSuccess\(email,context\)/);
 assert.match(types,/captchaToken\?:string/);
 assert.match(module,/providers: \[AuthService, AdaptiveLoginProtectionService/);
});

test('customer and platform login forms show CAPTCHA on-demand, not at every login',async()=>{
 const [customer,admin,challenge]=await Promise.all([
  load('../../web/components/relay-auth.tsx'),
  load('../../web/app/platform/login/page.tsx'),
  load('../../web/components/adaptive-login-challenge.tsx'),
 ]);
 for(const page of [customer,admin]){
  assert.match(page,/useAdaptiveLoginChallenge\(/);
  assert.match(page,/captcha\.check\(email\)/);
  assert.match(page,/captchaToken:captcha\.token\|\|undefined/);
  assert.match(page,/<AdaptiveLoginChallenge/);
 }
 assert.match(challenge,/if\(!status\?\.captchaRequired\)return null/);
 assert.match(challenge,/render=explicit/);
 assert.match(challenge,/expired-callback/);
 assert.match(challenge,/error-callback/);
});
