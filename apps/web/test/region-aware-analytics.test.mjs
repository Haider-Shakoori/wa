import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = () => readFile(new URL('../lib/regional-analytics-policy.ts', import.meta.url), 'utf8');
const approved = {
  geoHeaderName: 'cf-ipcountry',
  country: 'AF',
  ingressAttestation: 'a'.repeat(48),
  expectedAttestation: 'a'.repeat(48),
  approvedCountries: 'AF',
};

test('region policy fails closed without trusted geo, approved list or attestation', async () => {
  const js = ts.transpileModule(await source(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require });
  const resolve = exports.resolveRegionalAnalyticsPolicy;
  assert.equal(resolve(approved), 'auto');
  for (const change of [
    { approvedCountries: '' }, { approvedCountries: 'US,GB' },
    { geoHeaderName: 'x-country' }, { geoHeaderName: '' },
    { country: 'ZZ' }, { country: '' }, { country: 'XX' },
    { country: 'EU' }, { country: 'AF,US' }, { country: 'US' },
    { ingressAttestation: '' }, { ingressAttestation: 'wrong' },
    { expectedAttestation: '' }, { expectedAttestation: 'short' },
  ]) {
    assert.equal(resolve({ ...approved, ...change }), 'consent', JSON.stringify(change));
  }
  assert.equal(resolve({ ...approved, approvedCountries: 'XX,EU' }), 'consent');
  assert.equal(resolve({ ...approved, country: 'GB' }), 'consent');
  assert.equal(resolve({ ...approved, country: 'US', approvedCountries: 'AF,US' }), 'auto',
    'An explicitly reviewed/configured country may be automatic; no country is implicitly allowed');
});

test('policy is uncached, server-side, and never exposes secrets or country to browser', async () => {
  const route = await readFile(new URL('../app/analytics-policy/route.ts', import.meta.url), 'utf8');
  const tracker = await readFile(new URL('../components/google-analytics.tsx', import.meta.url), 'utf8');
  const env = await readFile(new URL('../../../.env.example', import.meta.url), 'utf8');
  assert.match(route, /force-dynamic/);
  assert.match(route, /private, no-store/);
  assert.match(route, /expectedAttestation: process\.env\.GA4_REGION_PROXY_SECRET/);
  assert.match(route, /approvedCountries: process\.env\.GA4_AUTO_APPROVED_COUNTRIES/);
  assert.match(route, /NextResponse\.json\(\{ policy \}/);
  assert.match(env, /^GA4_AUTO_APPROVED_COUNTRIES=$/m);
  assert.match(env, /^GA4_REGION_PROXY_SECRET=$/m);
  assert.match(tracker, /fetch\('\/analytics-policy'/);
  assert.match(tracker, /controller\.abort\(\)/);
  assert.match(tracker, /setRegionPolicy\(mode\)/);
  assert.match(tracker, /storedChoice \?\?/);
  assert.match(tracker, /setShowPreferences\(true\)/);
});
