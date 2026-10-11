import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { resolveRegionalAnalyticsPolicy } from '../../lib/regional-analytics-policy';

export const dynamic = 'force-dynamic';

function validIngressAttestation(received: string | null) {
  const expected=process.env.GA4_REGION_PROXY_SECRET;
  if (!expected || expected.length < 32 || !received) return false;
  const a=Buffer.from(received), b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}

function trustedVisitorIp(request: NextRequest): string | null {
  // This is ONLY safe if the edge strips incoming client X-Forwarded-For and
  // Nginx overwrites X-Relaywa-Geo-Attestation on every request.
  if (!validIngressAttestation(request.headers.get('x-relaywa-geo-attestation'))) return null;
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'';
  return isIP(ip)?ip:null;
}

async function resolveCountry(ip: string): Promise<string | null> {
  const secret=process.env.WEBSITE_ANALYTICS_INGEST_KEY;
  if (!secret || secret.length < 32) return null;
  const url=(process.env.WEBSITE_ANALYTICS_API_INTERNAL_URL || 'http://api:3001').replace(/\/$/,'')
    + '/api/website-events/resolve-country';
  try {
    const response=await fetch(url,{
      method:'POST', cache:'no-store',
      headers:{'content-type':'application/json','x-website-analytics-key':secret},
      body:JSON.stringify({clientIp:ip}),
      signal:AbortSignal.timeout(1800),
    });
    if (!response.ok) return null;
    const value:unknown=await response.json();
    if (!value || typeof value!=='object' || !('countryCode' in value)) return null;
    const code=(value as { countryCode:unknown }).countryCode;
    return typeof code==='string'?code:null;
  } catch {
    return null;
  }
}

/** No IP/country/auth tokens are ever returned to the browser. */
export async function GET(request: NextRequest) {
  let policy:'auto'|'consent'='consent';
  if (process.env.GA4_REGION_IP_LOOKUP_ENABLED === 'true') {
    const ip=trustedVisitorIp(request);
    if (ip) policy=resolveRegionalAnalyticsPolicy(await resolveCountry(ip));
  }
  return NextResponse.json({ policy },{
    headers:{
      'Cache-Control':'private, no-store, max-age=0',
      'X-Robots-Tag':'noindex, nofollow, noarchive',
      'Vary':'Cookie',
    },
  });
}
