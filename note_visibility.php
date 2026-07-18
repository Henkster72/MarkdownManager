<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/html_preview.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

if (!mdw_publisher_mode_enabled()) {
    json(['ok' => false, 'error' => 'wpm_required'], 403);
}

$data = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($data)) {
    json(['ok' => false, 'error' => 'invalid_json'], 400);
}

$csrf = isset($data['csrf']) ? (string)$data['csrf'] : '';
$expectedCsrf = isset($_SESSION['csrf_token']) ? (string)$_SESSION['csrf_token'] : '';
if ($csrf === '' || $expectedCsrf === '' || !hash_equals($expectedCsrf, $csrf)) {
    json(['ok' => false, 'error' => 'csrf_invalid'], 403);
}

$authToken = isset($data['auth_token']) ? (string)$data['auth_token'] : '';
if (!mdw_auth_verify_token('superuser', $authToken)) {
    json(['ok' => false, 'error' => 'superuser_required'], 403);
}

$path = sanitize_md_path(isset($data['file']) ? (string)$data['file'] : '');
if ($path === null) {
    json(['ok' => false, 'error' => 'invalid_file_path'], 400);
}

$fullPath = mdw_safe_full_path($path);
if ($fullPath === null || !is_file($fullPath)) {
    json(['ok' => false, 'error' => 'file_not_found'], 404);
}

$raw = @file_get_contents($fullPath);
if (!is_string($raw)) {
    json(['ok' => false, 'error' => 'read_failed'], 500);
}

$hidden = !empty($data['user_hidden']);
$next = mdw_hidden_meta_ensure_block($raw, $path, $hidden
    ? ['set' => ['user_hidden' => 'True'], 'preserve_only' => true]
    : ['unset' => ['user_hidden'], 'preserve_only' => true]
);
if (@file_put_contents($fullPath, $next) === false) {
    json(['ok' => false, 'error' => 'write_failed'], 500);
}

clearstatcache(true, $fullPath);
json(['ok' => true, 'file' => $path, 'user_hidden' => $hidden]);
