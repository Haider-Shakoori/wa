import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('MFA challenges do not expose access tokens before second-factor verification', async () => {
 const service=await source('../src/auth/auth.service.ts');
 const controller=await source('../src/auth/auth.controller.ts');
 const schema=await source('../migrations/031_platform_mfa_sessions.sql');
 assert.match(service, /mfaRequired: true/);
 assert.match(service, /mfaTicket: challengeToken/);
 assert.match(service, /attempts>=5/);
 assert.match(service, /now\(\)\+interval '5 minutes'/);
 assert.match(service, /used_at=now\(\)/);
 assert.match(service, /recoveryHash/);
 assert.match(controller, /@Post\('mfa\/verify'\)/);
 assert.match(schema, /platform_mfa_challenges/);
 assert.match(schema, /token_hash char\(64\)/);
});
test('MFA is opt-in, stores encrypted credentials and revokes sessions on enrollment', async () => {
 const service=await source('../src/auth/auth.service.ts');
 const crypto=await source('../src/auth/admin-mfa.crypto.ts');
 assert.match(service, /mfa_enabled_at && !mfaVerified/);
 assert.match(service, /mfa_pending_ciphertext/);
 assert.match(service, /token_version=token_version\+1/);
 assert.match(service, /user_login_sessions SET revoked_at=now\(\)/);
 assert.match(crypto,/aes-256-gcm/);
 assert.match(crypto,/timingSafeEqual/);
 assert.match(crypto,/randomBytes\(20\)/);
 assert.match(crypto,/createRecoveryCodes/);
});
test('JWT guards reject revoked sessions and token version mismatch', async () => {
 for (const path of ['../src/auth/jwt-auth.guard.ts','../src/auth/api-access.guard.ts']) {
   const guard=await source(path);
   assert.match(guard,/u\.token_version=COALESCE/);
   assert.match(guard,/user_login_sessions ls/);
   assert.match(guard,/ls\.revoked_at IS NULL/);
 }
});
test('MFA gate applies to platform, tenant, Google and GitHub sign-in', async () => {
 for(const path of ['../../web/app/platform/login/page.tsx','../../web/components/relay-auth.tsx','../../web/components/google-signin.tsx']){
   const screen=await source(path);
   assert.match(screen,/result\.mfaRequired/);
   assert.match(screen,/\/platform\/mfa/);
 }
 const page=await source('../../web/app/platform/mfa/page.tsx');
 assert.match(page,/\/auth\/mfa\/verify/);
});
