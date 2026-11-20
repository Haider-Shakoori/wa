/**
 * Bot Builder add-on catalog. This is separate from core RelayWA plans.
 * No Stripe charge or entitlement is created by this module.
 */
export const BOT_ADDON_PLANS = {
  starter: { monthlyCents: 500, maxBots: 1, monthlyReplyLimit: 1000 },
  pro: { monthlyCents: 1200, maxBots: 3, monthlyReplyLimit: 5000 },
  business: { monthlyCents: 2500, maxBots: 10, monthlyReplyLimit: 20000 },
} as const;

export type BotAddonPlan = keyof typeof BOT_ADDON_PLANS;

export function botAddonPlan(code: string) {
  if (!Object.prototype.hasOwnProperty.call(BOT_ADDON_PLANS, code))
    throw new Error('Unsupported Bot Builder plan');
  return BOT_ADDON_PLANS[code as BotAddonPlan];
}

/**
 * Fail closed when Stripe webhook metadata does not match a known, previously
 * created add-on checkout. The Stripe signature must be verified upstream.
 * This function intentionally does not activate an entitlement.
 */
export function verifyBotAddonCheckout(input: {
  checkoutId: string; checkoutMode: string; paymentStatus: string;
  subscriptionId: string | null; metadata: Record<string, string> | null;
  currency: string; amountTotal: number; expected: {
    checkoutId: string; organizationId: string; planCode: BotAddonPlan;
    amountCents: number; livemode: boolean;
  }; livemode: boolean;
}) {
  const { expected, metadata } = input;
  if (!expected.checkoutId || input.checkoutId !== expected.checkoutId ||
      input.checkoutMode !== 'subscription' || input.paymentStatus !== 'paid' ||
      !input.subscriptionId || input.livemode !== expected.livemode ||
      metadata?.relaywa_product !== 'bot_addon' ||
      metadata?.organization_id !== expected.organizationId ||
      metadata?.bot_plan !== expected.planCode ||
      input.currency.toLowerCase() !== 'usd' ||
      input.amountTotal !== expected.amountCents ||
      expected.amountCents !== botAddonPlan(expected.planCode).monthlyCents)
    return { verified: false as const };
  return { verified: true as const, organizationId: expected.organizationId,
    planCode: expected.planCode, subscriptionId: input.subscriptionId };
}
