import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { nextLeaseExpiry } from './session-runtime.js';

const { Pool } = pg;

export class SessionStore {
  constructor({ databaseUrl, workerId }) {
    this.workerId = workerId;
    this.pool = new Pool({ connectionString: databaseUrl, max: 5 });
  }

  async close() {
    await this.pool.end();
  }

  async claimNextCommand() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const commandResult = await client.query(
        `SELECT c.id, c.organization_id, c.session_id, c.command
         FROM whatsapp_session_commands c
         WHERE c.status = 'queued'
         ORDER BY c.created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      );
      const command = commandResult.rows[0];
      if (!command) {
        await client.query('COMMIT');
        return null;
      }

      const sessionResult = await client.query(
        `SELECT id, organization_id, status, worker_id, worker_lease_expires_at
         FROM whatsapp_sessions
         WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
         FOR UPDATE`,
        [command.session_id, command.organization_id],
      );
      const session = sessionResult.rows[0];
      if (!session) {
        await client.query(
          `UPDATE whatsapp_session_commands
           SET status = 'failed', last_error = 'Session not found', completed_at = now()
           WHERE id = $1`,
          [command.id],
        );
        await client.query('COMMIT');
        return null;
      }

      const leaseActive =
        session.worker_id &&
        session.worker_id !== this.workerId &&
        session.worker_lease_expires_at &&
        new Date(session.worker_lease_expires_at).getTime() > Date.now();

      if (leaseActive) {
        await client.query('COMMIT');
        return null;
      }

      const leaseExpiry = nextLeaseExpiry();
      await client.query(
        `UPDATE whatsapp_sessions
         SET worker_id = $1, worker_lease_expires_at = $2, last_heartbeat_at = now(), updated_at = now()
         WHERE id = $3`,
        [this.workerId, leaseExpiry, session.id],
      );
      await client.query(
        `UPDATE whatsapp_session_commands
         SET status = 'claimed', worker_id = $1, claimed_at = now(), attempts = attempts + 1
         WHERE id = $2`,
        [this.workerId, command.id],
      );
      await client.query('COMMIT');
      return { ...command, session: { ...session, worker_id: this.workerId } };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async claimRecoverableSessions({ limit, connectingStaleMs }) {
    const result = await this.pool.query(
      `WITH candidates AS (
         SELECT id
         FROM whatsapp_sessions
         WHERE deleted_at IS NULL
           AND status IN ('connecting','connected','reconnecting','disconnected')
           AND (worker_lease_expires_at IS NULL OR worker_lease_expires_at <= now())
           AND (
             status <> 'connecting'
             OR updated_at <= now() - ($1 * interval '1 millisecond')
           )
         ORDER BY updated_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE whatsapp_sessions s
       SET worker_id = $3,
           worker_lease_expires_at = $4,
           recovery_started_at = now(),
           recovery_reason = 'worker_startup',
           updated_at = now()
       FROM candidates c
       WHERE s.id = c.id
       RETURNING s.id, s.status, s.reconnect_attempts`,
      [connectingStaleMs, limit, this.workerId, nextLeaseExpiry()],
    );
    return result.rows;
  }

  async markRecovered(sessionId, reason) {
    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET last_recovery_at = now(), recovery_started_at = NULL,
           recovery_reason = $1, updated_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [reason, sessionId, this.workerId],
    );
  }

  async markRecoveryFailed(sessionId, error) {
    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET status = 'error',
           last_connection_error = $1,
           recovery_started_at = NULL,
           recovery_reason = 'recovery_failed',
           updated_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [String(error?.message ?? error).slice(0, 2000), sessionId, this.workerId],
    );
  }

  async getReconnectAttempts(sessionId) {
    const result = await this.pool.query(
      `SELECT reconnect_attempts
       FROM whatsapp_sessions
       WHERE id = $1 AND worker_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId, this.workerId],
    );
    return Number(result.rows[0]?.reconnect_attempts ?? 0);
  }

  async heartbeat(sessionId) {
    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET worker_lease_expires_at = $1, last_heartbeat_at = now(), updated_at = now()
       WHERE id = $2 AND worker_id = $3 AND deleted_at IS NULL`,
      [nextLeaseExpiry(), sessionId, this.workerId],
    );
  }

  async setStatus(sessionId, status, details = {}) {
    const {
      phoneNumber = null,
      displayName = null,
      jid = null,
      profilePictureUrl = null,
      clearQr = false,
      lastConnectionError = null,
      resetReconnectAttempts = false,
    } = details;

    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET status = $1,
           phone_number = COALESCE($2, phone_number),
           display_name = COALESCE($3, display_name),
           whatsapp_jid = COALESCE($4, whatsapp_jid),
           profile_picture_url = COALESCE($5, profile_picture_url),
           qr_code = CASE WHEN $6 THEN NULL ELSE qr_code END,
           qr_expires_at = CASE WHEN $6 THEN NULL ELSE qr_expires_at END,
           connection_opened_at = CASE WHEN $1 = 'connected' THEN now() ELSE connection_opened_at END,
           last_connected_at = CASE WHEN $1 = 'connected' THEN now() ELSE last_connected_at END,
           last_disconnected_at = CASE WHEN $1 IN ('disconnected','logged_out','error') THEN now() ELSE last_disconnected_at END,
           last_connection_error = $7,
           reconnect_attempts = CASE WHEN $8 THEN 0 ELSE reconnect_attempts END,
           updated_at = now()
       WHERE id = $9 AND worker_id = $10`,
      [
        status,
        phoneNumber,
        displayName,
        jid,
        profilePictureUrl,
        clearQr,
        lastConnectionError,
        resetReconnectAttempts,
        sessionId,
        this.workerId,
      ],
    );
  }

  async syncProfile(sessionId, profile) {
    const { jid = null, phoneNumber = null, displayName = null, profilePictureUrl = null } = profile;
    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET whatsapp_jid = COALESCE($1, whatsapp_jid),
           phone_number = COALESCE($2, phone_number),
           display_name = COALESCE($3, display_name),
           profile_picture_url = COALESCE($4, profile_picture_url),
           profile_synced_at = now(),
           updated_at = now()
       WHERE id = $5 AND worker_id = $6`,
      [jid, phoneNumber, displayName, profilePictureUrl, sessionId, this.workerId],
    );
  }

  async upsertContact(sessionId, contact) {
    if (!contact?.id) return;
    const phoneNumber = contact.id.endsWith('@g.us') ? null : contact.id.split('@')[0].split(':')[0];
    await this.pool.query(
      `INSERT INTO whatsapp_contacts
        (session_id, organization_id, jid, phone_number, display_name,
         notify_name, verified_name, is_business, updated_at)
       SELECT id, organization_id, $2, $3, $4, $5, $6, $7, now()
       FROM whatsapp_sessions
       WHERE id = $1 AND worker_id = $8 AND deleted_at IS NULL
       ON CONFLICT (session_id, jid)
       DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         display_name = COALESCE(EXCLUDED.display_name, whatsapp_contacts.display_name),
         notify_name = COALESCE(EXCLUDED.notify_name, whatsapp_contacts.notify_name),
         verified_name = COALESCE(EXCLUDED.verified_name, whatsapp_contacts.verified_name),
         is_business = EXCLUDED.is_business,
         updated_at = now()`,
      [
        sessionId,
        contact.id,
        phoneNumber,
        contact.name?.trim() || null,
        contact.notify?.trim() || null,
        contact.verifiedName?.trim() || null,
        Boolean(contact.businessName || contact.verifiedName),
        this.workerId,
      ],
    );
  }

  async upsertChat(sessionId, chat) {
    if (!chat?.id) return;
    const chatType = chat.id.endsWith('@g.us') ? 'group' : 'direct';
    const lastMessageAt = chat.conversationTimestamp
      ? new Date(Number(chat.conversationTimestamp) * 1000).toISOString()
      : null;
    await this.pool.query(
      `INSERT INTO whatsapp_chats
        (session_id, organization_id, jid, chat_type, name, unread_count,
         last_message_at, updated_at)
       SELECT id, organization_id, $2, $3, $4, $5, $6::timestamptz, now()
       FROM whatsapp_sessions
       WHERE id = $1 AND worker_id = $7 AND deleted_at IS NULL
       ON CONFLICT (session_id, jid)
       DO UPDATE SET
         chat_type = EXCLUDED.chat_type,
         name = COALESCE(EXCLUDED.name, whatsapp_chats.name),
         unread_count = EXCLUDED.unread_count,
         last_message_at = COALESCE(EXCLUDED.last_message_at, whatsapp_chats.last_message_at),
         updated_at = now()`,
      [
        sessionId,
        chat.id,
        chatType,
        chat.name?.trim() || null,
        Number(chat.unreadCount ?? 0),
        lastMessageAt,
        this.workerId,
      ],
    );
  }

  async upsertGroup(sessionId, group) {
    if (!group?.id) return;
    await this.pool.query(
      `INSERT INTO whatsapp_groups
        (session_id, organization_id, jid, subject, owner_jid,
         participant_count, announce, restrict_members, updated_at)
       SELECT id, organization_id, $2, $3, $4, $5, $6, $7, now()
       FROM whatsapp_sessions
       WHERE id = $1 AND worker_id = $8 AND deleted_at IS NULL
       ON CONFLICT (session_id, jid)
       DO UPDATE SET
         subject = COALESCE(EXCLUDED.subject, whatsapp_groups.subject),
         owner_jid = COALESCE(EXCLUDED.owner_jid, whatsapp_groups.owner_jid),
         participant_count = EXCLUDED.participant_count,
         announce = EXCLUDED.announce,
         restrict_members = EXCLUDED.restrict_members,
         updated_at = now()`,
      [
        sessionId,
        group.id,
        group.subject?.trim() || null,
        group.owner || null,
        Array.isArray(group.participants) ? group.participants.length : Number(group.size ?? 0),
        Boolean(group.announce),
        Boolean(group.restrict),
        this.workerId,
      ],
    );
  }

  async updateProfileFromContact(sessionId, contact) {
    if (!contact?.id) return;
    const result = await this.pool.query(
      `SELECT whatsapp_jid
       FROM whatsapp_sessions
       WHERE id = $1 AND worker_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId, this.workerId],
    );
    const sessionJid = result.rows[0]?.whatsapp_jid;
    if (!sessionJid || sessionJid !== contact.id) return;

    const displayName =
      contact.name?.trim() ||
      contact.notify?.trim() ||
      contact.verifiedName?.trim() ||
      null;

    if (displayName) {
      await this.pool.query(
        `UPDATE whatsapp_sessions
         SET display_name = $1, profile_synced_at = now(), updated_at = now()
         WHERE id = $2 AND worker_id = $3`,
        [displayName, sessionId, this.workerId],
      );
    }
  }

  async incrementReconnect(sessionId, error) {
    const result = await this.pool.query(
      `UPDATE whatsapp_sessions
       SET reconnect_attempts = reconnect_attempts + 1,
           last_connection_error = $1,
           updated_at = now()
       WHERE id = $2 AND worker_id = $3
       RETURNING reconnect_attempts`,
      [String(error?.message ?? error ?? '').slice(0, 2000) || null, sessionId, this.workerId],
    );
    return Number(result.rows[0]?.reconnect_attempts ?? 1);
  }

  async setQr(sessionId, qr, ttlMs = 55000) {
    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET status = 'need_scan', qr_code = $1,
           qr_expires_at = now() + ($2 * interval '1 millisecond'),
           updated_at = now()
       WHERE id = $3 AND worker_id = $4`,
      [qr, ttlMs, sessionId, this.workerId],
    );
    await this.event(sessionId, 'session.qr_updated', { expiresInMs: ttlMs });
  }

  async event(sessionId, eventType, payload = {}) {
    await this.pool.query(
      `INSERT INTO whatsapp_session_events
        (organization_id, session_id, event_type, payload)
       SELECT organization_id, id, $2, $3::jsonb
       FROM whatsapp_sessions
       WHERE id = $1`,
      [sessionId, eventType, JSON.stringify(payload)],
    );
  }

  async listDispatchReadyMessages(limit = 100) {
    const result = await this.pool.query(
      `SELECT id, scheduled_at, next_attempt_at, priority, max_attempts
       FROM whatsapp_messages
       WHERE direction = 'outbound'
         AND status IN ('queued','scheduled','retrying')
         AND next_attempt_at <= now()
         AND bull_job_id IS NULL
       ORDER BY priority ASC, next_attempt_at ASC, queued_at ASC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  async markMessageEnqueued(messageId, jobId) {
    await this.pool.query(
      `UPDATE whatsapp_messages
       SET bull_job_id = $1,
           status = CASE WHEN status = 'scheduled' THEN 'scheduled' ELSE 'queued' END,
           updated_at = now()
       WHERE id = $2 AND bull_job_id IS NULL`,
      [jobId, messageId],
    );
  }

  async claimOutboundMessageById(messageId) {
    const result = await this.pool.query(
      `UPDATE whatsapp_messages m
       SET status = 'claimed', worker_id = $1, claimed_at = now(),
           attempts = attempts + 1, updated_at = now()
       FROM whatsapp_sessions s
       WHERE m.id = $2
         AND m.session_id = s.id
         AND m.direction = 'outbound'
         AND m.status IN ('queued','scheduled','retrying','claimed')
         AND s.deleted_at IS NULL
         AND s.status = 'connected'
         AND s.worker_id = $1
         AND s.worker_lease_expires_at > now()
       RETURNING m.*`,
      [this.workerId, messageId],
    );
    return result.rows[0] ?? null;
  }

  async deferRateLimitedMessage(messageId, retryAt) {
    await this.pool.query(
      `UPDATE whatsapp_messages
       SET rate_limited_until = $1, updated_at = now()
       WHERE id = $2`,
      [retryAt, messageId],
    );
  }

  async markMessageAttemptFailed(messageId, error, retrying) {
    await this.pool.query(
      `UPDATE whatsapp_messages
       SET status = $1,
           last_error = $2,
           next_attempt_at = CASE WHEN $1 = 'retrying' THEN now() ELSE next_attempt_at END,
           updated_at = now()
       WHERE id = $3 AND worker_id = $4`,
      [retrying ? 'retrying' : 'failed', String(error?.message ?? error).slice(0, 2000), messageId, this.workerId],
    );
  }

  async claimNextOutboundMessage() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT m.id, m.organization_id, m.session_id, m.message_type,
                m.recipient_phone, m.recipient_jid, m.text_body,
                m.media_url, m.media_mime_type, m.media_file_name,
                m.media_size_bytes, m.media_caption, m.voice_note,
                m.action_payload, m.attempts
         FROM whatsapp_messages m
         JOIN whatsapp_sessions s ON s.id = m.session_id
         WHERE m.direction = 'outbound'
           AND m.status = 'queued'
           AND s.deleted_at IS NULL
           AND s.status = 'connected'
           AND s.worker_id = $1
           AND s.worker_lease_expires_at > now()
         ORDER BY m.queued_at ASC
         FOR UPDATE OF m SKIP LOCKED
         LIMIT 1`,
        [this.workerId],
      );
      const message = result.rows[0];
      if (!message) {
        await client.query('COMMIT');
        return null;
      }

      await client.query(
        `UPDATE whatsapp_messages
         SET status = 'claimed', worker_id = $1, claimed_at = now(),
             attempts = attempts + 1, updated_at = now()
         WHERE id = $2`,
        [this.workerId, message.id],
      );
      await client.query('COMMIT');
      return { ...message, attempts: Number(message.attempts ?? 0) + 1 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async saveInboundMessage(sessionId, message) {
    const result = await this.pool.query(
      `INSERT INTO whatsapp_messages
        (id, organization_id, session_id, direction, message_type,
         sender_phone, sender_jid, chat_jid, text_body, status,
         provider_message_id, media_mime_type, media_file_name,
         media_size_bytes, voice_note, action_payload, raw_payload,
         received_at, created_at, updated_at)
       SELECT $2, organization_id, id, 'inbound', $3,
              $4, $5, $6, $7, 'received',
              $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb,
              $15::timestamptz, now(), now()
       FROM whatsapp_sessions
       WHERE id = $1 AND worker_id = $16 AND deleted_at IS NULL
       ON CONFLICT (session_id, provider_message_id)
       WHERE direction = 'inbound' AND provider_message_id IS NOT NULL
       DO NOTHING
       RETURNING id, organization_id`,
      [
        sessionId,
        randomUUID(),
        message.messageType,
        message.senderPhone,
        message.senderJid,
        message.chatJid,
        message.textBody,
        message.providerMessageId,
        message.mediaMimeType,
        message.mediaFileName,
        message.mediaSizeBytes,
        message.voiceNote,
        JSON.stringify({
          ...message.actionPayload,
          pushName: message.pushName,
        }),
        JSON.stringify(message.rawPayload),
        message.receivedAt,
        this.workerId,
      ],
    );

    const saved = result.rows[0];
    if (!saved) return null;

    await this.event(sessionId, 'message.received', {
      messageId: saved.id,
      providerMessageId: message.providerMessageId,
      messageType: message.messageType,
      senderJid: message.senderJid,
      senderPhone: message.senderPhone,
      chatJid: message.chatJid,
      pushName: message.pushName,
      receivedAt: message.receivedAt,
    });

    return saved;
  }

  async markMessageSent(messageId, providerMessageId) {
    await this.pool.query(
      `UPDATE whatsapp_messages
       SET status = 'sent', provider_message_id = $1, sent_at = now(),
           last_error = NULL, bull_job_id = NULL, updated_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [providerMessageId, messageId, this.workerId],
    );
  }

  async markMessageFailed(messageId, error) {
    await this.pool.query(
      `UPDATE whatsapp_messages
       SET status = 'failed', last_error = $1, failed_at = now(),
           bull_job_id = NULL, updated_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [String(error?.message ?? error).slice(0, 2000), messageId, this.workerId],
    );
  }

  async enqueueWebhookDeliveries(limit = 100) {
    const candidates = await this.pool.query(
      `SELECT e.id AS session_event_id, e.organization_id, w.id AS endpoint_id
       FROM whatsapp_session_events e
       JOIN webhook_endpoints w
         ON w.organization_id = e.organization_id
        AND w.enabled = true
        AND e.created_at >= w.created_at
        AND ('*' = ANY(w.event_types) OR e.event_type = ANY(w.event_types))
       LEFT JOIN webhook_deliveries d
         ON d.endpoint_id = w.id AND d.session_event_id = e.id
       WHERE d.id IS NULL
       ORDER BY e.id ASC
       LIMIT $1`,
      [limit],
    );

    for (const row of candidates.rows) {
      await this.pool.query(
        `INSERT INTO webhook_deliveries
          (id, endpoint_id, organization_id, session_event_id, status)
         VALUES ($1, $2, $3, $4, 'queued')
         ON CONFLICT (endpoint_id, session_event_id) DO NOTHING`,
        [randomUUID(), row.endpoint_id, row.organization_id, row.session_event_id],
      );
    }
    return candidates.rowCount ?? 0;
  }

  async claimNextWebhookDelivery() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT d.id, d.endpoint_id, d.organization_id, d.session_event_id,
                d.attempts, w.url, w.secret_encrypted,
                e.session_id, e.event_type, e.payload,
                e.created_at AS event_created_at
         FROM webhook_deliveries d
         JOIN webhook_endpoints w ON w.id = d.endpoint_id AND w.enabled = true
         JOIN whatsapp_session_events e ON e.id = d.session_event_id
         WHERE d.status = 'queued'
           AND d.next_attempt_at <= now()
         ORDER BY d.next_attempt_at ASC, d.queued_at ASC
         FOR UPDATE OF d SKIP LOCKED
         LIMIT 1`,
      );
      const delivery = result.rows[0];
      if (!delivery) {
        await client.query('COMMIT');
        return null;
      }

      await client.query(
        `UPDATE webhook_deliveries
         SET status = 'claimed', worker_id = $1, claimed_at = now(),
             attempts = attempts + 1, updated_at = now()
         WHERE id = $2`,
        [this.workerId, delivery.id],
      );
      await client.query('COMMIT');
      return { ...delivery, attempts: Number(delivery.attempts ?? 0) + 1 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markWebhookDelivered(deliveryId, statusCode, responseBody) {
    const result = await this.pool.query(
      `UPDATE webhook_deliveries
       SET status = 'delivered', response_status = $1, response_body = $2,
           last_error = NULL, delivered_at = now(), updated_at = now()
       WHERE id = $3 AND worker_id = $4
       RETURNING endpoint_id`,
      [statusCode, responseBody, deliveryId, this.workerId],
    );
    const endpointId = result.rows[0]?.endpoint_id;
    if (endpointId) {
      await this.pool.query(
        `UPDATE webhook_endpoints
         SET consecutive_failures = 0, last_success_at = now(), updated_at = now()
         WHERE id = $1`,
        [endpointId],
      );
    }
  }

  async rescheduleWebhook(delivery, error) {
    const maxAttempts = Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? 6);
    const delays = [5, 30, 120, 600, 1800, 3600];
    const exhausted = Number(delivery.attempts) >= maxAttempts;
    const delaySeconds = delays[Math.min(Math.max(Number(delivery.attempts) - 1, 0), delays.length - 1)];
    const statusCode = Number(error?.statusCode) || null;
    const responseBody = typeof error?.responseBody === 'string' ? error.responseBody.slice(0, 4000) : null;
    const lastError = String(error?.message ?? error).slice(0, 2000);

    await this.pool.query(
      `UPDATE webhook_deliveries
       SET status = $1,
           next_attempt_at = CASE WHEN $1 = 'queued'
             THEN now() + ($2 * interval '1 second')
             ELSE next_attempt_at END,
           response_status = $3,
           response_body = $4,
           last_error = $5,
           failed_at = CASE WHEN $1 = 'failed' THEN now() ELSE NULL END,
           worker_id = CASE WHEN $1 = 'queued' THEN NULL ELSE worker_id END,
           claimed_at = CASE WHEN $1 = 'queued' THEN NULL ELSE claimed_at END,
           updated_at = now()
       WHERE id = $6`,
      [exhausted ? 'failed' : 'queued', delaySeconds, statusCode, responseBody, lastError, delivery.id],
    );

    await this.pool.query(
      `UPDATE webhook_endpoints
       SET consecutive_failures = consecutive_failures + 1,
           last_failure_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [delivery.endpoint_id],
    );
  }

  async completeCommand(commandId) {
    await this.pool.query(
      `UPDATE whatsapp_session_commands
       SET status = 'completed', completed_at = now()
       WHERE id = $1 AND worker_id = $2`,
      [commandId, this.workerId],
    );
  }

  async failCommand(commandId, error) {
    await this.pool.query(
      `UPDATE whatsapp_session_commands
       SET status = 'failed', last_error = $1, completed_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [String(error?.message ?? error).slice(0, 2000), commandId, this.workerId],
    );
  }
}
