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
