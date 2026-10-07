import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { BaileysSessionManager } from './baileys-session.js';
import { ChromiumSessionManager } from './chromium-session.js';
import { MessagingSessionManager } from './messaging-session-manager.js';
import { runCommandLoop } from './command-loop.js';
import { createMessageQueue, pumpReadyMessages } from './message-queue.js';
import { recoverSessions, startRecoveryWatchdog } from './recovery.js';
import { SESSION_LEASE_MS } from './session-runtime.js';
import { SessionStore } from './session-store.js';

export const workerIdentity = Object.freeze({
  service: 'relaywa-worker',
  role: 'session-runtime',
  workerId: process.env.WORKER_ID ?? `relaywa-worker-${randomUUID().slice(0, 8)}`,
  leaseMs: SESSION_LEASE_MS,
  status: 'queue-ready',
});

export async function startWorker() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!redisUrl) throw new Error('REDIS_URL is required');

  const authRoot = resolve(process.env.WA_AUTH_DIR ?? '.data/wa-auth');
  const chromiumAuthRoot = resolve(process.env.WA_CHROMIUM_AUTH_DIR ?? '.data/wa-chromium-auth');
  const store = new SessionStore({ databaseUrl, workerId: workerIdentity.workerId });
  const baileys = new BaileysSessionManager({ store, authRoot });
  const chromium = new ChromiumSessionManager({ store, authRoot: chromiumAuthRoot });
  const sessions = new MessagingSessionManager({ store, baileys, chromium });
  const controller = new AbortController();
  const messageQueue = createMessageQueue({ redisUrl, store, sessions });

  const pumpPromise = pumpReadyMessages({
    store,
    messageQueue,
    signal: controller.signal,
  });

  const shutdown = async () => {
    controller.abort();
    await pumpPromise.catch(() => {});
    await messageQueue.close();
    await sessions.close();
    await store.close();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  console.log(JSON.stringify(workerIdentity));
  await recoverSessions({ store, sessions, signal: controller.signal });
  startRecoveryWatchdog({ store, sessions, signal: controller.signal });

  await runCommandLoop({ store, sessions, signal: controller.signal });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
