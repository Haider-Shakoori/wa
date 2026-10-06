export type CheckoutRequest = {
  organizationId: string;
  paymentId: string;
  planCode: string;
  billingInterval: 'monthly' | 'annual';
  amountCents: number;
  currency: string;
};

export type CheckoutResult = {
  checkoutId: string;
  url: string;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
}
