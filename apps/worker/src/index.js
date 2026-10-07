import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { BaileysSessionManager } from './baileys-session.js';
import { ChromiumSessionManager } from './chromium-session.js';
import { MessagingSessionManager } from './messaging-session-manager.js';
import { runCommandLoop } from './command-loop.js';
import { startDirectDispatch } from './direct-dispatch.js';
import { recoverSessions, startRecoveryWatchdog } from './recovery.js';
import { SESSION_LEASE_MS } from './session-runtime.js';
import { SessionStore } from './session-store.js';
import { OperationalAlertMailer } from './operational-alerts.js';

let activeAlertMailer = null;

export const workerIdentity = Object.freeze({
  service: 'relaywa-worker',
  role: 'session-runtime',
  workerId: process.env.WORKER_ID ?? `relaywa-worker-${randomUUID().slice(0, 8)}`,
  leaseMs: SESSION_LEASE_MS,
  status: 'direct-dispatch',
});

export async function startWorker() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const authRoot = resolve(process.env.WA_AUTH_DIR ?? '.data/wa-auth');
  const chromiumAuthRoot = resolve(process.env.WA_CHROMIUM_AUTH_DIR ?? '.data/wa-chromium-auth');
  const store = new SessionStore({ databaseUrl, workerId: workerIdentity.workerId });
  const alertMailer = new OperationalAlertMailer({ store });
  activeAlertMailer = alertMailer;
  const baileys = new BaileysSessionManager({ store, authRoot });
  const chromium = new ChromiumSessionManager({ store, authRoot: chromiumAuthRoot });
  const sessions = new MessagingSessionManager({ store, baileys, chromium });
  const controller = new AbortController();
  const dispatch = await startDirectDispatch({store,sessions});

  const shutdown = async () => {
    controller.abort();
    await dispatch.close();
    await sessions.close();
    await store.close();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  console.log(JSON.stringify({
    ...workerIdentity,
    operationalEmailAlerts: alertMailer.isConfigured() ? 'configured' : 'waiting-for-smtp',
  }));
  await recoverSessions({ store, sessions, signal: controller.signal });
  startRecoveryWatchdog({ store, sessions, signal: controller.signal });

  await runCommandLoop({ store, sessions, alertMailer, signal: controller.signal });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch(async (error) => {
    console.error(error);
    if (activeAlertMailer?.isConfigured()) {
      await activeAlertMailer.deliver({
        event_type: 'worker.fatal',
        severity: 'critical',
        subject: 'relayWA worker stopped unexpectedly',
        summary: 'The relayWA session worker encountered a fatal error and stopped.',
        details: { error: String(error?.message ?? error).slice(0, 2000) },
        created_at: new Date().toISOString(),
        organization_id: null,
        session_id: null,
        resource_type: 'worker',
        resource_id: workerIdentity.workerId,
      }).catch((mailError) => {
        console.error('Failed to send worker fatal alert', mailError);
      });
    }
    process.exitCode = 1;
  });
}
