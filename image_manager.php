<?php

session_start();

require_once __DIR__ . '/env_loader.php';

function image_manager_sanitize_dir_name($name, $fallback) {
    $name = is_string($name) ? trim($name) : '';
    if ($name === '') return $fallback;
    if (strpos($name, '..') !== false) return $fallback;
    $name = str_replace("\\", "/", $name);
    $name = trim($name, "/");
    if ($name === '' || strpos($name, '/') !== false) return $fallback;
    if (!preg_match('/^[A-Za-z0-9._\\-\\p{L}\\p{N}]+$/u', $name)) return $fallback;
    return $name;
}

function image_manager_json($payload, $status = 200) {
    http_response_code((int)$status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function image_manager_guess_alt($filename) {
    $name = preg_replace('/\\.[a-z0-9]+$/i', '', (string)$filename);
    $name = str_replace(['_', '-'], ' ', $name);
    $name = trim(preg_replace('/\\s+/u', ' ', $name));
    if ($name === '') return 'Image';
    return mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
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
$imagesFsDir = __DIR__ . '/' . $IMAGES_DIR;
if (!is_dir($imagesFsDir)) {
    @mkdir($imagesFsDir, 0755, true);
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
    image_manager_json(['ok' => false, 'error' => 'Unknown action.'], 400);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    image_manager_json(['ok' => false, 'error' => 'POST required.'], 405);
}

$csrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
if (!hash_equals($CSRF_TOKEN, $csrf)) {
    image_manager_json(['ok' => false, 'error' => 'Invalid session (CSRF). Reload and try again.'], 403);
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    image_manager_json(['ok' => false, 'error' => 'Missing upload.'], 400);
}

$file = $_FILES['image'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    image_manager_json(['ok' => false, 'error' => 'Upload failed.'], 400);
}

$tmp = (string)($file['tmp_name'] ?? '');
if ($tmp === '' || !is_uploaded_file($tmp)) {
    image_manager_json(['ok' => false, 'error' => 'Invalid upload.'], 400);
}

if (!is_dir($imagesFsDir) || !is_writable($imagesFsDir)) {
    image_manager_json(['ok' => false, 'error' => 'Images directory is not writable.'], 500);
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
    image_manager_json(['ok' => false, 'error' => 'Could not detect file type.'], 400);
}
if (!array_key_exists($mime, $validMimes)) {
    image_manager_json(['ok' => false, 'error' => 'Unsupported image type.'], 400);
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
        image_manager_json(['ok' => false, 'error' => 'Could not process image.'], 415);
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
        image_manager_json(['ok' => false, 'error' => 'Failed to save image.'], 500);
    }
    imagedestroy($src);
} else {
    if (!@move_uploaded_file($tmp, $targetPath)) {
        image_manager_json(['ok' => false, 'error' => 'Failed to store image.'], 500);
    }
}

image_manager_json([
    'ok' => true,
    'images_dir' => $IMAGES_DIR,
    'path' => $IMAGES_DIR . '/' . $filename,
    'file' => $filename,
    'alt' => image_manager_guess_alt($filename),
]);

