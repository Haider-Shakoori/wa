import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../app/dashboard/bots/page.tsx',import.meta.url),'utf8');
test('all three Bot Builder paid plans launch authorized API checkout',()=>{
 for(const plan of ['starter','pro','business'])assert.match(ui,new RegExp("code:'"+plan+"'"));
 assert.match(ui,/api<\{checkoutUrl:string;orderId:string\}>\('\/bots\/checkout',token/);
 assert.match(ui,/method:'POST',body:JSON.stringify\(\{planCode\}\)/);
});
test('checkout redirects only to the official Stripe Checkout host over HTTPS',()=>{
 assert.match(ui,/url.protocol!=='https:'/);
 assert.match(ui,/url.hostname!=='checkout.stripe.com'/);
 assert.match(ui,/window.location.assign\(url.toString\(\)\)/);
});
test('checkout prevents double submission and surfaces failures',()=>{
 assert.match(ui,/if\(!token\|\|busy\)return/);
 assert.match(ui,/disabled=\{busy\|\|!token\}/);
 assert.match(ui,/Unable to start Bot Builder checkout/);
});
