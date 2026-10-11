import { NextResponse, type NextRequest } from 'next/server';
import { resolveRegionalAnalyticsPolicy } from '../../lib/regional-analytics-policy';

export const dynamic = 'force-dynamic';

/**
 * Public policy decision only; never expose the client country, IP,
 * jurisdiction rules or the trusted ingress attestation in the response.
 */
export function GET(request: NextRequest) {
  const name = (process.env.GA4_REGION_GEO_HEADER ?? '').trim().toLowerCase();
  const policy = resolveRegionalAnalyticsPolicy({
    geoHeaderName: name,
    country: request.headers.get(name),
    ingressAttestation: request.headers.get('x-relaywa-geo-attestation'),
    expectedAttestation: process.env.GA4_REGION_PROXY_SECRET,
    approvedCountries: process.env.GA4_AUTO_APPROVED_COUNTRIES,
  });
  return NextResponse.json({ policy }, {
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Vary': 'Cookie, X-Relaywa-Geo-Attestation',
    },
  });
}
