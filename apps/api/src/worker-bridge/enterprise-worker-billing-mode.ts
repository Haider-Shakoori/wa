import { ForbiddenException } from '@nestjs/common';

/**
 * Billing environment must be selected by API configuration, never by a
 * worker-controlled request. Missing/ambiguous configuration fails closed.
 * A Stripe key is inspected only for its mode; the key is never returned.
 */
export function trustedEnterpriseStripeLivemode(): boolean {
 const mode=(process.env.ENTERPRISE_STRIPE_MODE ?? '').trim().toLowerCase();
 if(mode!=='live' && mode!=='test') throw new ForbiddenException('Enterprise billing environment is not configured');
 const secret=process.env.STRIPE_SECRET_KEY ?? '';
 if(secret && !secret.startsWith(mode==='live'?'sk_live_':'sk_test_')) throw new ForbiddenException('Enterprise billing mode mismatch');
 return mode==='live';
 throw new ForbiddenException('Enterprise billing environment is not configured');
}
