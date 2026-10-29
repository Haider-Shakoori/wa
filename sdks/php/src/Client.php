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

    public function sessions(): array { return $this->request('GET', '/whatsapp-sessions'); }
    public function webhooks(): array { return $this->request('GET', '/webhooks'); }

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
