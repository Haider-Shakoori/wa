import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayWA, RelayWAError } from '../dist/index.js';

test('sends message to documented endpoint with bearer authentication', async () => {
  let request;
  const client = new RelayWA({ sessionKey: 'test-key', fetch: async (url, options) => {
    request = { url, ...options };
    return new Response(JSON.stringify({ id: 'msg-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }});
  const result = await client.messages.send({ to: '12025550123', text: 'Hello' });
  assert.deepEqual(result, { id: 'msg-1' });
  assert.equal(request.url, 'https://relaywa.com/api/send-message');
  assert.equal(request.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.body), { to: '12025550123', text: 'Hello' });
});

test('throws typed error on API failure', async () => {
  const client = new RelayWA({ sessionKey: 'test-key', fetch: async () => new Response('Unauthorized', { status: 401 }) });
  await assert.rejects(() => client.messages.send({ to: '12025550123', text: 'Hello' }), error => error instanceof RelayWAError && error.status === 401);
});

test('rejects empty keys and invalid message payloads', async () => {
  assert.throws(() => new RelayWA({ sessionKey: '' }));
  const client = new RelayWA({ sessionKey: 'test-key' });
  await assert.rejects(() => client.messages.send({ to: '', text: 'Hello' }));
});
