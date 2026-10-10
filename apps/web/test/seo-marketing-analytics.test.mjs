import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
function compile(path, imports = {}, extra = {}) {
  const output = ts.transpileModule(read(path), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const exports = {};
  runInNewContext(output, {
    exports, URL, URLSearchParams,
    require:id=>{assert.ok(id in imports, 'Unexpected '+id);return imports[id];},
    ...extra,
  }, {filename:path});
  return exports;
}
const publicPages = compile('lib/public-pages.ts');

test('GA4 page location contains only approved public paths and safe campaign keys', () => {
  const marketing = compile('lib/marketing-events.ts', {'./public-pages':publicPages});
  const url = marketing.safeMarketingPageLocation({
    origin:'https://relaywa.com',pathname:'/pricing/',
    search:'?utm_source=google&utm_medium=cpc&utm_campaign=launch_2026&token=secret&email=person%40example.com',
  });
  assert.equal(url,'https://relaywa.com/pricing?utm_source=google&utm_medium=cpc&utm_campaign=launch_2026');
  assert.equal(marketing.safeMarketingPageLocation({
    origin:'https://relaywa.com',pathname:'/dashboard',search:'?utm_source=google&access_token=private',
  }),'https://relaywa.com/');
  const polluted=marketing.safeMarketingPageLocation({
    origin:'https://relaywa.com',pathname:'/help',search:'?utm_campaign=person%40example.com&github_code=secret',
  });
  assert.equal(polluted,'https://relaywa.com/help');
});

test('marketing events never fire from private paths and accept only fixed event fields', () => {
  const sent = [];
  class StubEvent { constructor(name, options){this.type=name;this.detail=options.detail;} }
  const win={location:{pathname:'/dashboard'},dispatchEvent:event=>sent.push(event)};
  const marketing=compile('lib/marketing-events.ts',{'./public-pages':publicPages},{window:win,CustomEvent:StubEvent});
  marketing.trackMarketingEvent('trial_cta_click',{cta_position:'hero'});
  assert.equal(sent.length,0);
  win.location.pathname='/pricing';
  marketing.trackMarketingEvent('plan_select',{cta_position:'pricing',plan_code:'growth',email:'someone@example.com'});
  assert.equal(sent.length,1);
  assert.equal(sent[0].type,marketing.MARKETING_EVENT_CHANNEL);
  assert.equal(sent[0].detail.event,'plan_select');
  assert.equal(sent[0].detail.plan_code,'growth');
  assert.equal(Object.keys(sent[0].detail).sort().join(','),'cta_position,event,page_path,plan_code');
  marketing.trackMarketingEvent('fake_purchase',{plan_code:'growth'});
  assert.equal(sent.length,1);
});

test('analytics loads only after explicit consent; private routes cannot emit conversion data', () => {
  const source=read('components/google-analytics.tsx');
  assert.match(source,/consent === 'granted' && <Script/);
  assert.match(source,/ga-disable-/);
  assert.match(source,/if \(!isPublic\) return null/);
  assert.match(source,/isIndexablePublicPath\(normalizedPath\)/);
  assert.match(source,/marketingEventNames\.includes/);
  assert.doesNotMatch(source,/relaywa_access_token|messages\.send|customer_phone/);
  assert.match(read('components/relay-home.tsx'),/trackMarketingEvent\('trial_cta_click'/);
  assert.match(read('components/marketing-primitives.tsx'),/trackMarketingEvent\('plan_select'/);
  assert.match(read('components/relay-home.tsx'),/ANALYTICS_SETTINGS_CHANNEL/);
});

test('GA4 reports organic search separately from confirmed all-source platform payments', () => {
  const googleService=readFileSync(new URL('../../api/src/platform/google-analytics-reporting.service.ts',import.meta.url),'utf8');
  const platformService=readFileSync(new URL('../../api/src/platform/platform-admin.service.ts',import.meta.url),'utf8');
  const platformController=readFileSync(new URL('../../api/src/platform/platform-admin.controller.ts',import.meta.url),'utf8');
  assert.match(googleService,/sessionDefaultChannelGroup/);
  assert.match(googleService,/Organic Search/);
  assert.match(googleService,/eventName/);
  assert.match(googleService,/conversionEvents/);
  assert.match(platformService,/firstTimePayingWorkspaces/);
  assert.match(platformService,/provider <> 'demo'/);
  assert.match(platformService,/all_channels_unattributed/);
  assert.match(platformController,/@Get\('seo-conversions'\)/);
  assert.match(read('components/platform-google-analytics.tsx'),/All acquisition channels|all channels/i);

});
