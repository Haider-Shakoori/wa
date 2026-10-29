# RelayWA TypeScript SDK

[![npm version](https://img.shields.io/npm/v/%40relaywa%2Fsdk)](https://www.npmjs.com/package/@relaywa/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Server-side TypeScript/JavaScript client for the [RelayWA](https://relaywa.com) WhatsApp REST API. Supports Node.js with built-in `fetch`. **Keep API session keys on your server; do not use this SDK in browser/client-side code.**

## Install

```bash
npm install @relaywa/sdk
```

## Quick start

Set `RELAYWA_SESSION_KEY` in your server environment. Use a valid session key from your RelayWA account.

```ts
import { RelayWA } from '@relaywa/sdk';

const relaywa = new RelayWA({
  sessionKey: process.env.RELAYWA_SESSION_KEY!,
});

// Read sessions without changing a WhatsApp connection.
const sessions = await relaywa.sessions.list();
console.log(sessions);

// Sending is a live operation; uncomment only when ready.
// await relaywa.messages.send({ to: '12025550123', text: 'Hello from RelayWA' });
```

The default API base URL is `https://relaywa.com/api`. To use a different endpoint, pass `baseUrl` in the constructor. Non-local URLs must use HTTPS.

## Supported operations

| Area | Methods |
| --- | --- |
| Messages | `messages.send`, `sendLocation`, `sendContact`, `sendPoll`, `sendReply`, `sendReaction` |
| Sessions | `sessions.list`, `get`, `create`, `update`, `connect`, `restart`, `disconnect`, `remove`, `qrCode` |
| Session directory | `sessions.messages`, `contacts`, `chats`, `groups` |
| Webhooks | `webhooks.list`, `create`, `update`, `remove`, `deliveries` |
| Webhook security | `verifyWebhookSignature` |

Methods return the API's JSON response. Exact response shapes and available operations depend on the RelayWA API and your account.

### Sending a message

```ts
await relaywa.messages.send({
  to: '12025550123',
  text: 'Hello from RelayWA',
  clientMessageId: 'your-unique-id-001',
});
```

**Sending changes live state.** Avoid automatically retrying a timed-out send unless you have independently verified that it was not processed. Do not log session keys.

### Reading session details

```ts
const details = await relaywa.sessions.get('your-session-id');
const chats = await relaywa.sessions.chats('your-session-id');
```

Session lifecycle methods such as `connect`, `restart`, `disconnect` and `remove` affect live connections. Use them deliberately.

### Verify incoming webhooks

Use the exact raw HTTP request body, the webhook secret, the timestamp and the signature supplied by RelayWA. Do not parse and reserialize the body before verification.

```ts
import { verifyWebhookSignature } from '@relaywa/sdk';

const valid = verifyWebhookSignature({
  secret: process.env.RELAYWA_WEBHOOK_SECRET!,
  timestamp: timestampHeader,
  signature: signatureHeader,
  rawBody,
});

if (!valid) {
  throw new Error('Invalid RelayWA webhook signature');
}
```

The verifier checks an HMAC-SHA256 signature and enforces a default five-minute timestamp tolerance. Retrieve the signature and timestamp from the webhook headers specified in the [API documentation](https://relaywa.com/api-docs).

### Errors and timeouts

```ts
import { RelayWAError } from '@relaywa/sdk';

try {
  await relaywa.sessions.list();
} catch (error) {
  if (error instanceof RelayWAError) {
    console.error('RelayWA HTTP status:', error.status);
  } else {
    console.error('Request failed or timed out');
  }
}
```

`timeoutMs` defaults to 30 seconds and can be set from 1 to 120,000 milliseconds. The SDK validates HTTPS for remote API endpoints. Note that `messages.send` currently uses the underlying fetch directly and does not apply the configurable timeout; handle application-level cancellation separately.

## Links

- [RelayWA website](https://relaywa.com)
- [API documentation](https://relaywa.com/api-docs)
- [npm package](https://www.npmjs.com/package/@relaywa/sdk)
- [GitHub repository](https://github.com/Haider-Shakoori/wa)
- [Issues](https://github.com/Haider-Shakoori/wa/issues)

## License

MIT. This SDK is a client for RelayWA's existing API; it does not deploy or run the WhatsApp engine.
