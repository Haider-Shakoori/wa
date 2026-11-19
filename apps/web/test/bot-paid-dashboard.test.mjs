import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const page=read('../app/dashboard/bots/page.tsx');
const workspace=read('../components/relay-workspace.tsx');
test('Bot Builder is visible in dashboard navigation',()=>{
  assert.match(workspace,/\['bots','Bot Builder','\/dashboard\/bots'/);
});
test('unpaid users see locked upgrade screen and no bot data requests',()=>{
  assert.match(page,/api<Entitlement>\('\/bots\/entitlement',t\)/);
  assert.match(page,/if\(!access.entitled\)\{setBots\(\[\]\);setSessions\(\[\]\);return;\}/);
  assert.match(page,/Unlock Bot Builder/);
});
test('checkout is not advertised as available before integration',()=>{
  assert.match(page,/Subscriptions are not available for purchase yet/);
  assert.match(page,/if\(!entitlement\?\.entitled\)return/);
});
