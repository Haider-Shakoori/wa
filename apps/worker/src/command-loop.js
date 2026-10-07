import { deliverWebhook } from './webhook-delivery.js';

const POLL_MS = Number(process.env.SESSION_COMMAND_POLL_MS ?? 1000);

export async function runCommandLoop({ store, sessions, alertMailer, signal }) {
  while (!signal.aborted) {
    const command = await store.claimNextCommand();
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

    await store.enqueueWebhookDeliveries();
    const delivery = await store.claimNextWebhookDelivery();
    if (delivery) {
      await deliverWebhook(store, delivery);
      continue;
    }

    await sleep(POLL_MS, signal);
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
    const timer = setTimeout(resolve, ms);
    timer.unref();
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
