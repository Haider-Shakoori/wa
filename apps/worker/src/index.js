import { randomUUID } from 'node:crypto';
import { SESSION_LEASE_MS } from './session-runtime.js';

export const workerIdentity = Object.freeze({
  service: 'wa-worker',
  role: 'session-runtime',
  workerId: process.env.WORKER_ID ?? `wa-worker-${randomUUID().slice(0, 8)}`,
  leaseMs: SESSION_LEASE_MS,
  status: 'ready-for-session-claims',
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(workerIdentity));
}
