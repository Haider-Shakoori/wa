# RelayWA PHP SDK (preview)

**Unpublished source preview** — PHP 8.1+ with cURL.

## Local Composer installation
Until registry publication, install the package using a Composer `path` repository pointing to `sdks/php` in a local checkout. The package name is `relaywa/sdk`; it is not yet published to Packagist.

## Server-side usage
```php
<?php
require 'vendor/autoload.php';

$client = new \RelayWA\Client(getenv('RELAYWA_SESSION_KEY'));
// Example API request (do not execute in offline tests):
// $client->sendText('12025550123', 'Hello from RelayWA');
```

Keep credentials server-side. Never retry ambiguous sends automatically. See [SDK overview](../README.md) and [release checklist](../RELEASE_CHECKLIST.md).
