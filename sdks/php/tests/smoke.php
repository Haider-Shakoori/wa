<?php
declare(strict_types=1);
require_once __DIR__ . '/../src/Client.php';
try {
    new \RelayWA\Client('');
    fwrite(STDERR, "Expected validation error\n");
    exit(1);
} catch (\InvalidArgumentException $e) {
    echo "PHP SDK input validation passed\n";
}

$client = new \RelayWA\Client('test-key');
$media = ['to' => '12025550123', 'url' => 'https://example.com/photo.jpg', 'mimeType' => 'image/jpeg', 'mediaSizeBytes' => 16777217];
try {
    $client->sendImage($media);
    fwrite(STDERR, "Expected media size validation error\n");
    exit(1);
} catch (\InvalidArgumentException $e) {
    echo "PHP SDK media validation passed\n";
}


foreach ([
    fn() => $client->createSession([]),
    fn() => $client->createSession(['name' => 'x']),
    fn() => $client->updateSession('id', ['phoneHint' => str_repeat('x', 41)]),
    fn() => $client->connectSession(' '),
    fn() => $client->deleteSession(''),
] as $case) {
    try {
        $case();
        fwrite(STDERR, "Expected session validation error\\n");
        exit(1);
    } catch (\InvalidArgumentException $e) {
        // Invalid inputs must fail before any HTTP request.
    }
}
echo "PHP SDK session validation passed\\n";
