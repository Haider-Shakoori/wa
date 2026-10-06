import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PlatformAdminService {
  constructor(private readonly db: DatabaseService) {}

  async overview() {
    const [users, organizations, memberships, sessions, messages, payments, webhookFailures] = await Promise.all([
      this.count('SELECT count(*)::text AS count FROM users WHERE disabled_at IS NULL'),
      this.count('SELECT count(*)::text AS count FROM organizations'),
      this.count("SELECT count(*)::text AS count FROM organization_memberships WHERE status = 'active'"),
      this.db.query<{ status: string; count: string }>(
        `SELECT status, count(*)::text AS count
         FROM whatsapp_sessions WHERE deleted_at IS NULL GROUP BY status`,
      ),
      this.db.query<{ status: string; count: string }>(
        `SELECT status, count(*)::text AS count
         FROM whatsapp_messages WHERE direction = 'outbound' GROUP BY status`,
      ),
      this.db.query<{ status: string; count: string }>(
        `SELECT status, count(*)::text AS count FROM payments GROUP BY status`,
      ),
      this.count("SELECT count(*)::text AS count FROM webhook_deliveries WHERE status = 'failed'"),
    ]);

    return {
      users,
      organizations,
      activeMemberships: memberships,
      sessions: Object.fromEntries(sessions.rows.map((row) => [row.status, Number(row.count)])),
      messages: Object.fromEntries(messages.rows.map((row) => [row.status, Number(row.count)])),
      payments: Object.fromEntries(payments.rows.map((row) => [row.status, Number(row.count)])),
      failedWebhooks: webhookFailures,
    };
  }

  async tenants() {
    const result = await this.db.query(
      `SELECT o.id, o.name, o.slug, o.created_at,
              s.plan_code, s.status AS subscription_status, s.current_period_end,
              count(DISTINCT ws.id)::int AS sessions,
              count(DISTINCT m.id)::int AS members
       FROM organizations o
       LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
       LEFT JOIN whatsapp_sessions ws ON ws.organization_id = o.id AND ws.deleted_at IS NULL
       LEFT JOIN organization_memberships m ON m.organization_id = o.id AND m.status = 'active'
       GROUP BY o.id, s.plan_code, s.status, s.current_period_end
       ORDER BY o.created_at DESC
       LIMIT 200`,
    );
    return result.rows;
  }

  async workers() {
    const result = await this.db.query(
      `SELECT worker_id,
              count(*)::int AS owned_sessions,
              max(worker_lease_expires_at) AS lease_expires_at,
              count(*) FILTER (WHERE status = 'connected')::int AS connected_sessions,
              count(*) FILTER (WHERE status = 'reconnecting')::int AS reconnecting_sessions
       FROM whatsapp_sessions
       WHERE worker_id IS NOT NULL AND deleted_at IS NULL
       GROUP BY worker_id
       ORDER BY worker_id`,
    );
    return result.rows;
  }

  async queues() {
    const [messages, webhooks, commands] = await Promise.all([
      this.db.query(
        `SELECT status, count(*)::int AS count
         FROM whatsapp_messages
         WHERE direction = 'outbound'
         GROUP BY status ORDER BY status`,
      ),
      this.db.query(
        `SELECT status, count(*)::int AS count
         FROM webhook_deliveries GROUP BY status ORDER BY status`,
      ),
      this.db.query(
        `SELECT status, count(*)::int AS count
         FROM whatsapp_session_commands GROUP BY status ORDER BY status`,
      ),
    ]);
    return { messages: messages.rows, webhooks: webhooks.rows, commands: commands.rows };
  }

  async payments() {
    const result = await this.db.query(
      `SELECT p.id, p.organization_id, o.name AS organization_name,
              p.plan_code, p.provider, p.billing_interval, p.status,
              p.amount_cents, p.currency, p.manual_reference, p.paid_at, p.created_at
       FROM payments p
       JOIN organizations o ON o.id = p.organization_id
       ORDER BY p.created_at DESC
       LIMIT 200`,
    );
    return result.rows;
  }

  async recentErrors() {
    const [sessions, messages, webhooks] = await Promise.all([
      this.db.query(
        `SELECT id, organization_id, name, status, last_connection_error, updated_at
         FROM whatsapp_sessions
         WHERE last_connection_error IS NOT NULL
         ORDER BY updated_at DESC LIMIT 50`,
      ),
      this.db.query(
        `SELECT id, organization_id, session_id, status, last_error, updated_at
         FROM whatsapp_messages
         WHERE last_error IS NOT NULL
         ORDER BY updated_at DESC LIMIT 50`,
      ),
      this.db.query(
        `SELECT id, organization_id, endpoint_id, status, last_error, updated_at
         FROM webhook_deliveries
         WHERE last_error IS NOT NULL
         ORDER BY updated_at DESC LIMIT 50`,
      ),
    ]);
    return { sessions: sessions.rows, messages: messages.rows, webhooks: webhooks.rows };
  }

  private async count(sql: string) {
    const result = await this.db.query<{ count: string }>(sql);
    return Number(result.rows[0]?.count ?? 0);
  }
}
