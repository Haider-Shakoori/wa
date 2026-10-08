import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(file)=>readFile(new URL(file,import.meta.url),'utf8');

test('platform administrator sees Clients instead of Organizations without changing API or ids',async()=>{
 const page=await read('../app/platform/page.tsx');
 assert.match(page,/items:\['Overview','Clients','Sessions','Messaging'\]/);
 assert.match(page,/active === 'Clients'/);
 assert.match(page,/title="Clients"/);
 assert.match(page,/api\('\/platform\/tenants'/);
 assert.doesNotMatch(page,/active === 'Organizations'/);
 assert.match(page,/effective_subscription_status/);
});

test('subscriptions are changed only on explicit Save with audit reason and admin role',async()=>{
 const page=await read('../app/platform/page.tsx');
 const editor=await read('../components/platform-client-subscription-editor.tsx');
 assert.match(page,/PlatformClientSubscriptionEditor/);
 assert.match(page,/\/platform\/subscription-plans/);
 assert.match(page,/onUpdated=\{subscriptionSaved\}/);
 assert.match(editor,/Save subscription/);
 assert.match(editor,/Assign subscription/);
 assert.match(editor,/reason\.trim\(\)\.length<8/);
 assert.match(editor,/periodEndDate/);
 assert.match(editor,/extendDays/);
 assert.match(editor,/canEdit/);
 assert.match(editor,/onSubmit=\{e=>void submit\(e\)\}/);
 assert.doesNotMatch(editor,/onChange=\{.*updateSubscription/);
});

test('client editor is available from the client profile, clients list and subscriptions list',async()=>{
 const page=await read('../app/platform/page.tsx');
 assert.match(page,/setEditingClientId\(t\.id\)/);
 assert.match(page,/setEditingClientId\(selectedTenant\.id\)/);
 assert.match(page,/setEditingClientId\(item\.organization_id\)/);
 assert.match(page,/Choose client for subscription management/);
});
