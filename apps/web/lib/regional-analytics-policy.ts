import { timingSafeEqual } from 'node:crypto';

/**
 * Client IP / visitor-selected locale / ordinary request headers are NOT
 * trustworthy proof of jurisdiction. Only a verified ingress may provide the
 * country + private attestation. Without both, require a consent decision.
 *
 * A country's presence in an approved list must follow a legal/privacy review
 * of this site's actual GA4 behavior, not a general assumption about laws.
 */
export type RegionalAnalyticsPolicy = 'auto' | 'consent';
const geoHeaders = new Set(['cf-ipcountry', 'x-vercel-ip-country', 'x-geoip-country']);
const nonCountries = new Set(['XX', 'ZZ', 'T1', 'A1', 'AP', 'EU']);

function equalSecret(candidate: string | null, expected: string | undefined) {
  if (!candidate || !expected || expected.length < 32) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function resolveRegionalAnalyticsPolicy(options: {
  geoHeaderName?: string;
  country?: string | null;
  ingressAttestation?: string | null;
  expectedAttestation?: string;
  approvedCountries?: string;
}): RegionalAnalyticsPolicy {
  const header = (options.geoHeaderName ?? '').toLowerCase().trim();
  if (!geoHeaders.has(header) || !equalSecret(options.ingressAttestation ?? null, options.expectedAttestation)) {
    return 'consent';
  }
  const code = (options.country ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || nonCountries.has(code)) return 'consent';
  const approved = (options.approvedCountries ?? '').split(',').map(x => x.trim().toUpperCase());
  // No wildcard / all-country override. Unknown countries and all states of
  // any unreviewed country remain consent-required, including EEA, UK, CH.
  return approved.includes(code) ? 'auto' : 'consent';
}
