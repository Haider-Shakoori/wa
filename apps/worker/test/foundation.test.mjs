import test from 'node:test';
import assert from 'node:assert/strict';
import { workerIdentity } from '../src/index.js';

test('worker is isolated as a session runtime', () => {
  assert.equal(workerIdentity.role, 'session-runtime');
});
