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
          'Create a RelayWA workspace and connect a WhatsApp session by QR code. Create a session API key and add RELAYWA_API_BASE=https://relaywa.com/api and RELAYWA_SESSION_KEY to a server-only .env file. In config/services.php, define a relaywa array for URL, session key, and webhook secret.',
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
];

export function getPublishedArticle(slug:string):PublishedArticle | undefined {
  return publishedArticles.find((article)=>article.slug===slug);
}
