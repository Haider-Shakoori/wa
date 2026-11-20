/**
 * Isolated RelayWA bot decision engine.
 * PURE FUNCTIONS ONLY: this module never reads WhatsApp sessions, sends a
 * message, opens a socket, or claims a queue. Integration must explicitly
 * supply tenant/session authorization, deduplication and an outbound adapter.
 */
const normalize = (value) => String(value ?? '').normalize('NFKC')
  .toLocaleLowerCase().replace(/[\u064b-\u065f\u0670]/g, '')
  .replace(/\u064a/g, 'ی').replace(/\u0643/g, 'ک')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const validId = (value) => typeof value === 'string'
  && value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value);

export function validateBot(bot) {
  if (!bot || !validId(bot.id) || !validId(bot.tenantId) || !validId(bot.sessionId)) {
    throw new Error('Invalid bot ownership or session identity');
  }
  if (!Array.isArray(bot.faqs) || bot.faqs.length > 1000) throw new Error('Invalid FAQ collection');
  for (const faq of bot.faqs) {
    if (!validId(faq.id) || typeof faq.question !== 'string' || !faq.question.trim()
      || faq.question.length > 500 || typeof faq.answer !== 'string'
      || !faq.answer.trim() || faq.answer.length > 4000) throw new Error('Invalid FAQ');
  }
  return bot;
}

export function decideBotReply({ bot, event, conversation = {}, processedIds = new Set() }) {
  validateBot(bot);
  if (!event || event.tenantId !== bot.tenantId || event.sessionId !== bot.sessionId) {
    return { action: 'ignore', reason: 'ownership_mismatch' };
  }
  if (!bot.enabled || bot.mode !== 'active') return { action: 'ignore', reason: 'disabled' };
  if (event.direction !== 'inbound' || event.fromMe === true || event.isGroup === true) {
    return { action: 'ignore', reason: 'not_customer_inbound' };
  }
  if (!validId(event.messageId) || processedIds.has(event.messageId)) {
    return { action: 'ignore', reason: 'duplicate_or_invalid_message' };
  }
  if (conversation.humanTakeover === true) return { action: 'ignore', reason: 'human_takeover' };
  if (event.type !== 'text' || typeof event.text !== 'string') {
    return { action: 'ignore', reason: 'unsupported_message_type' };
  }
  const question = normalize(event.text);
  if (!question) return { action: 'ignore', reason: 'empty_message' };
  const handoff = (bot.handoffWords ?? ['human', 'agent', 'staff', 'operator', 'person'])
    .some(word => normalize(word) === question);
  if (handoff) return { action: 'handoff', reason: 'customer_requested_agent' };
  // Exact match by design. No fuzzy hallucinations or uncertain automatic answers.
  const matched = bot.faqs.find(faq =>
    normalize(faq.question) === question
    || (Array.isArray(faq.aliases) && faq.aliases.some(alias => normalize(alias) === question))
  );
  if (!matched) return { action: 'unmatched', reason: 'no_approved_answer' };
  return { action: 'reply', faqId: matched.id, messageId: event.messageId, text: matched.answer };
}
