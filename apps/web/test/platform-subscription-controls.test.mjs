import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('website plans offer disable / enable for new sales without deleting records', async()=>{
 const [dashboard,page,editor]=await Promise.all([
   read('../components/platform-website-subscriptions.tsx'),
   read('../app/platform/page.tsx'),
   read('../components/platform-website-plan-editor.tsx'),
 ]);
 assert.match(dashboard,/Disable new purchases/);
 assert.match(dashboard,/Enable new purchases/);
 assert.match(dashboard,/availableForPurchase:!available/);
 assert.match(dashboard,/\/platform\/website-plans\/.*\/availability/);
 assert.match(dashboard,/reason\.trim\(\)\.length<8/);
 assert.match(page,/stored\.available_for_purchase!==savedPlan\.available_for_purchase/);
 assert.match(editor,/method:plan\?'PATCH':'POST'/);
});

test('client subscription has a deliberate audited pause action',async()=>{
 const source=await read('../components/platform-client-subscription-editor.tsx');
 assert.match(source,/async function pauseAccess\(/);
 assert.match(source,/Pause client access/);
 assert.match(source,/status:'paused'/);
 assert.match(source,/does not cancel Stripe billing/);
 assert.match(source,/reason\.trim\(\)\.length<8/);
});
