# RelayWA TypeScript SDK (preview)

Server-side SDK for RelayWA. **Not yet published to npm.**

```ts
import { RelayWA } from '@relaywa/sdk';

const client = new RelayWA({ sessionKey: process.env.RELAYWA_SESSION_KEY! });
await client.messages.send({ to: '12025550123', text: 'Hello from RelayWA' });
const sessions = await client.sessions.list();
```

Implemented: text, media, advanced messaging (location/contact/poll/reply/reaction), session reads and lifecycle, directory reads, webhook management and signature verification.

**Safety:** Keep the session key server-side. Session lifecycle calls may change live WhatsApp connections. Do not automatically retry sends or state-changing requests after a timeout. The SDK uses existing HTTPS REST endpoints.

Build: `pnpm --filter @relaywa/sdk build`. API docs: https://relaywa.com/api-docs. See `sdks/README.md` for release limitations.
