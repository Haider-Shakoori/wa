import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTestSession, TEST_SESSION_ID } from '../src/bot/test-session-preflight.js';

const base = { id: TEST_SESSION_ID, organization_id: 'test_org',
  status: 'connected', worker_id: 'relaywa-vps-1', phone_number: '93707413263' };
const db = (row) => ({ query: async (sql, args) => {
  assert.match(sql, /^SELECT/);
  assert.deepEqual(args, [TEST_SESSION_ID]);
  return { rows: row ? [row] : [] };
}});
test('connected allowlisted session is simulation-only', async () => {
  const result = await inspectTestSession({ db: db(base) });
  assert.equal(result.ready, true);
  assert.equal(result.liveSendPermitted, false);
  assert.equal(result.transferPermitted, false);
});
test('unknown session never queries database', async () => {
  const result = await inspectTestSession({sessionId: 'other',
    db: {query: () => {throw Error('unexpected query');}}});
  assert.equal(result.reason, 'not_allowlisted');
});
test('ownership change fails closed', async () => {
  assert.equal((await inspectTestSession({db:db({...base,worker_id:'relaywa-worker-02'})})).reason,'owner_changed');
});
test('disconnection fails closed', async () => {
  assert.equal((await inspectTestSession({db:db({...base,status:'disconnected'})})).reason,'not_connected');
});
test('phone mismatch fails closed', async () => {
  assert.equal((await inspectTestSession({db:db({...base,phone_number:'93000000000'})})).reason,'phone_mismatch');
});
test('missing session fails closed', async () => {
  assert.equal((await inspectTestSession({db:db(null)})).reason,'not_found');
});
