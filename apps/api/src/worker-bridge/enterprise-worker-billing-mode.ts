import { ForbiddenException } from '@nestjs/common';

/**
 * Billing environment must be selected by API configuration, never by a
 * worker-controlled request. Missing/ambiguous configuration fails closed.
 * A Stripe key is inspected only for its mode; the key is never returned.
 */
export function trustedEnterpriseStripeLivemode(): boolean {
 const secret=process.env.STRIPE_SECRET_KEY ?? '';
 if(secret.startsWith('sk_live_') && secret.length>8)return true;
 if(secret.startsWith('sk_test_') && secret.length>8)return false;
 throw new ForbiddenException('Enterprise billing environment is not configured');
}
