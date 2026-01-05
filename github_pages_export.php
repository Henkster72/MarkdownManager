<?php

session_start();

require_once __DIR__ . '/env_loader.php';
require_once __DIR__ . '/html_preview.php';
require_once __DIR__ . '/themes_lib.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode((string)$raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$action = isset($data['action']) ? (string)$data['action'] : '';
$csrf = isset($data['csrf']) ? (string)$data['csrf'] : '';
if (!isset($_SESSION['csrf_token']) || $csrf === '' || !hash_equals($_SESSION['csrf_token'], $csrf)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'csrf', 'message' => 'Invalid session (CSRF). Reload and try again.']);
    exit;
}

$auth = mdw_auth_config();
$authRequired = ($auth['user_hash'] !== '' || $auth['superuser_hash'] !== '');
if ($authRequired) {
    $authIn = isset($data['auth']) && is_array($data['auth']) ? $data['auth'] : [];
    $role = isset($authIn['role']) ? (string)$authIn['role'] : '';
    $token = isset($authIn['token']) ? (string)$authIn['token'] : '';
    if ($role !== 'superuser' || !mdw_auth_verify_token('superuser', $token)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'auth_required', 'message' => 'Superuser login required.']);
        exit;
    }
}

function ghpx_normalize_path(string $path): string {
    $path = str_replace("\\", "/", $path);
    return rtrim($path, "/");
}

function ghpx_resolve_dir(string $root, string $raw): string {
    $raw = trim($raw);
    if ($raw === '') $raw = '.';
    if (preg_match('~(^|[\\\\/])\\.\\.($|[\\\\/])~', $raw)) {
        throw new RuntimeException("Refusing to resolve a path with '..' segments.");
    }
    $isAbs = str_starts_with($raw, '/') || preg_match('/^[A-Za-z]:[\\\\\\/]/', $raw);
    $path = $isAbs ? $raw : ($root . '/' . $raw);
    return ghpx_normalize_path($path);
}

function ghpx_ensure_within_root(string $root, string $path, string $label, bool $allowRoot = false): void {
    $rootNorm = ghpx_normalize_path($root);
    $pathNorm = ghpx_normalize_path($path);
    if (!$allowRoot && $pathNorm === $rootNorm) {
        throw new RuntimeException("Refusing to use project root for {$label}.");
    }
    if (!str_starts_with($pathNorm, $rootNorm . '/')) {
        throw new RuntimeException(ucfirst($label) . " path must live inside the project root.");
    }
}

function ghpx_safe_full_path(string $root, string $relativePath, bool $requireExists = true): ?string {
    if ($relativePath === '') return null;
    $clean = ghpx_normalize_path($relativePath);
    $clean = ltrim($clean, "/");
    if ($clean === '') return null;
    $full = rtrim($root, "/\\") . '/' . $clean;

    if ($requireExists) {
        $resolved = realpath($full);
        if ($resolved === false) return null;
        if (!str_starts_with(ghpx_normalize_path($resolved), ghpx_normalize_path($root) . '/')) return null;
        return $full;
    }

    $parent = dirname($full);
    $parentResolved = realpath($parent);
    if ($parentResolved === false) return null;
    if (!str_starts_with(ghpx_normalize_path($parentResolved), ghpx_normalize_path($root) . '/')) return null;
    return $full;
}

function ghpx_sanitize_md_path(string $root, string $path): ?string {
    if ($path === '' || strpos($path, '..') !== false) return null;
    $path = str_replace("\\", "/", $path);
    $parts = explode('/', $path);
    if (count($parts) > 3) return null;
    foreach ($parts as $p) {
        if ($p === '') return null;
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}\p{So}]+$/u', $p)) return null;
    }
    if (!preg_match('/\.md$/i', end($parts))) return null;
    $full = ghpx_safe_full_path($root, $path, true);
    if (!$full || !is_file($full)) return null;
    return $path;
}

function ghpx_read_file(string $path): string {
    if (!is_file($path)) return '';
    $raw = @file_get_contents($path);
    return is_string($raw) ? $raw : '';
}

function ghpx_sanitize_css_for_style_tag(string $css): string {
    return str_replace('</style', '<\\/style', $css);
}

function ghpx_build_mermaid_script(): string {
    return "\n<script type=\"module\">\n" .
        "import mermaid from \"https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs\";\n" .
        "mermaid.initialize({ startOnLoad: true });\n" .
        "window.mermaid = mermaid;\n" .
        "</script>\n";
}

function ghpx_build_repo_footer(?string $repoUrl, ?string $label): string {
    $repoUrl = trim((string)$repoUrl);
    if ($repoUrl === '') return '';
    $label = trim((string)$label);
    if ($label === '') $label = 'Source on GitHub';
    $urlEsc = htmlspecialchars($repoUrl, ENT_QUOTES, 'UTF-8');
    $labelEsc = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
    return '<footer class="export-footer"><a href="' . $urlEsc . '" target="_blank" rel="noopener noreferrer">' .
        $labelEsc . '</a></footer>';
}

function ghpx_find_theme_name(string $themesDir, string $preset): ?string {
    if ($preset === '' || strtolower($preset) === 'default') return null;
    $themes = list_available_themes($themesDir);
    foreach ($themes as $t) {
        $name = (string)($t['name'] ?? '');
        if ($name !== '' && strcasecmp($name, $preset) === 0) return $name;
    }
    return null;
}

function ghpx_build_overrides_css(array $overrides): string {
    $preview = isset($overrides['preview']) && is_array($overrides['preview']) ? $overrides['preview'] : [];
    $editor = isset($overrides['editor']) && is_array($overrides['editor']) ? $overrides['editor'] : [];
    $css = [];

    $val = static function($v): string {
        return trim((string)$v);
    };
    $add = static function(string $s) use (&$css): void {
        if ($s !== '') $css[] = $s;
    };

    $pBg = $val($preview['bg'] ?? '');
    $pText = $val($preview['text'] ?? '');
    $pFont = $val($preview['font'] ?? '');
    $pSize = $val($preview['fontSize'] ?? '');
    $hFont = $val($preview['headingFont'] ?? '');
    $hColor = $val($preview['headingColor'] ?? '');
    $listColor = $val($preview['listColor'] ?? '');
    $bqTint = $val($preview['blockquoteTint'] ?? '');

    if ($pBg || $pText || $pFont || $pSize) {
        $props = [];
        if ($pBg) $props[] = "background: {$pBg};";
        if ($pText) $props[] = "color: {$pText};";
        if ($pFont) $props[] = "font-family: {$pFont};";
        if ($pSize) $props[] = "font-size: {$pSize};";
        $add('.preview-content { ' . implode(' ', $props) . ' }');
    }

    if ($hFont || $hColor) {
        $props = [];
        if ($hFont) $props[] = "font-family: {$hFont};";
        if ($hColor) $props[] = "color: {$hColor};";
        $add('.preview-content h1, .preview-content h2, .preview-content h3, .preview-content h4, .preview-content h5, .preview-content h6 { ' . implode(' ', $props) . ' }');
    }

    if ($pText) {
        $add(".preview-content p { color: {$pText}; }");
    }

    if ($listColor) {
        $add(".preview-content ul, .preview-content ol, .preview-content li { color: {$listColor}; }");
    }

    if ($bqTint) {
        $add(".preview-content blockquote { border-left-color: {$bqTint}; background-color: color-mix(in srgb, {$bqTint} 12%, transparent); color: color-mix(in srgb, {$bqTint} 70%, currentColor); }");
    }

    $eFont = $val($editor['font'] ?? '');
    $eSize = $val($editor['fontSize'] ?? '');
    $eAccent = $val($editor['accent'] ?? '');

    if ($eFont || $eSize) {
        $props = [];
        if ($eFont) $props[] = "font-family: {$eFont};";
        if ($eSize) $props[] = "font-size: {$eSize};";
        $add('.editor-textarea { ' . implode(' ', $props) . ' }');
    }

    if ($eAccent) {
        $add(".editor-lines { color: {$eAccent}; }");
        $add(".editor-textarea { caret-color: {$eAccent}; }");
        $add(".editor-textarea::selection { background-color: color-mix(in srgb, {$eAccent} 22%, transparent); }");
    }

    return implode("\n", $css);
}

function ghpx_relative_path(string $fromFile, string $toFile): string {
    $fromFile = ltrim(ghpx_normalize_path($fromFile), '/');
    $toFile = ltrim(ghpx_normalize_path($toFile), '/');
    $fromDir = dirname($fromFile);
    if ($fromDir === '.' || $fromDir === '') $fromDir = '';
    $fromParts = $fromDir === '' ? [] : explode('/', $fromDir);
    $toParts = $toFile === '' ? [] : explode('/', $toFile);
    $i = 0;
    $max = min(count($fromParts), count($toParts));
    while ($i < $max && $fromParts[$i] === $toParts[$i]) $i++;
    $up = array_fill(0, count($fromParts) - $i, '..');
    $down = array_slice($toParts, $i);
    $out = array_merge($up, $down);
    return $out ? implode('/', $out) : basename($toFile);
}

function ghpx_rewrite_internal_links(string $html, string $currentHtml, bool $useBase): string {
    return preg_replace_callback('/href="index\\.php\\?file=([^"&]+)([^"]*)"/', function($m) use ($currentHtml, $useBase) {
        $rawFile = rawurldecode($m[1]);
        $rawFile = ltrim(str_replace("\\", "/", $rawFile), '/');
        if (!preg_match('/\\.md$/i', $rawFile)) return $m[0];
        $target = preg_replace('/\\.md$/i', '.html', $rawFile);
        $suffix = isset($m[2]) ? html_entity_decode($m[2], ENT_QUOTES, 'UTF-8') : '';
        if ($suffix !== '' && $suffix[0] === '&') {
            $suffix = '?' . substr($suffix, 1);
        }
        $href = $useBase ? $target : ghpx_relative_path($currentHtml, $target);
        $href .= $suffix;
        $hrefEsc = htmlspecialchars($href, ENT_QUOTES, 'UTF-8');
        return 'href="' . $hrefEsc . '"';
    }, $html);
}

function ghpx_copy_dir(string $src, string $dst): void {
    if (!is_dir($src)) return;
    if (!is_dir($dst)) @mkdir($dst, 0775, true);
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $item) {
        $rel = ltrim(str_replace("\\", "/", substr($item->getPathname(), strlen($src))), '/');
        if ($rel === '') continue;
        $target = $dst . '/' . $rel;
        if ($item->isDir()) {
            if (!is_dir($target)) @mkdir($target, 0775, true);
        } else {
            @copy($item->getPathname(), $target);
        }
    }
}

function ghpx_env_errors(string $root): array {
    $errors = [];
    $warnings = [];

    $token = trim((string)env_str('GITHUB_TOKEN', ''));
    if ($token === '') $errors[] = 'GITHUB_TOKEN is missing (set it in .env).';

    $out = trim((string)env_str('MDW_EXPORT_DIR', ''));
    if ($out === '') $errors[] = 'MDW_EXPORT_DIR is missing (set it in .env).';

    $exporter = $root . '/tools/export-wet-html.php';
    if (!is_file($exporter)) $errors[] = 'tools/export-wet-html.php is missing.';

    $workflow = $root . '/.github/workflows/pages.yml';
    if (!is_file($workflow)) $errors[] = '.github/workflows/pages.yml is missing.';

    $base = trim((string)env_str('MDW_EXPORT_BASE', ''));
    if ($base === '') {
        $warnings[] = 'MDW_EXPORT_BASE is empty (needed for Project Pages).';
    }

    return [$errors, $warnings];
}

try {
    if ($action === 'check') {
        [$errors, $warnings] = ghpx_env_errors(__DIR__);
        if ($errors) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'config_invalid', 'errors' => $errors, 'warnings' => $warnings]);
            exit;
        }
        echo json_encode(['ok' => true, 'warnings' => $warnings]);
        exit;
    }

    if ($action !== 'export') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_action']);
        exit;
    }

    [$errors, $warnings] = ghpx_env_errors(__DIR__);
    if ($errors) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'config_invalid', 'errors' => $errors, 'warnings' => $warnings]);
        exit;
    }

    $file = isset($data['file']) ? (string)$data['file'] : '';
    $root = realpath(__DIR__);
    if ($root === false) throw new RuntimeException('Project root not found.');
    $file = ghpx_sanitize_md_path($root, $file);
    if ($file === null) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_file', 'message' => 'Invalid markdown file.']);
        exit;
    }

    $outRaw = trim((string)env_str('MDW_EXPORT_DIR', ''));
    $srcRaw = trim((string)env_str('MDW_EXPORT_SRC', ''));
    $baseHref = trim((string)env_str('MDW_EXPORT_BASE', ''));
    $onlyPublished = (string)env_str('MDW_EXPORT_PUBLISHED_ONLY', '');
    $onlyPublished = $onlyPublished !== '' && in_array(strtolower($onlyPublished), ['1', 'true', 'yes', 'on'], true);

    $outDir = ghpx_resolve_dir($root, $outRaw);
    ghpx_ensure_within_root($root, $outDir, 'output');
    if (!is_dir($outDir) && !@mkdir($outDir, 0775, true)) {
        throw new RuntimeException('Unable to create export output directory.');
    }

    $srcDir = $srcRaw !== '' ? ghpx_resolve_dir($root, $srcRaw) : $root;
    ghpx_ensure_within_root($root, $srcDir, 'source', true);
    $srcDirNorm = ghpx_normalize_path($srcDir);

    $fullPath = ghpx_safe_full_path($root, $file, true);
    if ($fullPath === null) {
        throw new RuntimeException('Markdown file not found.');
    }
    $fullNorm = ghpx_normalize_path($fullPath);
    if (!str_starts_with($fullNorm, $srcDirNorm . '/')) {
        throw new RuntimeException('File is outside MDW_EXPORT_SRC.');
    }

    $relToSrc = ltrim(substr($fullNorm, strlen($srcDirNorm)), '/');
    $outRelFile = preg_replace('/\\.md$/i', '.html', $relToSrc);
    $outFull = ghpx_normalize_path($outDir) . '/' . $outRelFile;
    $outDirName = dirname($outFull);
    if (!is_dir($outDirName) && !@mkdir($outDirName, 0775, true)) {
        throw new RuntimeException('Unable to create export subdirectory.');
    }

    $rawMd = ghpx_read_file($fullPath);
    if ($rawMd === '') {
        throw new RuntimeException('Could not read markdown file.');
    }

    $settings = mdw_metadata_settings();
    $publisherMode = !empty($settings['publisher_mode']);
    if ($onlyPublished && $publisherMode) {
        $meta = [];
        mdw_hidden_meta_extract_and_remove_all($rawMd, $meta);
        $state = strtolower(trim((string)($meta['publishstate'] ?? '')));
        if ($state !== 'published') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'not_published', 'message' => 'This note is not Published.']);
            exit;
        }
    }

    $staticDir = (string)env_str('STATIC_DIR', 'static');
    $themesDir = (string)env_str('THEMES_DIR', 'themes');
    $imagesDir = (string)env_str('IMAGES_DIR', 'images');

    $themePreset = isset($settings['theme_preset']) ? trim((string)$settings['theme_preset']) : 'default';
    $overrides = isset($settings['theme_overrides']) && is_array($settings['theme_overrides']) ? $settings['theme_overrides'] : [];
    $customCss = isset($settings['custom_css']) ? (string)$settings['custom_css'] : '';

    $baseCss = ghpx_read_file($root . '/' . trim($staticDir, '/\\') . '/htmlpreview.css');
    $popiconCss = ghpx_read_file($root . '/' . trim($staticDir, '/\\') . '/popicon.css');
    $baseHref = trim($baseHref);
    $fontHref = $baseHref !== '' ? rtrim($baseHref, '/') . '/popicon.woff2' : '/popicon.woff2';
    if ($popiconCss !== '') {
        $popiconCss = preg_replace('~url\\((["\\\']?)popicon\\.woff2\\1\\)~', 'url("' . $fontHref . '")', $popiconCss);
    }
    $themeName = ghpx_find_theme_name($themesDir, $themePreset);
    $themeCss = $themeName ? ghpx_read_file($root . '/' . trim($themesDir, '/\\') . '/' . $themeName . '_htmlpreview.css') : '';
    $overridesCss = ghpx_build_overrides_css($overrides);
    $repoUrl = (string)(env_str('MDW_EXPORT_REPO_URL', '') ?? '');
    $repoLabel = (string)(env_str('MDW_EXPORT_REPO_LABEL', '') ?? '');
    $repoFooter = ghpx_build_repo_footer($repoUrl, $repoLabel);
    $repoCss = $repoFooter !== '' ? ".export-footer{margin-top:1.5rem;font-size:0.78em;opacity:0.7;}\n.export-footer a{text-decoration:none;}" : '';
    $cssChunks = array_filter([$popiconCss, $baseCss, $themeCss, $overridesCss, $customCss, $repoCss], fn($c) => trim((string)$c) !== '');
    $css = ghpx_sanitize_css_for_style_tag(implode("\n\n", $cssChunks));
    $cssBlock = $css !== '' ? "\n  <style data-mdw-export-css>\n{$css}\n  </style>\n" : '';
    $baseTag = $baseHref !== '' ? '  <base href="' . htmlspecialchars($baseHref, ENT_QUOTES, 'UTF-8') . '">' . "\n" : '';

    $title = extract_title($rawMd);
    $body = md_to_html($rawMd, $file, 'view');
    $body = '<article class="preview-content">' . $body . '</article>';
    $body = ghpx_rewrite_internal_links($body, $outRelFile, $baseHref !== '');
    $hasMermaid = (strpos($body, 'class="mermaid"') !== false)
        || (preg_match('/^```\\s*mermaid\\b/im', $rawMd) === 1);
    $mermaidScript = $hasMermaid ? ghpx_build_mermaid_script() : '';

    $html = "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>" .
        htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . "</title>\n" .
        $baseTag .
        $cssBlock .
        "</head>\n<body>\n" .
        $body .
        ($repoFooter !== '' ? "\n" . $repoFooter : '') .
        $mermaidScript .
        "\n</body>\n</html>\n";

    if (@file_put_contents($outFull, $html) === false) {
        throw new RuntimeException('Failed to write export file.');
    }

    $imagesSrc = $root . '/' . trim($imagesDir, '/\\');
    $imagesDst = ghpx_normalize_path($outDir) . '/' . trim($imagesDir, '/\\');
    ghpx_copy_dir($imagesSrc, $imagesDst);
    $popiconFont = $root . '/' . trim($staticDir, '/\\') . '/popicon.woff2';
    if (is_file($popiconFont)) {
        @copy($popiconFont, ghpx_normalize_path($outDir) . '/popicon.woff2');
    }

    echo json_encode([
        'ok' => true,
        'path' => $outRelFile,
        'output_dir' => ghpx_normalize_path($outDir),
        'warnings' => $warnings,
    ]);
    exit;
} catch (Throwable $err) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'export_failed', 'message' => $err->getMessage()]);
    exit;
}
