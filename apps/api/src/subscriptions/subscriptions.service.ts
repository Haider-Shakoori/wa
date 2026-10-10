import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { PoolClient } from 'pg';

type SubscriptionRow = {
  organization_id: string;
  plan_code: string;
  provider: string;
  stripe_livemode: boolean;
  status: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  provider: string | null;
  stripe_livemode: boolean;
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
    const subscription = await this.getSubscription(organizationId);
    const environmentMatches = this.stripeEnvironmentMatches(subscription);
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
      effectiveStatus: !environmentMatches ? 'expired' : (['trialing','active'].includes(subscription.status) &&
        new Date(subscription.current_period_end).getTime() <= Date.now()) ? 'expired' : subscription.status,
      canSendMessages: environmentMatches && ['trialing','active'].includes(subscription.status) &&
        new Date(subscription.current_period_end).getTime()>Date.now() &&
        (subscription.status!=='trialing' || !subscription.trial_ends_at ||
          new Date(subscription.trial_ends_at).getTime()>Date.now()),
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
    tx?: PoolClient,
    stripeLivemode = false,
  ) {
    // This must run in the same transaction that marks the payment paid.
    // Start renewals at the later of the current expiry and payment time, so
    // an early renewal extends access rather than throwing away paid days.
    const months = billingInterval === 'annual' ? 12 : 1;
    const write = async (client: Pick<PoolClient, 'query'>) => {
      await client.query(
        `INSERT INTO organization_subscriptions
          (organization_id, plan_code, status, current_period_start, current_period_end,
           trial_ends_at, cancel_at_period_end, provider, provider_customer_id,
           provider_subscription_id,stripe_livemode)
         VALUES ($6, $1, 'active', now(), now() + ($2 * interval '1 month'),
                 NULL, false, $3, $4, $5, $7)
         ON CONFLICT (organization_id)
         DO UPDATE SET
           plan_code = EXCLUDED.plan_code,
           status = 'active',
           current_period_start = now(),
           current_period_end = CASE
             WHEN EXCLUDED.provider='stripe' AND organization_subscriptions.provider='stripe'
               AND organization_subscriptions.stripe_livemode IS DISTINCT FROM EXCLUDED.stripe_livemode
             THEN now() + ($2 * interval '1 month')
             ELSE GREATEST(organization_subscriptions.current_period_end, now()) + ($2 * interval '1 month')
           END,
           trial_ends_at = NULL,
           cancel_at_period_end = false,
           provider = EXCLUDED.provider,
           provider_customer_id = EXCLUDED.provider_customer_id,
           provider_subscription_id = EXCLUDED.provider_subscription_id,
           stripe_livemode = EXCLUDED.stripe_livemode,
           updated_at = now()`,
        [planCode, months, provider, providerCustomerId, providerSubscriptionId, organizationId, stripeLivemode],
      );
      await client.query(`UPDATE organizations
        SET selected_plan_code=$2,selected_billing_interval=$3,
          onboarding_step=CASE WHEN onboarding_step='payment' THEN 'workspace' ELSE onboarding_step END,
          updated_at=now() WHERE id=$1`,[organizationId,planCode,billingInterval]);
    };
    if (tx) return write(tx);
    return this.db.transaction(async client => {
      await client.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[organizationId]);
      await write(client);
    });
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

  private async getSubscription(organizationId: string) {
    const result = await this.db.query<SubscriptionRow>(
      `SELECT s.organization_id, s.plan_code, s.status, s.provider, s.stripe_livemode,
              s.current_period_start, s.current_period_end, s.trial_ends_at,
              s.provider,s.stripe_livemode,
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

    return subscription;
  }

  private stripeEnvironmentMatches(subscription: SubscriptionRow) {
    if (subscription.provider !== 'stripe') return true;
    const secret = process.env.STRIPE_SECRET_KEY || '';
    return (secret.startsWith('sk_live_') && subscription.stripe_livemode) ||
      (secret.startsWith('sk_test_') && !subscription.stripe_livemode);
  }

  private async getActiveSubscription(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    if (!this.stripeEnvironmentMatches(subscription)) {
      throw new ConflictException('Test subscriptions do not provide access in live billing mode. Choose a live plan.');
    }
    const active = ['trialing', 'active'].includes(subscription.status);
    const expired = new Date(subscription.current_period_end).getTime() <= Date.now() ||
      (subscription.status==='trialing' && subscription.trial_ends_at !== null &&
       new Date(subscription.trial_ends_at).getTime() <= Date.now());
    if (!active || expired) {
      throw new ConflictException('relayWA subscription is not active');
    }
    return subscription;
  }
}
