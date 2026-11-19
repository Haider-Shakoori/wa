/**
 * Read-only preflight for the explicitly selected test session.
 * Never claims a session, sends messages or changes a worker lease.
 */
export const TEST_SESSION_ID = '507e6317-a4d1-4537-ac6f-51cf028998b7';
export const TEST_PHONE = '93707413263';
export const EXPECTED_WORKER = 'relaywa-vps-1';

export async function inspectTestSession({ db, sessionId = TEST_SESSION_ID } = {}) {
  if (sessionId !== TEST_SESSION_ID) return { ready: false, reason: 'not_allowlisted' };
  if (!db || typeof db.query !== 'function') throw Error('Database query adapter required');
  const result = await db.query(
    'SELECT id, organization_id, status, worker_id, phone_number FROM whatsapp_sessions WHERE id=$1 AND deleted_at IS NULL LIMIT 1',
    [sessionId],
  );
  const row = result.rows?.[0];
  if (!row) return { ready: false, reason: 'not_found' };
  if (String(row.phone_number ?? '').replace(/\D/g, '') !== TEST_PHONE)
    return { ready: false, reason: 'phone_mismatch' };
  if (row.worker_id !== EXPECTED_WORKER)
    return { ready: false, reason: 'owner_changed' };
  if (row.status !== 'connected')
    return { ready: false, reason: 'not_connected' };
  return {
    ready: true, sessionId: row.id, tenantId: row.organization_id,
    currentWorker: row.worker_id, mode: 'simulation_only',
    liveSendPermitted: false, transferPermitted: false,
  };
}
