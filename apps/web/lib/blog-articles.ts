/**
 * Explicitly published English editorial collection.
 * No MD parser / remote draft import; drafts have no public URL or sitemap entry.
 * Review code against examples/ and underlying NestJS API before adding an article.
 */
export type ArticleBlock = {
  id: string;
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  code?: string;
};
export type PublishedArticle = {
  slug: string;
  title: string;
  description: string;
  summary: string;
  keyword: string;
  audience: string;
  publishedAt: string;
  verifiedAt: string;
  readingMinutes: number;
  sourcePath: string;
  blocks: readonly ArticleBlock[];
};

export const publishedArticles: readonly PublishedArticle[] = [
  {
    slug: 'nodejs-whatsapp-api-send-webhooks',
    title: 'Node.js WhatsApp API: Send Messages and Verify Webhooks',
    description: 'Build a Node.js WhatsApp API integration with QR-linked sessions, Bearer auth, idempotent sends and signed webhook verification.',
    summary: 'A real Node.js HTTP client and signed event receiver, with fixture-based tests, for QR-linked WhatsApp sessions.',
    keyword: 'whatsapp api nodejs',
    audience: 'Node.js developers integrating an existing WhatsApp number',
    publishedAt: '2026-10-11',
    verifiedAt: '2026-10-11',
    readingMinutes: 9,
    sourcePath: 'examples/relaywa-node-webhooks/server.mjs',
    blocks: [
      {id:'prerequisites',heading:'Prepare a QR-linked session and server-side credentials',
        paragraphs:[
          'RelayWA is a QR-linked WhatsApp Web session API, not Meta’s official WhatsApp Cloud API. First create an account, connect one WhatsApp number through Linked devices, and issue a session-bound API key with messages.send scope.',
          'Install Node.js 20 or newer. Store RELAYWA_SESSION_KEY and RELAYWA_WEBHOOK_SECRET in your server environment, not browser JavaScript, public repositories, or mobile app bundles. Ask recipients for meaningful opt-in and respect applicable WhatsApp account rules.',
        ],
        bullets:['Send endpoint: POST https://relaywa.com/api/send-message','Required JSON: to (international digits), text, and a stable clientMessageId for each business event','Send and webhook response are transport events, not proof a recipient read the message'],
      },
      {id:'send',heading:'Send an order update with a stable idempotency key',
        paragraphs:[
          'Your app must make the call from a trusted server. The runnable example has a createRelayWaClient function that validates inputs and accepts an injectable fetch implementation for offline tests.',
          'Use an order-specific clientMessageId such as order-123-ready-v1. The API stores it per session to reduce duplicate message creation. If the request times out, delivery may already be in progress: look up the message or retry only with the same key after checking current status.',
        ],
        code: 'const sendText = createRelayWaClient({ sessionKey: process.env.RELAYWA_SESSION_KEY });\nawait sendText({\n  to: "12025550123",\n  text: "Your order #123 is ready.",\n  clientMessageId: "order-123-ready-v1"\n});',
      },
      {id:'webhook',heading:'Verify signed webhooks before processing events',
        paragraphs:[
          'Configure a public HTTPS webhook in your workspace. RelayWA signs the exact raw HTTP request body with HMAC-SHA256 using the secret returned during webhook creation, preceded by the x-relaywa-timestamp and a period. It sends x-relaywa-signature in sha256=HEX format.',
          'Do not parse and then reserialize JSON before hashing: whitespace and key order matter. Use crypto.timingSafeEqual for the 32-byte digest and reject stale timestamps to limit replay. Persist event.id with a database UNIQUE constraint and acknowledge duplicates before scheduling downstream processing.',
        ],
        code: 'const computed = createHmac("sha256", webhookSecret)\n  .update(timestamp).update(".").update(rawBodyBuffer).digest();\nconst valid = submitted.length === computed.length &&\n  timingSafeEqual(submitted, computed);',
      },
      {id:'failures',heading:'Handle failures without promising guaranteed delivery',
        paragraphs:[
          '401 signals invalid credentials, 403 indicates a missing scope or authorization, and 409 can indicate a disconnected session. In these cases, fix the cause before sending again. Transport errors or 503 can have an uncertain outcome; use the returned message ID when available and inspect session/message status.',
          'RelayWA does not operate an outbound Redis queue or automatically retry failed outbound sends. Scheduling, pacing, and bounded retry backoff belong in your application. Webhook delivery retry behavior is separate from outgoing message retry behavior.',
        ],
        bullets:['Test with a connected number you control and consenting recipient','Run the included Node fixture tests locally or in GitHub CI before adapting the code','Never promise ban immunity, guaranteed recipient delivery, or official Meta authorization'],
      },
    ],
  },
  {
    slug: 'laravel-whatsapp-api-order-notifications',
    title: 'Laravel WhatsApp API: Transactional Order Notifications',
    description: 'Integrate Laravel with RelayWA session-based WhatsApp API for order updates, stable message IDs and raw-body signed webhook handling.',
    summary: 'A server-side Laravel order notification flow with secure session credentials, idempotent sends and an event receiver.',
    keyword: 'whatsapp api laravel',
    audience: 'Laravel and PHP developers sending opt-in order updates',
    publishedAt: '2026-10-11',
    verifiedAt: '2026-10-11',
    readingMinutes: 10,
    sourcePath: 'examples/relaywa-laravel/app/Services/RelayWaOrderNotifier.php',
    blocks: [
      {id:'setup',heading:'Configure Laravel without exposing API keys',
        paragraphs:[
          'RelayWA is a QR-linked WhatsApp Web API, not Meta’s official Cloud API. Create a RelayWA workspace and connect a WhatsApp session by QR code. Create a session API key and add RELAYWA_API_BASE=https://relaywa.com/api and RELAYWA_SESSION_KEY to a server-only .env file. In config/services.php, define a relaywa array for URL, session key, and webhook secret.',
          'Do not invoke RelayWA directly from a Blade template or a public frontend. A service class makes the HTTP behavior auditable and testable. Laravel 11/12 HTTP clients can use the built-in Illuminate HTTP facade without an unofficial RelayWA PHP SDK.',
        ],
        code: "'relaywa' => [\n  'url' => env('RELAYWA_API_BASE', 'https://relaywa.com/api'),\n  'session_key' => env('RELAYWA_SESSION_KEY'),\n  'webhook_secret' => env('RELAYWA_WEBHOOK_SECRET'),\n],",
      },
      {id:'notify',heading:'Send a transactionally meaningful notification',
        paragraphs:[
          'The included RelayWaOrderNotifier sends an order-ready update via Http::withToken(...)->post(...). Supply the international destination without plus signs or spaces and create a stable clientMessageId from the order and event type, not a new random value on each attempt.',
          'Trigger the notifier only after the order has reached the required business state and the recipient has opted in. In your own application, enqueue an after-commit job and pace jobs to prevent burst sends. RelayWA dispatches immediately; it rejects scheduledAt, priority, and maxAttempts.',
        ],
        code: "return Http::withToken(config('services.relaywa.session_key'))\n  ->timeout(30)\n  ->post(config('services.relaywa.url').'/send-message', [\n    'to' => $recipient,\n    'text' => 'Your order is ready.',\n    'clientMessageId' => 'order-'.$orderId.'-ready-v1',\n  ]);",
      },
      {id:'events',heading:'Protect the webhook with HMAC and event deduplication',
        paragraphs:[
          'RelayWA posts an event body with id, type, sessionId, createdAt and data fields. Its webhook signature is sha256=HEX over timestamp + a period + the exact raw body bytes. Read Request::getContent() before JSON parsing and use hash_equals on the computed signature.',
          'The example controller checks timestamp age and uses Cache::add as a short-lived illustration of duplicate detection. For production, write event IDs into a database table with a unique index, persist payloads transactionally and dispatch processing jobs after commit. Cache::add by itself does not guarantee durable once-only processing.',
        ],
        code: "$raw = $request->getContent();\n$expected = 'sha256='.hash_hmac('sha256', $timestamp.'.'.$raw, $secret);\nif (! hash_equals($expected, $signature)) {\n    return response()->json(['error' => 'Invalid signature'], 401);\n}",
      },
      {id:'test',heading:'Test network uncertainty and production behavior',
        paragraphs:[
          'For a business notification workflow, cover consent checks, 401/403/409 responses, an HTTP timeout after a potentially accepted send, duplicate business events, invalid HMAC, stale timestamps and duplicate webhook IDs. The sample PHP service and controller are implementation templates; run your Laravel HTTP::fake and feature tests in your own Laravel app before deploying.',
          'If sending returns an uncertain outcome, inspect the message status and reuse the original clientMessageId rather than creating another notification. A successful transport response is not proof the recipient saw the message. For endpoint reference and troubleshooting, use RelayWA’s existing /api-docs and /help pages.',
        ],
        bullets:['Keep secrets in server configuration, never screenshots or source control','Do not confuse outbound app-managed retry policy with webhook delivery retries','Get real customer opt-in and do not send spam or unsolicited promotions'],
      },
    ],
  },
  {
    slug: 'whatsapp-api-qr-session-troubleshooting',
    title: 'WhatsApp API QR Code and Session Troubleshooting Guide',
    description: 'Diagnose QR pairing, expired codes, disconnected sessions and reconnecting WhatsApp Web APIs using verified RelayWA session states and read-only checks.',
    summary: 'A practical QR pairing and reconnection decision tree tied to RelayWA session states, API results and safe operational recovery.',
    keyword: 'whatsapp api qr code',
    audience: 'Backend engineers and operators supporting connected WhatsApp numbers',
    publishedAt: '2026-10-11',
    verifiedAt: '2026-10-11',
    readingMinutes: 10,
    sourcePath: 'examples/relaywa-session-diagnostics/diagnose.mjs',
    blocks: [
      {
        id:'check-state',
        heading:'First read the real session status, not yesterday’s QR',
        paragraphs:[
          'A QR-linked WhatsApp Web session is different from Meta’s official Cloud API. Start with GET /whatsapp-sessions/:sessionId and inspect status and last connection information using a scoped server-side key that has sessions.read permission. The response is specific to your organization and selected session.',
          'RelayWA currently defines nine possible states: pending, need_scan, connecting, connected, disconnected, reconnecting, logged_out, expired and error. These describe the session, not a guaranteed delivery state for an outbound message. A session can be connected even after an old QR code expires.',
        ],
        code:'GET /api/whatsapp-sessions/SESSION_UUID\nAuthorization: Bearer SERVER_SIDE_KEY_WITH_SESSIONS_READ\n\n# Use /api-docs#sessions for the complete authenticated reference.',
      },
      {
        id:'qr-expiry',
        heading:'QR missing, expired or awaiting a new scan',
        paragraphs:[
          'GET /whatsapp-sessions/:sessionId/qrcode returns status, available and expiresAt. When a fresh QR exists it can also return qr and dataUrl. Treat those values as secrets: show them only to the authorized WhatsApp account owner and do not store them in analytics, server logs or public screenshots.',
          'available: false means the QR is missing or its stored expiry has passed. It does not by itself prove a broken worker or demand immediate session deletion. If status is need_scan, inspect connection events and wait for the next authorized QR. Have the account owner scan it from WhatsApp Linked devices, then read the session status again.',
        ],
        bullets:[
          'pending: session exists but connection may not have been requested; use the authorized Connect action first.',
          'need_scan: pairing needed; securely display a CURRENT available QR.',
          'connecting: pairing or transport is in progress; wait and monitor events rather than forcefully logging out.',
          'connected: no further QR action should be necessary solely because a previous QR expired.',
        ],
        code:'GET /api/whatsapp-sessions/SESSION_UUID/qrcode\n# Example when QR unavailable:\n{\n  "sessionId": "SESSION_UUID",\n  "status": "need_scan",\n  "available": false,\n  "expiresAt": null\n}',
      },
      {
        id:'reconnect',
        heading:'Recover a disconnected or reconnecting session carefully',
        paragraphs:[
          'disconnected and reconnecting are different states. Reconnecting indicates restoration is in progress, so give the runtime time and inspect event history first. A deliberate POST /whatsapp-sessions/:sessionId/restart queues a worker command; it is NOT proof that the connection restarted or succeeded.',
          'For logged_out, the WhatsApp account is no longer authenticated and requires the authorized account owner to re-pair. Avoid repeatedly issuing disconnect/logout: it can destroy recoverable authentication. For expired or error, inspect subscription/session diagnostics before choosing an action. Session deletion is restricted to pending or logged_out, and session-scoped keys can be revoked when deleting a session.',
        ],
        bullets:[
          'Review GET /whatsapp-sessions/:sessionId/logs (sessions.read) for recent events, without copying sensitive tokens.',
          'Watch GET /whatsapp-sessions/:sessionId/events (SSE) for changes; do not mistake a heartbeat for a connection confirmation.',
          'Use the Connect, Restart or Disconnect commands only as an authorized operator. Their immediate response has status queued.',
          'If the session remains in error, check worker reachability and network health before escalating.',
        ],
      },
      {
        id:'message-errors',
        heading:'Connected session but a message still fails',
        paragraphs:[
          'A connected session only verifies the transport connection. Sending requires a valid Bearer credential, messages.send scope, subscription eligibility and a valid international recipient number. A 401 indicates invalid credentials; 403 indicates authorization/scope restrictions; 409 can mean the session is not connected.',
          'RelayWA dispatches outbound sends immediately. It does not automatically schedule or retry messages in an outbound Redis queue. If a worker transport request times out, the send outcome may be uncertain; inspect the returned message ID and delivery state before resending and reuse the same clientMessageId when appropriate. A successful API send response does not prove the recipient read the message.',
        ],
        bullets:[
          'Never create a fresh clientMessageId merely because the HTTP response timed out.',
          'Do not confuse a webhook delivery retry with an outbound message retry.',
          'Respect opt-in and platform rules; this diagnostic workflow cannot prevent WhatsApp account restrictions.',
        ],
      },
      {
        id:'read-only-diagnostic',
        heading:'Run the safe read-only session diagnostic',
        paragraphs:[
          'The source-linked Node.js 20+ example requests session details and QR availability metadata only. It never sends lifecycle commands, messages, QR data, secrets or access tokens to stdout. Supply RELAYWA_API_KEY with sessions.read permission and RELAYWA_SESSION_ID in a trusted server environment.',
          'The diagnostic is an offline-testable illustration and does not guarantee that a live worker is reachable, that an account can be paired or that a given network configuration is correct. Follow the canonical REST reference for endpoint permissions and the original Node.js sending tutorial for HMAC-signed event handling.',
        ],
        code:'RELAYWA_API_KEY=SERVER_SIDE_KEY_WITH_SESSIONS_READ \\\nRELAYWA_SESSION_ID=YOUR_SESSION_UUID \\\nnode examples/relaywa-session-diagnostics/diagnose.mjs',
      },
    ],
  },
];

export function getPublishedArticle(slug:string):PublishedArticle | undefined {
  return publishedArticles.find((article)=>article.slug===slug);
}
