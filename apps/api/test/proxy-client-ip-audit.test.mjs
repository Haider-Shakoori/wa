import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');

test('production API trusts exactly one configured reverse-proxy hop, not arbitrary chains',async()=>{
 const main=await read('../src/main.ts');
 assert.match(main,/TRUST_PROXY_HOPS/);
 assert.match(main,/app\.getHttpAdapter\(\)\.getInstance\(\)\.set\('trust proxy',proxyHops\)/);
 assert.match(main,/proxyHops>2/);
 assert.doesNotMatch(main,/set\('trust proxy',true\)/);
});

test('password, registration and OAuth login sessions record a request IP and device',async()=>{
 const [ctrl,service]=await Promise.all([
  read('../src/auth/auth.controller.ts'),read('../src/auth/auth.service.ts'),
 ]);
 assert.match(ctrl,/ip: request\.ip/);
 assert.match(ctrl,/ip:request\.ip/);
 assert.match(ctrl,/return this\.auth\.google\(body,/);
 assert.match(ctrl,/return this\.auth\.githubExchange\(body\.code,/);
 assert.match(service,/async google\(input: GoogleAuthDto,context/);
 assert.match(service,/async githubExchange\(code: string,context/);
 assert.match(service,/ip_address,user_agent,expires_at/);
 assert.match(service,/context\?\.ip\?\.slice\(0,64\)/);
});
