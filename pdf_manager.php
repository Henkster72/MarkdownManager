<?php

require __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/html_preview.php';

function pdf_manager_json($payload, $status = 200) {
    json($payload, (int)$status);
}

function pdf_manager_error($code, $status = 400, $extra = []) {
    $payload = [
        'ok' => false,
        'error_code' => (string)$code,
        'error' => (string)$code,
    ];
    if (is_array($extra) && $extra) {
        foreach ($extra as $k => $v) {
            $payload[$k] = $v;
        }
    }
    pdf_manager_json($payload, $status);
}

function pdf_manager_display_name($filename) {
    $name = preg_replace('/\.pdf$/i', '', (string)$filename);
    $name = str_replace('_', ' ', $name);
    $name = trim(preg_replace('/\s+/u', ' ', $name));
    return $name !== '' ? $name : 'PDF document';
}

function pdf_manager_sanitize_base($name) {
    $base = pathinfo((string)$name, PATHINFO_FILENAME);
    $base = str_replace(' ', '_', $base);
    $base = preg_replace('/[^\w\d_\-\p{L}\p{N}]+/u', '_', $base);
    if (!is_string($base)) $base = '';
    $base = preg_replace('/_+/', '_', $base);
    $base = trim((string)$base, "._- \t\n\r\0\x0B");
    return $base !== '' ? $base : 'document_' . date('Ymd_His');
}

function pdf_manager_unique_name($dir, $base) {
    $candidate = $base . '.pdf';
    $path = rtrim((string)$dir, "/\\") . '/' . $candidate;
    $i = 1;
    while (is_file($path)) {
        $candidate = $base . '_' . $i . '.pdf';
        $path = rtrim((string)$dir, "/\\") . '/' . $candidate;
        $i++;
    }
    return $candidate;
}

$staticDir = mdw_asset_relative_path('static_path', 'STATIC_PATH', 'static');
$staticFsDir = mdw_asset_filesystem_path('static_path', 'STATIC_PATH', 'static');
if (!is_dir($staticFsDir)) {
    @mkdir($staticFsDir, 0755, true);
}
if (is_dir($staticFsDir) && !is_writable($staticFsDir)) {
    @chmod($staticFsDir, 0775);
    if (!is_writable($staticFsDir)) {
        @chmod($staticFsDir, 0777);
    }
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
}
$CSRF_TOKEN = (string)$_SESSION['csrf_token'];

$action = isset($_REQUEST['action']) ? (string)$_REQUEST['action'] : 'list';

if ($action === 'list') {
    $out = [];
    if (is_dir($staticFsDir)) {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($staticFsDir, FilesystemIterator::SKIP_DOTS)
        );
        $baseLen = strlen(rtrim($staticFsDir, "/\\"));
        foreach ($it as $fi) {
            if (!$fi->isFile()) continue;
            $filename = $fi->getFilename();
            if ($filename === '' || $filename[0] === '.') continue;
            if (strtolower(pathinfo($filename, PATHINFO_EXTENSION)) !== 'pdf') continue;

            $fullPath = $fi->getPathname();
            $rel = ltrim(str_replace(DIRECTORY_SEPARATOR, '/', substr($fullPath, $baseLen)), '/');
            if ($rel === '' || $rel[0] === '.' || strpos($rel, '/.') !== false) continue;
            $out[] = [
                'file' => $filename,
                'token' => $filename,
                'path' => rtrim($staticDir, '/') . '/' . $rel,
                'title' => pdf_manager_display_name($filename),
                'size_kb' => round((filesize($fullPath) ?: 0) / 1024, 1),
                'mtime' => @filemtime($fullPath) ?: 0,
            ];
        }
    }

    usort($out, static function($a, $b) {
        return strnatcasecmp((string)($a['title'] ?? ''), (string)($b['title'] ?? ''));
    });

    pdf_manager_json([
        'ok' => true,
        'static_dir' => $staticDir,
        'pdfs' => $out,
    ]);
}

if ($action !== 'upload') {
    pdf_manager_error('unknown_action', 400);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    pdf_manager_error('post_required', 405);
}

$csrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
if (!hash_equals($CSRF_TOKEN, $csrf)) {
    pdf_manager_error('csrf', 403);
}

if (!isset($_FILES['pdf']) || !is_array($_FILES['pdf'])) {
    pdf_manager_error('missing_upload', 400);
}

$file = $_FILES['pdf'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    pdf_manager_error('upload_failed', 400);
}

$tmp = (string)($file['tmp_name'] ?? '');
if ($tmp === '' || !is_uploaded_file($tmp)) {
    pdf_manager_error('invalid_upload', 400);
}

if (!is_dir($staticFsDir) || !is_writable($staticFsDir)) {
    pdf_manager_error('static_dir_not_writable', 500, ['static_dir' => $staticDir]);
}

$mime = null;
if (function_exists('finfo_open')) {
    $fi = finfo_open(FILEINFO_MIME_TYPE);
    if ($fi) {
        $mime = finfo_file($fi, $tmp);
        finfo_close($fi);
    }
}
$ext = strtolower(pathinfo((string)($file['name'] ?? ''), PATHINFO_EXTENSION));
if ($ext !== 'pdf' || (is_string($mime) && $mime !== '' && !in_array($mime, ['application/pdf', 'application/x-pdf', 'application/octet-stream'], true))) {
    pdf_manager_error('type_unsupported', 400);
}

$handle = @fopen($tmp, 'rb');
$signature = $handle ? @fread($handle, 5) : '';
if ($handle) @fclose($handle);
if ($signature !== '%PDF-') {
    pdf_manager_error('type_unsupported', 400);
}

$base = pdf_manager_sanitize_base((string)($file['name'] ?? 'document.pdf'));
$filename = pdf_manager_unique_name($staticFsDir, $base);
$targetPath = rtrim($staticFsDir, "/\\") . '/' . $filename;

if (!@move_uploaded_file($tmp, $targetPath)) {
    pdf_manager_error('store_failed', 500);
}

pdf_manager_json([
    'ok' => true,
    'static_dir' => $staticDir,
    'file' => $filename,
    'token' => $filename,
    'path' => rtrim($staticDir, '/') . '/' . $filename,
    'title' => pdf_manager_display_name($filename),
]);
