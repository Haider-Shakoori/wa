import test from 'node:test';
import assert from 'node:assert/strict';
import { signWebhook } from '../../../apps/worker/src/webhook-crypto.js';
import { verifyWebhookSignature } from '../dist/index.js';

test('SDK verifies the actual worker signature using raw body', () => {
  const secret='secret-test-123';
  const timestamp='1793260800';
  const rawBody='{"type":"message.received","data":{"a":1}}';
  const signature=signWebhook(secret,timestamp,rawBody);
  const input={secret,timestamp,rawBody,signature,nowSeconds:Number(timestamp)};
  assert.equal(verifyWebhookSignature(input),true);
  assert.equal(verifyWebhookSignature({...input,rawBody:rawBody+' '}),false);
  assert.equal(verifyWebhookSignature({...input,secret:'wrong'}),false);
  assert.equal(verifyWebhookSignature({...input,signature:'sha256=xyz'}),false);
  assert.equal(verifyWebhookSignature({...input,nowSeconds:Number(timestamp)+301}),false);
  assert.equal(verifyWebhookSignature({...input,timestamp:'not-a-time'}),false);
  assert.equal(verifyWebhookSignature({...input,rawBody:Buffer.from(rawBody)}),true);
});
