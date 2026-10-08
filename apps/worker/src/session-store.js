import pg from 'pg';
import { randomUUID, randomBytes, createHash, createCipheriv } from 'node:crypto';
import { nextLeaseExpiry } from './session-runtime.js';

const { Pool } = pg;

function sessionAlertDefinition(eventType, payload = {}) {
  if (eventType === 'session.logged_out') {
    return {
      severity: 'critical',
      subject: 'WhatsApp session logged out',
      summary: 'A linked WhatsApp session was logged out. Messaging from this session has stopped until it is connected again.',
      cooldownSeconds: 300,
    };
  }

  if (eventType === 'session.auth_failure' || eventType === 'session.auth_corrupt') {
    return {
      severity: 'critical',
      subject: eventType === 'session.auth_corrupt'
        ? 'WhatsApp authentication data is corrupt'
        : 'WhatsApp authentication failed',
      summary: 'relayWA could not use the stored WhatsApp authentication state for this session and it needs attention.',
      cooldownSeconds: 900,
    };
  }

  if (eventType === 'session.reconnecting') {
    const attempts = Number(payload?.reconnectAttempts ?? 0);
    const threshold = Number(process.env.ALERT_RECONNECT_THRESHOLD ?? 3);
    if (attempts < threshold) return null;
    return {
      severity: 'warning',
      subject: 'WhatsApp session is repeatedly reconnecting',
      summary: `A WhatsApp session has reached ${attempts} reconnect attempts and may need investigation.`,
      cooldownSeconds: Number(process.env.ALERT_DEDUPE_SECONDS ?? 900),
    };
  }

  return null;
}

export class SessionStore {
  constructor({ databaseUrl, workerId }) {
    this.workerId = workerId;
    this.pool = new Pool({ connectionString: databaseUrl, max: 5 });
    this.safetyCache = { value: null, expiresAt: 0 };
  }

  async close() {
    await this.pool.end();
  }

  async getSessionEngine(sessionId) {
    const result = await this.pool.query(
      `SELECT engine, next_engine, status
       FROM whatsapp_sessions
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId],
    );
    const session = result.rows[0];
    if (!session) return 'baileys';

    if (session.next_engine && ['pending', 'logged_out'].includes(session.status)) {
      const promoted = await this.pool.query(
        `UPDATE whatsapp_sessions
         SET engine = next_engine, next_engine = NULL, updated_at = now()
         WHERE id = $1
           AND next_engine IS NOT NULL
           AND status IN ('pending', 'logged_out')
         RETURNING engine`,
        [sessionId],
      );
      return promoted.rows[0]?.engine ?? session.engine;
    }

    return session.engine ?? 'baileys';
  }

  async claimNextCommand() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const commandResult = await client.query(
        `SELECT c.id, c.organization_id, c.session_id, c.command
         FROM whatsapp_session_commands c
         JOIN organizations o ON o.id = c.organization_id AND o.suspended_at IS NULL
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
    const message = String(error?.message ?? error).slice(0, 2000);
    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET status = 'error',
           last_connection_error = $1,
           recovery_started_at = NULL,
           recovery_reason = 'recovery_failed',
           updated_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [message, sessionId, this.workerId],
    );

    await this.queueSessionAlert(sessionId, {
      eventType: 'session.recovery_failed',
      severity: 'critical',
      subject: 'WhatsApp session recovery failed',
      summary: 'relayWA could not recover a WhatsApp session after a worker restart or lease recovery.',
      details: { error: message },
      cooldownSeconds: Number(process.env.ALERT_DEDUPE_SECONDS ?? 900),
    });
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

  async heartbeatWorker() {
    await this.pool.query(`INSERT INTO relaywa_worker_heartbeats
      (worker_id,first_seen_at,last_seen_at) VALUES ($1,now(),now())
      ON CONFLICT(worker_id) DO UPDATE SET last_seen_at=now()`,[this.workerId]);
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
       SET status = $1::varchar(24),
           phone_number = COALESCE($2, phone_number),
           display_name = COALESCE($3, display_name),
           whatsapp_jid = COALESCE($4, whatsapp_jid),
           profile_picture_url = COALESCE($5, profile_picture_url),
           qr_code = CASE WHEN $6 THEN NULL ELSE qr_code END,
           qr_expires_at = CASE WHEN $6 THEN NULL ELSE qr_expires_at END,
           connection_opened_at = CASE WHEN $1::varchar(24) = 'connected' THEN now() ELSE connection_opened_at END,
           last_connected_at = CASE WHEN $1::varchar(24) = 'connected' THEN now() ELSE last_connected_at END,
           last_disconnected_at = CASE WHEN $1::varchar(24) IN ('disconnected','logged_out','error') THEN now() ELSE last_disconnected_at END,
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
    if (status === 'connected') {
      try { await this.ensureSessionKey(sessionId); }
      catch { console.error('Unable to create the connected session API key'); }
    }
  }

  async ensureSessionKey(sessionId) {
    const key = Buffer.from(process.env.WEBHOOK_ENCRYPTION_KEY || '', 'base64');
    if (key.length !== 32) throw new Error('WEBHOOK_ENCRYPTION_KEY must decode to 32 bytes');
    const token = 'rw_session_' + randomBytes(32).toString('base64url');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const value = [iv, cipher.getAuthTag(), encrypted].map(part=>part.toString('base64url')).join('.');
    await this.pool.query(`INSERT INTO api_keys
      (id, organization_id, created_by_user_id, session_id, name, key_prefix, key_hash, token_type, scopes, token_encrypted, auto_generated)
      SELECT $1, organization_id, created_by_user_id, id, 'Connected session ' || id::text,
        $2, $3, 'session', $4, $5, true FROM whatsapp_sessions
      WHERE id=$6 AND status='connected' AND worker_id=$7 AND deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM api_keys WHERE session_id=$6 AND enabled AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()))
      ON CONFLICT DO NOTHING`, [randomUUID(), token.slice(0,20), createHash('sha256').update(token).digest('hex'),
        ['sessions.read','messages.read','messages.send','contacts.read','chats.read','groups.read'], value, sessionId, this.workerId]);
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

  async setQr(sessionId, qr, ttlMs = 60000) {
    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET status = 'need_scan', qr_code = $1,
           qr_expires_at = CASE WHEN status='need_scan' THEN qr_expires_at ELSE now() + (LEAST($2::int,60000) * interval '1 millisecond') END,
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

    const alert = sessionAlertDefinition(eventType, payload);
    if (alert) {
      await this.queueSessionAlert(sessionId, {
        eventType,
        ...alert,
        details: payload,
      });
    }
  }

    async scanOperationalHealth() {
    // Auto-resolve lease incidents only after the specific session has a
    // refreshed, non-expired worker lease. Historical alerts remain stored.
    await this.pool.query(`UPDATE system_alerts a SET resolved_at=now(),updated_at=now()
      FROM whatsapp_sessions s WHERE a.event_type='worker.session_lease_expired'
        AND a.resolved_at IS NULL AND a.session_id=s.id
        AND s.deleted_at IS NULL AND s.worker_id IS NOT NULL
        AND s.worker_lease_expires_at>now()`);
    // A live worker can detect peers with expired session leases. External uptime
    // monitoring is still required when the entire worker fleet is down.
    const staleSessions = await this.pool.query(`SELECT s.id, s.organization_id,
      s.name, s.status, s.worker_id, s.worker_lease_expires_at, o.name AS organization_name
      FROM whatsapp_sessions s
      JOIN organizations o ON o.id=s.organization_id AND o.suspended_at IS NULL
      WHERE s.deleted_at IS NULL AND s.worker_id IS NOT NULL
        AND s.worker_lease_expires_at IS NOT NULL
        AND s.worker_lease_expires_at < now() - interval '1 minute'
        AND s.status IN ('connected','connecting','reconnecting')
      ORDER BY s.worker_lease_expires_at ASC LIMIT 25`);
    for(const session of staleSessions.rows) {
      await this.queueSystemAlert({
        eventType:'worker.session_lease_expired',
        severity:'critical',
        dedupeKey:`lease:${session.id}:expired`,
        organizationId:session.organization_id,
        sessionId:session.id,
        resourceType:'whatsapp_session',
        resourceId:session.id,
        subject:'WhatsApp worker lease expired',
        summary:'A WhatsApp session appears to have lost its active worker ownership and needs review.',
        details:{organizationName:session.organization_name,sessionName:session.name,
          workerId:session.worker_id,sessionStatus:session.status,leaseExpiresAt:session.worker_lease_expires_at},
        cooldownSeconds:900,
      });
    }

    // Direct-dispatch queues should drain quickly. Flag sustained backlog without
    // touching queued records or forcing retries; preserve operator control.
    const stalled = await this.pool.query(`SELECT organization_id, count(*)::int AS stalled
      FROM (SELECT m.organization_id FROM whatsapp_messages m
        JOIN organizations o ON o.id=m.organization_id AND o.suspended_at IS NULL
        WHERE m.direction='outbound' AND m.status='queued'
          AND m.queued_at < now() - interval '10 minutes'
        ORDER BY m.queued_at ASC LIMIT 500) pending
      GROUP BY organization_id HAVING count(*) >= 10 LIMIT 20`);
    for(const item of stalled.rows) {
      await this.queueSystemAlert({
        eventType:'messaging.queue_stalled',
        severity:'warning',
        dedupeKey:`org:${item.organization_id}:stalled-queue`,
        organizationId:item.organization_id,
        resourceType:'organization',
        resourceId:item.organization_id,
        subject:'Outgoing message queue appears stalled',
        summary:'At least ten outbound messages have remained queued for over ten minutes. Investigate dispatch and session connectivity.',
        details:{stalledMessages:item.stalled},
        cooldownSeconds:1800,
      });
    }
    return {staleLeases:staleSessions.rowCount??0,stalledOrganizations:stalled.rowCount??0};
  }

  async queueSystemAlert({
    eventType,
    severity = 'warning',
    dedupeKey,
    organizationId = null,
    sessionId = null,
    resourceType = null,
    resourceId = null,
    subject,
    summary,
    details = {},
    cooldownSeconds = Number(process.env.ALERT_DEDUPE_SECONDS ?? 900),
  }) {
    const result = await this.pool.query(
      `INSERT INTO system_alerts
        (id, event_type, severity, dedupe_key, organization_id, session_id,
         resource_type, resource_id, subject, summary, details)
       SELECT $1::uuid, $2::text, $3::text, $4::text, $5::uuid, $6::uuid, $7::text, $8::text, $9::text, $10::text, $11::jsonb
       WHERE NOT EXISTS (
         SELECT 1
         FROM system_alerts
         WHERE dedupe_key = $4
           AND created_at >= now() - ($12::int * interval '1 second')
       )
       RETURNING id`,
      [
        randomUUID(),
        eventType,
        severity,
        dedupeKey,
        organizationId,
        sessionId,
        resourceType,
        resourceId,
        subject,
        summary,
        JSON.stringify(details),
        Math.max(Number(cooldownSeconds) || 0, 0),
      ],
    );
    return result.rows[0]?.id ?? null;
  }

  async queueSessionAlert(sessionId, input) {
    const context = await this.pool.query(
      `SELECT s.organization_id, s.name AS session_name, s.phone_number,
              s.engine, s.status, o.name AS organization_name
       FROM whatsapp_sessions s
       JOIN organizations o ON o.id = s.organization_id
       WHERE s.id = $1 AND s.deleted_at IS NULL
       LIMIT 1`,
      [sessionId],
    );
    const row = context.rows[0];
    if (!row) return null;

    return this.queueSystemAlert({
      ...input,
      dedupeKey: input.dedupeKey ?? `session:${sessionId}:${input.eventType}`,
      organizationId: row.organization_id,
      sessionId,
      resourceType: 'whatsapp_session',
      resourceId: sessionId,
      details: {
        organizationName: row.organization_name,
        sessionName: row.session_name,
        phoneNumber: row.phone_number,
        engine: row.engine,
        sessionStatus: row.status,
        ...(input.details ?? {}),
      },
    });
  }

  async listPlatformAdminEmails() {
    const result = await this.pool.query(
      `SELECT email
       FROM users
       WHERE is_platform_admin = true
         AND disabled_at IS NULL
       ORDER BY created_at ASC`,
    );
    return result.rows.map((row) => String(row.email || '').trim()).filter(Boolean);
  }

  async claimNextSystemAlert() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT *
         FROM system_alerts
         WHERE status = 'queued'
           AND next_attempt_at <= now()
         ORDER BY
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
           created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      );
      const alert = result.rows[0];
      if (!alert) {
        await client.query('COMMIT');
        return null;
      }

      await client.query(
        `UPDATE system_alerts
         SET status = 'sending', worker_id = $1, claimed_at = now(),
             attempts = attempts + 1, updated_at = now()
         WHERE id = $2`,
        [this.workerId, alert.id],
      );
      await client.query('COMMIT');
      return { ...alert, attempts: Number(alert.attempts ?? 0) + 1 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markSystemAlertSent(alertId) {
    await this.pool.query(
      `UPDATE system_alerts
       SET status = 'sent', sent_at = now(), last_error = NULL, updated_at = now()
       WHERE id = $1 AND worker_id = $2`,
      [alertId, this.workerId],
    );
  }

  async rescheduleSystemAlert(alert, error) {
    const maxAttempts = Number(process.env.ALERT_EMAIL_MAX_ATTEMPTS ?? 6);
    const delays = [60, 300, 900, 3600, 21600, 86400];
    const exhausted = Number(alert.attempts) >= maxAttempts;
    const delaySeconds = delays[Math.min(Math.max(Number(alert.attempts) - 1, 0), delays.length - 1)];
    const lastError = String(error?.message ?? error).slice(0, 2000);

    await this.pool.query(
      `UPDATE system_alerts
       SET status = $1::varchar(24),
           next_attempt_at = CASE WHEN $1::varchar(24) = 'queued'
             THEN now() + ($2 * interval '1 second')
             ELSE next_attempt_at END,
           last_error = $3,
           worker_id = CASE WHEN $1::varchar(24) = 'queued' THEN NULL ELSE worker_id END,
           claimed_at = CASE WHEN $1::varchar(24) = 'queued' THEN NULL ELSE claimed_at END,
           updated_at = now()
       WHERE id = $4`,
      [exhausted ? 'failed' : 'queued', delaySeconds, lastError, alert.id],
    );
  }

  async claimDirectMessage(messageId) {
    const result=await this.pool.query(`UPDATE whatsapp_messages m
      SET status='claimed',worker_id=$1,claimed_at=now(),attempts=attempts+1,updated_at=now()
      FROM whatsapp_sessions s, organizations o, organization_subscriptions sub
      WHERE m.id=$2 AND m.session_id=s.id
      AND o.id=m.organization_id AND o.suspended_at IS NULL
      AND sub.organization_id=m.organization_id
      AND sub.status IN ('trialing','active')
      AND sub.current_period_end>now()
      AND (sub.status<>'trialing' OR sub.trial_ends_at IS NULL OR sub.trial_ends_at>now())
      AND m.direction='outbound' AND m.status='queued'
      AND s.deleted_at IS NULL AND s.status='connected'
      AND s.worker_id=$1 AND s.worker_lease_expires_at>now() RETURNING m.*`,[this.workerId,messageId]);
    return result.rows[0]??null;
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
    const message = String(error?.message ?? error).slice(0, 2000);
    await this.pool.query(
      `UPDATE whatsapp_messages
       SET status = 'failed', last_error = $1, failed_at = now(),
           bull_job_id = NULL, updated_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [message, messageId, this.workerId],
    );

    const context = await this.pool.query(
      `SELECT m.organization_id, m.session_id, m.recipient_phone, m.message_type,
              s.name AS session_name
       FROM whatsapp_messages m
       LEFT JOIN whatsapp_sessions s ON s.id = m.session_id
       WHERE m.id = $1
       LIMIT 1`,
      [messageId],
    );
    const row = context.rows[0];
    if (row) {
      await this.queueSystemAlert({
        eventType: 'message.failed',
        severity: 'warning',
        dedupeKey: `message:${messageId}:failed`,
        organizationId: row.organization_id,
        sessionId: row.session_id,
        resourceType: 'whatsapp_message',
        resourceId: messageId,
        subject: 'WhatsApp message permanently failed',
        summary: 'An outbound WhatsApp message exhausted its retries and could not be sent.',
        details: {
          sessionName: row.session_name,
          recipientPhone: row.recipient_phone,
          messageType: row.message_type,
          error: message,
        },
        cooldownSeconds: 86400,
      });
    }
  }

  async enqueueWebhookDeliveries(limit = 100) {
    const candidates = await this.pool.query(
      `SELECT e.id AS session_event_id, e.organization_id, w.id AS endpoint_id
       FROM whatsapp_session_events e
       JOIN organizations o ON o.id = e.organization_id AND o.suspended_at IS NULL
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
         JOIN organizations o ON o.id = d.organization_id AND o.suspended_at IS NULL
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
       SET status = $1::varchar(24),
           next_attempt_at = CASE WHEN $1::varchar(24) = 'queued'
             THEN now() + ($2 * interval '1 second')
             ELSE next_attempt_at END,
           response_status = $3,
           response_body = $4,
           last_error = $5,
           failed_at = CASE WHEN $1::varchar(24) = 'failed' THEN now() ELSE NULL END,
           worker_id = CASE WHEN $1::varchar(24) = 'queued' THEN NULL ELSE worker_id END,
           claimed_at = CASE WHEN $1::varchar(24) = 'queued' THEN NULL ELSE claimed_at END,
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

    if (exhausted) {
      await this.queueSystemAlert({
        eventType: 'webhook.failed',
        severity: 'warning',
        dedupeKey: `webhook:${delivery.id}:failed`,
        organizationId: delivery.organization_id,
        sessionId: delivery.session_id,
        resourceType: 'webhook_delivery',
        resourceId: delivery.id,
        subject: 'Webhook delivery permanently failed',
        summary: 'A webhook delivery exhausted all retry attempts and requires attention.',
        details: {
          endpointId: delivery.endpoint_id,
          eventType: delivery.event_type,
          url: delivery.url,
          statusCode,
          error: lastError,
        },
        cooldownSeconds: 86400,
      });
    }
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
    const message = String(error?.message ?? error).slice(0, 2000);
    await this.pool.query(
      `UPDATE whatsapp_session_commands
       SET status = 'failed', last_error = $1, completed_at = now()
       WHERE id = $2 AND worker_id = $3`,
      [message, commandId, this.workerId],
    );

    const context = await this.pool.query(
      `SELECT organization_id, session_id, command
       FROM whatsapp_session_commands
       WHERE id = $1
       LIMIT 1`,
      [commandId],
    );
    const row = context.rows[0];
    if (row) {
      await this.queueSystemAlert({
        eventType: 'session.command_failed',
        severity: 'warning',
        dedupeKey: `command:${commandId}:failed`,
        organizationId: row.organization_id,
        sessionId: row.session_id,
        resourceType: 'session_command',
        resourceId: commandId,
        subject: 'WhatsApp session command failed',
        summary: `relayWA could not complete the "${row.command}" command for a WhatsApp session.`,
        details: { command: row.command, error: message },
        cooldownSeconds: 86400,
      });
    }
  }
}
