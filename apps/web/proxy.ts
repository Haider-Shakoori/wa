import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Runs for document navigations, including JavaScript-disabled search crawlers.
// Never blocks, delays or changes the page response when analytics fails.
const botFamilies: Array<[string, RegExp]> = [
  ['Googlebot', /googlebot|googleother|adsbot-google/i],
  ['Bingbot', /bingbot|bingpreview/i],
  ['GPTBot', /gptbot/i],
  ['ChatGPT-User', /chatgpt-user/i],
  ['ClaudeBot', /claudebot|claude-web/i],
  ['Applebot', /applebot/i],
  ['Bytespider', /bytespider/i],
  ['AhrefsBot', /ahrefsbot/i],
  ['SemrushBot', /semrushbot/i],
  ['YandexBot', /yandex(bot|images)/i],
  ['Baiduspider', /baiduspider/i],
  ['FacebookBot', /facebookexternalhit|facebot/i],
  ['LinkedInBot', /linkedinbot/i],
  ['TwitterBot', /twitterbot/i],
  ['Other named crawler', /(?:crawler|spider|\bbot\b)/i],
];
const suspicious = /headless|puppeteer|playwright|selenium|curl\b|wget\b|python-requests|scrapy|httpclient|go-http-client|libwww-perl|okhttp|postmanruntime/i;
const exclusions = /^\/(?:api(?:\/|$)|_next(?:\/|$)|platform(?:\/|$)|dashboard(?:\/|$)|onboarding(?:\/|$)|login(?:\/|$)|signup(?:\/|$)|register(?:\/|$)|settings(?:\/|$)|checkout(?:\/|$)|billing(?:\/|$)|auth(?:\/|$)|verify(?:\/|$)|reset(?:\/|$)|invite(?:\/|$)|robots\.txt$|sitemap(?:-[^/]*)?\.xml$|favicon\.ico$|manifest\.webmanifest$)/i;

function classify(userAgent: string) {
  for (const [name, matcher] of botFamilies) {
    if (matcher.test(userAgent)) return { trafficType:'bot', botFamily:name } as const;
  }
  if (!userAgent || suspicious.test(userAgent)) {
    return { trafficType:'suspected_bot',botFamily:'Other automation' } as const;
  }
  return { trafficType:'human', botFamily:null } as const;
}

function countryFromTrustedHeader(request: NextRequest) {
  // A deployment must explicitly trust a CDN/reverse-proxy-injected country
  // header. NEVER infer location from a user-supplied arbitrary header.
  const configured=(process.env.WEBSITE_ANALYTICS_COUNTRY_HEADER??'').toLowerCase();
  if (!['cf-ipcountry','x-vercel-ip-country','x-geoip-country'].includes(configured)) return 'ZZ';
  const code=(request.headers.get(configured)??'').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && !['XX','T1','A1','AP','EU'].includes(code) ? code:'ZZ';
}

function referrerHost(request: NextRequest) {
  const header=request.headers.get('referer');
  if (!header) return null;
  try {
    const value=new URL(header);
    if (!['http:','https:'].includes(value.protocol)) return null;
    const host=value.hostname.toLowerCase().slice(0,180);
    const current=request.nextUrl.hostname.toLowerCase();
    return host===current||host===`www.${current}`?null:host;
  } catch { return null; }
}

function trackable(request: NextRequest) {
  if (request.method!=='GET') return false;
  const path=request.nextUrl.pathname;
  if (!path.startsWith('/') || exclusions.test(path) || /\.[a-z0-9]{2,6}$/i.test(path)) return false;
  // Router prefetches and React server-component fetches aren't page views.
  if (request.headers.has('rsc') || request.headers.has('next-router-prefetch') ||
      request.headers.has('next-router-state-tree')) return false;
  const accept=request.headers.get('accept')??'';
  const ua=request.headers.get('user-agent')??'';
  return accept.includes('text/html') || (!accept || accept==='*/*') && classify(ua).trafficType!=='human';
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const response=NextResponse.next();
  const secret=process.env.WEBSITE_ANALYTICS_INGEST_KEY;
  if (!secret || secret.length<32 || !trackable(request)) return response;

  const ua=(request.headers.get('user-agent')??'').slice(0,500);
  const {trafficType,botFamily}=classify(ua);
  // The production stack is Caddy -> Nginx -> Next. Nginx sets X-Real-IP
  // to the upstream address; X-Forwarded-For retains the original client.
  // Proxy access control should sanitize forwarded headers at the outer edge.
  const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const real=request.headers.get('x-real-ip')?.trim()??'';
  const clientIp=isIP(forwarded)?forwarded:isIP(real)?real:'unavailable';
  const excludedAddresses=(process.env.WEBSITE_ANALYTICS_EXCLUDE_IPS??'')
    .split(',').map(ip=>ip.trim()).filter(Boolean);
  const isExcluded=request.cookies.get('relaywa_analytics_optout')?.value==='1' ||
    /relaywa-analyticssmoke|relaywa-analyticstest/i.test(ua) ||
    (clientIp!=='unavailable' && excludedAddresses.includes(clientIp));
  const day=new Date().toISOString().slice(0,10);
  // Per-day keyed digest avoids storing raw IP/UA and deliberately prevents
  // cross-day tracking. The counts are estimates, not verified people.
  const visitorKey=createHmac('sha256',secret)
    .update(day).update('\n').update(clientIp).update('\n').update(ua).digest('hex');
  const deviceType=/ipad|tablet|kindle/i.test(ua)?'tablet':
    /iphone|android.*mobile|windows phone/i.test(ua)?'mobile':
    !ua?'other':'desktop';
  const data={
    visitorKey,
    path:request.nextUrl.pathname.slice(0,240),
    countryCode:countryFromTrustedHeader(request),
    // Used only for offline country resolution by the internal API; not persisted.
    clientIp:clientIp!=='unavailable'?clientIp:null,
    trafficType,botFamily,deviceType,isExcluded,
    referrerHost:referrerHost(request),
  };
  const url=(process.env.WEBSITE_ANALYTICS_API_INTERNAL_URL || 'http://api:3001').replace(/\/$/,'')
    +'/api/website-events/collect';
  event.waitUntil(fetch(url,{
    method:'POST',
    headers:{'content-type':'application/json','x-website-analytics-key':secret},
    body:JSON.stringify(data),
    signal:AbortSignal.timeout(1800),
    cache:'no-store',
  }).then(()=>undefined).catch(()=>undefined));
  return response;
}

export const config={matcher:['/((?!_next/static|_next/image|api/).*)']};
