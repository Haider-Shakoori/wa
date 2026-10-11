import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('basic Consent Mode v2 sends default denial before config and advertising remains denied', async () => {
  const file = await readFile(new URL('../lib/ga4-consent-v2.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(file, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(js, { exports, Date });
  const target = {};
  assert.equal(target.gtag, undefined);
  exports.initializeConsentV2(target, 'G-61Z26DFM1V');
  exports.updateConsentV2(target, 'granted');
  const actions = target.dataLayer;
  // gtag.js expects the original array-like function arguments object, not
  // an Array from a rest parameter. This was missed by previous string tests.
  assert.ok(actions.every(row => Object.prototype.toString.call(row) === '[object Arguments]'));
  const actionsAsJson = JSON.parse(JSON.stringify(actions.map(row => Array.from(row))));
  assert.deepEqual(actionsAsJson[0], ['consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
  }]);
  const jsIndex = actionsAsJson.findIndex(x => x[0] === 'js');
  const configIndex = actionsAsJson.findIndex(x => x[0] === 'config');
  const grantIndex = actionsAsJson.findIndex(x => x[0] === 'consent' && x[1] === 'update');
  assert.ok(jsIndex > 0);
  assert.ok(configIndex > jsIndex);
  assert.ok(grantIndex > configIndex);
  assert.equal(actionsAsJson[configIndex][2].send_page_view, false);
  assert.equal(actionsAsJson[configIndex][2].allow_google_signals, false);
  assert.deepEqual(actionsAsJson[grantIndex][2], {
    analytics_storage: 'granted', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
  });
  exports.updateConsentV2(target, 'denied');
  assert.deepEqual(JSON.parse(JSON.stringify(Array.from(actions.at(-1)))), ['consent', 'update', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
  }]);
  const denied = {};
  exports.updateConsentV2(denied, 'denied');
  assert.deepEqual(denied, {}, 'Do not initialize or load Google for declined visitors');
});

test('GA4 script never loads without consent and existing first-party estimates remain separate', async () => {
  const tracker = await readFile(new URL('../components/google-analytics.tsx', import.meta.url), 'utf8');
  const proxy = await readFile(new URL('../proxy.ts', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../components/platform-website-traffic.tsx', import.meta.url), 'utf8');
  assert.match(tracker, /consent === 'granted' && tagEnabled && <Script/);
  assert.match(tracker, /initializeConsentV2\(global, measurementId\)/);
  assert.match(tracker, /updateConsentV2\(global, 'denied'\)/);
  assert.match(tracker, /setTagEnabled\(true\)/);
  assert.match(tracker, /ga-disable-/);
  assert.match(tracker, /isIndexablePublicPath/);
  assert.doesNotMatch(tracker, /<aside|showPreferences/);
  assert.match(proxy, /createHmac\('sha256',secret\)/);
  assert.match(proxy, /request\.nextUrl\.pathname\.slice\(0,240\)/);
  assert.match(dashboard, /Approximate, privacy-preserving/);
  assert.doesNotMatch(tracker, /ad_storage: 'granted'|ad_personalization: 'granted'/);
});
