# RelayWA public API

The public API uses unversioned URLs. The canonical production base URL is `https://relaywa.com/api`; no API subdomain is required. The local development base URL is `http://localhost:3001/api`.

## Send a text message

```http
POST /api/send-message
Authorization: Bearer YOUR_SESSION_KEY
Content-Type: application/json

{"to":"12025550123","text":"Hello from RelayWA"}
```

The Bearer session key determines which WhatsApp number sends the message. An organization API key or dashboard access token cannot use this endpoint. Scope permissions and subscription checks apply. Sending is immediate, without Redis/BullMQ, randomized pacing, duplicate-content suppression, or automatic retries. The response is `{ "success": true, "data": ... }` after transport acceptance, with the actual message state. Recipient delivery is a separate acknowledgement. Laravel Jobs or your application must handle scheduling, pacing, and retries. `scheduledAt`, `priority`, and `maxAttempts` are rejected. Keep `clientMessageId` for idempotency; a timeout may have an unknown outcome, so check status before resending.

## Connect a session

Use a dashboard access token or an organization key with the appropriate session management scope:

```http
POST /api/whatsapp-sessions/SESSION_ID/connect
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Poll `GET /api/whatsapp-sessions/SESSION_ID/qrcode` for QR availability, image data, and expiration. Pairing is asynchronous; the connect response identifies the queued command. QR pairing is supported. Disconnect uses `POST /api/whatsapp-sessions/SESSION_ID/disconnect`.

## Other messages

Session keys can use `/api/send-image`, `/api/send-video`, `/api/send-audio`, `/api/send-document`, `/api/send-location`, `/api/send-contact`, `/api/send-poll`, `/api/send-reply`, and `/api/send-reaction`. Their bodies use the RelayWA DTO fields documented on `/api-docs`. In particular, media requires `url`, `mimeType`, and `mediaSizeBytes`, alongside `to` and optional fields.

The original `/api/v1/...` routes remain available for existing clients. New documentation and the dashboard use unversioned routes.

## Languages and frameworks

The website and API documentation share examples for JavaScript, TypeScript, Python, PHP, Laravel, C#, Java, Ruby, Go, Swift, Rust, PowerShell, cURL, and n8n. `apiBase` includes `/api`; `sessionKey` is the session's Bearer credential. Use the standard HTTP client for your framework and keep credentials on a trusted server.

The endpoint naming is modeled on WasenderAPI's documented send-message and session connection routes. This is not a claim of complete WasenderAPI wire compatibility. Its official packages use its service and should not be presented as RelayWA SDKs. RelayWA's response fields, media DTOs, and supported connection methods are documented above.

## Media transfer and retention

Outbound media URLs are fetched into worker memory, not retained as RelayWA disk files. The worker enforces the streaming size cap, requires actual downloaded bytes to match `mediaSizeBytes`, and checks a provided Content-Type against the requested MIME (generic application/octet-stream is allowed). These checks are not a malware scan or binary format verification. After each send attempt the worker clears its download buffers; Chromium's base64 media reference is cleared too. If your application retries with a new request, the worker fetches the source URL again. Message records and sent events retain metadata, including verified transferred byte count, rather than file contents. Source files on customer hosting are not deleted. A sent event means transport acceptance; recipient delivery acknowledgement remains a separate event.

## Private worker dispatch configuration

The API calls a private worker HTTP listener on WORKER_DISPATCH_URL (default http://127.0.0.1:3002). The worker listens on WORKER_DISPATCH_HOST/PORT (defaults 127.0.0.1/3002). Both use WORKER_DISPATCH_SECRET, falling back to JWT_SECRET. Keep the listener private; never expose it through the public proxy. For separate containers use a private network hostname and bind the worker to 0.0.0.0 inside that network. For multiple workers configure WORKER_DISPATCH_URLS as a JSON mapping from worker IDs to internal URLs. Requests wait up to 120 seconds and are never automatically replayed after timeout.

During upgrades stop the old worker before migration027, which retires outstanding legacy queue jobs and clears legacy messaging pauses. Restart API and worker together. Old Redis outbound jobs are no longer read. Message database rows remain for status/history; legacy queue columns are retained for schema compatibility, not used as a delivery scheduler. Session lifecycle commands and webhook/operational email delivery remain asynchronous and separate from outbound sending.
