import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
const load=path=>readFile(new URL(path,import.meta.url),'utf8');

test('administrators have an audited Add administrator action and a protected form',async()=>{
 const page=await load('../app/platform/page.tsx');
 const form=await load('../components/platform-add-administrator.tsx');
 assert.match(page, /'Administrators'/);
 assert.match(page, /platformRole==='super_admin'&&<button/);
 assert.match(page, /\+ Add administrator/);
 assert.match(page, /<PlatformAddAdministrator token=\{token\}/);
 assert.match(form, /\/platform\/administrators/);
 assert.match(form, /method:'POST'/);
 assert.match(form, /reason\.trim\(\)\.length<8/);
 assert.match(form, /onSubmit=\{e=>void submit\(e\)\}/);
 assert.match(form, /window\.confirm/);
 assert.match(form, /existing RelayWA account/);
 assert.doesNotMatch(form, /type="password"|passwordHash|generatePassword/);
});

test('website subscription page edits public plans without duplicating customer subscriptions',async()=>{
 const page=await load('../app/platform/page.tsx');
 const dashboard=await load('../components/platform-website-subscriptions.tsx');
 const editor=await load('../components/platform-website-plan-editor.tsx');
 const pricing=(await load('../components/relay-home.tsx')) + (await load('../components/relay-home-interactive.tsx'));
 assert.match(page, /'Website subscriptions','Subscriptions','Payments'/);
 assert.match(page, /active === 'Website subscriptions'/);
 assert.match(page, /<PlatformWebsiteSubscriptions/);
 assert.match(page, /plans=\{subscriptionPlans\} payments=\{payments\} token=\{token\}/);
 assert.match(page, /<PlatformClientSubscriptionEditor/);
 assert.match(dashboard, /\/pricing/);
 assert.match(dashboard, /plans\.map/);
 assert.match(dashboard, /payments\.slice\(0,12\)/);
 assert.match(dashboard, /\+ Add website plan/);
 assert.match(dashboard, /Edit plan/);
 assert.match(dashboard, /monthly_price_cents/);
 assert.match(dashboard, /annual_price_cents/);
 assert.doesNotMatch(dashboard, /Website customer subscriptions/);
 assert.doesNotMatch(dashboard, /subscriptions\.filter|onManage/);
 assert.match(editor, /method:plan\?'PATCH':'POST'/);
 assert.match(editor, /reason\.trim\(\)\.length<8/);
 assert.match(editor, /onSubmit=\{e=>void submit\(e\)\}/);
 assert.match(pricing, /api<Plan\[]>\('\/public\/plans'\)/);
});
test('administrator role, public plan, and subscription selectors have legible dark options',async()=>{
 const styles=await load('../app/globals.css');
 assert.match(styles,/\.platform-shell \.platform-admin-create select option/);
 assert.match(styles,/\.platform-shell \.website-plan-form select option/);
 assert.match(styles,/\.platform-shell \.platform-client-subscription-form select option/);
 assert.match(styles,/color-scheme:dark!important/);
 assert.match(styles,/background:#17261d!important/);
 assert.match(styles,/color:#f6fff8!important/);
});

test('website plan edits are verified with a fresh server catalog, not optimistic local state',async()=>{
  const page=await load('../app/platform/page.tsx');
  const dashboard=await load('../components/platform-website-subscriptions.tsx');
  const editor=await load('../components/platform-website-plan-editor.tsx');
  assert.match(editor,/const savedPlan=await api<ClientPlan>\(/);
  assert.match(editor,/await onUpdated\(savedPlan\)/);
  assert.match(dashboard,/onUpdated:\(savedPlan:ClientPlan\)=>Promise<void>/);
  assert.match(page,/onUpdated=\{async\(savedPlan\)=>\{/);
  assert.match(page,/const stored=latest\.find\(item=>item\.code===savedPlan\.code\)/);
  assert.match(page,/stored\.monthly_price_cents!==savedPlan\.monthly_price_cents/);
  assert.match(page,/stored\.annual_price_cents!==savedPlan\.annual_price_cents/);
  assert.match(page,/setSubscriptionPlans\(latest\)/);
  assert.match(page,/active!=='Website subscriptions'/);
  assert.match(page,/api<ClientPlan\[]>\('\/platform\/subscription-plans',token\)/);
  assert.doesNotMatch(editor,/window\.confirm/,'No native modal should silently cancel an admin save');
  assert.doesNotMatch(page,/onUpdated=\{async\(\)=>\{await refresh\(\)/);
});

test('website plan edit validates exact USD cents, bounds and audit reason',async()=>{
  const editor=await load('../components/platform-website-plan-editor.tsx');
  assert.match(editor,/function toCents\(value:string\):number\|null/);
  assert.match(editor,/Number\.isSafeInteger\(cents\)/);
  assert.match(editor,/monthlyCents===null\|\|annualCents===null/);
  assert.match(editor,/reason\.trim\(\)\.length<8/);
  assert.match(editor,/dailyLimit/);
  assert.match(editor,/monthlyLimit/);
  assert.match(editor,/maxSessions<1\|\|maxSessions>100000/);
  assert.match(editor,/plan\?'PATCH':'POST'/);
  assert.match(editor,/onUpdated\(savedPlan\)/);
  assert.match(editor,/Saving updates the website catalog for future checkouts/);
});

test('USD price conversion accepts exact cents and rejects malformed values',async()=>{
  const editor=await load('../components/platform-website-plan-editor.tsx');
  const source=editor.slice(editor.indexOf('function toCents('),editor.indexOf('export function PlatformWebsitePlanEditor('));
  assert.ok(source.startsWith('function toCents('));
  const javascript=source.replace('value:string','value').replace('):number|null',')');
  const convert=runInNewContext(javascript+';toCents;');
  for(const [input,expected] of [
    ['3.99',399],['6.49',649],['65.00',6500],['0.01',1],
    ['1',100],['1.2',120],['999999.99',99999999],['1000000',100000000],
    ['0.00',null],['-0.01',null],['3.999',null],['abc',null],['1e3',null],
    ['1,000',null],['1000000.01',null],['',null],
  ])assert.equal(convert(input),expected,'Unexpected cents for '+JSON.stringify(input));
});
