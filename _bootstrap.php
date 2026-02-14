<?php
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header('X-Content-Type-Options: nosniff');

// Reduce first-load transfer size for large rendered pages (index trees, previews).
if (
    PHP_SAPI !== 'cli'
    && function_exists('ob_gzhandler')
    && extension_loaded('zlib')
    && !ini_get('zlib.output_compression')
) {
    $acceptEncoding = (string)($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '');
    if (stripos($acceptEncoding, 'gzip') !== false) {
        @ob_start('ob_gzhandler');
    }
}

require_once __DIR__ . '/env_loader.php';
require_once __DIR__ . '/_resp.php';
require_once __DIR__ . '/_path.php';

set_error_handler(function ($sev, $msg, $file, $line) {
    if (!(error_reporting() & $sev)) {
        return false;
    }
    error_log("PHP Error [$sev] $msg in $file:$line");
    return false;
});
