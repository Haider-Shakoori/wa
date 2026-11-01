import { SESSION_LEASE_MS } from './session-runtime.js';

/**
 * RemoteStore — drop-in replacement for SessionStore (session-store.js) that
 * talks to the platform over HTTPS (`/internal/worker/*` on relaywa-api)
 * instead of a direct Postgres connection. Method names, arguments and return
 * shapes mirror SessionStore so the rest of the worker is unchanged.
 *
 * Enabled by setting RELAYWA_API_URL + WORKER_DISPATCH_SECRET on the VPS.
 */

const REQUEST_TIMEOUT_MS = Number(process.env.RELAYWA_API_TIMEOUT_MS ?? 15000);
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** pg parsed json/jsonb columns into objects; the bridge returns TEXT. */
function parseJsonFields(row, fields) {
  if (!row) return row;
  for (const field of fields) {
    if (typeof row[field] === 'string') {
      try { row[field] = JSON.parse(row[field]); } catch { /* leave as-is */ }
    }
  }
  return row;
}

export class RemoteStore {
  constructor({ apiUrl, secret, workerId }) {
    if (!apiUrl) throw new Error('RELAYWA_API_URL is required');
    if (!secret) throw new Error('WORKER_DISPATCH_SECRET is required');
    this.apiUrl = String(apiUrl).replace(/\/$/, '');
    this.secret = secret;
    this.workerId = workerId;
    this.cooldownUntil = 0;
    this.commandHeartbeatConfirmedAt = 0;
  }

  commandClaimHeartbeatVerified() {
    return this.commandHeartbeatConfirmedAt > 0 &&
      Date.now() - this.commandHeartbeatConfirmedAt <= 12000;
  }

  async close() { /* no persistent connections */ }

  async call(path, body = {}, { retries = MAX_ATTEMPTS } = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      if (Date.now() < this.cooldownUntil) await sleep(this.cooldownUntil - Date.now());
      try {
        const response = await fetch(`${this.apiUrl}/internal/worker${path}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ workerId: this.workerId, ...body }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(payload.message || `Worker bridge HTTP ${response.status}`);
          error.statusCode = response.status;
          if (response.status === 429) {
            const retryAfter = Number(response.headers.get('retry-after'));
            this.cooldownUntil = Date.now() + Math.max(60000, Math.min(300000, (Number.isFinite(retryAfter) ? retryAfter : 60) * 1000));
          }
          // Auth/config failures will never succeed on retry.
          if (response.status === 401 || response.status === 400) throw error;
          throw error;
        }
        if (path === '/commands/claim') {
          this.commandHeartbeatConfirmedAt =
            response.headers.get('x-relaywa-heartbeat-combined') === '1'
              ? Date.now() : 0;
        }
        return payload;
      } catch (error) {
        lastError = error;
        if (error?.statusCode === 401 || error?.statusCode === 400 || error?.statusCode === 429) throw error;
        if (attempt < retries) await sleep(500 * attempt);
      }
    }
    throw lastError;
  }

  // --- engine / commands ---------------------------------------------------

  async getSessionEngine(sessionId) {
    const result = await this.call('/engine', { sessionId });
    return result.engine ?? 'baileys';
  }

  async claimNextCommand() {
    const result = await this.call('/commands/claim', { leaseMs: SESSION_LEASE_MS });
    return result.command ?? null;
  }

  async completeCommand(commandId) {
    await this.call('/commands/complete', { commandId });
  }

  async failCommand(commandId, error) {
    await this.call('/commands/fail', {
      commandId,
      error: String(error?.message ?? error).slice(0, 2000),
    });
  }

  // --- recovery --------------------------------------------------------------

  async claimRecoverableSessions({ limit, connectingStaleMs }) {
    const result = await this.call('/sessions/recoverable', {
      limit,
      connectingStaleMs,
      leaseMs: SESSION_LEASE_MS,
    });
    return result.sessions ?? [];
  }

  async markRecovered(sessionId, reason) {
    await this.call('/sessions/recovered', { sessionId, reason });
  }

  async markRecoveryFailed(sessionId, error) {
    await this.call('/sessions/recovery-failed', {
      sessionId,
      error: String(error?.message ?? error).slice(0, 2000),
    });
  }

  async getReconnectAttempts(sessionId) {
    const result = await this.call('/sessions/reconnect-attempts', { sessionId });
    return Number(result.attempts ?? 0);
  }

  // --- heartbeats --------------------------------------------------------------

  async heartbeatWorker() {
    await this.call('/heartbeat');
  }

  async heartbeat(sessionId) {
    await this.call('/sessions/heartbeat', { sessionId, leaseMs: SESSION_LEASE_MS });
  }

  // --- status / QR / events ------------------------------------------------------

  async setStatus(sessionId, status, details = {}) {
    await this.call('/sessions/status', { sessionId, status, details });
  }

  async ensureSessionKey() {
    // Handled server-side when status transitions to 'connected'.
  }

  async setQr(sessionId, qr, ttlMs = 60000) {
    await this.call('/sessions/qr', { sessionId, qr, ttlMs });
  }

  async event(sessionId, eventType, payload = {}) {
    await this.call('/sessions/event', { sessionId, eventType, payload });
  }

  async incrementReconnect(sessionId, error) {
    const result = await this.call('/sessions/reconnect', {
      sessionId,
      error: String(error?.message ?? error ?? '').slice(0, 2000) || null,
    });
    return Number(result.attempts ?? 1);
  }

  // --- profile / directory sync -----------------------------------------------------

  async syncProfile(sessionId, profile) {
    await this.call('/sessions/profile', { sessionId, profile });
  }

  async upsertContact(sessionId, contact) {
    await this.call('/sessions/contact', { sessionId, contact });
  }

  async upsertChat(sessionId, chat) {
    await this.call('/sessions/chat', { sessionId, chat });
  }

  async upsertGroup(sessionId, group) {
    await this.call('/sessions/group', { sessionId, group });
  }

  async updateProfileFromContact(sessionId, contact) {
    await this.call('/sessions/profile-from-contact', { sessionId, contact });
  }

  // --- operational health / alerts ----------------------------------------------------

  async scanOperationalHealth() {
    const result = await this.call('/health-scan', {});
    return {
      staleLeases: Number(result.staleLeases ?? 0),
      stalledOrganizations: Number(result.stalledOrganizations ?? 0),
    };
  }

  async queueSystemAlert(input) {
    const result = await this.call('/alerts/queue', { ...input });
    return result.id ?? null;
  }

  async queueSessionAlert(sessionId, input) {
    const result = await this.call('/alerts/session/queue', { sessionId, input });
    return result.id ?? null;
  }

  async listPlatformAdminEmails() {
    const result = await this.call('/alerts/admins');
    return result.emails ?? [];
  }

  async claimNextSystemAlert() {
    const result = await this.call('/alerts/claim');
    return parseJsonFields(result.alert ?? null, ['details']);
  }

  async markSystemAlertSent(alertId) {
    await this.call('/alerts/sent', { alertId });
  }

  async rescheduleSystemAlert(alert, error) {
    await this.call('/alerts/reschedule', {
      alert: { id: alert.id, attempts: alert.attempts },
      error: String(error?.message ?? error).slice(0, 2000),
    });
  }

  // --- outbound messages -----------------------------------------------------------------

  async claimDirectMessage(messageId) {
    const result = await this.call('/messages/claim', {
      messageId,
      stripeLivemode: process.env.STRIPE_MODE === 'live',
    });
    return parseJsonFields(result.message ?? null, ['action_payload', 'raw_payload']);
  }

  /** Poll pickup used when the API cannot reach this worker's HTTP listener. */
  async pollDirectMessage() {
    const result = await this.call('/messages/poll', {
      stripeLivemode: process.env.STRIPE_MODE === 'live',
    });
    return parseJsonFields(result.message ?? null, ['action_payload', 'raw_payload']);
  }

  async saveInboundMessage(sessionId, message) {
    const result = await this.call('/sessions/inbound', { sessionId, message });
    return result.saved ?? null;
  }

  async markMessageSent(messageId, providerMessageId) {
    await this.call('/messages/sent', { messageId, providerMessageId });
  }

  async markMessageFailed(messageId, error) {
    await this.call('/messages/failed', {
      messageId,
      error: String(error?.message ?? error).slice(0, 2000),
    });
  }

  // --- webhooks -----------------------------------------------------------------------------

  async enqueueWebhookDeliveries(limit = 100) {
    const result = await this.call('/webhooks/enqueue', { limit });
    return Number(result.enqueued ?? 0);
  }

  async claimNextWebhookDeliveryEnqueued() {
    try {
      const result=await this.call('/webhooks/claim-enqueued', {}, {retries:1});
      return {supported:true,delivery:parseJsonFields(result.delivery??null,['payload'])};
    } catch(error) {
      // 404/405/501 mean only that the new route is absent/unsupported.
      // Do not fallback on network failures or 5xx: a job might be claimed.
      if([404,405,501].includes(error?.statusCode))return {supported:false,delivery:null};
      throw error;
    }
  }

  async claimNextWebhookDelivery() {
    const result = await this.call('/webhooks/claim');
    return parseJsonFields(result.delivery ?? null, ['payload']);
  }

  async markWebhookDelivered(deliveryId, statusCode, responseBody) {
    await this.call('/webhooks/delivered', { deliveryId, statusCode, responseBody });
  }

  async rescheduleWebhook(delivery, error) {
    await this.call('/webhooks/reschedule', {
      delivery: {
        id: delivery.id,
        endpoint_id: delivery.endpoint_id,
        organization_id: delivery.organization_id,
        session_id: delivery.session_id,
        event_type: delivery.event_type,
        url: delivery.url,
        attempts: delivery.attempts,
      },
      error: {
        statusCode: Number(error?.statusCode) || null,
        responseBody: typeof error?.responseBody === 'string' ? error.responseBody.slice(0, 4000) : null,
        message: String(error?.message ?? error).slice(0, 2000),
      },
    });
  }

  // --- billing notifications ----------------------------------------------------------------------

  async claimBillingNotification() {
    const result = await this.call('/billing/claim');
    return result.notification ?? null;
  }

  async markBillingNotificationSent(id, attempts) {
    await this.call('/billing/sent', { id, attempts });
  }

  async markBillingNotificationFailed(id, attempts, error) {
    await this.call('/billing/failed', {
      id,
      attempts,
      error: String(error?.message ?? error).slice(0, 300),
    });
  }
}
