import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { ContinueOnboardingDto, SelectPlanDto, UpdateWorkspaceDto } from './onboarding.dto';

type Step = 'plan' | 'payment' | 'workspace' | 'connect' | 'api_key' | 'test' | 'webhook' | 'complete';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async state(organizationId: string) {
    const orgResult = await this.db.query<any>(
      `SELECT id, name, slug, onboarding_step, onboarding_completed_at,
              selected_plan_code, selected_billing_interval
       FROM organizations WHERE id = $1 LIMIT 1`,
      [organizationId],
    );
    const organization = orgResult.rows[0];
    if (!organization) throw new NotFoundException('Organization not found');

    const [subscription, plans, providers, sessions, apiKeys, webhooks, outbound] = await Promise.all([
      this.db.query<any>(
        `SELECT plan_code, status, current_period_start, current_period_end, trial_ends_at, provider
         FROM organization_subscriptions WHERE organization_id = $1 LIMIT 1`,
        [organizationId],
      ),
      this.db.query<any>(
        `SELECT code, name, max_sessions, monthly_messages, max_api_keys,
                monthly_price_cents, annual_price_cents, currency
         FROM subscription_plans
         WHERE active = true
         ORDER BY CASE code WHEN 'trial' THEN 0 WHEN 'starter' THEN 1 WHEN 'growth' THEN 2 WHEN 'scale' THEN 3 ELSE 9 END,
                  monthly_price_cents ASC NULLS LAST`,
      ),
      this.db.query<any>(
        `SELECT provider, enabled, public_config
         FROM payment_provider_settings ORDER BY provider`,
      ),
      this.db.query<any>(
        `SELECT id, name, status, phone_number, display_name
         FROM whatsapp_sessions
         WHERE organization_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [organizationId],
      ),
      this.db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM api_keys
         WHERE organization_id = $1 AND enabled = true AND revoked_at IS NULL`,
        [organizationId],
      ),
      this.db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM webhook_endpoints
         WHERE organization_id = $1 AND enabled = true`,
        [organizationId],
      ),
      this.db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM whatsapp_messages
         WHERE organization_id = $1 AND direction = 'outbound'
           AND status IN ('queued','claimed','scheduled','retrying','sent')`,
        [organizationId],
      ),
    ]);

    const connected = sessions.rows.filter((session:any) => session.status === 'connected').length;

    return {
      organization,
      step: organization.onboarding_step as Step,
      completed: organization.onboarding_step === 'complete',
      subscription: subscription.rows[0] ?? null,
      plans: plans.rows,
      providers: providers.rows,
      sessions: sessions.rows,
      progress: {
        plan: Boolean(subscription.rows[0]),
        workspace: organization.onboarding_step !== 'plan' && organization.onboarding_step !== 'payment',
        connectedSession: connected > 0,
        apiKey: Number(apiKeys.rows[0]?.count ?? 0) > 0,
        testMessage: Number(outbound.rows[0]?.count ?? 0) > 0,
        webhook: Number(webhooks.rows[0]?.count ?? 0) > 0,
      },
    };
  }

  async selectPlan(organizationId: string, input: SelectPlanDto) {
    const planResult = await this.db.query<any>(
      `SELECT code, monthly_price_cents, annual_price_cents, currency
       FROM subscription_plans WHERE code = $1 AND active = true LIMIT 1`,
      [input.planCode],
    );
    const plan = planResult.rows[0];
    if (!plan) throw new NotFoundException('Plan not found');

    const billingInterval = input.billingInterval ?? 'monthly';

    if (plan.code === 'trial') {
      await this.subscriptions.createTrial(organizationId);
      await this.db.query(
        `UPDATE organizations
         SET selected_plan_code = $2,
             selected_billing_interval = $3,
             onboarding_step = 'workspace',
             updated_at = now()
         WHERE id = $1`,
        [organizationId, plan.code, billingInterval],
      );
      return { planCode: plan.code, billingInterval, requiresPayment: false, nextStep: 'workspace' };
    }

    await this.db.query(
      `UPDATE organizations
       SET selected_plan_code = $2,
           selected_billing_interval = $3,
           onboarding_step = 'payment',
           updated_at = now()
       WHERE id = $1`,
      [organizationId, plan.code, billingInterval],
    );

    return {
      planCode: plan.code,
      billingInterval,
      requiresPayment: true,
      nextStep: 'payment',
      amountCents: billingInterval === 'annual' ? plan.annual_price_cents : plan.monthly_price_cents,
      currency: plan.currency,
    };
  }

  async updateWorkspace(organizationId: string, input: UpdateWorkspaceDto) {
    const result = await this.db.query(
      `UPDATE organizations
       SET name = $2, onboarding_step = 'connect', updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, onboarding_step`,
      [organizationId, input.name.trim()],
    );
    if (!result.rows[0]) throw new NotFoundException('Organization not found');
    return result.rows[0];
  }

  async continue(organizationId: string, input: ContinueOnboardingDto) {
    const orgResult = await this.db.query<{ onboarding_step: Step }>(
      'SELECT onboarding_step FROM organizations WHERE id = $1 LIMIT 1',
      [organizationId],
    );
    const step = orgResult.rows[0]?.onboarding_step;
    if (!step) throw new NotFoundException('Organization not found');

    let next: Step;

    if (step === 'payment') {
      const subscription = await this.db.query<{ status: string }>(
        `SELECT status FROM organization_subscriptions
         WHERE organization_id = $1 AND status IN ('trialing','active')
           AND current_period_end > now()
         LIMIT 1`,
        [organizationId],
      );
      if (!subscription.rows[0]) throw new ConflictException('Payment must be completed or approved before continuing');
      next = 'workspace';
    } else if (step === 'connect') {
      await this.requireCount(
        `SELECT count(*)::text AS count FROM whatsapp_sessions
         WHERE organization_id = $1 AND deleted_at IS NULL AND status = 'connected'`,
        organizationId,
        'Connect a WhatsApp session before continuing',
      );
      next = 'api_key';
    } else if (step === 'api_key') {
      await this.requireCount(
        `SELECT count(*)::text AS count FROM api_keys
         WHERE organization_id = $1 AND enabled = true AND revoked_at IS NULL`,
        organizationId,
        'Create an API key before continuing',
      );
      next = 'test';
    } else if (step === 'test') {
      await this.requireCount(
        `SELECT count(*)::text AS count FROM whatsapp_messages
         WHERE organization_id = $1 AND direction = 'outbound'
           AND status IN ('queued','claimed','scheduled','retrying','sent')`,
        organizationId,
        'Send a test message before continuing',
      );
      next = 'webhook';
    } else if (step === 'webhook') {
      if (!input.skipWebhook) {
        await this.requireCount(
          `SELECT count(*)::text AS count FROM webhook_endpoints
           WHERE organization_id = $1 AND enabled = true`,
          organizationId,
          'Create a webhook or choose Skip for now',
        );
      }
      next = 'complete';
    } else if (step === 'complete') {
      return this.state(organizationId);
    } else {
      throw new ConflictException('Complete the current onboarding step before continuing');
    }

    await this.db.query(
      `UPDATE organizations
       SET onboarding_step = $2,
           onboarding_completed_at = CASE WHEN $2 = 'complete' THEN now() ELSE onboarding_completed_at END,
           updated_at = now()
       WHERE id = $1`,
      [organizationId, next],
    );

    return this.state(organizationId);
  }

  private async requireCount(sql: string, organizationId: string, message: string) {
    const result = await this.db.query<{ count: string }>(sql, [organizationId]);
    if (Number(result.rows[0]?.count ?? 0) <= 0) throw new ConflictException(message);
  }
}
