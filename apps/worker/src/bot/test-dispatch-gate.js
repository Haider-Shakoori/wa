/**
 * Test-only transport gate. Does not import Baileys or any production session.
 * The transport is injected by an isolated test harness and must be configured
 * with explicit session, recipient and confirmation token.
 */
export function createTestDispatchGate({
  sessionId, recipientId, confirmationToken, transport,
  dryRun = true,
} = {}) {
  if (typeof sessionId !== 'string' || !sessionId.trim()
    || typeof recipientId !== 'string' || !recipientId.trim()
    || typeof confirmationToken !== 'string' || confirmationToken.length < 24
    || typeof transport !== 'function') throw Error('Invalid isolated test dispatch configuration');
  const sent = new Set();
  return {
    async dispatch({ sessionId: candidateSession, recipientId: candidateRecipient,
      inboundMessageId, text, approvalToken }) {
      if (candidateSession !== sessionId || candidateRecipient !== recipientId) {
        return { status: 'blocked', reason: 'not_allowlisted' };
      }
      if (approvalToken !== confirmationToken) {
        return { status: 'blocked', reason: 'approval_required' };
      }
      if (typeof inboundMessageId !== 'string' || !inboundMessageId.trim()
        || typeof text !== 'string' || !text.trim() || text.length > 4000) {
        return { status: 'blocked', reason: 'invalid_payload' };
      }
      if (sent.has(inboundMessageId)) return { status: 'blocked', reason: 'duplicate' };
      if (dryRun) return { status: 'dry_run', text };
      // Only test harnesses may supply a transport. No production API wiring.
      const result = await transport({ sessionId, recipientId, text, inboundMessageId });
      if (!result || result.accepted !== true) throw Error('Test transport did not accept message');
      sent.add(inboundMessageId);
      return { status: 'accepted', inboundMessageId };
    },
  };
}
