# RelayWA SDK usage (source previews, not registry packages)

All examples are **server-side only**. Do not embed RelayWA session API keys in browser or mobile apps. Install from a reviewed source checkout for local development; public registry installation commands will be documented only after publication.

## TypeScript

```ts
import { RelayWA } from '@relaywa/sdk';
const client = new RelayWA({ sessionKey: process.env.RELAYWA_SESSION_KEY! });
await client.messages.send({ to: 'E164_RECIPIENT_NUMBER', text: 'Hello from RelayWA' });
```

## PHP

```php
$client = new \\RelayWA\\Client(getenv('RELAYWA_SESSION_KEY'));
$result = $client->sendText('E164_RECIPIENT_NUMBER', 'Hello from RelayWA');
```

## Python

```python
import os
from relaywa import RelayWA
client = RelayWA(os.environ['RELAYWA_SESSION_KEY'])
result = client.send_text('E164_RECIPIENT_NUMBER', 'Hello from RelayWA')
```

## .NET

```csharp
using RelayWA;
using var http = new HttpClient();
var client = new RelayWAClient(http, Environment.GetEnvironmentVariable("RELAYWA_SESSION_KEY")!);
var result = await client.SendTextAsync("E164_RECIPIENT_NUMBER", "Hello from RelayWA");
```

These snippets describe source APIs only. They do not assert package publication or production compatibility.
