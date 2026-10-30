# RelayWA PHP SDK

Server-side PHP client for the [RelayWA](https://relaywa.com) WhatsApp API. PHP **8.1+**, **cURL**, and **JSON** are required. The package uses Composer PSR-4 autoloading and sends requests to `https://relaywa.com/api` by default.

> **Publication status:** This package is being prepared for Packagist. `composer require relaywa/sdk` will work only **after** a Packagist package and installable release have been published. Do not assume it is available yet.

## 1. Prerequisites

- PHP 8.1 or newer, with the `curl` and `json` extensions enabled
- [Composer](https://getcomposer.org/)
- A RelayWA account and a valid **session key** for server-side API authentication

Check your setup:

```bash
php -v
php -m
composer --version
```

## 2. Install with Composer (after Packagist publication)

In an existing PHP or Laravel application:

```bash
composer require relaywa/sdk
```

Until the package is publicly released, you can test it locally using a Composer `path` repository. From a project with a checkout of this repository:

```bash
composer config repositories.relaywa path "/absolute/path/to/wa/sdks/php"
composer require "relaywa/sdk:@dev"
```

This local installation is for testing only and is **not** the public Packagist release.

## 3. Configure credentials

Get your session key from your RelayWA account. Set `RELAYWA_SESSION_KEY` as a server environment variable; never put it in browser JavaScript, mobile applications, committed `.env` files, or logs.

**Windows CMD**

```cmd
set "RELAYWA_SESSION_KEY=your-session-key"
```

**PowerShell**

```powershell
$env:RELAYWA_SESSION_KEY = "your-session-key"
```

**Linux / macOS**

```bash
export RELAYWA_SESSION_KEY="your-session-key"
```

## 4. First request: list sessions (read-only)

Create `example.php`:

```php
<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

$key = getenv('RELAYWA_SESSION_KEY');
if ($key === false || trim($key) === '') {
    throw new RuntimeException('Set RELAYWA_SESSION_KEY first');
}

$relaywa = new \RelayWA\Client($key);

try {
    $sessions = $relaywa->sessions();
    print_r($sessions);
} catch (RuntimeException $e) {
    fwrite(STDERR, 'RelayWA request failed: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
```

Run:

```bash
php example.php
```

This is a live **read-only** request. It does not connect, restart, or disconnect a WhatsApp session.

## 5. Send a text message (live operation)

Only run this once your WhatsApp session is connected and you have permission to message the recipient:

```php
$result = $relaywa->sendText('12025550123', 'Hello from RelayWA');
print_r($result);
```

A successful request can send a real WhatsApp message. Avoid automatically retrying sends after ambiguous network timeouts; the first attempt might already have been processed.

## 6. More PHP examples

**Session details and chats (read-only)**

```php
$details = $relaywa->session('your-session-id');
$chats = $relaywa->sessionChats('your-session-id');
```

**Send an image by HTTPS URL (live operation)**

```php
$result = $relaywa->sendImage([
    'to' => '12025550123',
    'url' => 'https://example.com/image.jpg',
    'mimeType' => 'image/jpeg',
    'mediaSizeBytes' => 102400,
]);
```

The media URL must be HTTPS and the size must be within the SDK's per-media limit.

**Laravel example**

Set `RELAYWA_SESSION_KEY` in your deployment's environment configuration, then use the client from server-side application code:

```php
use RelayWA\Client;

$relaywa = new Client((string) config('services.relaywa.session_key'));
$sessions = $relaywa->sessions();
```

In `config/services.php`, add:

```php
'relaywa' => [
    'session_key' => env('RELAYWA_SESSION_KEY'),
],
```

Do not call the API from Blade/browser code. Laravel's config cache may need refreshing after deployment environment changes.

## 7. Supported methods

| Category | Methods |
| --- | --- |
| Text/media | `sendText`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument` |
| Interactive messages | `sendLocation`, `sendContact`, `sendPoll`, `sendReply`, `sendReaction` |
| Sessions | `sessions`, `session`, `createSession`, `updateSession`, `connectSession`, `restartSession`, `disconnectSession`, `deleteSession` |
| Session data | `sessionQrCode`, `sessionStatistics`, `sessionLogs`, `sessionMessages`, `sessionMessage`, `sessionContacts`, `sessionChats`, `sessionGroups` |
| Webhooks | `webhooks`, `createWebhook`, `updateWebhook`, `deleteWebhook`, `webhookDeliveries` |

The methods return decoded JSON arrays. Webhook endpoint management is supported; this PHP SDK does **not** currently expose a webhook-signature verification helper.

## 8. Troubleshooting

| Problem | What to check |
| --- | --- |
| Composer cannot find `relaywa/sdk` | The package may not yet be published on Packagist; use the local path repository for pre-release testing. |
| `Class "RelayWA\\Client" not found` | Install Composer dependencies and include `vendor/autoload.php`. |
| `Call to undefined function curl_init()` | Enable the PHP cURL extension for the PHP runtime executing your app. |
| `Session key required` | Set `RELAYWA_SESSION_KEY` in the server process environment. |
| `RelayWA HTTP 401` or `403` | Verify the session key and account permissions without sharing the key. |
| `RelayWA transport failure` | Check HTTPS connectivity, DNS, firewall, and timeouts. |

The SDK uses a 30-second request timeout, 10-second connection timeout, and disables HTTP redirects. API errors are thrown as `RuntimeException`. Never log credentials or automatically retry uncertain message sends.

## 9. Publishing note for maintainers

**Important monorepo caveat:** Packagist reads the root `composer.json` of the Git repository. This package's `composer.json` is in `sdks/php`. Do **not** submit the existing `Haider-Shakoori/wa` repository URL directly and assume Packagist will publish this subdirectory.

Before publication, prepare a dedicated package repository (or a verified split/mirror of `sdks/php`) whose **repository root** contains `composer.json`, `src/`, `README.md`, and `LICENSE`. Tag that repository (for example `v0.1.0`) and register its URL with Packagist. Validate Composer installability and the package archive before announcing a release. Keep the production RelayWA repository and runtime unchanged.

## Links

- [RelayWA](https://relaywa.com)
- [RelayWA API documentation](https://relaywa.com/api-docs)
- [GitHub source](https://github.com/Haider-Shakoori/wa/tree/main/sdks/php)
- [Issues](https://github.com/Haider-Shakoori/wa/issues)

## License

MIT.
