# relayWA API

relayWA exposes a versioned REST API under `/api/v1`.

## Authentication

Dashboard users authenticate with JWT Bearer tokens.

External applications should create an API credential in the relayWA dashboard/API:

- Organization key prefix: `rw_live_`
- Session token prefix: `rw_session_`

The full token is returned **once** when created. relayWA stores only a SHA-256 hash.

Use:

```http
Authorization: Bearer rw_live_xxxxxxxxx
```

## Scopes

- `sessions.read`
- `messages.read`
- `messages.send`
- `contacts.read`
- `chats.read`
- `groups.read`
- `webhooks.read`

Session tokens are restricted to their bound WhatsApp session in addition to scope checks.

## Core endpoints

- `GET /api/v1/sessions`
- `GET /api/v1/sessions/{sessionId}`
- `GET /api/v1/sessions/{sessionId}/messages`
- `POST /api/v1/sessions/{sessionId}/messages/text`
- `POST /api/v1/sessions/{sessionId}/messages/image`
- `POST /api/v1/sessions/{sessionId}/messages/video`
- `POST /api/v1/sessions/{sessionId}/messages/audio`
- `POST /api/v1/sessions/{sessionId}/messages/document`
- `POST /api/v1/sessions/{sessionId}/messages/reply`
- `POST /api/v1/sessions/{sessionId}/messages/reaction`
- `POST /api/v1/sessions/{sessionId}/messages/location`
- `POST /api/v1/sessions/{sessionId}/messages/contact`
- `POST /api/v1/sessions/{sessionId}/messages/poll`
- `GET /api/v1/sessions/{sessionId}/contacts`
- `GET /api/v1/sessions/{sessionId}/chats`
- `GET /api/v1/sessions/{sessionId}/groups`

## Example: send text

```bash
curl -X POST https://relaywa.example/api/v1/sessions/SESSION_ID/messages/text \
  -H "Authorization: Bearer rw_session_REPLACE_ME" \
  -H "Content-Type: application/json" \
  -d '{"to":"+93700123456","text":"Your balance is 500 AFN","clientMessageId":"invoice-123"}'
```

`clientMessageId` is recommended for idempotency.

## Webhook verification

Webhook requests include:

- `x-relaywa-event`
- `x-relaywa-event-id`
- `x-relaywa-timestamp`
- `x-relaywa-signature`

The signature is HMAC-SHA256 over:

```text
{timestamp}.{rawRequestBody}
```

using the webhook secret returned when the endpoint is created.
