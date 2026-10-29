import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayWA } from '../dist/index.js';

test('session lifecycle methods use only expected routes and HTTP verbs', async () => {
  const calls = [];
  const sdk = new RelayWA({ sessionKey: 'offline-test', fetch: async (url, options) => {
    calls.push([options.method, new URL(url).pathname, options.body ? JSON.parse(options.body) : undefined]);
    return new Response('{}', { status: 200 });
  }});
  await sdk.sessions.create({ name: 'Demo' });
  await sdk.sessions.update('a/b', { name: 'Renamed' });
  await sdk.sessions.connect('a/b');
  await sdk.sessions.restart('a/b');
  await sdk.sessions.disconnect('a/b');
  await sdk.sessions.remove('a/b');
  assert.deepEqual(calls.map(([method, path]) => [method, path]), [
    ['POST', '/api/whatsapp-sessions'],
    ['PATCH', '/api/whatsapp-sessions/a%2Fb'],
    ['POST', '/api/whatsapp-sessions/a%2Fb/connect'],
    ['POST', '/api/whatsapp-sessions/a%2Fb/restart'],
    ['POST', '/api/whatsapp-sessions/a%2Fb/disconnect'],
    ['DELETE', '/api/whatsapp-sessions/a%2Fb'],
  ]);
  assert.deepEqual(calls[0][2], { name: 'Demo' });
  assert.deepEqual(calls[1][2], { name: 'Renamed' });
});

test('session mutations reject empty IDs and invalid input without transport calls', () => {
  let calls = 0;
  const sdk = new RelayWA({ sessionKey: 'offline-test', fetch: async () => { calls++; return new Response('{}'); }});
  assert.throws(() => sdk.sessions.connect(''), /Resource ID/);
  assert.throws(() => sdk.sessions.remove(' '), /Resource ID/);
  assert.throws(() => sdk.sessions.create(null), /Session input/);
  assert.throws(() => sdk.sessions.update('abc', []), /Session update/);
  assert.equal(calls, 0);
});
