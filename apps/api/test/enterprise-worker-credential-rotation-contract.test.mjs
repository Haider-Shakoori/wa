import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = readFileSync(new URL('../src/worker-bridge/enterprise-worker-credentials.ts', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../src/worker-bridge/enterprise-worker-authorization.ts', import.meta.url), 'utf8');
const heartbeat = readFileSync(new URL('../src/worker-bridge/enterprise-worker-heartbeat.controller.ts', import.meta.url), 'utf8');
test('credential rotation uses 256-bit random token and stores only SHA-256 digest', () => {
  assert.match(file, /randomBytes\(32\)/);
  assert.match(file, /createHash\('sha256'\)/);
  assert.match(file, /token_sha256=EXCLUDED\.token_sha256/);
  assert.match(file, /ew\.organization_id=\$2/);
});
test('revocation requires organization ownership and is enforced at authentication', () => {
  assert.match(file, /UPDATE enterprise_worker_credentials ec SET revoked_at=now\(\)/);
  assert.match(file, /ew\.organization_id=\$2/);
  assert.match(auth, /ec\.revoked_at IS NULL/);
});
test('dedicated heartbeat is separate and does not expose claims or messages', () => {
  assert.match(heartbeat, /internal\/enterprise-worker/);
  assert.match(heartbeat, /authorizeEnterpriseWorker/);
  assert.doesNotMatch(heartbeat, /@Post\('(?:commands|messages|sessions)/);
});
