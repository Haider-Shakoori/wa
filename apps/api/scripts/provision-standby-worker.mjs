#!/usr/bin/env node
// Operator-only provisioning. Requires DATABASE_URL and WORKER_ID.
// Prints the generated token once; never writes plaintext tokens to the database.
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
const workerId = process.env.WORKER_ID;
if (!/^relaywa-worker-[a-z0-9-]{1,100}$/.test(workerId ?? '')) throw Error('Invalid WORKER_ID');
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL required');
const token = randomBytes(32).toString('hex');
const digest = createHash('sha256').update(token).digest('hex');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const existing = await client.query('SELECT worker_id FROM relaywa_standby_worker_credentials WHERE worker_id=$1', [workerId]);
  if (existing.rowCount) throw Error('Worker already provisioned; refuse silent credential rotation');
  await client.query('INSERT INTO relaywa_standby_worker_credentials(worker_id,token_sha256) VALUES($1,$2)', [workerId,digest]);
  process.stdout.write('WORKER_ID=' + workerId + '\nWORKER_DISPATCH_SECRET=' + token + '\n');
} finally {
  await client.end();
}
