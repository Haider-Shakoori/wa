import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(file)=>readFile(new URL(file,import.meta.url),'utf8');

test('expired browser JWTs send platform and tenant accounts to their own sign-in pages', async()=>{
 const session=await read('../lib/session-expiry.ts');
 const watcher=await read('../components/session-expiry-watcher.tsx');
 assert.match(session,/pathname\.startsWith\('\/platform\/'\)/);
 assert.match(session, /\? '\/platform\/login' : '\/login'/);
 assert.match(session,/\?expired=1/);
 assert.match(session,/ACCESS_TOKEN_KEY/);
 assert.match(session,/localStorage\.removeItem/);
 assert.match(session,/activeToken !== token/);
 assert.match(session,/sessionStorage\.removeItem\('relaywa_platform_mfa_ticket'\)/);
 assert.match(watcher,/accessTokenExpiration\(token\)/);
 assert.match(watcher,/setTimeout\(validateSession/);
 assert.match(watcher,/visibilitychange/);
 assert.match(watcher,/pageshow/);
 assert.match(watcher,/addEventListener\('storage'/);
 assert.match(watcher,/clearTimeout/);
 assert.match(watcher,/expireBrowserSession\(token\)/);
});

test('unauthorized protected API requests log out but failed password logins do not', async()=>{
 const api=await read('../lib/api.ts');
 assert.match(api,/response\.status === 401 && token/);
 assert.match(api,/expireBrowserSession\(token\)/);
 assert.match(api,/if \(!response\.ok\)/);
 assert.doesNotMatch(api,/response\.status === 403 && token/);
});

test('all pages get the session watcher and sign-in pages explain expiration', async()=>{
 const layout=await read('../app/layout.tsx');
 const platform=await read('../app/platform/login/page.tsx');
 const tenant=await read('../components/relay-auth.tsx');
 assert.match(layout, /<SessionExpiryWatcher\/>/);
 assert.match(platform,/Your session expired/);
 assert.match(tenant,/Your login session expired/);
});

test('session expiry is client-only and does not disturb WhatsApp sessions',async()=>{
 const session=await read('../lib/session-expiry.ts');
 assert.doesNotMatch(session,/whatsapp_session_commands|whatsapp_sessions|api-keys|fetch\(/);
 assert.match(session,/if \(typeof window === 'undefined'\)/);
});
