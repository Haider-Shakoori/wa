# RelayWA low-request worker bridge

This directory contains source-controlled rollout components for batching Cloudflare worker bridge calls. Keep the 15-second message and heartbeat cadence, validate against the deployed Cloudflare API, and provide an explicit rollback path. No change to WhatsApp authentication or credentials.

Do not deploy until the Cloudflare Worker implementation and VPS client both pass automated tests.
