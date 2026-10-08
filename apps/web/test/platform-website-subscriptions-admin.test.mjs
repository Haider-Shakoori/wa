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
 assert.doesNotMatch(form, /password|temporaryKey|generatePassword/);
});

test('website subscriptions use the website plan catalog and the same client billing records',async()=>{
 const page=await load('../app/platform/page.tsx');
 const dashboard=await load('../components/platform-website-subscriptions.tsx');
 const pricing=await load('../components/relay-home.tsx');
 assert.match(page, /'Website subscriptions','Subscriptions','Payments'/);
 assert.match(page, /active === 'Website subscriptions'/);
 assert.match(page, /<PlatformWebsiteSubscriptions/);
 assert.match(page, /onManage=\{id=>setEditingClientId\(id\)\}/);
 assert.match(page, /<PlatformClientSubscriptionEditor/);
 assert.match(dashboard, /\/pricing/);
 assert.match(dashboard, /plans\.map/);
 assert.match(dashboard, /subscriptions\.filter/);
 assert.match(dashboard, /payments\.slice\(0,12\)/);
 assert.match(dashboard, /monthly_price_cents/);
 assert.match(dashboard, /annual_price_cents/);
 assert.match(dashboard, /effective_status/);
 assert.match(pricing, /api<Plan\[]>\('\/public\/plans'\)/);
 assert.doesNotMatch(dashboard, /fake|mocked|demoData/);
});
