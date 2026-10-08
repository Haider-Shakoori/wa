import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UpdateMessagingSafetyDto, UpdatePlatformSubscriptionDto, UpdateTenantMemberStatusDto, UpdateTenantSuspensionDto, UpdatePlatformAdminRoleDto } from './platform-admin.dto';
import { DatabaseService } from '../database/database.service';
import type { PoolClient } from 'pg';

@Injectable()
export class PlatformAdminService {
  constructor(private readonly db: DatabaseService) {}

  async whoami(userId: string) {
    const result = await this.db.query<{id:string; email:string; role:string}>(
      `SELECT id,email,platform_role AS role FROM users
       WHERE id=$1 AND is_platform_admin=true AND disabled_at IS NULL LIMIT 1`,[userId]);
    if (!result.rows[0]) throw new ForbiddenException('Platform administrator access required');
    return result.rows[0];
  }

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

  async analytics() {
    const [messageTrend, tenantTrend, alertSummary, recentAlerts] = await Promise.all([
      this.db.query<{ day: string; sent: number; failed: number }>(`SELECT to_char(day::date, 'YYYY-MM-DD') AS day,
        count(m.id) FILTER (WHERE m.status IN ('sent','delivered','read'))::int AS sent,
        count(m.id) FILTER (WHERE m.status = 'failed')::int AS failed
        FROM generate_series(current_date - 13, current_date, interval '1 day') day
        LEFT JOIN whatsapp_messages m ON m.created_at >= day AND m.created_at < day + interval '1 day' AND m.direction = 'outbound'
        GROUP BY day ORDER BY day`),
      this.db.query<{ day: string; organizations: number }>(`SELECT to_char(day::date, 'YYYY-MM-DD') AS day,
        count(o.id)::int AS organizations FROM generate_series(current_date - 13, current_date, interval '1 day') day
        LEFT JOIN organizations o ON o.created_at >= day AND o.created_at < day + interval '1 day'
        GROUP BY day ORDER BY day`),
      this.db.query<{ severity: string; count: number }>(`SELECT severity, count(*)::int AS count FROM system_alerts
        WHERE created_at >= now() - interval '14 days' GROUP BY severity`),
      this.db.query(`SELECT id, severity, event_type, subject, summary, status, created_at
        FROM system_alerts ORDER BY created_at DESC LIMIT 20`),
    ]);
    return { messageTrend: messageTrend.rows, tenantTrend: tenantTrend.rows,
      alertSummary: alertSummary.rows, alerts: recentAlerts.rows };
  }

  async monitoringOverview() {
    const [sessions, webhooks, messageFailures, recentAlerts, workers] = await Promise.all([
      this.db.query(`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status='connected')::int AS connected,
        count(*) FILTER (WHERE status='reconnecting')::int AS reconnecting,
        count(*) FILTER (WHERE status IN ('logged_out','error','disconnected'))::int AS offline,
        count(*) FILTER (WHERE worker_id IS NOT NULL AND worker_lease_expires_at < now()
           AND status IN ('connected','connecting','reconnecting'))::int AS stale_leases
        FROM whatsapp_sessions WHERE deleted_at IS NULL`),
      this.db.query(`SELECT count(*) FILTER (WHERE status='failed')::int AS failed,
        count(*) FILTER (WHERE status='queued')::int AS queued,
        count(*) FILTER (WHERE status='delivered')::int AS delivered
        FROM webhook_deliveries WHERE queued_at >= now()-interval '24 hours'`),
      this.db.query(`SELECT count(*)::int AS count FROM whatsapp_messages
        WHERE direction='outbound' AND status='failed'
        AND created_at>=now()-interval '24 hours'`),
      this.db.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE acknowledged_at IS NULL)::int AS unacknowledged,
        count(*) FILTER (WHERE acknowledged_at IS NULL AND severity='critical')::int AS critical
        FROM system_alerts WHERE created_at>=now()-interval '30 days'`),
      this.workers(),
    ]);
    // Do not expose SMTP credentials; only tell operators whether outbound
    // notification delivery has enough configuration to be attempted.
    const emailAlertsEnabled=!['0','false','no','off'].includes(
      String(process.env.ALERT_EMAIL_ENABLED??'true').toLowerCase());
    const emailAlertsConfigured=Boolean(emailAlertsEnabled && process.env.SMTP_HOST &&
      (process.env.SMTP_FROM||process.env.SMTP_USER));

    return { generatedAt:new Date().toISOString(),
      notificationDelivery:{ emailConfigured:emailAlertsConfigured },
      sessions:sessions.rows[0], webhooks24h:webhooks.rows[0],
      failedMessages24h:messageFailures.rows[0]?.count??0,
      alerts30d:recentAlerts.rows[0],
      workers:workers.map((worker:any)=>({
        ...worker, leaseActive:Boolean(worker.lease_expires_at &&
          new Date(worker.lease_expires_at).getTime()>Date.now()),
      })) };
  }

  async monitoringAlerts(severity = '', acknowledgement = '') {
    if (severity && !['critical','warning','info'].includes(severity)) {
      throw new BadRequestException('Invalid alert severity');
    }
    if (acknowledgement && !['open','acknowledged'].includes(acknowledgement)) {
      throw new BadRequestException('Invalid alert acknowledgement filter');
    }
    const result=await this.db.query(`SELECT a.id,a.event_type,a.severity,a.subject,a.summary,
      a.organization_id,a.session_id,a.resource_type,a.resource_id,a.status,a.created_at,
      a.sent_at,a.acknowledged_at,u.email AS acknowledged_by_email
      FROM system_alerts a
      LEFT JOIN users u ON u.id=a.acknowledged_by
      WHERE ($1='' OR a.severity=$1)
        AND ($2='' OR ($2='open' AND a.acknowledged_at IS NULL)
          OR ($2='acknowledged' AND a.acknowledged_at IS NOT NULL))
      ORDER BY a.created_at DESC LIMIT 150`,[severity,acknowledgement]);
    return result.rows;
  }

  async setAlertAcknowledgement(alertId:string, acknowledged:boolean, actorUserId:string) {
    return this.db.transaction(async client=>{
      const result=await client.query<{id:string;acknowledged_at:Date|null}>(
        'SELECT id,acknowledged_at FROM system_alerts WHERE id=$1 FOR UPDATE',[alertId]);
      const alert=result.rows[0];
      if(!alert)throw new NotFoundException('Alert not found');
      if(Boolean(alert.acknowledged_at)===acknowledged) {
        return {id:alertId,acknowledged,changed:false};
      }
      await client.query(`UPDATE system_alerts
        SET acknowledged_at=CASE WHEN $2 THEN now() ELSE NULL END,
            acknowledged_by=CASE WHEN $2 THEN $3::uuid ELSE NULL END,
            updated_at=now() WHERE id=$1`,[alertId,acknowledged,actorUserId]);
      await this.recordAudit(client,actorUserId,
        acknowledged?'monitoring.alert.acknowledged':'monitoring.alert.reopened',
        'system_alert',alertId,
        {acknowledged:Boolean(alert.acknowledged_at)},
        {acknowledged});
      return {id:alertId,acknowledged,changed:true};
    });
  }

  async auditLogs(action = '', actor = '') {
    const result = await this.db.query(`SELECT a.id, a.action, a.target_type, a.target_id, a.before_state, a.after_state,
      a.created_at, u.email AS actor_email
      FROM platform_admin_audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE ($1 = '' OR a.action ILIKE '%' || $1 || '%')
        AND ($2 = '' OR u.email ILIKE '%' || $2 || '%')
      ORDER BY a.created_at DESC LIMIT 100`, [action.slice(0,80),actor.slice(0,100)]);
    return result.rows;
  }

  async loginEvents() {
    const result = await this.db.query(`SELECT e.id, e.outcome, e.login_method, e.ip_address,
      e.created_at, u.email FROM platform_login_events e
      LEFT JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT 100`);
    return result.rows;
  }

  async administrators() {
    const result = await this.db.query(`SELECT id, email, name, platform_role, created_at
      FROM users WHERE is_platform_admin = true AND disabled_at IS NULL
      ORDER BY email ASC LIMIT 100`);
    return result.rows;
  }

  async updateAdminRole(userId: string, input: UpdatePlatformAdminRoleDto, actorUserId: string) {
    if (input.reason?.trim().length < 8) throw new BadRequestException('Provide an audit reason');
    return this.db.transaction(async (client) => {
      // A table lock prevents concurrent changes removing the last super-admin.
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const result = await client.query<{id:string; platform_role:string|null}>(
        'SELECT id, platform_role FROM users WHERE id = $1 AND is_platform_admin = true AND disabled_at IS NULL FOR UPDATE',
        [userId],
      );
      const target = result.rows[0];
      if (!target) throw new NotFoundException('Platform administrator not found');
      if (target.id === actorUserId && input.role !== target.platform_role) {
        throw new ForbiddenException('Cannot change your own platform administrator role');
      }
      if (target.platform_role === input.role) return { userId, role: input.role, changed: false };
      if (target.platform_role === 'super_admin') {
        const count = await client.query<{total:number}>(`SELECT count(*)::int AS total FROM users
          WHERE is_platform_admin = true AND disabled_at IS NULL AND platform_role = 'super_admin'`);
        if ((count.rows[0]?.total ?? 0) <= 1) throw new ForbiddenException('Last super administrator must remain');
      }
      await client.query('UPDATE users SET platform_role = $2, updated_at = now() WHERE id = $1', [userId, input.role]);
      await this.recordAudit(client, actorUserId,'platform.admin.role.updated','platform_admin',userId,
        {role: target.platform_role},{role: input.role, reason: input.reason.trim()});
      return { userId, role: input.role, changed: true };
    });
  }

  async setTenantSuspension(organizationId: string, input: UpdateTenantSuspensionDto, actorUserId: string) {
    const reason = input.reason?.trim();
    if (!reason || reason.length < 8) throw new BadRequestException('Provide a reason of at least eight characters');
    return this.db.transaction(async (client) => {
      const result = await client.query<{ id: string; suspended_at: Date|null }>(
        'SELECT id, suspended_at FROM organizations WHERE id = $1 FOR UPDATE', [organizationId],
      );
      const org = result.rows[0];
      if (!org) throw new NotFoundException('Organization not found');
      const wasSuspended = Boolean(org.suspended_at);
      if (wasSuspended === (input.status === 'suspended')) {
        return { organizationId, status: wasSuspended ? 'suspended' : 'active', changed: false };
      }
      if (input.status === 'suspended') {
        const admins = await client.query(`SELECT 1 FROM organization_memberships m JOIN users u ON u.id = m.user_id
          WHERE m.organization_id = $1 AND m.status = 'active'
            AND u.is_platform_admin = true AND u.disabled_at IS NULL LIMIT 1`,[organizationId]);
        if (admins.rowCount) throw new ForbiddenException('Cannot suspend an organization containing a platform administrator');
      }
      const updated = await client.query(`UPDATE organizations
        SET suspended_at = CASE WHEN $2 = 'suspended' THEN now() ELSE NULL END,
            suspension_reason = CASE WHEN $2 = 'suspended' THEN $3 ELSE NULL END,
            suspended_by = CASE WHEN $2 = 'suspended' THEN $4::uuid ELSE NULL END,
            updated_at = now()
        WHERE id = $1 RETURNING suspended_at`,[organizationId,input.status,reason,actorUserId]);
      await this.recordAudit(client,actorUserId,input.status === 'suspended'?'tenant.suspended':'tenant.reactivated',
        'tenant',organizationId,{status:wasSuspended?'suspended':'active'},
        {status:input.status,reason});
      return { organizationId, status: input.status, changed: true, suspendedAt:updated.rows[0].suspended_at };
    });
  }

  async updateTenantMemberStatus(
    organizationId: string,
    membershipId: string,
    input: UpdateTenantMemberStatusDto,
    actorUserId: string,
  ) {
    const reason = input.reason?.trim();
    if (!reason || reason.length < 8) throw new BadRequestException('Provide a reason (at least 8 characters)');

    return this.db.transaction(async (client) => {
      // Serialize membership changes per organization to protect the final owner.
      const org = await client.query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [organizationId]);
      if (!org.rows[0]) throw new NotFoundException('Organization not found');

      const member = await client.query<{
        id: string; user_id: string; role: string; status: string;
        is_platform_admin: boolean; email: string;
      }>(
        `SELECT m.id, m.user_id, m.role, m.status, u.is_platform_admin, u.email
         FROM organization_memberships m JOIN users u ON u.id = m.user_id
         WHERE m.id = $1 AND m.organization_id = $2
         FOR UPDATE OF m`,
        [membershipId, organizationId],
      );
      const target = member.rows[0];
      if (!target) throw new NotFoundException('Tenant member not found');
      if (!['active', 'suspended'].includes(target.status)) {
        throw new BadRequestException('This membership is not eligible for suspension or reactivation');
      }
      if (target.status === input.status) {
        return { membershipId, organizationId, status: target.status, changed: false };
      }
      if (input.status === 'suspended') {
        if (target.user_id === actorUserId) {
          throw new ForbiddenException('Cannot suspend your own membership');
        }
        if (target.is_platform_admin) {
          throw new ForbiddenException('Cannot suspend a platform administrator');
        }
        if (target.role === 'owner') {
          const owners = await client.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM organization_memberships
             WHERE organization_id = $1 AND role = 'owner' AND status = 'active' AND id <> $2`,
            [organizationId, membershipId],
          );
          if ((owners.rows[0]?.count ?? 0) < 1) {
            throw new ForbiddenException('Cannot suspend the final active organization owner');
          }
        }
      }

      const updated = await client.query(
        `UPDATE organization_memberships SET status = $3, updated_at = now()
         WHERE organization_id = $1 AND id = $2
         RETURNING id AS membership_id, organization_id, user_id, role, status, updated_at`,
        [organizationId, membershipId, input.status],
      );
      await this.recordAudit(
        client, actorUserId, input.status === 'suspended' ? 'tenant.member.suspended' : 'tenant.member.reactivated',
        'tenant_member', membershipId,
        { organizationId, userId: target.user_id, role: target.role, status: target.status },
        { organizationId, userId: target.user_id, role: target.role, status: input.status, reason },
      );
      return { ...updated.rows[0], changed: true };
    });
  }

  async tenantMembers(organizationId: string) {
    const organization = await this.db.query('SELECT id FROM organizations WHERE id = $1 LIMIT 1', [organizationId]);
    if (!organization.rows[0]) throw new NotFoundException('Organization not found');
    const result = await this.db.query(
      `SELECT m.id AS membership_id, m.user_id, u.name, u.email, m.role, m.status,
              m.created_at, m.updated_at, (u.disabled_at IS NOT NULL) AS account_disabled,
              u.is_platform_admin AS platform_admin
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1
       ORDER BY m.created_at ASC LIMIT 200`,
      [organizationId],
    );
    return result.rows;
  }

  private async recordAudit(
    client: PoolClient, actorUserId: string, action: string,
    targetType: string, targetId: string, before: unknown, after: unknown,
  ) {
    await client.query(
      `INSERT INTO platform_admin_audit_logs
       (id, actor_user_id, action, target_type, target_id, before_state, after_state)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [randomUUID(), actorUserId, action, targetType, targetId,
       before === undefined ? null : JSON.stringify(before),
       after === undefined ? null : JSON.stringify(after)],
    );
  }

  async tenants() {
    const result = await this.db.query(
      `SELECT o.id, o.name, o.slug, o.created_at, o.suspended_at, o.suspension_reason,
              s.plan_code, s.status AS subscription_status, s.current_period_end,
              CASE WHEN s.status IN ('active','trialing') AND (
                 s.current_period_end <= now() OR (s.status='trialing' AND
                 s.trial_ends_at IS NOT NULL AND s.trial_ends_at<=now()))
                THEN 'expired' ELSE COALESCE(s.status,'none') END AS effective_subscription_status,
              count(DISTINCT ws.id)::int AS sessions,
              count(DISTINCT m.id)::int AS members
       FROM organizations o
       LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
       LEFT JOIN whatsapp_sessions ws ON ws.organization_id = o.id AND ws.deleted_at IS NULL
       LEFT JOIN organization_memberships m ON m.organization_id = o.id AND m.status = 'active'
       GROUP BY o.id, s.plan_code, s.status, s.current_period_end, s.trial_ends_at
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
              CASE WHEN s.status IN ('active','trialing') AND (
                 s.current_period_end <= now() OR (s.status='trialing' AND
                 s.trial_ends_at IS NOT NULL AND s.trial_ends_at<=now()))
                THEN 'expired' ELSE s.status END AS effective_status,
              p.max_sessions, p.daily_messages, p.monthly_messages, p.max_api_keys
       FROM organization_subscriptions s
       JOIN organizations o ON o.id = s.organization_id
       JOIN subscription_plans p ON p.code = s.plan_code
       ORDER BY s.updated_at DESC
       LIMIT 300`,
    );
    return result.rows;
  }

  async sessionAction(sessionId: string, action: 'connect' | 'restart' | 'logout', actorUserId: string) {
    return this.db.transaction(async (client) => {
      const session = await client.query<{ organization_id: string; status: string }>(
        `SELECT organization_id, status FROM whatsapp_sessions
         WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [sessionId],
      );
      if (!session.rows[0]) throw new NotFoundException('Session not found');
      const commandId = randomUUID();
      await client.query(
        `INSERT INTO whatsapp_session_commands
          (id, organization_id, session_id, command, status)
         VALUES ($1, $2, $3, $4, 'queued')`,
        [commandId, session.rows[0].organization_id, sessionId, action],
      );
      await this.recordAudit(client, actorUserId, 'session.command.' + action,
        'session', sessionId,
        { sessionStatus: session.rows[0].status },
        { commandId, command: action, status: 'queued' });
      return { commandId, sessionId, action, status: 'queued' };
    });
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

  async subscriptionPlans() {
    const result = await this.db.query(`SELECT code, name, max_sessions,
      daily_messages, monthly_messages, max_api_keys,
      monthly_price_cents, annual_price_cents, currency
      FROM subscription_plans WHERE active = true ORDER BY
      CASE code WHEN 'trial' THEN 1 WHEN 'starter' THEN 2
        WHEN 'growth' THEN 3 WHEN 'plus' THEN 4 WHEN 'scale' THEN 5 ELSE 99 END`);
    return result.rows;
  }

  async updateSubscription(organizationId: string, input: UpdatePlatformSubscriptionDto, actorUserId: string) {
    if (input.extendDays !== undefined && input.periodEndDate !== undefined) {
      throw new BadRequestException('Choose either an expiration date or an extension, not both');
    }
    const reason=input.reason?.trim();
    if (!reason || reason.length < 8) throw new BadRequestException('An audit reason of at least eight characters is required');
    let explicitEnd: Date | null = null;
    if (input.periodEndDate !== undefined) {
      explicitEnd = new Date(input.periodEndDate + 'T23:59:59.999Z');
      if (Number.isNaN(explicitEnd.getTime()) || explicitEnd.toISOString().slice(0,10) !== input.periodEndDate) {
        throw new BadRequestException('Invalid calendar expiration date');
      }
      if (explicitEnd.getTime() <= Date.now()) throw new BadRequestException('Expiration date must be in the future');
    }
    return this.db.transaction(async (client) => {
      // Serialize mutations with the parent organization, including the first assignment.
      const org=await client.query<{id:string}>(`SELECT id FROM organizations WHERE id=$1 FOR UPDATE`,[organizationId]);
      if (!org.rows[0]) throw new NotFoundException('Client not found');
      const previous=await client.query<{
        plan_code:string;status:string;current_period_start:Date;current_period_end:Date;
        trial_ends_at:Date|null;cancel_at_period_end:boolean;provider:string|null;
      }>(`SELECT plan_code,status,current_period_start,current_period_end,trial_ends_at,
        cancel_at_period_end,provider FROM organization_subscriptions
        WHERE organization_id=$1 FOR UPDATE`,[organizationId]);
      const before=previous.rows[0]??null;
      const planCode=input.planCode??before?.plan_code;
      if (!planCode) throw new BadRequestException('Select a subscription plan');
      const plan=await client.query(`SELECT code FROM subscription_plans
        WHERE code=$1 AND active=true LIMIT 1`,[planCode]);
      if (!plan.rows[0]) throw new NotFoundException('Plan not found or inactive');
      const status=input.status??before?.status??'trialing';
      const now=new Date();
      const previousEnd=before?.current_period_end ? new Date(before.current_period_end) : null;
      let end=explicitEnd;
      if(!end && input.extendDays!==undefined){
        const baseline=previousEnd && previousEnd.getTime()>now.getTime() ? previousEnd : now;
        end=new Date(baseline.getTime() + input.extendDays*86400000);
      }
      if(!end){
        // An "active" status with an expired period is still blocked by the client API.
        // Give newly activated/renewed clients a real term, never a cosmetically active label.
        end=previousEnd && previousEnd.getTime()>now.getTime() ?
          previousEnd : new Date(now.getTime()+((status==='trialing')?7:30)*86400000);
      }
      const isActive=['trialing','active'].includes(status);
      const started=(!before || (isActive && !['trialing','active'].includes(before.status)))
        ? now : new Date(before.current_period_start);
      const trialEnd=status==='trialing'?end:null;
      const cancelAtEnd=isActive?false:(before?.cancel_at_period_end??false);
      const updated=await client.query(`INSERT INTO organization_subscriptions
        (organization_id,plan_code,status,current_period_start,current_period_end,
         trial_ends_at,cancel_at_period_end,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,now())
        ON CONFLICT (organization_id) DO UPDATE SET
          plan_code=excluded.plan_code,status=excluded.status,
          current_period_start=excluded.current_period_start,
          current_period_end=excluded.current_period_end,
          trial_ends_at=excluded.trial_ends_at,
          cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now()
        RETURNING organization_id,plan_code,status,current_period_start,current_period_end,
          trial_ends_at,cancel_at_period_end,provider,updated_at`,
        [organizationId,planCode,status,started,end,trialEnd,cancelAtEnd]);
      await this.recordAudit(client,actorUserId,'subscription.updated','subscription',organizationId,
        before,{...updated.rows[0],reason,manualAdjustment:true});
      return {...updated.rows[0],effectiveActive:isActive && end.getTime()>Date.now()};
    });
  }

  async authProviders() {
    const result = await this.db.query(
      `SELECT provider, enabled, public_config, updated_at
       FROM auth_provider_settings
       WHERE provider IN ('google','github')
       ORDER BY provider`,
    );
    const rows = new Map(result.rows.map((row:any) => [row.provider, row]));

    const google = rows.get('google') as any;
    const googleClientId = String(
      google?.public_config?.clientId ??
      process.env.GOOGLE_CLIENT_ID ??
      '',
    ).trim();

    const github = rows.get('github') as any;
    const githubClientId = String(
      github?.public_config?.clientId ??
      process.env.GITHUB_CLIENT_ID ??
      '',
    ).trim();
    const githubSecretConfigured = Boolean(String(process.env.GITHUB_CLIENT_SECRET ?? '').trim());

    return [
      {
        provider: 'google',
        enabled: google ? Boolean(google.enabled) : Boolean(googleClientId),
        public_config: {
          clientId: googleClientId,
          source: google ? 'platform' : googleClientId ? 'environment' : 'platform',
        },
        updated_at: google?.updated_at ?? null,
      },
      {
        provider: 'github',
        enabled: github ? Boolean(github.enabled) : Boolean(githubClientId && githubSecretConfigured),
        public_config: {
          clientId: githubClientId,
          source: github ? 'platform' : githubClientId ? 'environment' : 'platform',
          secretConfigured: githubSecretConfigured,
        },
        updated_at: github?.updated_at ?? null,
      },
    ];
  }

  async updateGoogleAuthProvider(input: { enabled?: boolean; clientId?: string }, actorUserId: string) {
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

    return this.db.transaction(async (client) => {
      const result = await client.query(
      `INSERT INTO auth_provider_settings (provider, enabled, public_config, updated_at)
       VALUES ('google', $1, $2::jsonb, now())
       ON CONFLICT (provider)
       DO UPDATE SET enabled = EXCLUDED.enabled,
                     public_config = EXCLUDED.public_config,
                     updated_at = now()
       RETURNING provider, enabled, public_config, updated_at`,
      [enabled, JSON.stringify({ clientId, source: 'platform' })],
    );
      await this.recordAudit(client, actorUserId, 'auth.provider.updated', 'auth_provider', 'google',
        { enabled: Boolean(current.rows[0]?.enabled), clientId: existingClientId },
        { enabled, clientId });
      return result.rows[0];
    });
  }

  async updateGithubAuthProvider(input: { enabled?: boolean; clientId?: string }, actorUserId: string) {
    const current = await this.db.query<any>(
      `SELECT enabled, public_config
       FROM auth_provider_settings
       WHERE provider = 'github'
       LIMIT 1`,
    );

    const existingClientId = String(
      current.rows[0]?.public_config?.clientId ??
      process.env.GITHUB_CLIENT_ID ??
      '',
    ).trim();
    const clientId = input.clientId === undefined ? existingClientId : input.clientId.trim();
    const enabled = input.enabled === undefined
      ? Boolean(current.rows[0]?.enabled ?? (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET))
      : input.enabled;
    const secretConfigured = Boolean(String(process.env.GITHUB_CLIENT_SECRET ?? '').trim());

    if (enabled && !clientId) {
      throw new BadRequestException('GitHub Client ID is required before enabling GitHub sign-in');
    }
    if (enabled && !secretConfigured) {
      throw new BadRequestException('GITHUB_CLIENT_SECRET must be configured in the production environment before enabling GitHub sign-in');
    }

    return this.db.transaction(async (client) => {
      const result = await client.query(
      `INSERT INTO auth_provider_settings (provider, enabled, public_config, updated_at)
       VALUES ('github', $1, $2::jsonb, now())
       ON CONFLICT (provider)
       DO UPDATE SET enabled = EXCLUDED.enabled,
                     public_config = EXCLUDED.public_config,
                     updated_at = now()
       RETURNING provider, enabled, public_config, updated_at`,
      [enabled, JSON.stringify({ clientId, source: 'platform', secretConfigured })],
    );
      await this.recordAudit(client, actorUserId, 'auth.provider.updated', 'auth_provider', 'github',
        { enabled: Boolean(current.rows[0]?.enabled), clientId: existingClientId },
        { enabled, clientId, secretConfigured });
      return {
      ...result.rows[0],
      public_config: {
        ...(result.rows[0] as any).public_config,
        secretConfigured,
      },
      };
    });
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

  async updateMessagingEngine(input: { engine: 'baileys' | 'chromium' }, actorUserId: string) {
    await this.db.transaction(async (client) => {
      const before = await client.query(`SELECT default_engine FROM messaging_engine_settings WHERE id = 'global' FOR UPDATE`);
      await client.query(
      `INSERT INTO messaging_engine_settings (id, default_engine, updated_at)
       VALUES ('global', $1, now())
       ON CONFLICT (id)
       DO UPDATE SET default_engine = EXCLUDED.default_engine, updated_at = now()`,
      [input.engine],
    );
      await this.recordAudit(client, actorUserId, 'messaging.engine.updated',
        'global_settings', 'messaging_engine',
        { defaultEngine: before.rows[0]?.default_engine ?? null },
        { defaultEngine: input.engine });
    });
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

  async updateMessagingSafety(input: UpdateMessagingSafetyDto, actorUserId: string) {
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

    await this.db.transaction(async (client) => {
      const locked = await client.query(`SELECT enabled, min_delay_ms, max_delay_ms, messages_per_minute,
        messages_per_hour, burst_limit, duplicate_window_seconds, failure_pause_threshold, auto_pause_seconds
        FROM messaging_safety_settings WHERE id = 'global' FOR UPDATE`);
      await client.query(
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

      await this.recordAudit(client, actorUserId, 'messaging.safety.updated',
        'global_settings', 'messaging_safety',
        locked.rows[0] ?? null, next);
    });
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
