// Standalone, server-only GA4 report handler designed for the deployed relaywa-platform Worker.
// This file can be inlined into the existing Worker entrypoint; do not expose it to a browser.
const RELAYWA_GA4_PROPERTY = '558119248';
const RELAYWA_GA4_EMAIL = 'relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com';
const RELAYWA_GA4_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const RELAYWA_GA4_DATA_URL = 'https://analyticsdata.googleapis.com/v1beta/properties/' + RELAYWA_GA4_PROPERTY;
const RELAYWA_GA4_REPORT_TTL = 120000;
const RELAYWA_GA4_TOKEN_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

let relaywaGa4Token = null;
let relaywaGa4TokenPending = null;
const relaywaGa4Cache = new Map();
const relaywaGa4PendingReports = new Map();

function relaywaGa4Base64Url(bytes) {
  let result = '';
  for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function relaywaGa4Json64(data) {
  return relaywaGa4Base64Url(new TextEncoder().encode(JSON.stringify(data)));
}
function relaywaGa4Credential(raw) {
  if (typeof raw !== 'string' || raw.length > 32768 || !raw.trim()) {
    throw new Error('GA4 JSON binding missing');
  }
  const data = JSON.parse(raw);
  if (!data || data.type !== 'service_account' || data.client_email !== RELAYWA_GA4_EMAIL ||
      typeof data.private_key !== 'string' ||
      !data.private_key.includes('-----BEGIN PRIVATE KEY-----') ||
      !data.private_key.includes('-----END PRIVATE KEY-----')) {
    throw new Error('GA4 credential has the wrong identity or format');
  }
  return data;
}
async function relaywaGa4RequestToken(raw) {
  const credentials = relaywaGa4Credential(raw);
  const binary = credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const bytes = Uint8Array.from(atob(binary), c => c.charCodeAt(0));
  const imported = await crypto.subtle.importKey('pkcs8', bytes, {
    name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'
  }, false, ['sign']);
  const timestamp = Math.floor(Date.now() / 1000);
  const message = relaywaGa4Json64({ alg: 'RS256', typ: 'JWT' }) + '.' + relaywaGa4Json64({
    iss: RELAYWA_GA4_EMAIL, scope: RELAYWA_GA4_TOKEN_SCOPE, aud: RELAYWA_GA4_TOKEN_URL,
    iat: timestamp, exp: timestamp + 3600
  });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', imported,
    new TextEncoder().encode(message));
  const response = await fetch(RELAYWA_GA4_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: message + '.' + relaywaGa4Base64Url(new Uint8Array(signature))
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Google OAuth authentication failed');
  const data = await response.json();
  if (!data || typeof data.access_token !== 'string') throw new Error('Google OAuth token missing');
  return { accessToken: data.access_token, expiresAt: Date.now() + Math.min(3600, Math.max(120, data.expires_in || 3600)) * 1000 };
}
async function relaywaGa4AccessToken(raw) {
  if (relaywaGa4Token && relaywaGa4Token.expiresAt > Date.now() + 60000) return relaywaGa4Token.accessToken;
  if (!relaywaGa4TokenPending) {
    relaywaGa4TokenPending = relaywaGa4RequestToken(raw).then(token => {
      relaywaGa4Token = token;
      return token.accessToken;
    }).finally(() => { relaywaGa4TokenPending = null; });
  }
  return relaywaGa4TokenPending;
}
async function relaywaGa4DataPost(path, token, body) {
  const response = await fetch(RELAYWA_GA4_DATA_URL + path, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('GA4 Data API request failed');
  return response.json();
}
function relaywaGa4Number(row, i) {
  return Number(row?.metricValues?.[i]?.value ?? 0) || 0;
}
function relaywaGa4Entries(response, max = 10) {
  return (response.rows || []).slice(0, max).map(row => ({
    name: row.dimensionValues?.[0]?.value || 'Unknown',
    value: relaywaGa4Number(row, 0)
  }));
}
async function relaywaGa4LoadReport(raw, days) {
  const token = await relaywaGa4AccessToken(raw);
  const dateRanges = [{ startDate: String(days - 1) + 'daysAgo', endDate: 'today' }];
  // Website reporting only; mobile apps and non-public hostnames excluded.
  const webExpression = { filter: { fieldName: 'platform', stringFilter: {
    matchType: 'EXACT', value: 'web', caseSensitive: false } } };
  const hostnameExpression = { filter: { fieldName: 'hostName', stringFilter: {
    matchType: 'FULL_REGEXP', value: '^(www\\.)?relaywa\\.com$', caseSensitive: false } } };
  const websiteFilter = { andGroup: { expressions: [webExpression, hostnameExpression] } };
  const combineWebsiteFilter = extra => ({
    andGroup: { expressions: [webExpression, hostnameExpression, extra] }
  });
  const run = (metrics, dimensions = [], limit = 15) => relaywaGa4DataPost(':runReport', token, {
    dateRanges, metrics: metrics.map(name => ({ name })),
    ...(dimensions.length ? { dimensions: dimensions.map(name => ({ name })) } : {}),
    limit: String(limit), dimensionFilter: websiteFilter
  });
  const organic = { filter: { fieldName: 'sessionDefaultChannelGroup',
    stringFilter: { value: 'Organic Search', matchType: 'EXACT' } } };
  const conversions = ['pricing_view', 'trial_cta_click', 'plan_select', 'docs_cta_click'];
  const [summary, trend, countries, sources, pages, devices, realtime, marketing,
    organicCountries, organicPages] = await Promise.all([
      run(['activeUsers', 'screenPageViews', 'sessions', 'engagementRate']),
      run(['activeUsers', 'screenPageViews'], ['date'], days),
      run(['activeUsers'], ['country']),
      run(['sessions'], ['sessionDefaultChannelGroup']),
      run(['screenPageViews'], ['pagePath']),
      run(['activeUsers'], ['deviceCategory']),
      relaywaGa4DataPost(':runRealtimeReport', token, {
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: webExpression
      }),
      relaywaGa4DataPost(':runReport', token, {
        dateRanges, metrics: [{ name: 'eventCount' }], dimensions: [{ name: 'eventName' }],
        dimensionFilter: combineWebsiteFilter({ filter: { fieldName: 'eventName', inListFilter: { values: conversions } } }),
        limit: '10'
      }),
      relaywaGa4DataPost(':runReport', token, {
        dateRanges, metrics: [{ name: 'sessions' }], dimensions: [{ name: 'country' }],
        dimensionFilter: combineWebsiteFilter(organic), limit: '30'
      }),
      relaywaGa4DataPost(':runReport', token, {
        dateRanges, metrics: [{ name: 'sessions' }], dimensions: [{ name: 'landingPage' }],
        dimensionFilter: combineWebsiteFilter(organic), limit: '30'
      })
    ]);
  const total = summary.rows?.[0];
  return {
    status: 'ready', propertyId: RELAYWA_GA4_PROPERTY, days,
    updatedAt: new Date().toISOString(),
    summary: {
      users: relaywaGa4Number(total, 0), views: relaywaGa4Number(total, 1),
      sessions: relaywaGa4Number(total, 2),
      engagementRate: Math.round(relaywaGa4Number(total, 3) * 1000) / 10
    },
    realtimeUsers: relaywaGa4Number(realtime.rows?.[0], 0),
    trend: (trend.rows || []).map(row => {
      const value = row.dimensionValues?.[0]?.value || '';
      return {
        date: /^\d{8}$/.test(value) ?
          value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6) : value,
        users: relaywaGa4Number(row, 0), views: relaywaGa4Number(row, 1)
      };
    }).sort((a,b) => a.date.localeCompare(b.date)),
    countries: relaywaGa4Entries(countries),
    sources: relaywaGa4Entries(sources),
    pages: relaywaGa4Entries(pages),
    devices: relaywaGa4Entries(devices),
    conversionEvents: relaywaGa4Entries(marketing),
    organicCountries: relaywaGa4Entries(organicCountries, 30),
    organicLandingPages: relaywaGa4Entries(organicPages, 30)
  };
}

/**
 * This is a data function, not a route. Existing platform authentication and
 * platform-admin authorization MUST run before calling it in the Worker router.
 * Never expose an unauthenticated endpoint using this function.
 */
export async function relaywaGa4ReportData(env, url) {
  const days = Number(url.searchParams.get('days') ?? 30);
  if (![7, 30, 90].includes(days)) {
    return { status: 'error', propertyId: RELAYWA_GA4_PROPERTY, days: 30, message: 'Choose 7, 30 or 90 days.' };
  }
  const raw = env?.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return { status: 'not_configured', propertyId: RELAYWA_GA4_PROPERTY, days,
      message: 'Google Analytics reporting needs the Cloudflare Worker GA4_SERVICE_ACCOUNT_JSON secret binding.' };
  }
  const cached = relaywaGa4Cache.get(days);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (!relaywaGa4PendingReports.has(days)) {
    relaywaGa4PendingReports.set(days, relaywaGa4LoadReport(raw, days));
  }
  const task = relaywaGa4PendingReports.get(days);
  try {
    const data = await task;
    relaywaGa4Cache.set(days, { expiresAt: Date.now() + RELAYWA_GA4_REPORT_TTL, data });
    return data;
  } catch {
    // Do not expose Google response bodies, access tokens or private-key errors.
    return { status: 'error', propertyId: RELAYWA_GA4_PROPERTY, days,
      message: 'Unable to retrieve GA4 reports. Verify the service-account secret and Google permissions.' };
  } finally {
    if (relaywaGa4PendingReports.get(days) === task) relaywaGa4PendingReports.delete(days);
  }
}
