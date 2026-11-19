import { TEST_SESSION_ID, EXPECTED_WORKER } from './test-session-preflight.js';
import { inspectTestSession } from './test-session-preflight.js';
import { previewTestInbound } from './test-inbound-adapter.js';

/**
 * Explicit, one-shot read of stored inbound messages. Not a listener or
 * dispatcher. Reads only the approved session, and never reads raw_payload.
 */
export async function inspectStoredTestInbound({ db, pipeline, since, limit = 10 }) {
  if (!db || typeof db.query !== 'function') throw Error('Read-only database adapter required');
  if (!pipeline || typeof pipeline.inspect !== 'function') throw Error('Preview pipeline required');
  if (!(since instanceof Date) || !Number.isFinite(since.getTime()))
    throw Error('Explicit since Date required');
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    throw Error('Limit must be between 1 and 20');
  const preflight = await inspectTestSession({ db });
  if (!preflight.ready) return { ready: false, reason: preflight.reason, inspected: 0 };
  const rows = await db.query(
    `SELECT organization_id, session_id, provider_message_id, chat_jid,
            message_type, text_body, direction
       FROM whatsapp_messages
      WHERE session_id=$1 AND organization_id=$2
        AND direction='inbound' AND message_type='text'
        AND provider_message_id IS NOT NULL
        AND received_at >= $3
      ORDER BY received_at ASC, id ASC LIMIT $4`,
    [TEST_SESSION_ID, preflight.tenantId, since, limit],
  );
  const decisions = [];
  for (const row of rows.rows ?? []) {
    const snapshot = {
      sessionId: row.session_id, sourceWorker: EXPECTED_WORKER,
      tenantId: row.organization_id, messageId: row.provider_message_id,
      chatId: row.chat_jid, direction: row.direction,
      type: row.message_type, text: row.text_body,
      // Stored message records are only read as candidates, not trusted as
      // proof of sender identity; group/own messages are excluded by JID.
      fromMe: false, isGroup: typeof row.chat_jid === 'string'
        && row.chat_jid.endsWith('@g.us'),
    };
    const decision = await previewTestInbound({ pipeline, snapshot });
    decisions.push({ action: decision.action, reason: decision.reason ?? null });
  }
  return { ready: true, inspected: decisions.length, decisions, liveSendPermitted: false };
}
