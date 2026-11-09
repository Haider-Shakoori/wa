import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const auth=readFileSync(new URL('../src/worker-bridge/enterprise-worker-authorization.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/054_enterprise_worker_credentials.sql',import.meta.url),'utf8');
test('dedicated credentials use only hashes and support revocation',()=>{
 assert.match(migration,/token_sha256 TEXT NOT NULL UNIQUE/);
 assert.match(migration,/revoked_at TIMESTAMPTZ/);
 assert.doesNotMatch(migration,/token_plaintext|secret_plaintext/);
});
test('dedicated authentication requires ready registry identity and active token',()=>{
 assert.match(auth,/ew\.status='ready'/);
 assert.match(auth,/ec\.revoked_at IS NULL/);
 assert.match(auth,/timingSafeEqual/);
 assert.match(auth,/createHash\('sha256'\)/);
 assert.doesNotMatch(auth,/WORKER_DISPATCH_SECRET/);
});
