// Read-only GA4 service-account verification. Never log credentials or tokens.
import { createSign } from 'node:crypto';

const property = '558119248';
const email = 'relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const reportEndpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`;

function encoded(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function verify() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GitHub Secret GA4_SERVICE_ACCOUNT_JSON is missing or empty');

  let credentials;
  try { credentials = JSON.parse(raw); }
  catch { throw new Error('GA4_SERVICE_ACCOUNT_JSON is not valid JSON'); }
  if (credentials?.type !== 'service_account' ||
      credentials?.client_email !== email ||
      typeof credentials?.private_key !== 'string' ||
      !credentials.private_key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('GA4 service account type, email, or private key field does not match RelayWA');
  }
  console.log('Credential JSON: valid structure and expected account.');

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encoded({alg:'RS256',typ:'JWT'})}.${encoded({
    iss: email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: tokenEndpoint, iat: now, exp: now + 3600,
  })}`;
  let signature;
  try {
    signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key).toString('base64url');
  } catch {
    throw new Error('Private key could not sign a Google OAuth assertion');
  }

  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new Error(`Google OAuth rejected the credential (HTTP ${tokenResponse.status})`);
  const token = (await tokenResponse.json()).access_token;
  if (!token) throw new Error('Google OAuth did not issue an access token');
  console.log('Google OAuth: authenticated with read-only Analytics scope.');

  // This is a report QUERY, not a mutation.
  const reportResponse = await fetch(reportEndpoint, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{startDate:'yesterday',endDate:'today'}],
      metrics: [{name:'activeUsers'}],
      limit: '1',
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!reportResponse.ok) {
    throw new Error(`Google Analytics Data API report failed (HTTP ${reportResponse.status}); verify Viewer access to property ${property} and API enablement`);
  }

  const websiteFilter = { andGroup: { expressions: [
    { filter: { fieldName: 'platform', stringFilter: {
      value: 'web', matchType: 'EXACT', caseSensitive: false } } },
    { filter: { fieldName: 'hostName', stringFilter: {
      value: '^(www\\.)?relaywa\\.com$', matchType: 'FULL_REGEXP', caseSensitive: false } } }
  ] } };
  const websiteResponse = await fetch(reportEndpoint, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{startDate:'7daysAgo',endDate:'today'}],
      metrics: [{name:'sessions'}, {name:'screenPageViews'}],
      dimensionFilter: websiteFilter, limit: '1'
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!websiteResponse.ok) {
    throw new Error('GA4 website-only filter query failed HTTP ' + websiteResponse.status);
  }
  console.log('GA4 Core reporting: website-only hostname and web platform filters accepted.');
  const realtimeResponse = await fetch(
    'https://analyticsdata.googleapis.com/v1beta/properties/' + property + ':runRealtimeReport', {
      method: 'POST',
      headers: {authorization: 'Bearer ' + token, 'content-type': 'application/json'},
      body: JSON.stringify({
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: {filter:{fieldName:'platform',stringFilter:{
          value:'web', matchType:'EXACT', caseSensitive:false
        }}}
      }),
      signal: AbortSignal.timeout(15000)
    });
  if (!realtimeResponse.ok) {
    throw new Error('GA4 web-only realtime filter query failed HTTP ' + realtimeResponse.status);
  }
  console.log('GA4 Realtime: web-only platform filter accepted.');

  console.log(`GA4 Data API: property ${property} accessible. Live secret verified. No changes made.`);
}

verify().catch(error => {
  // Only controlled error messages; do not print Google response bodies.
  console.error(error instanceof Error ? error.message : 'GA4 verification failed');
  process.exitCode = 1;
});
