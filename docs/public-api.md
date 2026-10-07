# RelayWA public API

The public API uses unversioned URLs. The local base URL is `http://localhost:3001/api`. Configure the deployed HTTPS API origin in your application's environment.

## Send a text message

```http
POST /api/send-message
Authorization: Bearer YOUR_SESSION_KEY
Content-Type: application/json

{"to":"12025550123","text":"Hello from RelayWA"}
```

The Bearer session key determines which WhatsApp number sends the message. An organization API key or dashboard access token cannot use this endpoint. Existing message scope permissions, subscription checks, queues, and safety controls apply. The response is `{ "success": true, "data": ... }`, with the queued message's actual RelayWA state. Queued does not mean delivered.

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

Outbound media URLs are fetched into worker memory, not retained as RelayWA disk files. The worker enforces the streaming size cap, requires actual downloaded bytes to match `mediaSizeBytes`, and checks a provided Content-Type against the requested MIME (generic application/octet-stream is allowed). These checks are not a malware scan or binary format verification. After each send attempt the worker clears its download buffers; Chromium's base64 media reference is cleared too. Failed attempts fetch the source URL again on retry. Message records and sent events retain metadata, including verified transferred byte count, rather than file contents. Source files on customer hosting are not deleted. A sent event means transport acceptance; recipient delivery acknowledgement remains a separate event.
