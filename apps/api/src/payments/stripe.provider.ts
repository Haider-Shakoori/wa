import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import type { CheckoutRequest, CheckoutResult, PaymentProvider } from './payment-provider';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';

  isLiveMode(): boolean {
    const secret = process.env.STRIPE_SECRET_KEY || '';
    const configured = (process.env.STRIPE_MODE || 'test').trim().toLowerCase();
    if (configured !== 'test' && configured !== 'live') throw new Error('STRIPE_MODE must be test or live');
    const keyMode = secret.startsWith('sk_live_') ? 'live' : secret.startsWith('sk_test_') ? 'test' : null;
    if (!keyMode || configured !== keyMode) {
      throw new Error('Stripe key mode differs from STRIPE_MODE; checkout is disabled until configured correctly');
    }
    if (configured === 'live' && !process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
      throw new Error('Live Stripe webhook signing secret must be configured before charging customers');
    }
    return configured === 'live';
  }

  private client() {
    this.isLiveMode();
    return new Stripe(process.env.STRIPE_SECRET_KEY!);
  }

  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;
    if (!successUrl || !cancelUrl) throw new Error('Stripe success/cancel URLs are required');

    const session = await this.client().checkout.sessions.create({
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [{
        quantity: 1,
        price_data: {
          recurring: { interval: input.billingInterval === 'annual' ? 'year' : 'month' },
          currency: input.currency.toLowerCase(),
          unit_amount: input.amountCents,
          product_data: {
            name: `relayWA ${input.planCode} (${input.billingInterval})`,
          },
        },
      }],
      client_reference_id: input.organizationId,
      subscription_data: {
        metadata: {
          relaywa_organization_id: input.organizationId,
          relaywa_plan_code: input.planCode,
          relaywa_billing_interval: input.billingInterval,
        },
      },
      metadata: {
        relaywa_payment_id: input.paymentId,
        organization_id: input.organizationId,
        plan_code: input.planCode,
        billing_interval: input.billingInterval,
      },
    });

    if (!session.url) throw new Error('Stripe Checkout did not return a URL');
    return { checkoutId: session.id, url: session.url };
  }

  async createBillingPortal(customerId: string) {
    const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || process.env.STRIPE_SUCCESS_URL;
    if (!returnUrl || !/^https:\/\//.test(returnUrl)) {
      throw new Error('A secure Stripe billing portal return URL is required');
    }
    const session = await this.client().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  constructEvent(rawBody: Buffer, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is required');
    let event: Stripe.Event;
    try {
      event = this.client().webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
    if (event.livemode !== this.isLiveMode()) {
      throw new BadRequestException('Stripe webhook event mode does not match server mode');
    }
    return event;
  }
}
