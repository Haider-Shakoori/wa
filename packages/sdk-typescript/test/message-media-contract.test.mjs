import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RelayWA } from '../dist/index.js';

const source = path => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const legacy = source('apps/api/src/messages/send-message.controller.ts');
const session = source('apps/api/src/messages/messages.controller.ts');
const dto = source('apps/api/src/messages/messages.dto.ts');
const policy = source('apps/api/src/messages/media-policy.ts');

test('legacy text endpoint retains session-key and permission guards', () => {
  for (const token of ["@Post('send-message')", 'ApiAccessGuard', 'SessionKeyGuard', 'PermissionGuard', 'PERMISSIONS.MESSAGES_SEND', 'SendTextMessageDto'])
    assert.ok(legacy.includes(token), 'Missing legacy send contract: ' + token);
  for (const token of ['@MinLength(7)', '@MaxLength(32)', '@MaxLength(4096)', '@MaxLength(120)', 'clientMessageId?'])
    assert.ok(dto.includes(token), 'Missing DTO constraint: ' + token);
});

test('legacy media and session media routes remain available with declared restrictions', () => {
  for (const type of ['image','video','audio','document']) {
    assert.ok(legacy.includes(`@Post('send-${type}')`), 'Missing legacy media: ' + type);
    assert.ok(session.includes(`@Post('${type}')`), 'Missing session media: ' + type);
  }
  assert.ok(session.includes("@Post('file')"));
  assert.ok(session.includes("FileInterceptor('file'"));
  assert.ok(policy.includes('16 * 1024 * 1024'));
  assert.ok(policy.includes('64 * 1024 * 1024'));
  assert.ok(policy.includes('100 * 1024 * 1024'));
  assert.ok(policy.includes("parsed.protocol !== 'https:'"));
});

test('SDK sends the documented legacy text payload once, without contacting the network', async () => {
  const calls = [];
  const sdk = new RelayWA({ sessionKey: 'mock-key', fetch: async (url, opts) => {
    calls.push({url, opts});
    return new Response(JSON.stringify({success:true,data:{id:'mock-id'}}), {status:200});
  }});
  const result = await sdk.messages.send({to:'12025550123',text:'Hello',clientMessageId:'sdk-test-1'});
  assert.deepEqual(result, {success:true,data:{id:'mock-id'}});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://relaywa.com/api/send-message');
  assert.deepEqual(JSON.parse(calls[0].opts.body),{to:'12025550123',text:'Hello',clientMessageId:'sdk-test-1'});
  assert.equal(calls[0].opts.headers.Authorization,'Bearer mock-key');
});
