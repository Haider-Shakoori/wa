import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type SubscriptionRow = {
  organization_id: string;
  plan_code: string;
  status: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  max_sessions: number;
  daily_messages: number | null;
  monthly_messages: number | null;
  max_api_keys: number;
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly db: DatabaseService) {}

  async createTrial(organizationId: string) {
    const days = Number(process.env.TRIAL_DAYS ?? 7);
    await this.db.query(
      `INSERT INTO organization_subscriptions
        (organization_id, plan_code, status, current_period_start,
         current_period_end, trial_ends_at)
       VALUES ($1, 'trial', 'trialing', now(),
               now() + ($2 * interval '1 day'),
               now() + ($2 * interval '1 day'))
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId, days],
    );
  }

  async summary(organizationId: string) {
    const subscription = await this.getActiveSubscription(organizationId);
    const usage = await this.db.query<{ metric: string; quantity: string }>(
      `SELECT metric, quantity::text
       FROM subscription_usage
       WHERE organization_id = $1
         AND period_start = date_trunc('month', now())::date`,
      [organizationId],
    );

    const sessions = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM whatsapp_sessions
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [organizationId],
    );
    const apiKeys = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM api_keys
       WHERE organization_id = $1 AND enabled = true AND revoked_at IS NULL`,
      [organizationId],
    );

    return {
      subscription,
      usage: {
        sessions: Number(sessions.rows[0]?.count ?? 0),
        monthlyMessages: Number(usage.rows.find((row) => row.metric === 'outbound_messages')?.quantity ?? 0),
        apiKeys: Number(apiKeys.rows[0]?.count ?? 0),
      },
      limits: {
        sessions: subscription.max_sessions,
        dailyMessages: subscription.daily_messages,
        monthlyMessages: subscription.monthly_messages,
        apiKeys: subscription.max_api_keys,
      },
    };
  }

  async activatePaidPlan(
    organizationId: string,
    planCode: string,
    billingInterval: 'monthly' | 'annual',
    provider: string,
    providerCustomerId: string | null,
    providerSubscriptionId: string | null,
  ) {
    const months = billingInterval === 'annual' ? 12 : 1;
    await this.db.query(
      `INSERT INTO organization_subscriptions
        (organization_id, plan_code, status, current_period_start, current_period_end,
         trial_ends_at, cancel_at_period_end, provider, provider_customer_id,
         provider_subscription_id)
       VALUES ($6, $1, 'active', now(), now() + ($2 * interval '1 month'),
               NULL, false, $3, $4, $5)
       ON CONFLICT (organization_id)
       DO UPDATE SET
         plan_code = EXCLUDED.plan_code,
         status = 'active',
         current_period_start = now(),
         current_period_end = now() + ($2 * interval '1 month'),
         trial_ends_at = NULL,
         cancel_at_period_end = false,
         provider = EXCLUDED.provider,
         provider_customer_id = EXCLUDED.provider_customer_id,
         provider_subscription_id = EXCLUDED.provider_subscription_id,
         updated_at = now()`,
      [planCode, months, provider, providerCustomerId, providerSubscriptionId, organizationId],
    );
  }

  async listPlans() {
    const result = await this.db.query(
      `SELECT code, name, max_sessions, daily_messages, monthly_messages, max_api_keys,
              monthly_price_cents, annual_price_cents, currency
       FROM subscription_plans
       WHERE active = true
       ORDER BY CASE code
         WHEN 'trial' THEN 1
         WHEN 'starter' THEN 2
         WHEN 'growth' THEN 3
         WHEN 'plus' THEN 4
         WHEN 'scale' THEN 5
         ELSE 99
       END`,
    );
    return result.rows;
  }

  async assertActive(organizationId: string) {
    return this.getActiveSubscription(organizationId);
  }

  async assertCanCreateSession(organizationId: string) {
    const subscription = await this.getActiveSubscription(organizationId);
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM whatsapp_sessions
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [organizationId],
    );
    if (Number(result.rows[0]?.count ?? 0) >= subscription.max_sessions) {
      throw new ConflictException('Session quota reached for the current relayWA plan');
    }
  }

  async assertCanCreateApiKey(organizationId: string) {
    const subscription = await this.getActiveSubscription(organizationId);
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM api_keys
       WHERE organization_id = $1 AND enabled = true AND revoked_at IS NULL`,
      [organizationId],
    );
    if (Number(result.rows[0]?.count ?? 0) >= subscription.max_api_keys) {
      throw new ConflictException('API credential quota reached for the current relayWA plan');
    }
  }

  async assertCanSendMessage(organizationId: string) {
    const subscription = await this.getActiveSubscription(organizationId);
    const usage = await this.db.query<{ metric: string; quantity: string }>(
      `SELECT metric, quantity::text
       FROM subscription_usage
       WHERE organization_id = $1
         AND (
           (period_start = date_trunc('month', now())::date AND metric = 'outbound_messages')
           OR
           (period_start = current_date AND metric = 'outbound_messages_daily')
         )`,
      [organizationId],
    );

    const monthly = Number(usage.rows.find((row) => row.metric === 'outbound_messages')?.quantity ?? 0);
    const daily = Number(usage.rows.find((row) => row.metric === 'outbound_messages_daily')?.quantity ?? 0);

    if (subscription.monthly_messages !== null && monthly >= subscription.monthly_messages) {
      throw new ConflictException('Monthly message quota reached for the current relayWA plan');
    }
    if (subscription.daily_messages !== null && daily >= subscription.daily_messages) {
      throw new ConflictException('Daily message cap reached for the current relayWA plan');
    }
  }

  async recordOutboundMessage(organizationId: string) {
    await this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO subscription_usage
          (organization_id, period_start, metric, quantity)
         VALUES ($1, date_trunc('month', now())::date, 'outbound_messages', 1)
         ON CONFLICT (organization_id, period_start, metric)
         DO UPDATE SET quantity = subscription_usage.quantity + 1, updated_at = now()`,
        [organizationId],
      );
      await client.query(
        `INSERT INTO subscription_usage
          (organization_id, period_start, metric, quantity)
         VALUES ($1, current_date, 'outbound_messages_daily', 1)
         ON CONFLICT (organization_id, period_start, metric)
         DO UPDATE SET quantity = subscription_usage.quantity + 1, updated_at = now()`,
        [organizationId],
      );
    });
  }

  private async getActiveSubscription(organizationId: string) {
    const result = await this.db.query<SubscriptionRow>(
      `SELECT s.organization_id, s.plan_code, s.status,
              s.current_period_start, s.current_period_end, s.trial_ends_at,
              s.cancel_at_period_end, p.max_sessions, p.daily_messages,
              p.monthly_messages, p.max_api_keys
       FROM organization_subscriptions s
       JOIN subscription_plans p ON p.code = s.plan_code AND p.active = true
       WHERE s.organization_id = $1
       LIMIT 1`,
      [organizationId],
    );
    const subscription = result.rows[0];
    if (!subscription) throw new NotFoundException('Subscription not found');

    const active = ['trialing', 'active'].includes(subscription.status);
    const expired = new Date(subscription.current_period_end).getTime() <= Date.now();
    if (!active || expired) {
      throw new ConflictException('relayWA subscription is not active');
    }
    return subscription;
  }
}
