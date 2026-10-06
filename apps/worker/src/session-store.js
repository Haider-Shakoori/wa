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
      clearQr = false,
    } = details;

    await this.pool.query(
      `UPDATE whatsapp_sessions
       SET status = $1,
           phone_number = COALESCE($2, phone_number),
           display_name = COALESCE($3, display_name),
           qr_code = CASE WHEN $4 THEN NULL ELSE qr_code END,
           qr_expires_at = CASE WHEN $4 THEN NULL ELSE qr_expires_at END,
           last_connected_at = CASE WHEN $1 = 'connected' THEN now() ELSE last_connected_at END,
           last_disconnected_at = CASE WHEN $1 IN ('disconnected','logged_out','error') THEN now() ELSE last_disconnected_at END,
           updated_at = now()
       WHERE id = $5 AND worker_id = $6`,
      [status, phoneNumber, displayName, clearQr, sessionId, this.workerId],
    );
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
