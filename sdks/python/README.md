# RelayWA Python SDK

[![PyPI](https://img.shields.io/pypi/v/relaywa-sdk)](https://pypi.org/project/relaywa-sdk/)
[![Python](https://img.shields.io/pypi/pyversions/relaywa-sdk)](https://pypi.org/project/relaywa-sdk/)

Official server-side Python SDK for [RelayWA](https://relaywa.com), providing WhatsApp messaging, session management, and webhooks through the existing RelayWA REST API.

## Installation

Requires Python 3.9 or newer.

```bash
python -m pip install relaywa-sdk
```

To install a specific version:

```bash
python -m pip install relaywa-sdk==0.1.1
```

Version 0.1.1 will be available **only after the release is published on PyPI**.

## Quick start

Keep your RelayWA session key in a server-side environment variable. Never embed it in browser or mobile application code.

```python
import os
from relaywa import RelayWA

client = RelayWA(os.environ["RELAYWA_SESSION_KEY"])

# Read sessions without changing any WhatsApp connection.
sessions = client.sessions()
print(sessions)

# Sending is a live operation; uncomment only when ready.
# client.send_text("12025550123", "Hello from RelayWA")
```

The default API base URL is `https://relaywa.com/api`.

## Common operations

```python
# Read a session and its chats.
session = client.session("your-session-id")
chats = client.session_chats("your-session-id")

# Send a message (this affects live WhatsApp state).
# client.send_text("12025550123", "Your order is ready")

# List webhook endpoints.
webhooks = client.webhooks()
```

Other SDK methods cover media (image, video, audio, document), location, contacts, polls, replies, reactions, session lifecycle, directory resources, and webhook management.

## Security and operational safety

- Keep session keys secret and server-side. Avoid logging credentials or request authorization headers.
- Use HTTPS for API requests and webhook destinations.
- Sending messages and changing session state are real operations. Do not automatically retry timed-out sends or mutations: the first request may have succeeded.
- Run integration tests against a dedicated test session, not a production WhatsApp account.
- Validate incoming webhook signatures before processing webhook events. Refer to the [RelayWA API documentation](https://relaywa.com/api-docs) for the relevant headers and verification requirements.

## Error handling

```python
from relaywa import RelayWAError

try:
    sessions = client.sessions()
except RelayWAError as error:
    print(f"RelayWA request failed: {error}")
```

## Resources

- [RelayWA website](https://relaywa.com)
- [API documentation](https://relaywa.com/api-docs)
- [PyPI package](https://pypi.org/project/relaywa-sdk/)
- [Source code](https://github.com/Haider-Shakoori/wa/tree/main/sdks/python)
- [Issues](https://github.com/Haider-Shakoori/wa/issues)

## License

MIT.
