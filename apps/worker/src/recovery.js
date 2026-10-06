const RECOVERY_BATCH_SIZE = Number(process.env.SESSION_RECOVERY_BATCH_SIZE ?? 25);
const CONNECTING_STALE_MS = Number(process.env.SESSION_CONNECTING_STALE_MS ?? 90000);

export async function recoverSessions({ store, sessions, signal }) {
  const recoverable = await store.claimRecoverableSessions({
    limit: RECOVERY_BATCH_SIZE,
    connectingStaleMs: CONNECTING_STALE_MS,
  });

  for (const session of recoverable) {
    if (signal.aborted) break;
    try {
      await sessions.restore(session.id, session.status);
      await store.markRecovered(session.id, 'worker_startup');
    } catch (error) {
      await store.markRecoveryFailed(session.id, error);
    }
  }

  return recoverable.length;
}

export function startRecoveryWatchdog({ store, sessions, signal }) {
  const intervalMs = Number(process.env.SESSION_RECOVERY_WATCHDOG_MS ?? 30000);
  const timer = setInterval(() => {
    if (signal.aborted) return;
    recoverSessions({ store, sessions, signal }).catch(() => {});
  }, intervalMs);
  timer.unref();
  signal.addEventListener('abort', () => clearInterval(timer), { once: true });
  return timer;
}
