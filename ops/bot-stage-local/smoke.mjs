import assert from 'node:assert/strict';
const base = process.env.BOT_STAGE_URL ?? 'http://127.0.0.1:3159';
const cases = [
  ['GET','/dashboard/bots',200],
  ['GET','/api/health',200],
  ['GET','/api/bots',401],
  ['GET','/api/bots/entitlement',401],
  ['POST','/api/bots/checkout',401],
  ['POST','/api/bots',401],
  ['GET','/api/platform/bot-subscriptions',401],
];
for(const [method,path,expected] of cases){
 const response=await fetch(base+path,{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({planCode:'starter'})}:{})});
 assert.equal(response.status,expected,`${method} ${path}: expected ${expected}, got ${response.status}`);
 console.log(`${method} ${path}: ${response.status} PASS`);
}
console.log('PASS: staging public/unauthenticated checks only; authenticated flows not tested');
