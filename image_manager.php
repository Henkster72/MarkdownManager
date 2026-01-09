<?php

require __DIR__ . '/_bootstrap.php';

function image_manager_sanitize_dir_name($name, $fallback) {
    $name = is_string($name) ? trim($name) : '';
    if ($name === '') return $fallback;
    $name = str_replace("\\", "/", $name);
    if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $name) || str_starts_with($name, '//')) return $fallback;
    if (str_starts_with($name, './')) $name = substr($name, 2);
    $isAbs = str_starts_with($name, '/');
    $parts = array_values(array_filter(explode('/', $name), fn($p) => $p !== ''));
    if (empty($parts)) return $fallback;
    $safe = [];
    foreach ($parts as $p) {
        if ($p === '.' || $p === '..') {
            $safe[] = $p;
            continue;
        }
        if (!preg_match('/^[A-Za-z0-9._\\-\\p{L}\\p{N}]+$/u', $p)) return $fallback;
        $safe[] = $p;
    }
    $clean = implode('/', $safe);
    if ($clean === '') return $fallback;
    if ($isAbs && strpos($clean, '..') !== false) return $fallback;
    return $isAbs ? '/' . $clean : $clean;
}

function image_manager_json($payload, $status = 200) {
    json($payload, (int)$status);
}

function image_manager_error($code, $status = 400, $extra = []) {
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
    image_manager_json($payload, $status);
}

function image_manager_guess_alt($filename) {
    $name = preg_replace('/\\.[a-z0-9]+$/i', '', (string)$filename);
    $name = str_replace(['_', '-'], ' ', $name);
    $name = trim(preg_replace('/\\s+/u', ' ', $name));
    if ($name === '') return 'Image';
    if (function_exists('mb_convert_case')) {
        return mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
    }
    return ucwords(strtolower($name));
}

function image_manager_unique_name($dir, $base, $ext) {
    $base = (string)$base;
    $ext = ltrim((string)$ext, '.');
    $base = trim($base, " .\t\n\r\0\x0B");
    if ($base === '') $base = 'image_' . date('Ymd_His');

    $candidate = $base . '.' . $ext;
    $path = rtrim($dir, "/\\") . '/' . $candidate;
    $i = 1;
    while (is_file($path)) {
        $candidate = $base . '_' . $i . '.' . $ext;
        $path = rtrim($dir, "/\\") . '/' . $candidate;
        $i++;
    }
    return $candidate;
}

$IMAGES_DIR = image_manager_sanitize_dir_name(env_str('IMAGES_DIR', 'images'), 'images');
$imagesFsDir = $IMAGES_DIR;
if (!str_starts_with($imagesFsDir, '/')) {
    $imagesFsDir = __DIR__ . '/' . $imagesFsDir;
}
if (!is_dir($imagesFsDir)) {
    @mkdir($imagesFsDir, 0755, true);
}
if (is_dir($imagesFsDir) && !is_writable($imagesFsDir)) {
    @chmod($imagesFsDir, 0775);
    if (!is_writable($imagesFsDir)) {
        @chmod($imagesFsDir, 0777);
    }
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
}
$CSRF_TOKEN = (string)$_SESSION['csrf_token'];

$action = isset($_REQUEST['action']) ? (string)$_REQUEST['action'] : 'list';

if ($action === 'list') {
    $allowedExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'];
    $out = [];

    if (is_dir($imagesFsDir)) {
        $dh = opendir($imagesFsDir);
        if ($dh !== false) {
            while (($file = readdir($dh)) !== false) {
                if ($file === '.' || $file === '..') continue;
                if ($file === '' || $file[0] === '.') continue;
                $full = $imagesFsDir . '/' . $file;
                if (!is_file($full)) continue;
                $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                if (!in_array($ext, $allowedExt, true)) continue;

                $sizeKB = round((filesize($full) ?: 0) / 1024, 1);
                $out[] = [
                    'file' => $file,
                    'path' => $IMAGES_DIR . '/' . $file,
                    'alt' => image_manager_guess_alt($file),
                    'size_kb' => $sizeKB,
                    'mtime' => @filemtime($full) ?: 0,
                ];
            }
            closedir($dh);
        }
    }

    usort($out, function($a, $b) {
        $am = (int)($a['mtime'] ?? 0);
        $bm = (int)($b['mtime'] ?? 0);
        if ($am !== $bm) return $bm <=> $am;
        return strcasecmp((string)($a['file'] ?? ''), (string)($b['file'] ?? ''));
    });

    image_manager_json([
        'ok' => true,
        'images_dir' => $IMAGES_DIR,
        'images' => $out,
    ]);
}

if ($action !== 'upload') {
    image_manager_error('unknown_action', 400);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    image_manager_error('post_required', 405);
}

$csrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
if (!hash_equals($CSRF_TOKEN, $csrf)) {
    image_manager_error('csrf', 403);
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    image_manager_error('missing_upload', 400);
}

$file = $_FILES['image'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    image_manager_error('upload_failed', 400);
}

$tmp = (string)($file['tmp_name'] ?? '');
if ($tmp === '' || !is_uploaded_file($tmp)) {
    image_manager_error('invalid_upload', 400);
}

if (!is_dir($imagesFsDir) || !is_writable($imagesFsDir)) {
    image_manager_error('images_dir_not_writable', 500, ['images_dir' => $IMAGES_DIR]);
}

$validMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
    'image/avif' => 'avif',
];

$mime = null;
if (function_exists('finfo_open')) {
    $fi = finfo_open(FILEINFO_MIME_TYPE);
    if ($fi) {
        $mime = finfo_file($fi, $tmp);
        finfo_close($fi);
    }
}
if (!is_string($mime) || $mime === '') {
    image_manager_error('type_detect_failed', 400);
}
if (!array_key_exists($mime, $validMimes)) {
    image_manager_error('type_unsupported', 400);
}

$originalBase = pathinfo((string)($file['name'] ?? 'image'), PATHINFO_FILENAME);
$cleanBase = preg_replace('/[^\\w\\d_-]+/u', '_', $originalBase);
if (!is_string($cleanBase)) $cleanBase = 'image';
$cleanBase = trim($cleanBase, '_');

$genericPattern = '/(Naamloos|Afbeelding|Adobe|AdobeStock|stock|IMG|Schermafbeelding|Photo|^\\w{1,2}$|\\d+$|\\d{4,}|\\d+x\\d+|-\\d+$|\\(\\d+\\)$)/i';
if ($cleanBase === '' || preg_match($genericPattern, $cleanBase)) {
    $cleanBase = 'image_' . date('Ymd_His');
}

$canConvertToWebp = function_exists('imagewebp')
    && function_exists('imagecreatetruecolor')
    && in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true);

$finalExt = $canConvertToWebp ? 'webp' : $validMimes[$mime];
$filename = image_manager_unique_name($imagesFsDir, $cleanBase, $finalExt);
$targetPath = $imagesFsDir . '/' . $filename;

if ($canConvertToWebp) {
    $src = null;
    switch ($mime) {
        case 'image/jpeg': $src = @imagecreatefromjpeg($tmp); break;
        case 'image/png':  $src = @imagecreatefrompng($tmp); break;
        case 'image/gif':  $src = @imagecreatefromgif($tmp); break;
        case 'image/webp': $src = @imagecreatefromwebp($tmp); break;
    }
    if (!$src) {
        image_manager_error('process_failed', 415);
    }

    $width = imagesx($src);
    $height = imagesy($src);
    $maxSize = 1600;
    if ($width > $maxSize || $height > $maxSize) {
        if ($width >= $height) {
            $newW = $maxSize;
            $newH = (int)round($height * ($newW / max(1, $width)));
        } else {
            $newH = $maxSize;
            $newW = (int)round($width * ($newH / max(1, $height)));
        }
        $resized = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($resized, $src, 0, 0, 0, 0, $newW, $newH, $width, $height);
        imagedestroy($src);
        $src = $resized;
    }

    if (!@imagewebp($src, $targetPath, 82)) {
        imagedestroy($src);
        image_manager_error('save_failed', 500);
    }
    imagedestroy($src);
} else {
    if (!@move_uploaded_file($tmp, $targetPath)) {
        image_manager_error('store_failed', 500);
    }
}

image_manager_json([
    'ok' => true,
    'images_dir' => $IMAGES_DIR,
    'path' => $IMAGES_DIR . '/' . $filename,
    'file' => $filename,
    'alt' => image_manager_guess_alt($filename),
]);
