import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateCheckoutDto, CreateManualPaymentDto, UpdateProviderDto } from './payments.dto';
import { StripeProvider } from './stripe.provider';

type PlanRow = {
  code: string;
  monthly_price_cents: number;
  annual_price_cents: number;
  currency: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly subscriptions: SubscriptionsService,
    private readonly stripe: StripeProvider,
  ) {}

  async providers() {
    const result = await this.db.query(
      `SELECT provider, enabled, public_config, updated_at
       FROM payment_provider_settings ORDER BY provider`,
    );
    return result.rows;
  }

  async history(organizationId: string) {
    const result = await this.db.query(
      `SELECT id, plan_code, provider, billing_interval, status, amount_cents,
              currency, provider_payment_id, manual_reference, paid_at, created_at
       FROM payments WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [organizationId],
    );
    return result.rows;
  }

  async invoice(organizationId: string, paymentId: string) {
    const result=await this.db.query(`SELECT pay.id,pay.provider,pay.status,pay.amount_cents,pay.currency,
      pay.billing_interval,pay.paid_at,pay.created_at,plan.name AS plan_name,org.name AS organization_name
      FROM payments pay JOIN subscription_plans plan ON plan.code=pay.plan_code
      JOIN organizations org ON org.id=pay.organization_id
      WHERE pay.id=$1 AND pay.organization_id=$2`,[paymentId,organizationId]);
    const payment=result.rows[0];
    if(!payment)throw new NotFoundException('Invoice not found');
    return {number:(payment.provider==='demo'?'DEMO-':'INV-')+payment.id, paymentId:payment.id,
      demo:payment.provider==='demo',status:payment.status,issuedAt:payment.paid_at||payment.created_at,
      organizationName:payment.organization_name,planName:payment.plan_name,
      billingInterval:payment.billing_interval,totalCents:payment.amount_cents,currency:payment.currency};
  }

  async createStripeCheckout(organizationId: string, input: CreateCheckoutDto) {
    await this.assertProviderEnabled('stripe');
    const plan = await this.plan(input.planCode);
    const interval = input.billingInterval ?? 'monthly';
    const amount = interval === 'annual' ? plan.annual_price_cents : plan.monthly_price_cents;
    if (!amount || amount <= 0) throw new BadRequestException('Selected plan is not purchasable');

    const paymentId = randomUUID();
    await this.db.query(
      `INSERT INTO payments
        (id, organization_id, plan_code, provider, billing_interval, status, amount_cents, currency)
       VALUES ($1,$2,$3,'stripe',$4,'pending',$5,$6)`,
      [paymentId, organizationId, plan.code, interval, amount, plan.currency],
    );

    const checkout = await this.stripe.createCheckout({
      organizationId,
      paymentId,
      planCode: plan.code,
      billingInterval: interval,
      amountCents: amount,
      currency: plan.currency,
    });

    await this.db.query(
      `UPDATE payments SET provider_checkout_id = $1, updated_at = now() WHERE id = $2`,
      [checkout.checkoutId, paymentId],
    );
    return { paymentId, checkoutUrl: checkout.url };
  }

  async createManual(organizationId: string, input: CreateManualPaymentDto) {
    await this.assertProviderEnabled('manual');
    const plan = await this.plan(input.planCode);
    const interval = input.billingInterval ?? 'monthly';
    const amount = interval === 'annual' ? plan.annual_price_cents : plan.monthly_price_cents;
    const id = randomUUID();

    const result = await this.db.query(
      `INSERT INTO payments
        (id, organization_id, plan_code, provider, billing_interval, status,
         amount_cents, currency, manual_reference)
       VALUES ($1,$2,$3,'manual',$4,'pending',$5,$6,$7)
       RETURNING id, plan_code, billing_interval, status, amount_cents, currency,
                 manual_reference, created_at`,
      [id, organizationId, plan.code, interval, amount, plan.currency, input.reference.trim()],
    );
    return result.rows[0];
  }

  async createDemo(organizationId: string, input: CreateCheckoutDto) {
    if (process.env.DEMO_PAYMENTS_ENABLED !== 'true' || process.env.NODE_ENV === 'production') {
      throw new ConflictException('Demo payments are unavailable');
    }
    const plan = await this.plan(input.planCode);
    const interval = input.billingInterval ?? 'monthly';
    const amount = interval === 'annual' ? plan.annual_price_cents : plan.monthly_price_cents;
    if(plan.code==='trial'||amount<=0)throw new BadRequestException('Choose a paid subscription plan');
    const id = randomUUID();
    // No card data is accepted or stored. Demo activation and receipt commit together.
    await this.db.transaction(async client => {
      await client.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE', [organizationId]);
      const usage = await client.query(`SELECT count(*)::int AS total FROM whatsapp_sessions WHERE organization_id=$1 AND deleted_at IS NULL`, [organizationId]);
      const limits = await client.query('SELECT max_sessions FROM subscription_plans WHERE code=$1', [plan.code]);
      if (usage.rows[0].total > limits.rows[0].max_sessions) throw new ConflictException('Remove extra sessions before switching to this plan');
      await client.query(`INSERT INTO payments (id,organization_id,plan_code,provider,billing_interval,status,amount_cents,currency,paid_at,metadata) VALUES ($1,$2,$3,'demo',$4,'paid',$5,$6,now(),'{"demo":true}'::jsonb)`, [id,organizationId,plan.code,interval,amount,plan.currency]);
      await client.query(`INSERT INTO organization_subscriptions (organization_id,plan_code,status,current_period_start,current_period_end,trial_ends_at,cancel_at_period_end,provider,provider_subscription_id) VALUES ($1,$2,'active',now(),now()+($3*interval '1 month'),NULL,false,'demo',$4) ON CONFLICT (organization_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status='active',current_period_start=now(),current_period_end=EXCLUDED.current_period_end,trial_ends_at=NULL,cancel_at_period_end=false,provider='demo',provider_customer_id=NULL,provider_subscription_id=$4,updated_at=now()`, [organizationId,plan.code,interval==='annual'?12:1,id]);
      await client.query("UPDATE organizations SET selected_plan_code=$2,selected_billing_interval=$3,onboarding_step=CASE WHEN onboarding_step='payment' THEN 'workspace' ELSE onboarding_step END,updated_at=now() WHERE id=$1",[organizationId,plan.code,interval]);
    });
    const subscription=await this.subscriptions.summary(organizationId);
    const invoice=await this.invoice(organizationId,id);
    return {paymentId:id,demo:true,activated:subscription.subscription.status==='active'&&subscription.subscription.plan_code===plan.code,amountCents:amount,currency:plan.currency,subscription:subscription.subscription,invoice};
  }

  async handleStripeEvent(event: any) {
    if (event.type !== 'checkout.session.completed') return { ignored: true };
    const session = event.data.object;
    const paymentId = session.metadata?.relaywa_payment_id;
    if (!paymentId) throw new BadRequestException('Missing relayWA payment metadata');

    if (session.payment_status !== 'paid') {
      return { pending: true };
    }

    const pending = await this.db.query<any>(
      `SELECT organization_id, plan_code, billing_interval, amount_cents, currency
       FROM payments
       WHERE id = $1 AND provider = 'stripe' AND status = 'pending'
       LIMIT 1`,
      [paymentId],
    );
    const expected = pending.rows[0];
    if (!expected) return { duplicate: true };

    if (
      Number(session.amount_total ?? -1) !== Number(expected.amount_cents) ||
      String(session.currency ?? '').toUpperCase() !== String(expected.currency).toUpperCase()
    ) {
      throw new BadRequestException('Stripe payment amount or currency mismatch');
    }

    const result = await this.db.query<any>(
      `UPDATE payments
       SET status = 'paid', provider_payment_id = $1, paid_at = now(), updated_at = now()
       WHERE id = $2 AND provider = 'stripe' AND status = 'pending'
       RETURNING organization_id, plan_code, billing_interval`,
      [session.payment_intent ?? session.id, paymentId],
    );
    const payment = result.rows[0];
    if (!payment) return { duplicate: true };

    await this.subscriptions.activatePaidPlan(
      payment.organization_id,
      payment.plan_code,
      payment.billing_interval,
      'stripe',
      session.customer ?? null,
      session.id,
    );
    return { activated: true };
  }

  async approveManual(paymentId: string) {
    const result = await this.db.query<any>(
      `UPDATE payments SET status = 'paid', paid_at = now(), updated_at = now()
       WHERE id = $1 AND provider = 'manual' AND status = 'pending'
       RETURNING organization_id, plan_code, billing_interval`,
      [paymentId],
    );
    const payment = result.rows[0];
    if (!payment) throw new NotFoundException('Pending manual payment not found');

    await this.subscriptions.activatePaidPlan(
      payment.organization_id,
      payment.plan_code,
      payment.billing_interval,
      'manual',
      null,
      paymentId,
    );
    return { paymentId, approved: true };
  }

  async updateProvider(input: UpdateProviderDto) {
    if (input.provider === 'stripe' && input.enabled && !process.env.STRIPE_SECRET_KEY) {
      throw new ConflictException('STRIPE_SECRET_KEY must be configured before enabling Stripe');
    }
    const result = await this.db.query(
      `UPDATE payment_provider_settings
       SET enabled = $1, public_config = COALESCE($2::jsonb, public_config), updated_at = now()
       WHERE provider = $3
       RETURNING provider, enabled, public_config, updated_at`,
      [input.enabled, input.publicConfig ? JSON.stringify(input.publicConfig) : null, input.provider],
    );
    return result.rows[0];
  }

  private async assertProviderEnabled(provider: string) {
    const result = await this.db.query<{ enabled: boolean }>(
      'SELECT enabled FROM payment_provider_settings WHERE provider = $1 LIMIT 1',
      [provider],
    );
    if (!result.rows[0]?.enabled) throw new ConflictException(`${provider} payments are disabled`);
  }

  private async plan(code: string) {
    const result = await this.db.query<PlanRow>(
      `SELECT code, monthly_price_cents, annual_price_cents, currency
       FROM subscription_plans WHERE code = $1 AND active = true LIMIT 1`,
      [code],
    );
    if (!result.rows[0]) throw new NotFoundException('Plan not found');
    return result.rows[0];
  }
}
