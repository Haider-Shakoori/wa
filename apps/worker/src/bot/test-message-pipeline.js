import { inspectTestSession, TEST_SESSION_ID } from './test-session-preflight.js';
import { createIsolatedBotRuntime } from './isolated-runtime.js';

/**
 * Read-only, in-process simulation of an inbound event from the approved
 * Worker 01 test session. No queue subscription, database write, or send.
 */
export function createTestMessagePipeline({ db, bot, onDecision = () => {} }) {
  const runtime = createIsolatedBotRuntime({
    allowedSessionIds: [TEST_SESSION_ID], onDecision,
  });
  return {
    async inspect(event) {
      if (!event || event.sessionId !== TEST_SESSION_ID)
        return { action: 'ignore', reason: 'session_not_allowlisted' };
      const preflight = await inspectTestSession({ db, sessionId: event.sessionId });
      if (!preflight.ready)
        return { action: 'ignore', reason: 'preflight_' + preflight.reason };
      if (bot?.tenantId !== preflight.tenantId || bot?.sessionId !== preflight.sessionId)
        return { action: 'ignore', reason: 'bot_ownership_mismatch' };
      const decision = runtime.inspect({ bot, event });
      return decision.action === 'reply'
        ? { action: 'preview', text: decision.text, messageId: decision.messageId,
            liveSendPermitted: false }
        : decision;
    },
    releaseHandoff(args) {
      return runtime.releaseHandoff(args);
    },
  };
}
