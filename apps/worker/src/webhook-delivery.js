import { isIP } from 'node:net';
import { decryptWebhookSecret, signWebhook } from './webhook-crypto.js';

export async function deliverWebhook(store, delivery) {
  const url = new URL(delivery.url);
  assertPublicUrl(url);

  const body = JSON.stringify({
    id: String(delivery.session_event_id),
    type: delivery.event_type,
    sessionId: delivery.session_id,
    createdAt: delivery.event_created_at,
    data: delivery.payload,
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const secret = decryptWebhookSecret(delivery.secret_encrypted);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.WEBHOOK_TIMEOUT_MS ?? 10000));
  timeout.unref();

  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'relayWA-webhooks/1.0',
        'x-relaywa-event': delivery.event_type,
        'x-relaywa-event-id': String(delivery.session_event_id),
        'x-relaywa-timestamp': timestamp,
        'x-relaywa-signature': signWebhook(secret, timestamp, body),
      },
      body,
    });

    const responseBody = (await response.text()).slice(0, 4000);
    if (!response.ok) {
      const error = new Error(`Webhook returned HTTP ${response.status}`);
      error.statusCode = response.status;
      error.responseBody = responseBody;
      throw error;
    }

    await store.markWebhookDelivered(delivery.id, response.status, responseBody);
  } catch (error) {
    await store.rescheduleWebhook(delivery, error);
  } finally {
    clearTimeout(timeout);
  }
}

function assertPublicUrl(url) {
  if (url.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) throw new Error('Private webhook URL blocked');

  if (isIP(host) && (
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )) {
    throw new Error('Private webhook URL blocked');
  }
}
