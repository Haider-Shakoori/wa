import test from 'node:test';
import assert from 'node:assert/strict';
import { canOwnSession, lifecycleTarget, nextLeaseExpiry } from '../src/session-runtime.js';

test('worker can take an unowned or expired session but not an active foreign lease', () => {
  const now = Date.now();
  assert.equal(canOwnSession({}, 'worker-a', now), true);
  assert.equal(canOwnSession({ worker_id: 'worker-a', worker_lease_expires_at: new Date(now + 10000).toISOString() }, 'worker-a', now), true);
  assert.equal(canOwnSession({ worker_id: 'worker-b', worker_lease_expires_at: new Date(now + 10000).toISOString() }, 'worker-a', now), false);
  assert.equal(canOwnSession({ worker_id: 'worker-b', worker_lease_expires_at: new Date(now - 1).toISOString() }, 'worker-a', now), true);
});

test('worker lease expiry advances beyond current time', () => {
  const now = Date.now();
  assert.ok(new Date(nextLeaseExpiry(now)).getTime() > now);
});

test('lifecycle commands map to expected transient states', () => {
  assert.equal(lifecycleTarget('connect'), 'connecting');
  assert.equal(lifecycleTarget('restart'), 'reconnecting');
  assert.equal(lifecycleTarget('logout'), 'logged_out');
});
