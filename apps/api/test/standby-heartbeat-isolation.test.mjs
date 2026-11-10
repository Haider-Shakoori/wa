import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const heartbeat = readFileSync(new URL('../src/worker-bridge/worker-heartbeat-authorization.ts', import.meta.url),'utf8');
const bridge = readFileSync(new URL('../src/worker-bridge/worker-bridge.controller.ts', import.meta.url),'utf8');
const shared = readFileSync(new URL('../src/worker-bridge/shared-worker-authorization.ts', import.meta.url),'utf8');
const migration = readFileSync(new URL('../migrations/055_standby_worker_credentials.sql', import.meta.url),'utf8');
test('heartbeat endpoint alone uses scoped authorization',()=>{
  assert.match(bridge, /async heartbeat[\s\S]*?authorizeWorkerHeartbeat\(this\.db,auth,body\.workerId\)/);
  assert.equal((bridge.match(/authorizeWorkerHeartbeat\(this\.db,auth,body\.workerId\)/g)||[]).length,1);
  assert.match(bridge, /async claim[\s\S]*?authorizeSharedWorker\(this\.db,auth,body\.workerId\)/);
  assert.match(bridge, /async sessionHeartbeat[\s\S]*?authorizeSharedWorker\(this\.db,auth,body\.workerId\)/);
});
test('standby credentials cannot authorize session and command endpoints',()=>{
  assert.doesNotMatch(shared, /relaywa_standby_worker_credentials/);
  assert.match(heartbeat, /relaywa_standby_worker_credentials/);
  assert.match(heartbeat, /timingSafeEqual/);
  assert.match(migration, /token_sha256 char\(64\)/);
  assert.match(migration, /revoked_at/);
});
