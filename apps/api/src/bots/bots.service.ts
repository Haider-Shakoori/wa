import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StripeProvider } from '../payments/stripe.provider';
import { botAddonPlan, verifyBotAddonCheckout, type BotAddonPlan } from './bot-billing-policy';
import { DatabaseService } from '../database/database.service';
import { CreateBotDto, CreateFaqDto } from './bots.dto';

@Injectable()
export class BotsService {
  constructor(private readonly db: DatabaseService, private readonly stripe: StripeProvider) {}

  async platformOverview() {
    const result=await this.db.query(
      `SELECT e.organization_id,o.name AS organization_name,e.plan_code,e.status,
       e.max_bots,e.monthly_reply_limit,e.current_period_end,
       COUNT(b.id)::int AS bot_count
       FROM relaywa_bot_entitlements e
       JOIN organizations o ON o.id=e.organization_id
       LEFT JOIN relaywa_bots b ON b.organization_id=e.organization_id
       GROUP BY e.organization_id,o.name,e.plan_code,e.status,
        e.max_bots,e.monthly_reply_limit,e.current_period_end
       ORDER BY o.name LIMIT 200`);
    return result.rows;
  }

  async ownsStripeSubscription(subscriptionId: string, livemode: boolean) {
    const found=await this.db.query(
      'SELECT 1 FROM relaywa_bot_entitlements WHERE stripe_subscription_id=$1 AND stripe_livemode=$2 LIMIT 1',
      [subscriptionId,livemode]);
    return !!found.rowCount;
  }

  async handleStripeEvent(event: any) {
    const object = event.data?.object;
    if (event.type === 'checkout.session.completed') {
      if (object?.metadata?.relaywa_product !== 'bot_addon') return {ignored:true};
      const orderId = object.metadata.relaywa_bot_order_id;
      if (!orderId) return {ignored:true};
      return this.db.transaction(async client => {
        const found = await client.query(
          'SELECT organization_id FROM relaywa_bot_checkout_orders WHERE id=$1 AND stripe_livemode=$2',
          [orderId,event.livemode]);
        if (!found.rows[0]) return {ignored:true};
        const org=found.rows[0].organization_id;
        await client.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);
        const selected=await client.query(
          'SELECT * FROM relaywa_bot_checkout_orders WHERE id=$1 AND organization_id=$2 FOR UPDATE',
          [orderId,org]);
        const order=selected.rows[0];
        if (order.status==='paid') return {duplicate:true};
        if (order.status!=='pending') return {ignored:true};
        const ref=typeof object.subscription==='string'?object.subscription:object.subscription?.id;
        const checked=verifyBotAddonCheckout({
          checkoutId:object.id,checkoutMode:object.mode,paymentStatus:object.payment_status,
          subscriptionId:ref??null,metadata:object.metadata??null,
          currency:object.currency??'',amountTotal:Number(object.amount_total),
          livemode:event.livemode,
          expected:{checkoutId:order.stripe_checkout_id,organizationId:org,
            planCode:order.plan_code,amountCents:order.amount_cents,
            livemode:order.stripe_livemode},
        });
        if (!checked.verified) throw new BadRequestException('Bot checkout verification failed');
        const existing=await client.query(
          'SELECT stripe_subscription_id FROM relaywa_bot_entitlements WHERE organization_id=$1 FOR UPDATE',[org]);
        if (existing.rows[0]?.stripe_subscription_id &&
            existing.rows[0].stripe_subscription_id!==ref)
          throw new ConflictException('Another Bot Builder subscription already exists');
        const plan=botAddonPlan(order.plan_code);
        await client.query(
          `INSERT INTO relaywa_bot_entitlements
           (organization_id,plan_code,status,max_bots,monthly_reply_limit,stripe_subscription_id,
            stripe_livemode,current_period_end)
           VALUES($1,$2,'active',$3,$4,$5,$6,now()+interval '1 month')
           ON CONFLICT (organization_id) DO UPDATE SET
           plan_code=EXCLUDED.plan_code,status='active',max_bots=EXCLUDED.max_bots,
           monthly_reply_limit=EXCLUDED.monthly_reply_limit,
           stripe_subscription_id=EXCLUDED.stripe_subscription_id,
           stripe_livemode=EXCLUDED.stripe_livemode,
           current_period_end=EXCLUDED.current_period_end,updated_at=now()`,
          [org,order.plan_code,plan.maxBots,plan.monthlyReplyLimit,ref,event.livemode]);
        await client.query(
          "UPDATE relaywa_bot_checkout_orders SET status='paid' WHERE id=$1 AND status='pending'",[orderId]);
        return {activated:true};
      });
    }
    const ref=event.type==='invoice.paid'||event.type==='invoice.payment_failed'
      ?object?.parent?.subscription_details?.subscription:object?.id;
    const subscriptionId=typeof ref==='string'?ref:ref?.id;
    if (!subscriptionId) return {ignored:true};
    // Never grant an entitlement from an unrecognized subscription event.
    if (event.type==='invoice.paid') {
      if (object.billing_reason!=='subscription_cycle' || object.status!=='paid' ||
          !object.id || Number(object.amount_paid)<=0) return {ignored:true};
      const found=await this.db.query(
        'SELECT plan_code FROM relaywa_bot_entitlements WHERE stripe_subscription_id=$1 AND stripe_livemode=$2',
        [subscriptionId,event.livemode]);
      if (!found.rows[0] || Number(object.amount_paid)!==botAddonPlan(found.rows[0].plan_code).monthlyCents ||
          object.currency!=='usd') return {ignored:true};
      const result=await this.db.transaction(async client => {
        const selected=await client.query(
          'SELECT organization_id,status,current_period_end FROM relaywa_bot_entitlements WHERE stripe_subscription_id=$1 AND stripe_livemode=$2 FOR UPDATE',
          [subscriptionId,event.livemode]);
        if (!selected.rows[0]) return {ignored:true};
        const org=selected.rows[0].organization_id;
        // A delayed paid invoice must never resurrect a canceled subscription.
        if (selected.rows[0].status==='canceled') return {ignored:true,reason:'subscription_canceled'};
        const periodEnds=(object.lines?.data??[])
          .filter((line:any)=>line.parent?.subscription_item_details?.subscription===subscriptionId ||
            line.subscription===subscriptionId)
          .map((line:any)=>Number(line.period?.end))
          .filter((end:number)=>Number.isSafeInteger(end)&&end>0);
        const latestPeriodEnd=periodEnds.length?Math.max(...periodEnds):null;
        if (!latestPeriodEnd) return {ignored:true,reason:'missing_billing_period'};
        const inserted=await client.query(
          `INSERT INTO relaywa_bot_renewal_events(stripe_invoice_id,stripe_livemode,organization_id)
           VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING stripe_invoice_id`,
          [object.id,event.livemode,org]);
        if (!inserted.rowCount) return {duplicate:true};
        await client.query(
          `UPDATE relaywa_bot_entitlements SET status='active',
           current_period_end=GREATEST(COALESCE(current_period_end,to_timestamp(0)),to_timestamp($4)),
           updated_at=now() WHERE organization_id=$1 AND stripe_subscription_id=$2 AND stripe_livemode=$3
           AND status<>'canceled'`,
          [org,subscriptionId,event.livemode,latestPeriodEnd]);
        return {renewed:true};
      });
      return result;
    }
    const restricted=event.type==='customer.subscription.deleted'?'canceled':
      event.type==='invoice.payment_failed'?'past_due':
      event.type==='customer.subscription.updated'?
        (['past_due','unpaid'].includes(object.status)?'past_due':
         ['canceled','incomplete_expired'].includes(object.status)?'canceled':null):null;
    if (!restricted) return {ignored:true};
    await this.db.query(
      'UPDATE relaywa_bot_entitlements SET status=$3,updated_at=now() WHERE stripe_subscription_id=$1 AND stripe_livemode=$2',
      [subscriptionId,event.livemode,restricted]);
    return {restricted:true};
  }

  async checkout(org: string, planCode: string) {
    const plan = botAddonPlan(planCode);
    const access = await this.entitlement(org);
    if (access.entitled) throw new ConflictException('Manage your existing Bot Builder subscription');
    const livemode = this.stripe.isLiveMode();
    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;
    if (!successUrl || !cancelUrl || !/^https:\/\//.test(successUrl) || !/^https:\/\//.test(cancelUrl))
      throw new BadRequestException('Secure Stripe return URLs are required');
    const orderId = randomUUID();
    try {
      await this.db.query(
        `INSERT INTO relaywa_bot_checkout_orders
         (id,organization_id,plan_code,amount_cents,stripe_livemode)
         VALUES($1,$2,$3,$4,$5)`,
        [orderId,org,planCode,plan.monthlyCents,livemode]);
    } catch (error) {
      if ((error as {code?:string}).code === '23505')
        throw new ConflictException('Bot Builder checkout already pending');
      throw error;
    }
    // Checkout is separate from the existing RelayWA core plan and subscription.
    // The order stays pending until a verified webhook activates the entitlement.
    try {
      const checkout = await this.stripe.createBotAddonCheckout({
        organizationId: org, orderId, planCode: planCode as BotAddonPlan,
        amountCents: plan.monthlyCents, successUrl, cancelUrl,
      });
      await this.db.query(
        'UPDATE relaywa_bot_checkout_orders SET stripe_checkout_id=$2 WHERE id=$1 AND organization_id=$3',
        [orderId,checkout.checkoutId,org]);
      return {checkoutUrl:checkout.url,orderId};
    } catch (error) {
      await this.db.query(
        "UPDATE relaywa_bot_checkout_orders SET status='expired' WHERE id=$1 AND status='pending'",
        [orderId]);
      throw error;
    }
  }

  async entitlement(org: string) {
    const result = await this.db.query(
      `SELECT plan_code,status,max_bots,monthly_reply_limit,trial_ends_at,current_period_end
       FROM relaywa_bot_entitlements WHERE organization_id=$1`, [org]);
    const row = result.rows[0];
    const now = Date.now();
    const active = !!row && (
      (row.status === 'active' && row.current_period_end &&
        new Date(row.current_period_end).getTime() > now) ||
      (row.status === 'trialing' && row.trial_ends_at &&
        new Date(row.trial_ends_at).getTime() > now)
    );
    return { entitled: Boolean(active), plan: row?.plan_code ?? null,
      maxBots: active ? row.max_bots : 0,
      monthlyReplyLimit: active ? row.monthly_reply_limit : 0 };
  }

  private async requireEntitlement(org: string) {
    const access = await this.entitlement(org);
    if (!access.entitled) throw new ForbiddenException('Bot Builder subscription required');
    return access;
  }

  async list(org: string) {
    await this.requireEntitlement(org);
    const result = await this.db.query(
      'SELECT id,name,session_id,mode,created_at,updated_at FROM relaywa_bots WHERE organization_id=$1 ORDER BY created_at DESC',
      [org],
    );
    return result.rows;
  }

  async create(org: string, user: string, body: CreateBotDto) {
    // Serialize all bot creations per tenant, including concurrent API requests.
    // Lock the organization row first, then re-read paid access and capacity in
    // the same transaction. The UI entitlement is never trusted for writes.
    return this.db.transaction(async client => {
      const owner = await client.query(
        'SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);
      if (!owner.rowCount) throw new NotFoundException('Organization not found');
      const entitlement = await client.query(
        `SELECT max_bots FROM relaywa_bot_entitlements
         WHERE organization_id=$1 AND (
           (status='active' AND current_period_end>now()) OR
           (status='trialing' AND trial_ends_at>now())
         ) FOR UPDATE`,[org]);
      const access = entitlement.rows[0];
      if (!access) throw new ForbiddenException('Bot Builder subscription required');
      const count = await client.query(
        'SELECT count(*)::int AS count FROM relaywa_bots WHERE organization_id=$1',[org]);
      if (Number(count.rows[0]?.count ?? 0) >= Number(access.max_bots))
        throw new ForbiddenException('Bot plan limit reached');
      const session = await client.query(
        'SELECT id FROM whatsapp_sessions WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL',
        [body.sessionId,org]);
      if (!session.rowCount) throw new NotFoundException('WhatsApp session not found');
      try {
        const result = await client.query(
          `INSERT INTO relaywa_bots(id,organization_id,session_id,created_by_user_id,name,mode)
           VALUES($1,$2,$3,$4,$5,'standby')
           RETURNING id,name,session_id,mode,created_at,updated_at`,
          [randomUUID(),org,body.sessionId,user,body.name.trim()]);
        return result.rows[0];
      } catch (error) {
        if ((error as {code?:string}).code === '23505')
          throw new ConflictException('A bot already exists for this session');
        throw error;
      }
    });
  }

  async get(org: string, id: string) {
    await this.requireEntitlement(org);
    const result = await this.db.query(
      'SELECT id,name,session_id,mode,created_at,updated_at FROM relaywa_bots WHERE id=$1 AND organization_id=$2',
      [id,org],
    );
    if (!result.rowCount) throw new NotFoundException('Bot not found');
    return result.rows[0];
  }

  async faqs(org: string, id: string) {
    await this.get(org,id);
    const result = await this.db.query(
      `SELECT id,question,answer,aliases,created_at,updated_at FROM relaywa_bot_faqs
       WHERE bot_id=$1 AND organization_id=$2 ORDER BY created_at,id`,[id,org],
    );
    return result.rows;
  }

  async addFaq(org: string, id: string, body: CreateFaqDto) {
    await this.get(org,id);
    if ((body.aliases ?? []).length > 20 || (body.aliases ?? []).some(a => typeof a !== 'string' || a.length > 200 || !a.trim())) {
      throw new BadRequestException('Invalid FAQ aliases');
    }
    const result = await this.db.query(
      `INSERT INTO relaywa_bot_faqs(id,organization_id,bot_id,question,answer,aliases)
       VALUES($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id,question,answer,aliases,created_at,updated_at`,
      [randomUUID(),org,id,body.question.trim(),body.answer.trim(),JSON.stringify(body.aliases ?? [])],
    );
    return result.rows[0];
  }

  async removeFaq(org: string, botId: string, faqId: string) {
    await this.get(org,botId);
    const result = await this.db.query(
      'DELETE FROM relaywa_bot_faqs WHERE id=$1 AND bot_id=$2 AND organization_id=$3 RETURNING id',
      [faqId,botId,org],
    );
    if (!result.rowCount) throw new NotFoundException('FAQ not found');
    return {deleted:true};
  }
}
