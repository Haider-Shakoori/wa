import { deliverWebhook } from './webhook-delivery.js';
import { hasActiveSessions, boundedInterval } from './adaptive-poll.js';

const ACTIVE_POLL_MS = boundedInterval(process.env.SESSION_COMMAND_POLL_MS, 15000);
const IDLE_POLL_MS = boundedInterval(process.env.SESSION_IDLE_COMMAND_POLL_MS, 30000, ACTIVE_POLL_MS);
const IDLE_WEBHOOK_POLL_MS = boundedInterval(process.env.SESSION_IDLE_WEBHOOK_POLL_MS, 60000, IDLE_POLL_MS);

export async function runCommandLoop({ store, sessions, alertMailer, signal }) {
  let nextWorkerHeartbeat = 0;
  let nextHealthScan = 0;
  let nextWebhookScan = 0;
  let nextCommandPoll = 0;
  const healthScanIntervalMs = Math.max(30_000, Number(process.env.OPERATIONAL_HEALTH_SCAN_MS || 60_000));
  while (!signal.aborted) {
    try {
    // Checks run even under a heavy command load. Failures must never interrupt
    // WhatsApp command processing or webhook delivery.
    if (Date.now() >= nextHealthScan) {
      nextHealthScan = Date.now() + healthScanIntervalMs;
      try {
        await store.scanOperationalHealth();
      } catch (error) {
        console.error('[monitoring] health scan failed:', error instanceof Error ? error.message : String(error));
      }
    }
    const activeSessions = hasActiveSessions(sessions);
    let command = null;
    let commandClaimSucceeded = false;
    if (activeSessions || Date.now() >= nextCommandPoll) {
      nextCommandPoll = Date.now() + (activeSessions ? ACTIVE_POLL_MS : IDLE_POLL_MS);
      try {
        command = await store.claimNextCommand();
        commandClaimSucceeded = true;
      } catch (error) {
        console.error('[command-loop] command claim failed:', error instanceof Error ? error.message : String(error));
      }
    }

    // Every 15 seconds a connected worker already claims commands. When the
    // Cloudflare response confirms the same request refreshed process liveness,
    // avoid a redundant /heartbeat request. Missing acknowledgement, an old API,
    // a failed claim, and passive workers all preserve the ORIGINAL heartbeat.
    if (Date.now() >= nextWorkerHeartbeat) {
      nextWorkerHeartbeat = Date.now() + 15_000;
      const combined = activeSessions && commandClaimSucceeded &&
        store.commandClaimHeartbeatVerified?.() === true;
      if (!combined) {
        try { await store.heartbeatWorker(); }
        catch (error) { console.error('[monitoring] worker heartbeat failed:', error instanceof Error ? error.message : String(error)); }
      }
    }

    if (command) {
      await handleCommand({ store, sessions, command });
      continue;
    }

    if (alertMailer?.isConfigured()) {
      const alert = await store.claimNextSystemAlert();
      if (alert) {
        try {
          await alertMailer.deliver(alert);
          await store.markSystemAlertSent(alert.id);
        } catch (error) {
          await store.rescheduleSystemAlert(alert, error);
        }
        continue;
      }
    }

    // Idle workers do not need to check the webhook queue on every command poll.
    // With any active session, preserve original 15s delivery responsiveness.
    if (activeSessions || Date.now() >= nextWebhookScan) {
      nextWebhookScan = Date.now() + (activeSessions ? ACTIVE_POLL_MS : IDLE_WEBHOOK_POLL_MS);
      await store.enqueueWebhookDeliveries();
      const delivery = await store.claimNextWebhookDelivery();
      if (delivery) {
        await deliverWebhook(store, delivery);
        continue;
      }
    }

    } catch (error) {
      console.error('[command-loop] bridge unavailable:', error instanceof Error ? error.message : String(error));
    }
    // Wake every 15s to preserve the independent worker liveness heartbeat.
    await sleep(ACTIVE_POLL_MS, signal);
  }
}

async function handleCommand({ store, sessions, command }) {
  try {
    if (command.command === 'connect') {
      await sessions.connect(command.session_id);
    } else if (command.command === 'restart') {
      await sessions.restart(command.session_id);
    } else if (command.command === 'logout') {
      await sessions.logout(command.session_id);
    } else {
      throw new Error(`Unsupported command: ${command.command}`);
    }
    await store.completeCommand(command.id);
  } catch (error) {
    await store.failCommand(command.id, error);
  }
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    timer.unref();
    signal.addEventListener('abort', finish, { once: true });
  });
}
