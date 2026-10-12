import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relaywaGa4ReportData } from './ga4-reporting.mjs';
import { patchPlatformWorker } from '../scripts/ga4/patch-platform-worker.mjs';

test('report handler refuses missing credentials and unsupported ranges without any network calls', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('must not fetch'); };
  try {
    const badDays = await relaywaGa4ReportData({}, new URL('https://platform.relaywa.com/api/platform/google-analytics?days=10'));
    assert.equal(badDays.status, 'error');
    const missing = await relaywaGa4ReportData({}, new URL('https://platform.relaywa.com/api/platform/google-analytics?days=7'));
    assert.equal(missing.status, 'not_configured');
  } finally { globalThis.fetch = original; }
});

test('real Web Crypto service-account signing calls Google OAuth and report APIs without exposing a secret', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = JSON.stringify({
    type: 'service_account',
    client_email: 'relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
  });
  const original = globalThis.fetch;
  let tokenCalls = 0, dataCalls = 0;
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    assert.equal(options.method, 'POST');
    if (target === 'https://oauth2.googleapis.com/token') {
      tokenCalls++;
      const body = new URLSearchParams(options.body);
      assert.equal(body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
      assert.equal(body.get('assertion').split('.').length, 3);
      return new Response(JSON.stringify({ access_token: 'test-only-access-token', expires_in: 3600 }), { status: 200 });
    }
    assert.match(target, /analyticsdata\.googleapis\.com\/v1beta\/properties\/558119248:/);
    assert.equal(options.headers.authorization, 'Bearer test-only-access-token');
    dataCalls++;
    return new Response(JSON.stringify({
      rows: [{ dimensionValues: [{ value: '20261012' }],
        metricValues: [{ value: '5' }, { value: '12' }, { value: '3' }, { value: '0.5' }] }]
    }), { status: 200 });
  };
  try {
    const url = new URL('https://platform.relaywa.com/api/platform/google-analytics?days=7');
    const result = await relaywaGa4ReportData({ GA4_SERVICE_ACCOUNT_JSON: credentials }, url);
    assert.equal(result.status, 'ready');
    assert.equal(result.propertyId, '558119248');
    assert.equal(result.summary.users, 5);
    assert.equal(result.summary.views, 12);
    assert.equal(result.realtimeUsers, 5);
    assert.equal(result.trend[0].date, '2026-10-12');
    assert.equal(result.countries[0].value, 5);
    assert.equal(tokenCalls, 1);
    assert.equal(dataCalls, 10);
    assert.equal(JSON.stringify(result).includes('PRIVATE KEY'), false);
    const cached = await relaywaGa4ReportData({ GA4_SERVICE_ACCOUNT_JSON: credentials }, url);
    assert.deepEqual(cached, result);
    assert.equal(tokenCalls, 1);
    assert.equal(dataCalls, 10);
  } finally { globalThis.fetch = original; }
});

test('patcher only replaces the known GA4 placeholder and preserves the existing route table', async () => {
  const source = [
    'const ROUTES = [["GET", "google-analytics", null, (e, r) => googleAnalytics(e, r.url)]];',
    'function googleAnalytics(env, url) {',
    '  return json({ status: "not_configured", propertyId: "558119248" });',
    '}',
    'const otherRoutes = true;'
  ].join('\n');
  const module = await readFile(new URL('./ga4-reporting.mjs', import.meta.url), 'utf8');
  const patched = patchPlatformWorker(source, module);
  assert.match(patched, /async function googleAnalytics\(env, url\)/);
  assert.match(patched, /return json\(await relaywaGa4ReportData\(env, url\)\)/);
  assert.match(patched, /const otherRoutes = true/);
  assert.match(patched, /const ROUTES =/);
  assert.doesNotMatch(patched, /export async function relaywaGa4ReportData/);
  assert.throws(() => patchPlatformWorker(patched, module), /already contains/);
  assert.throws(() => patchPlatformWorker(source.replace('not_configured', 'ready'), module), /no longer the expected placeholder/);
});
