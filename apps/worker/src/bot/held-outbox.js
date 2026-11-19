import { randomUUID } from 'node:crypto';
import { decideBotReply } from './faq-engine.js';

/**
 * Explicit test-session only persistence adapter. No outbound sender exists.
 * Database transactions and unique constraint enforce idempotent HELD records.
 */
export async function holdTestReply({ db, bot, event, allowedSessionIds = [] }) {
  if (!db || typeof db.connect !== 'function') throw Error('Database pool required');
  if (!Array.isArray(allowedSessionIds) || !allowedSessionIds.includes(event?.sessionId)) {
    return { action: 'ignore', reason: 'session_not_allowlisted' };
  }
  if (event.tenantId !== bot.tenantId || event.sessionId !== bot.sessionId) {
    return { action: 'ignore', reason: 'ownership_mismatch' };
  }
  if (typeof event.chatId !== 'string' || !event.chatId.trim() || event.chatId.length > 256) {
    return { action: 'ignore', reason: 'invalid_chat' };
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Enforce tenant and bot ownership in the same transaction.
    const found = await client.query(
      `SELECT id FROM relaywa_bots WHERE id=$1 AND organization_id=$2
       AND session_id=$3 AND mode='standby' FOR UPDATE`,
      [bot.id, bot.tenantId, bot.sessionId],
    );
    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return { action: 'ignore', reason: 'bot_not_standby_or_not_owned' };
    }
    const convo = await client.query(
      `SELECT human_takeover FROM relaywa_bot_conversations
       WHERE organization_id=$1 AND bot_id=$2 AND chat_id=$3 FOR UPDATE`,
      [bot.tenantId, bot.id, event.chatId],
    );
    const decision = decideBotReply({
      bot: { ...bot, mode: 'active' }, event,
      conversation: { humanTakeover: convo.rows[0]?.human_takeover === true },
    });
    if (decision.action === 'handoff') {
      await client.query(
        `INSERT INTO relaywa_bot_conversations(id,organization_id,bot_id,chat_id,human_takeover)
         VALUES($1,$2,$3,$4,true)
         ON CONFLICT(organization_id,bot_id,chat_id)
         DO UPDATE SET human_takeover=true,updated_at=now()`,
        [randomUUID(),bot.tenantId,bot.id,event.chatId],
      );
    } else if (decision.action === 'reply') {
      const inserted = await client.query(
        `INSERT INTO relaywa_bot_outbox
         (id,organization_id,bot_id,session_id,chat_id,inbound_message_id,response_text,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,'held')
         ON CONFLICT(organization_id,bot_id,inbound_message_id) DO NOTHING RETURNING id`,
        [randomUUID(),bot.tenantId,bot.id,bot.sessionId,event.chatId,event.messageId,decision.text],
      );
      if (!inserted.rowCount) {
        await client.query('COMMIT');
        return { action: 'ignore', reason: 'duplicate_message' };
      }
    }
    await client.query('COMMIT');
    return decision.action === 'reply'
      ? { action: 'held', reason: 'awaiting_test_review', messageId: event.messageId }
      : decision;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
