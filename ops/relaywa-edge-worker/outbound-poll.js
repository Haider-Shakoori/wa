/**
 * Outbound poll loop — picks up queued outbound messages through the worker
 * bridge (`/internal/worker/messages/poll`). This is the inverse of the
 * direct HTTP dispatch listener: the API leaves messages queued and this loop
 * claims them, which works even when the VPS listener is unreachable from the
 * internet (private firewall). File-upload messages are excluded server-side
 * (their bytes only travel on the direct dispatch).
 */

import { hasActiveSessions, boundedInterval } from './adaptive-poll.js';

const POLL_MS = boundedInterval(process.env.OUTBOUND_POLL_MS, 15000);
const IDLE_POLL_MS = boundedInterval(process.env.OUTBOUND_IDLE_POLL_MS, 60000, POLL_MS);
const ERROR_BACKOFF_MS = Math.max(60000, Number(process.env.OUTBOUND_POLL_ERROR_BACKOFF_MS ?? 60000));

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });

export function startOutboundPoll({ store, sessions, signal }) {
  const loop = (async () => {
    while (!signal.aborted) {
      let message = null;
      try {
        message = await store.pollDirectMessage();
      } catch (error) {
        console.error('[outbound-poll] poll failed:', error instanceof Error ? error.message : String(error));
        await sleep(ERROR_BACKOFF_MS, signal);
        continue;
      }

      if (!message) {
        await sleep(hasActiveSessions(sessions) ? POLL_MS : IDLE_POLL_MS, signal);
        continue;
      }

      try {
        if (message.message_type === 'text') {
          await sessions.sendText(message.session_id, message);
        } else if (['image', 'video', 'audio', 'document'].includes(message.message_type)) {
          await sessions.sendMedia(message.session_id, message, undefined);
        } else {
          await sessions.sendAction(message.session_id, message);
        }
      } catch (error) {
        await store.markMessageFailed(message.id, error).catch(() => {});
      }
    }
  })();

  return {
    close: async () => { await loop.catch(() => {}); },
  };
}
