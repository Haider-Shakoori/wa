import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import type { CheckoutRequest, CheckoutResult, PaymentProvider } from './payment-provider';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';

  private client() {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error('STRIPE_SECRET_KEY is required');
    return new Stripe(secret);
  }

  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;
    if (!successUrl || !cancelUrl) throw new Error('Stripe success/cancel URLs are required');

    const session = await this.client().checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amountCents,
          product_data: {
            name: `relayWA ${input.planCode} (${input.billingInterval})`,
          },
        },
      }],
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

  constructEvent(rawBody: Buffer, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is required');
    return this.client().webhooks.constructEvent(rawBody, signature, secret);
  }
}
