import { TEST_SESSION_ID, EXPECTED_WORKER } from './test-session-preflight.js';

/**
 * Normalize an explicitly supplied event snapshot for offline simulation.
 * Never subscribes to a queue, reads auth state or starts a WhatsApp socket.
 */
export function normalizeTestInbound(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
    return { accepted: false, reason: 'invalid_snapshot' };
  if (snapshot.sessionId !== TEST_SESSION_ID || snapshot.sourceWorker !== EXPECTED_WORKER)
    return { accepted: false, reason: 'source_not_allowlisted' };
  if (typeof snapshot.tenantId !== 'string' || !/^[\w-]{1,128}$/.test(snapshot.tenantId))
    return { accepted: false, reason: 'invalid_tenant' };
  if (typeof snapshot.messageId !== 'string' || !/^[\w-]{1,128}$/.test(snapshot.messageId))
    return { accepted: false, reason: 'invalid_message_id' };
  if (typeof snapshot.chatId !== 'string' || !/^[\w@.:-]{1,256}$/.test(snapshot.chatId))
    return { accepted: false, reason: 'invalid_chat' };
  if (snapshot.fromMe === true || snapshot.isGroup === true || snapshot.direction !== 'inbound')
    return { accepted: false, reason: 'not_customer_inbound' };
  if (snapshot.type !== 'text' || typeof snapshot.text !== 'string' ||
      !snapshot.text.trim() || snapshot.text.length > 4000)
    return { accepted: false, reason: 'invalid_text' };
  return {
    accepted: true,
    event: {
      tenantId: snapshot.tenantId, sessionId: TEST_SESSION_ID,
      chatId: snapshot.chatId, messageId: snapshot.messageId,
      direction: 'inbound', fromMe: false, isGroup: false,
      type: 'text', text: snapshot.text,
    },
  };
}

export async function previewTestInbound({ pipeline, snapshot }) {
  const normalized = normalizeTestInbound(snapshot);
  if (!normalized.accepted)
    return { action: 'ignore', reason: normalized.reason };
  if (!pipeline || typeof pipeline.inspect !== 'function')
    throw Error('Isolated test pipeline required');
  return pipeline.inspect(normalized.event);
}
