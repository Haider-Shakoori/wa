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


test('read-only resources use documented paths and Bearer keys', async () => {
  const calls = [];
  const client = new RelayWA({ sessionKey: 'secret', fetch: async (url, options) => {
    calls.push({ url, options });
    return new Response('{}', { status: 200 });
  }});
  await client.sessions.list();
  await client.sessions.groups('session 1');
  await client.webhooks.deliveries('hook/1');
  assert.deepEqual(calls.map(x => x.url), [
    'https://relaywa.com/api/whatsapp-sessions',
    'https://relaywa.com/api/whatsapp-sessions/session%201/groups',
    'https://relaywa.com/api/webhooks/hook%2F1/deliveries',
  ]);
  assert.ok(calls.every(x => x.options.method === 'GET' && x.options.headers.Authorization === 'Bearer secret'));
});


test('propagates authorization, rate-limit and server errors without retrying sends', async () => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    const client = new RelayWA({ sessionKey: 'test-key', fetch: async () => {
      calls++;
      return new Response(JSON.stringify({ error: 'blocked' }), { status });
    }});
    await assert.rejects(() => client.messages.send({ to: '12025550123', text: 'Hello' }),
      error => error instanceof RelayWAError && error.status === status && error.responseBody.includes('blocked'));
    assert.equal(calls, 1, 'a send must never be automatically retried');
  }
});

test('does not silently treat malformed success JSON as a successful send', async () => {
  const client = new RelayWA({ sessionKey: 'test-key', fetch: async () => new Response('not-json', { status: 200 }) });
  await assert.rejects(() => client.messages.send({ to: '12025550123', text: 'Hello' }), SyntaxError);
});

test('rejects empty resource IDs before network access', async () => {
  let calls = 0;
  const client = new RelayWA({ sessionKey: 'test-key', fetch: async () => { calls++; return new Response('{}'); } });
  await assert.rejects(() => client.sessions.get(''));
  await assert.rejects(() => client.webhooks.deliveries(''));
  assert.equal(calls, 0);
});
