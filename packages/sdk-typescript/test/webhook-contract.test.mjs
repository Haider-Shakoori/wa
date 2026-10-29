import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RelayWA } from '../dist/index.js';

const source = path => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const controller = source('apps/api/src/webhooks/webhooks.controller.ts');
const dto = source('apps/api/src/webhooks/webhooks.dto.ts');
const service = source('apps/api/src/webhooks/webhooks.service.ts');

test('webhook controller routes and scopes match read-only SDK methods', () => {
  for (const fragment of ["@Controller(['webhooks', 'v1/webhooks'])", "@Get()", "@Post()", "@Patch(':endpointId')", "@Delete(':endpointId')", "@Get(':endpointId/deliveries')", 'PERMISSIONS.WEBHOOKS_READ', 'PERMISSIONS.WEBHOOKS_MANAGE'])
    assert.ok(controller.includes(fragment), 'Missing webhook contract: ' + fragment);
});

test('webhook create/update input restrictions and secret lifecycle are documented in source', () => {
  for (const fragment of ["@MinLength(2)", "@MaxLength(120)", "@ArrayMaxSize(32)", "@MaxLength(64, { each: true })", "protocols: ['https']", 'enabled?: boolean'])
    assert.ok(dto.includes(fragment), 'Missing webhook DTO contract: ' + fragment);
  assert.ok(service.includes('randomBytes(32)'));
  assert.ok(service.includes('encryptWebhookSecret(secret)'));
  assert.ok(service.includes('return { ...result.rows[0], secret }'));
  assert.ok(service.includes('LIMIT 100'));
});

test('SDK webhook read methods target verified paths without network access', async () => {
  const calls=[];
  const sdk=new RelayWA({sessionKey:'mock-key',fetch:async (url,opts)=>{calls.push({url,opts});return new Response('[]',{status:200});}});
  await sdk.webhooks.list();
  await sdk.webhooks.deliveries('hook/1');
  assert.deepEqual(calls.map(x=>x.url),['https://relaywa.com/api/webhooks','https://relaywa.com/api/webhooks/hook%2F1/deliveries']);
  assert.ok(calls.every(x=>x.opts.method==='GET' && x.opts.headers.Authorization==='Bearer mock-key'));
});
