import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/dashboard/bots/page.tsx',import.meta.url),'utf8');
test('bot builder requires dashboard token and uses protected bot API',()=>{
 assert.match(source,/relaywa_access_token/);
 assert.match(source,/api<Bot\[]>\('\/bots',t\)/);
 assert.match(source,/\/auth\/me/);
});
test('UI creates only standby bots and does not send WhatsApp messages',()=>{
 assert.match(source,/Create standby bot/);
 assert.doesNotMatch(source,/\/messages\/send|\/connect|\/restart|\/disconnect/);
});
test('FAQ management includes create, list, delete and local preview',()=>{
 assert.match(source,/\/faqs'/);
 assert.match(source,/method:'DELETE'/);
 assert.match(source,/Test answer \(local preview\)/);
});
