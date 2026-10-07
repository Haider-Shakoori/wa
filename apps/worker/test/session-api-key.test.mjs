import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { SessionStore } from '../src/session-store.js';
import { decryptWebhookSecret } from '../src/webhook-crypto.js';

test('connected session provisions an encrypted key matching its authentication hash', async () => {
  const previous = process.env.WEBHOOK_ENCRYPTION_KEY;
  process.env.WEBHOOK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  try {
    const calls = [];
    const store = Object.create(SessionStore.prototype);
    store.workerId = 'worker';
    store.pool = {query: async (sql, params) => {calls.push({sql, params});return {rowCount: 1};}};
    await store.setStatus('session', 'connected');
    assert.equal(calls.length, 2);
    const {sql, params} = calls[1];
    const token = decryptWebhookSecret(params[4]);
    assert.match(token, /^rw_session_/);
    assert.equal(createHash('sha256').update(token).digest('hex'), params[2]);
    assert.equal(token.slice(0, 20), params[1]);
    assert.equal(params[5], 'session');
    assert.equal(params[6], 'worker');
    assert.ok(params[3].includes('messages.send'));
    assert.match(sql, /NOT EXISTS/);
    assert.match(sql, /ON CONFLICT DO NOTHING/);
    calls.length = 0;
    await store.setStatus('session', 'reconnecting');
    assert.equal(calls.length, 1);
  } finally {
    if (previous === undefined) delete process.env.WEBHOOK_ENCRYPTION_KEY;
    else process.env.WEBHOOK_ENCRYPTION_KEY = previous;
  }
});
