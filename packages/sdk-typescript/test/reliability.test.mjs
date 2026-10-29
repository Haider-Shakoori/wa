import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayWA } from '../dist/index.js';

test('request timeout is bounded and sent to transport', async () => {
  let signal;
  const sdk = new RelayWA({ sessionKey: 'offline-test', timeoutMs: 250, fetch: async (_url, options) => {
    signal = options.signal;
    return new Response('{}', { status: 200 });
  }});
  await sdk.sessions.list();
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal.aborted, false);
});

test('invalid timeout is rejected before network activity', () => {
  for (const timeoutMs of [0, -1, 1.5, Infinity, 120001]) {
    assert.throws(() => new RelayWA({ sessionKey: 'offline-test', timeoutMs }), /timeoutMs/);
  }
});

test('HTTP error exposes status but never embeds response in message', async () => {
  const sdk = new RelayWA({ sessionKey: 'offline-test', fetch: async () => new Response('sensitive backend details', { status: 503 }) });
  await assert.rejects(sdk.sessions.list(), (err) => {
    assert.equal(err.status, 503);
    assert.doesNotMatch(err.message, /sensitive backend details/);
    return true;
  });
});
