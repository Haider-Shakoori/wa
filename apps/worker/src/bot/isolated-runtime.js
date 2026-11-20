import { decideBotReply, validateBot } from './faq-engine.js';

/**
 * A test-only, no-I/O bot runtime. It does not import the WhatsApp engine.
 * There is intentionally no send adapter and no live activation path.
 */
export function createIsolatedBotRuntime({ allowedSessionIds = [], onDecision = () => {} } = {}) {
  const allowlist = new Set(allowedSessionIds);
  if (allowlist.size > 5 || [...allowlist].some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('Invalid isolated test session allowlist');
  }
  const processed = new Set();
  const takeover = new Set();
  const conversationKey = (event) => {
    if (typeof event?.chatId !== 'string' || !event.chatId.trim() || event.chatId.length > 256) {
      throw new Error('Invalid chat identity');
    }
    return [event.tenantId, event.sessionId, event.chatId].join(':');
  };
  return {
    inspect({ bot, event }) {
      validateBot(bot);
      if (!event || event.tenantId !== bot.tenantId || event.sessionId !== bot.sessionId) {
        return { action: 'ignore', reason: 'ownership_mismatch' };
      }
      if (!allowlist.has(event.sessionId)) {
        return { action: 'ignore', reason: 'session_not_allowlisted' };
      }
      const key = conversationKey(event);
      const messageKey = [event.tenantId, event.sessionId, event.messageId].join(':');
      const decision = decideBotReply({
        bot, event, conversation: { humanTakeover: takeover.has(key) },
        processedIds: processed.has(messageKey) ? new Set([event.messageId]) : new Set(),
      });
      if (decision.action === 'handoff') takeover.add(key);
      if (decision.action === 'reply' || decision.action === 'handoff') processed.add(messageKey);
      // Callback is for local test observation only, never dispatch.
      onDecision({ action: decision.action, reason: decision.reason ?? null });
      return decision;
    },
    // A human must explicitly release a conversation in the test harness.
    releaseHandoff({ tenantId, sessionId, chatId }) {
      if (!allowlist.has(sessionId)) return false;
      return takeover.delete(conversationKey({ tenantId, sessionId, chatId }));
    },
    // No external sends, database mutations, session claims or WhatsApp imports.
  };
}
