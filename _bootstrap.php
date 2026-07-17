<?php
declare(strict_types=1);

require_once __DIR__ . '/env_loader.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    $sharedAuthEnabled = in_array(strtolower(trim((string)env_str('MDW_SHARED_AUTH', ''))), ['1', 'true', 'yes', 'on'], true);
    if ($sharedAuthEnabled) {
        $secureCookie = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        $sessionName = trim((string)env_str('MDW_SHARED_SESSION_NAME', 'MDW_SHARED_AUTH'));
        $sessionPath = trim((string)env_str('MDW_SHARED_SESSION_PATH', '/'));
        if ($sessionName !== '') {
            session_name($sessionName);
        }
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => $sessionPath !== '' ? $sessionPath : '/',
            'secure' => $secureCookie,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
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

require_once __DIR__ . '/_resp.php';
require_once __DIR__ . '/_path.php';

set_error_handler(function ($sev, $msg, $file, $line) {
    if (!(error_reporting() & $sev)) {
        return false;
    }
    error_log("PHP Error [$sev] $msg in $file:$line");
    return false;
});
