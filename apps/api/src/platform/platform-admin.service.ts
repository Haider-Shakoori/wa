import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UpdatePlatformSubscriptionDto } from './platform-admin.dto';
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

  async sessions() {
    const result = await this.db.query(
      `SELECT ws.id, ws.organization_id, o.name AS organization_name,
              ws.name, ws.phone_number, ws.display_name, ws.status,
              ws.worker_id, ws.last_connected_at, ws.last_disconnected_at,
              ws.last_connection_error, ws.created_at, ws.updated_at
       FROM whatsapp_sessions ws
       JOIN organizations o ON o.id = ws.organization_id
       WHERE ws.deleted_at IS NULL
       ORDER BY ws.updated_at DESC
       LIMIT 300`,
    );
    return result.rows;
  }

  async subscriptions() {
    const result = await this.db.query(
      `SELECT s.organization_id, o.name AS organization_name, s.plan_code,
              s.status, s.current_period_start, s.current_period_end,
              s.trial_ends_at, s.cancel_at_period_end, s.provider,
              p.max_sessions, p.monthly_messages, p.max_api_keys
       FROM organization_subscriptions s
       JOIN organizations o ON o.id = s.organization_id
       JOIN subscription_plans p ON p.code = s.plan_code
       ORDER BY s.updated_at DESC
       LIMIT 300`,
    );
    return result.rows;
  }

  async sessionAction(sessionId: string, action: 'connect' | 'restart' | 'logout') {
    const session = await this.db.query<{ organization_id: string }>(
      `SELECT organization_id
       FROM whatsapp_sessions
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId],
    );
    if (!session.rows[0]) throw new NotFoundException('Session not found');

    const commandId = randomUUID();
    await this.db.query(
      `INSERT INTO whatsapp_session_commands
        (id, organization_id, session_id, command, status)
       VALUES ($1, $2, $3, $4, 'queued')`,
      [commandId, session.rows[0].organization_id, sessionId, action],
    );
    return { commandId, sessionId, action, status: 'queued' };
  }

  async updateSubscription(organizationId: string, input: UpdatePlatformSubscriptionDto) {
    if (input.planCode) {
      const plan = await this.db.query<{ code: string }>(
        'SELECT code FROM subscription_plans WHERE code = $1 AND active = true LIMIT 1',
        [input.planCode],
      );
      if (!plan.rows[0]) throw new NotFoundException('Plan not found');
    }

    const result = await this.db.query(
      `UPDATE organization_subscriptions
       SET plan_code = COALESCE($2, plan_code),
           status = COALESCE($3, status),
           current_period_end = CASE
             WHEN $4::int IS NOT NULL THEN GREATEST(current_period_end, now()) + ($4::int * interval '1 day')
             ELSE current_period_end
           END,
           trial_ends_at = CASE
             WHEN $4::int IS NOT NULL AND COALESCE($3, status) = 'trialing'
               THEN GREATEST(COALESCE(trial_ends_at, now()), now()) + ($4::int * interval '1 day')
             ELSE trial_ends_at
           END,
           updated_at = now()
       WHERE organization_id = $1
       RETURNING organization_id, plan_code, status, current_period_start,
                 current_period_end, trial_ends_at, cancel_at_period_end, provider`,
      [organizationId, input.planCode ?? null, input.status ?? null, input.extendDays ?? null],
    );
    if (!result.rows[0]) throw new NotFoundException('Subscription not found');
    return result.rows[0];
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
