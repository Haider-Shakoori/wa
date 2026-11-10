import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../dist/worker-bridge/worker-heartbeat-authorization.js', import.meta.url));
const { authorizeWorkerHeartbeat } = require('./worker-heartbeat-authorization.js');
const { authorizeSharedWorker } = require('./shared-worker-authorization.js');
const workerId = 'relaywa-worker-02';
const token = 'test-standby-token-only-not-production';
const digest = createHash('sha256').update(token).digest('hex');
const db = {
  async query(sql, params) {
    if (sql.includes('relaywa_standby_worker_credentials')) {
      assert.equal(params[0], workerId);
      return { rows: [{ token_sha256: digest }], rowCount: 1 };
    }
    if (sql.includes('enterprise_workers')) return { rows: [], rowCount: 0 };
    throw new Error('Unexpected database query');
  },
};
test('dedicated token authorizes worker heartbeat', async () => {
  const original = process.env.WORKER_DISPATCH_SECRET;
  process.env.WORKER_DISPATCH_SECRET = 'test-legacy-secret-not-production';
  try {
    assert.equal(await authorizeWorkerHeartbeat(db, 'Bearer ' + token, workerId), workerId);
    await assert.rejects(authorizeSharedWorker(db, 'Bearer ' + token, workerId));
    await assert.rejects(authorizeWorkerHeartbeat(db, 'Bearer wrong-token', workerId));
    await assert.rejects(authorizeWorkerHeartbeat(db, undefined, workerId));
  } finally {
    if (original === undefined) delete process.env.WORKER_DISPATCH_SECRET;
    else process.env.WORKER_DISPATCH_SECRET = original;
  }
});
test('legacy worker heartbeat remains authorized', async () => {
  const original = process.env.WORKER_DISPATCH_SECRET;
  process.env.WORKER_DISPATCH_SECRET = 'test-legacy-secret-not-production';
  try {
    assert.equal(await authorizeWorkerHeartbeat(db, 'Bearer test-legacy-secret-not-production', 'relaywa-edge-worker'), 'relaywa-edge-worker');
  } finally {
    if (original === undefined) delete process.env.WORKER_DISPATCH_SECRET;
    else process.env.WORKER_DISPATCH_SECRET = original;
  }
});
