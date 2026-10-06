import pg from 'pg';
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
       SELECT gen_random_uuid(), organization_id, id, 'inbound', $2,
              $3, $4, $5, $6, 'received',
              $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb,
              $14::timestamptz, now(), now()
       FROM whatsapp_sessions
       WHERE id = $1 AND worker_id = $15 AND deleted_at IS NULL
       ON CONFLICT (session_id, provider_message_id)
       WHERE direction = 'inbound' AND provider_message_id IS NOT NULL
       DO NOTHING
       RETURNING id, organization_id`,
      [
        sessionId,
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
           last_error = NULL, updated_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [providerMessageId, messageId, this.workerId],
    );
  }

  async markMessageFailed(messageId, error) {
    await this.pool.query(
      `UPDATE whatsapp_messages
       SET status = 'failed', last_error = $1, failed_at = now(), updated_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [String(error?.message ?? error).slice(0, 2000), messageId, this.workerId],
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
