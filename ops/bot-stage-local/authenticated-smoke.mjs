import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JwtService}=require('../../apps/api/node_modules/@nestjs/jwt');
const base='http://127.0.0.1:3159';
const token=new JwtService({secret:process.env.BOT_STAGE_JWT_SECRET}).sign({sub:'00000000-0000-4000-8000-000000000002',org:'00000000-0000-4000-8000-000000000001',membership:'00000000-0000-4000-8000-000000000003',email:'staging@example.invalid',ver:0},{expiresIn:180});
async function check(method,path,expected,body){
 const r=await fetch(base+path,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const payload=await r.json().catch(()=>null);
 assert.equal(r.status,expected,`${method} ${path}: ${JSON.stringify(payload)}`);
 console.log(`${method} ${path} => ${r.status} PASS`);
 return payload;
}
const entitlement=await check('GET','/api/bots/entitlement',200);
assert.equal(entitlement.entitled,true);
await check('POST','/api/bots/checkout',409,{planCode:'starter'});
const bots=await check('GET','/api/bots',200);
assert.ok(Array.isArray(bots));
const bot=bots.length?bots[0]:await check('POST','/api/bots',201,{name:'Staging FAQ Bot',sessionId:'00000000-0000-4000-8000-000000000004'});
assert.equal(bot.mode,'standby');
await check('POST','/api/bots',403,{name:'Second Bot',sessionId:'00000000-0000-4000-8000-000000000004'});
const faq=await check('POST',`/api/bots/${bot.id}/faqs`,201,{question:'Test question?',answer:'Test answer.',aliases:['Example']});
const faqs=await check('GET',`/api/bots/${bot.id}/faqs`,200);
assert.equal(faqs.length,1);
await check('DELETE',`/api/bots/${bot.id}/faqs/${faq.id}`,200);
const empty=await check('GET',`/api/bots/${bot.id}/faqs`,200);
assert.equal(empty.length,0);
console.log('PASS: authenticated isolated staging bot and FAQ API workflow (no outbound messages)');
