# RelayWA TypeScript SDK (preview)

A small, server-side client for RelayWA's documented WhatsApp Web REST API. **Not yet published to npm.** This initial preview implements text-message sending; additional API methods, tests, and a release process are pending.

```ts
import { RelayWA } from '@relaywa/sdk';

const client = new RelayWA({ sessionKey: process.env.RELAYWA_SESSION_KEY! });
const result = await client.messages.send({ to: '12025550123', text: 'Hello from RelayWA' });
console.log(result);
```

The API uses a session-bound Bearer key and POST /api/send-message. Use only from trusted server-side environments. API documentation: https://relaywa.com/api-docs.

To build within the monorepo: `pnpm --filter @relaywa/sdk build`.
