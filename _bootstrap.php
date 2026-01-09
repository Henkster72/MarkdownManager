<?php
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header('X-Content-Type-Options: nosniff');

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
