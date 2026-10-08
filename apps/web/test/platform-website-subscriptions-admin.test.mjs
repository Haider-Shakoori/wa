import test from 'node:test';
import assert from 'node:assert/strict';
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
 const pricing=await load('../components/relay-home.tsx');
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
 assert.match(styles,/background:#17261d!important;color:#f6fff8!important/);
});
