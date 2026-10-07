import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UpdateMessagingSafetyDto, UpdatePlatformSubscriptionDto } from './platform-admin.dto';
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
              ws.name, ws.phone_number, ws.display_name, ws.status, ws.engine, ws.next_engine,
              ws.worker_id, ws.last_connected_at, ws.last_disconnected_at,
              ws.last_connection_error, ws.messaging_paused_until, ws.messaging_pause_reason, ws.created_at, ws.updated_at
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

  async updateSessionEngine(sessionId: string, input: { engine: 'baileys' | 'chromium' }) {
    const current = await this.db.query<{
      id: string;
      organization_id: string;
      status: string;
      engine: 'baileys' | 'chromium';
      next_engine: 'baileys' | 'chromium' | null;
    }>(
      `SELECT id, organization_id, status, engine, next_engine
       FROM whatsapp_sessions
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId],
    );
    const session = current.rows[0];
    if (!session) throw new NotFoundException('Session not found');

    if (session.engine === input.engine) {
      await this.db.query(
        `UPDATE whatsapp_sessions
         SET next_engine = NULL, updated_at = now()
         WHERE id = $1`,
        [sessionId],
      );
      return {
        sessionId,
        activeEngine: session.engine,
        nextEngine: null,
        applied: true,
        requiresQrNow: false,
        message: 'Session is already using this engine.',
      };
    }

    const canApplyWithoutActiveAuth = ['pending', 'logged_out'].includes(session.status);
    if (canApplyWithoutActiveAuth) {
      const changed = await this.db.query(
        `UPDATE whatsapp_sessions
         SET engine = $2, next_engine = NULL, updated_at = now()
         WHERE id = $1
         RETURNING engine, next_engine, status`,
        [sessionId, input.engine],
      );
      return {
        sessionId,
        activeEngine: changed.rows[0].engine,
        nextEngine: null,
        applied: true,
        requiresQrNow: false,
        message: 'Engine changed. No active login was interrupted.',
      };
    }

    await this.db.query(
      `UPDATE whatsapp_sessions
       SET next_engine = $2, updated_at = now()
       WHERE id = $1`,
      [sessionId, input.engine],
    );

    return {
      sessionId,
      activeEngine: session.engine,
      nextEngine: input.engine,
      applied: false,
      deferred: true,
      requiresQrNow: false,
      message: 'Engine preference saved. The current authenticated engine stays active; RelayWA will not force a QR rescan.',
    };
  }

  async resumeSessionMessaging(sessionId: string) {
    const result = await this.db.query(
      `UPDATE whatsapp_sessions
       SET messaging_paused_until = NULL,
           messaging_pause_reason = NULL,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, organization_id, status`,
      [sessionId],
    );
    const session = result.rows[0];
    if (!session) throw new NotFoundException('Session not found');

    await this.db.query(
      `INSERT INTO whatsapp_session_events
        (organization_id, session_id, event_type, payload)
       VALUES ($1, $2, 'session.messaging_safety_resumed', '{}'::jsonb)`,
      [session.organization_id, sessionId],
    );

    return { sessionId, resumed: true };
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

  async authProviders() {
    const result = await this.db.query(
      `SELECT provider, enabled, public_config, updated_at
       FROM auth_provider_settings
       ORDER BY provider`,
    );

    const google = result.rows.find((row:any) => row.provider === 'google');
    if (!google) {
      return [{
        provider: 'google',
        enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
        public_config: {
          clientId: process.env.GOOGLE_CLIENT_ID ?? '',
          source: process.env.GOOGLE_CLIENT_ID ? 'environment' : 'platform',
        },
        updated_at: null,
      }];
    }

    return result.rows;
  }

  async updateGoogleAuthProvider(input: { enabled?: boolean; clientId?: string }) {
    const current = await this.db.query<any>(
      `SELECT enabled, public_config
       FROM auth_provider_settings
       WHERE provider = 'google'
       LIMIT 1`,
    );

    const existingClientId = String(
      current.rows[0]?.public_config?.clientId ??
      process.env.GOOGLE_CLIENT_ID ??
      '',
    ).trim();
    const clientId = input.clientId === undefined ? existingClientId : input.clientId.trim();
    const enabled = input.enabled === undefined
      ? Boolean(current.rows[0]?.enabled ?? process.env.GOOGLE_CLIENT_ID)
      : input.enabled;

    if (enabled && !clientId) {
      throw new NotFoundException('Google Client ID is required before enabling Google sign-in');
    }

    const result = await this.db.query(
      `INSERT INTO auth_provider_settings (provider, enabled, public_config, updated_at)
       VALUES ('google', $1, $2::jsonb, now())
       ON CONFLICT (provider)
       DO UPDATE SET enabled = EXCLUDED.enabled,
                     public_config = EXCLUDED.public_config,
                     updated_at = now()
       RETURNING provider, enabled, public_config, updated_at`,
      [enabled, JSON.stringify({ clientId, source: 'platform' })],
    );
    return result.rows[0];
  }

  async messagingEngineSettings() {
    const result = await this.db.query<{ default_engine: 'baileys' | 'chromium'; updated_at: string | null }>(
      `SELECT default_engine, updated_at
       FROM messaging_engine_settings
       WHERE id = 'global'
       LIMIT 1`,
    );
    const row = result.rows[0] ?? { default_engine: 'baileys' as const, updated_at: null };

    return {
      defaultEngine: row.default_engine,
      updatedAt: row.updated_at,
      engines: [
        { key: 'baileys', name: 'Baileys', transport: 'WebSocket protocol client', profile: 'Lightweight and scalable' },
        { key: 'chromium', name: 'Chromium / WhatsApp Web', transport: 'Real WhatsApp Web browser session', profile: 'Higher resource usage; persistent browser profile' },
      ],
      existingSessionPolicy: 'Existing sessions keep their assigned engine. New sessions use the selected default.',
    };
  }

  async updateMessagingEngine(input: { engine: 'baileys' | 'chromium' }) {
    await this.db.query(
      `INSERT INTO messaging_engine_settings (id, default_engine, updated_at)
       VALUES ('global', $1, now())
       ON CONFLICT (id)
       DO UPDATE SET default_engine = EXCLUDED.default_engine, updated_at = now()`,
      [input.engine],
    );
    return this.messagingEngineSettings();
  }

  async messagingSafetySettings() {
    const result = await this.db.query<any>(
      `SELECT enabled, min_delay_ms, max_delay_ms, messages_per_minute, messages_per_hour,
              burst_limit, burst_window_seconds, duplicate_window_seconds,
              retry_base_ms, max_attempts, max_queue_age_seconds,
              failure_pause_threshold, failure_window_seconds, auto_pause_seconds, updated_at
       FROM messaging_safety_settings
       WHERE id = 'global'
       LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Messaging safety settings are not initialized');

    return {
      enabled: row.enabled,
      minDelayMs: row.min_delay_ms,
      maxDelayMs: row.max_delay_ms,
      messagesPerMinute: row.messages_per_minute,
      messagesPerHour: row.messages_per_hour,
      burstLimit: row.burst_limit,
      burstWindowSeconds: row.burst_window_seconds,
      duplicateWindowSeconds: row.duplicate_window_seconds,
      retryBaseMs: row.retry_base_ms,
      maxAttempts: row.max_attempts,
      maxQueueAgeSeconds: row.max_queue_age_seconds,
      failurePauseThreshold: row.failure_pause_threshold,
      failureWindowSeconds: row.failure_window_seconds,
      autoPauseSeconds: row.auto_pause_seconds,
      updatedAt: row.updated_at,
      hardMinimumDelayMs: 1000,
      recommendation: 'For unofficial WhatsApp Web engines, slower and consent-based messaging is safer. These controls reduce burst risk but cannot guarantee that WhatsApp will not restrict an account.',
    };
  }

  async updateMessagingSafety(input: UpdateMessagingSafetyDto) {
    const current = await this.messagingSafetySettings();
    const next = {
      enabled: input.enabled ?? current.enabled,
      minDelayMs: input.minDelayMs ?? current.minDelayMs,
      maxDelayMs: input.maxDelayMs ?? current.maxDelayMs,
      messagesPerMinute: input.messagesPerMinute ?? current.messagesPerMinute,
      messagesPerHour: input.messagesPerHour ?? current.messagesPerHour,
      burstLimit: input.burstLimit ?? current.burstLimit,
      burstWindowSeconds: input.burstWindowSeconds ?? current.burstWindowSeconds,
      duplicateWindowSeconds: input.duplicateWindowSeconds ?? current.duplicateWindowSeconds,
      retryBaseMs: input.retryBaseMs ?? current.retryBaseMs,
      maxAttempts: input.maxAttempts ?? current.maxAttempts,
      maxQueueAgeSeconds: input.maxQueueAgeSeconds ?? current.maxQueueAgeSeconds,
      failurePauseThreshold: input.failurePauseThreshold ?? current.failurePauseThreshold,
      failureWindowSeconds: input.failureWindowSeconds ?? current.failureWindowSeconds,
      autoPauseSeconds: input.autoPauseSeconds ?? current.autoPauseSeconds,
    };

    if (next.maxDelayMs < next.minDelayMs) {
      throw new BadRequestException('Maximum delay must be greater than or equal to minimum delay');
    }
    if (next.messagesPerHour < next.messagesPerMinute) {
      throw new BadRequestException('Hourly message limit must be at least the per-minute limit');
    }

    await this.db.query(
      `UPDATE messaging_safety_settings
       SET enabled = $1,
           min_delay_ms = $2,
           max_delay_ms = $3,
           messages_per_minute = $4,
           messages_per_hour = $5,
           burst_limit = $6,
           burst_window_seconds = $7,
           duplicate_window_seconds = $8,
           retry_base_ms = $9,
           max_attempts = $10,
           max_queue_age_seconds = $11,
           failure_pause_threshold = $12,
           failure_window_seconds = $13,
           auto_pause_seconds = $14,
           updated_at = now()
       WHERE id = 'global'`,
      [
        next.enabled,
        next.minDelayMs,
        next.maxDelayMs,
        next.messagesPerMinute,
        next.messagesPerHour,
        next.burstLimit,
        next.burstWindowSeconds,
        next.duplicateWindowSeconds,
        next.retryBaseMs,
        next.maxAttempts,
        next.maxQueueAgeSeconds,
        next.failurePauseThreshold,
        next.failureWindowSeconds,
        next.autoPauseSeconds,
      ],
    );

    return this.messagingSafetySettings();
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

  async supportAnswer(rawMessage: string) {
    const message = rawMessage.trim().toLowerCase();
    const [overview, sessions, workers, queues, errors, safety, engine, payments] = await Promise.all([
      this.overview(),
      this.sessions(),
      this.workers(),
      this.queues(),
      this.recentErrors(),
      this.messagingSafetySettings(),
      this.messagingEngineSettings(),
      this.payments(),
    ]);

    const connected = Number((overview.sessions as any)?.connected ?? 0);
    const needScan = Number((overview.sessions as any)?.need_scan ?? 0);
    const reconnecting = Number((overview.sessions as any)?.reconnecting ?? 0);
    const loggedOut = Number((overview.sessions as any)?.logged_out ?? 0);
    const failedMessages = Number((overview.messages as any)?.failed ?? 0);
    const retryingMessages = Number((overview.messages as any)?.retrying ?? 0);
    const healthyWorkers = workers.filter((worker:any) => new Date(worker.lease_expires_at).getTime() > Date.now()).length;
    const failedWebhooks = Number(overview.failedWebhooks ?? 0);
    const pendingManual = payments.filter((payment:any) => payment.provider === 'manual' && payment.status === 'pending').length;

    const action = (label: string, section: string) => ({ label, section });
    const result = {
      title: 'RelayWA operations overview',
      reply: `RelayWA currently has ${connected} connected WhatsApp session(s), ${healthyWorkers} healthy worker lease(s), ${failedMessages} failed outbound message(s), and ${failedWebhooks} failed webhook delivery record(s).`,
      highlights: [
        `${sessions.length} total WhatsApp session(s)`,
        `${needScan} waiting for QR scan`,
        `${reconnecting} reconnecting`,
        `${pendingManual} pending manual payment(s)`,
      ],
      actions: [
        action('Open sessions', 'Sessions'),
        action('Open infrastructure', 'Infrastructure'),
        action('Open diagnostics', 'Diagnostics'),
      ],
      intent: 'overview',
      generatedAt: new Date().toISOString(),
    };

    if (/disconnect|logged out|logout|qr|scan|reconnect|session|whatsapp/.test(message)) {
      const problemSessions = sessions
        .filter((session:any) => session.status !== 'connected')
        .slice(0, 5)
        .map((session:any) => `${session.organization_name}: ${session.name} — ${session.status}`);
      return {
        ...result,
        title: 'WhatsApp session health',
        reply: `${connected} session(s) are connected. ${needScan} need a QR scan, ${reconnecting} are reconnecting, and ${loggedOut} are logged out. A logged-out session requires pairing again; a reconnecting session should normally recover without logout.`,
        highlights: problemSessions.length ? problemSessions : ['No non-connected sessions are currently listed.'],
        actions: [action('Inspect sessions', 'Sessions'), action('Check diagnostics', 'Diagnostics')],
        intent: 'sessions',
      };
    }

    if (/queue|message|send|failed|retry|delivery|stuck/.test(message)) {
      const messageQueue = (queues.messages ?? []).map((row:any) => `${row.status}: ${row.count}`);
      return {
        ...result,
        title: 'Outbound messaging health',
        reply: `There are ${failedMessages} failed outbound message(s) and ${retryingMessages} retrying message(s). Safety Governor is ${safety.enabled ? 'enabled' : 'disabled'} with ${safety.minDelayMs}–${safety.maxDelayMs} ms randomized pacing, ${safety.messagesPerMinute}/minute and ${safety.messagesPerHour}/hour limits.`,
        highlights: messageQueue.length ? messageQueue : ['No outbound queue rows were returned.'],
        actions: [action('Open messaging controls', 'Messaging'), action('Open diagnostics', 'Diagnostics'), action('Open infrastructure', 'Infrastructure')],
        intent: 'messaging',
      };
    }

    if (/webhook|callback|event/.test(message)) {
      return {
        ...result,
        title: 'Webhook delivery health',
        reply: `RelayWA currently reports ${failedWebhooks} failed webhook delivery record(s). Review Diagnostics for recent endpoint errors and Infrastructure for queue state before retrying the integration from the tenant side.`,
        highlights: (errors.webhooks ?? []).slice(0, 5).map((row:any) => row.last_error || row.status) || [],
        actions: [action('Open diagnostics', 'Diagnostics'), action('Open infrastructure', 'Infrastructure')],
        intent: 'webhooks',
      };
    }

    if (/worker|infrastructure|redis|postgres|lease|capacity/.test(message)) {
      return {
        ...result,
        title: 'Infrastructure health',
        reply: `${healthyWorkers} of ${workers.length} worker lease(s) are currently healthy. Worker leases own ${workers.reduce((sum:number,row:any)=>sum + Number(row.owned_sessions || 0),0)} session(s) in total.`,
        highlights: workers.slice(0, 6).map((row:any) => `${row.worker_id}: ${row.connected_sessions} connected / ${row.owned_sessions} owned`),
        actions: [action('Open infrastructure', 'Infrastructure'), action('Open diagnostics', 'Diagnostics')],
        intent: 'infrastructure',
      };
    }

    if (/subscription|plan|billing|payment|trial|revenue/.test(message)) {
      const paymentStates = Object.entries(overview.payments ?? {}).map(([status,count]) => `${status}: ${count}`);
      return {
        ...result,
        title: 'Subscription and payment health',
        reply: `There are ${overview.organizations} organization(s) and ${pendingManual} pending manual payment(s). Use Subscriptions for plan state and Payments for transaction review.`,
        highlights: paymentStates.length ? paymentStates : ['No payment status rows were returned.'],
        actions: [action('Open subscriptions', 'Subscriptions'), action('Open payments', 'Payments'), action('Open providers', 'Providers')],
        intent: 'billing',
      };
    }

    if (/safety|rate|limit|delay|burst|ban|pacing/.test(message)) {
      return {
        ...result,
        title: 'Messaging Safety Governor',
        reply: `Safety Governor is ${safety.enabled ? 'enabled' : 'disabled'}. Current pacing is ${safety.minDelayMs}–${safety.maxDelayMs} ms, with ${safety.messagesPerMinute} messages/minute, ${safety.messagesPerHour} messages/hour, and a burst limit of ${safety.burstLimit} per ${safety.burstWindowSeconds} seconds.`,
        highlights: [
          `Duplicate suppression: ${safety.duplicateWindowSeconds}s`,
          `Maximum attempts: ${safety.maxAttempts}`,
          `Auto-pause after ${safety.failurePauseThreshold} final failures in ${safety.failureWindowSeconds}s`,
          `Pause duration: ${safety.autoPauseSeconds}s`,
        ],
        actions: [action('Open messaging controls', 'Messaging')],
        intent: 'safety',
      };
    }

    if (/engine|baileys|chromium|browser/.test(message)) {
      const counts = sessions.reduce((acc:any,session:any) => {
        const key = session.engine || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return {
        ...result,
        title: 'Messaging engine configuration',
        reply: `The platform default engine is ${engine.defaultEngine}. Existing connected sessions keep their current assigned engine; changing the default does not force logout or an immediate QR rescan.`,
        highlights: Object.entries(counts).map(([name,count]) => `${name}: ${count} session(s)`),
        actions: [action('Open messaging controls', 'Messaging'), action('Inspect sessions', 'Sessions')],
        intent: 'engines',
      };
    }

    if (/error|diagnostic|problem|issue|broken|health/.test(message)) {
      return {
        ...result,
        title: 'Recent operational errors',
        reply: `Diagnostics currently contains ${errors.sessions.length} session error row(s), ${errors.messages.length} message error row(s), and ${errors.webhooks.length} webhook error row(s).`,
        highlights: [
          ...(errors.sessions ?? []).slice(0, 2).map((row:any) => `Session: ${row.last_connection_error || row.status}`),
          ...(errors.messages ?? []).slice(0, 2).map((row:any) => `Message: ${row.last_error || row.status}`),
          ...(errors.webhooks ?? []).slice(0, 2).map((row:any) => `Webhook: ${row.last_error || row.status}`),
        ],
        actions: [action('Open diagnostics', 'Diagnostics'), action('Open infrastructure', 'Infrastructure')],
        intent: 'diagnostics',
      };
    }

    return result;
  }

  private async count(sql: string) {
    const result = await this.db.query<{ count: string }>(sql);
    return Number(result.rows[0]?.count ?? 0);
  }
}
