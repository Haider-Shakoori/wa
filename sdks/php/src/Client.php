<?php
declare(strict_types=1);
namespace RelayWA;

/** Minimal PHP SDK preview; requires cURL. Never expose session keys to clients. */
final class Client
{
    public function __construct(private string $sessionKey, private string $baseUrl = 'https://relaywa.com/api')
    {
        if (trim($sessionKey) === '') throw new \InvalidArgumentException('Session key required');
        if (!str_starts_with($baseUrl, 'https://')) throw new \InvalidArgumentException('HTTPS API base required');
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    public function sendText(string $to, string $text): array
    {
        if (trim($to) === '' || trim($text) === '') throw new \InvalidArgumentException('Recipient and text required');
        return $this->request('POST', '/send-message', ['to' => $to, 'text' => $text]);
    }

    /** @param array<string,mixed> $media */
    public function sendImage(array $media): array { return $this->sendMedia('image', $media); }
    /** @param array<string,mixed> $media */
    public function sendVideo(array $media): array { return $this->sendMedia('video', $media); }
    /** @param array<string,mixed> $media */
    public function sendAudio(array $media): array { return $this->sendMedia('audio', $media); }
    /** @param array<string,mixed> $media */
    public function sendDocument(array $media): array { return $this->sendMedia('document', $media); }

    /** @param array<string,mixed> $media */
    private function sendMedia(string $kind, array $media): array
    {
        $limits = ['image' => 16777216, 'video' => 67108864, 'audio' => 16777216, 'document' => 104857600];
        $to = $media['to'] ?? null;
        $url = $media['url'] ?? null;
        $mime = $media['mimeType'] ?? null;
        $size = $media['mediaSizeBytes'] ?? null;
        if (!is_string($to) || strlen($to) < 7 || strlen($to) > 32 || trim($to) === '') throw new \InvalidArgumentException('Invalid recipient');
        if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL) || parse_url($url, PHP_URL_SCHEME) !== 'https' || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null) throw new \InvalidArgumentException('Media URL must be HTTPS');
        if (!is_string($mime) || trim($mime) === '') throw new \InvalidArgumentException('mimeType is required');
        if (!is_int($size) || $size < 1 || $size > $limits[$kind]) throw new \InvalidArgumentException('Invalid media size');
        return $this->request('POST', '/send-' . $kind, $media);
    }

    public function sessions(): array { return $this->request('GET', '/whatsapp-sessions'); }
    private function sessionPath(string $id): string
    {
        if (trim($id) === '') throw new \InvalidArgumentException('Session ID required');
        return '/whatsapp-sessions/' . rawurlencode($id);
    }

    public function session(string $id): array { return $this->request('GET', $this->sessionPath($id)); }
    public function sessionQrCode(string $id): array { return $this->request('GET', $this->sessionPath($id) . '/qrcode'); }
    public function sessionStatistics(string $id): array { return $this->request('GET', $this->sessionPath($id) . '/statistics'); }
    public function sessionLogs(string $id): array { return $this->request('GET', $this->sessionPath($id) . '/logs'); }
    public function sessionMessages(string $id): array { return $this->request('GET', $this->sessionPath($id) . '/messages'); }
    public function sessionMessage(string $id, string $messageId): array
    {
        if (trim($messageId) === '') throw new \InvalidArgumentException('Message ID required');
        return $this->request('GET', $this->sessionPath($id) . '/messages/' . rawurlencode($messageId));
    }
    public function sessionContacts(string $id): array { return $this->request('GET', $this->sessionPath($id) . '/contacts'); }
    public function sessionChats(string $id): array { return $this->request('GET', $this->sessionPath($id) . '/chats'); }
    public function sessionGroups(string $id): array { return $this->request('GET', $this->sessionPath($id) . '/groups'); }

    public function webhooks(): array { return $this->request('GET', '/webhooks'); }

    /** @param array<string,mixed> $input */
    public function createWebhook(array $input): array
    {
        $this->validateWebhook($input, true);
        return $this->request('POST', '/webhooks', $input);
    }

    /** @param array<string,mixed> $input */
    public function updateWebhook(string $id, array $input): array
    {
        $this->validateWebhook($input, false);
        return $this->request('PATCH', '/webhooks/' . $this->webhookId($id), $input);
    }

    public function deleteWebhook(string $id): array
    {
        return $this->request('DELETE', '/webhooks/' . $this->webhookId($id));
    }

    public function webhookDeliveries(string $id): array
    {
        return $this->request('GET', '/webhooks/' . $this->webhookId($id) . '/deliveries');
    }

    private function webhookId(string $id): string
    {
        if (trim($id) === '') throw new \InvalidArgumentException('Webhook ID required');
        return rawurlencode($id);
    }

    private function validateWebhook(array $input, bool $create): void
    {
        if ($create && (!isset($input['name'], $input['url']))) throw new \InvalidArgumentException('Webhook name and URL required');
        if (array_key_exists('name', $input) && (!is_string($input['name']) || strlen($input['name']) < 2 || strlen($input['name']) > 120)) throw new \InvalidArgumentException('Invalid webhook name');
        if (array_key_exists('url', $input) && (!is_string($input['url']) || !filter_var($input['url'], FILTER_VALIDATE_URL) || parse_url($input['url'], PHP_URL_SCHEME) !== 'https' || parse_url($input['url'], PHP_URL_USER) !== null || parse_url($input['url'], PHP_URL_PASS) !== null)) throw new \InvalidArgumentException('Webhook URL must use HTTPS');
        if (array_key_exists('eventTypes', $input) && (!is_array($input['eventTypes']) || count($input['eventTypes']) > 32 || array_filter($input['eventTypes'], fn($x) => !is_string($x) || strlen($x) > 64))) throw new \InvalidArgumentException('Invalid webhook event types');
        if (array_key_exists('enabled', $input) && !is_bool($input['enabled'])) throw new \InvalidArgumentException('Invalid enabled value');
    }

    private function request(string $method, string $path, ?array $payload = null): array
    {
        $handle = curl_init($this->baseUrl . $path);
        if ($handle === false) throw new \RuntimeException('Unable to initialize cURL');
        $headers = ['Authorization: Bearer ' . $this->sessionKey];
        $options = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CUSTOMREQUEST => $method];
        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
            $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_THROW_ON_ERROR);
        }
        $options[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($handle, $options);
        $response = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_HTTP_CODE);
        if ($response === false) { $error = curl_error($handle); curl_close($handle); throw new \RuntimeException($error); }
        curl_close($handle);
        if ($status < 200 || $status >= 300) throw new \RuntimeException('RelayWA HTTP ' . $status);
        $decoded = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) throw new \RuntimeException('Unexpected RelayWA response');
        return $decoded;
    }
}
