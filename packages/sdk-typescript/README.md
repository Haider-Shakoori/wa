# RelayWA TypeScript SDK

[![npm version](https://img.shields.io/npm/v/%40relaywa%2Fsdk)](https://www.npmjs.com/package/@relaywa/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Server-side TypeScript/JavaScript client for the [RelayWA](https://relaywa.com) WhatsApp REST API. Supports Node.js with built-in `fetch`. **Keep API session keys on your server; do not use this SDK in browser/client-side code.**

## Installation walkthrough (Node.js)

**Prerequisites:** Node.js 20+ with npm, a RelayWA account, and a server-side RelayWA session key. The SDK uses ESM and built-in `fetch`; it is not intended for browser or mobile client code.

### 1. Create a Node.js project

Open Terminal, PowerShell, or Windows CMD in a new folder:

```bash
mkdir relaywa-example
cd relaywa-example
npm init -y
npm pkg set type=module
```

### 2. Install the SDK

```bash
npm install @relaywa/sdk
```

Check which version npm installed:

```bash
npm list @relaywa/sdk
```

### 3. Get your session key

Sign in to [RelayWA](https://relaywa.com), configure the WhatsApp session you want to use, and obtain its **session key** from your account's session/API access settings. Keep the key private. A session key is used for API authentication; installing the SDK does **not** connect or create a WhatsApp session automatically.

### 4. Set the key in your terminal

**Windows CMD** (for the current terminal session):

```cmd
set "RELAYWA_SESSION_KEY=your-session-key"
```

**PowerShell**:

```powershell
$env:RELAYWA_SESSION_KEY = "your-session-key"
```

**macOS / Linux**:

```bash
export RELAYWA_SESSION_KEY="your-session-key"
```

Do not commit keys into source code, Git, screenshots, or logs. For deployed apps, use your host's secret/environment-variable manager.

### 5. Create a working example

Create `index.mjs` in the project folder:

```js
import { RelayWA, RelayWAError } from '@relaywa/sdk';

const sessionKey = process.env.RELAYWA_SESSION_KEY;
if (!sessionKey) {
  throw new Error('Set RELAYWA_SESSION_KEY before running');
}

const client = new RelayWA({ sessionKey });

try {
  const sessions = await client.sessions.list();
  console.log('RelayWA sessions:', sessions);
} catch (error) {
  if (error instanceof RelayWAError) {
    console.error('RelayWA API status:', error.status);
  } else {
    console.error('Connection failed:', error.message);
  }
  process.exitCode = 1;
}
```

### 6. Run the example

```bash
node index.mjs
```

This makes a **read-only** API call to list sessions. If it succeeds, your project can authenticate to RelayWA. To send a message, use the example below only after your session is connected and the recipient is appropriate.

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

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `ERR_MODULE_NOT_FOUND` | Run `npm install @relaywa/sdk` in the same project directory as `index.mjs`. |
| `Cannot use import statement outside a module` | Use `index.mjs` or set `"type": "module"` in `package.json`. |
| Missing session key | Set `RELAYWA_SESSION_KEY` in the **same terminal** where you run Node.js. |
| HTTP 401 or 403 | Confirm your session key is valid and has the required access; do not share it in support messages. |
| Network or timeout error | Confirm the API is reachable over HTTPS. A timed-out send may still have been processed. |
| Session not connected | Check the session state in RelayWA before attempting to send. |

## Links

- [RelayWA website](https://relaywa.com)
- [API documentation](https://relaywa.com/api-docs)
- [npm package](https://www.npmjs.com/package/@relaywa/sdk)
- [GitHub repository](https://github.com/Haider-Shakoori/wa)
- [Issues](https://github.com/Haider-Shakoori/wa/issues)

## License

MIT. This SDK is a client for RelayWA's existing API; it does not deploy or run the WhatsApp engine.
