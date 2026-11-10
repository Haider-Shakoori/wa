import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../dist/worker-bridge/worker-heartbeat-authorization.js', import.meta.url));
const { authorizeWorkerHeartbeat } = require('./worker-heartbeat-authorization.js');
const { authorizeSharedWorker } = require('./shared-worker-authorization.js');
const workerId = 'relaywa-worker-02';
const token = randomBytes(32).toString('hex');
const legacy = randomBytes(32).toString('hex');
test('standby credentials work in isolated PostgreSQL and cannot authorize command/session operations', async () => {
  assert.ok(process.env.DATABASE_URL?.includes('127.0.0.1'), 'Test database must be local PostgreSQL');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const old = process.env.WORKER_DISPATCH_SECRET;
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE relaywa_standby_worker_credentials(worker_id varchar(120) PRIMARY KEY, token_sha256 char(64), enabled boolean, revoked_at timestamptz)');
    await client.query('CREATE TEMP TABLE enterprise_workers(worker_id varchar(120) PRIMARY KEY)');
    await client.query('INSERT INTO relaywa_standby_worker_credentials VALUES($1,$2,true,NULL)', [workerId, createHash('sha256').update(token).digest('hex')]);
    process.env.WORKER_DISPATCH_SECRET = legacy;
    const db = { query: (sql, params) => client.query(sql, params) };
    assert.equal(await authorizeWorkerHeartbeat(db, 'Bearer '+token, workerId), workerId);
    await assert.rejects(authorizeSharedWorker(db, 'Bearer '+token, workerId));
    await assert.rejects(authorizeWorkerHeartbeat(db, 'Bearer invalid', workerId));
    assert.equal(await authorizeWorkerHeartbeat(db, 'Bearer '+legacy, 'relaywa-edge-worker'), 'relaywa-edge-worker');
    await client.query('UPDATE relaywa_standby_worker_credentials SET revoked_at=now() WHERE worker_id=$1', [workerId]);
    await assert.rejects(authorizeWorkerHeartbeat(db, 'Bearer '+token, workerId));
    await client.query('ROLLBACK');
  } finally {
    if (old === undefined) delete process.env.WORKER_DISPATCH_SECRET;
    else process.env.WORKER_DISPATCH_SECRET = old;
    await client.end().catch(()=>{});
  }
});
