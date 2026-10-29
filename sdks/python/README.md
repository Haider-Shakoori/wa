# RelayWA Python SDK (preview)

**Unpublished source preview** — Python 3.9+.

## Local installation
From the repository root, build a wheel with `python -m build sdks/python`, then install the generated wheel in a separate virtual environment. The package is not yet published to PyPI.

## Server-side usage
```python
import os
from relaywa import RelayWA

client = RelayWA(os.environ["RELAYWA_SESSION_KEY"])
# Example API request (do not execute in offline tests):
# client.send_text("12025550123", "Hello from RelayWA")
```

The default API base is `https://relaywa.com/api`. Keep credentials in server-side environment variables. Do not automatically retry message sends or session mutations after ambiguous timeouts. See [SDK overview](../README.md) and [release checklist](../RELEASE_CHECKLIST.md).
