#!/usr/bin/env php
<?php
declare(strict_types=1);

// Export all markdown files to wet HTML for static hosting.

$root = realpath(__DIR__ . '/..');
if ($root === false) {
    fwrite(STDERR, "Unable to resolve project root.\n");
    exit(1);
}

require_once $root . '/env_loader.php';
require_once $root . '/html_preview.php';
require_once $root . '/themes_lib.php';

function usage(): void {
    $help = <<<TXT
Usage: php tools/export-wet-html.php --out <dir> [options]

Options:
  --out <dir>           Output directory (required unless MDW_EXPORT_DIR is set).
  --src <dir>           Source folder to export (default: project root).
  --base <href>         Optional <base href="..."> for GitHub Pages.
  --clean               Remove existing output contents first.
  --only-published      When WPM is enabled, export only Published items.
  --help                Show this help.

Environment:
  MDW_EXPORT_DIR              Default output dir if --out not set.
  MDW_EXPORT_SRC              Default source dir if --src not set.
  MDW_EXPORT_BASE             Default base href if --base not set.
  MDW_EXPORT_PUBLISHED_ONLY   Same as --only-published when set to 1/true.
TXT;
    fwrite(STDOUT, $help . "\n");
}

function normalize_path(string $path): string {
    $path = str_replace("\\", "/", $path);
    return rtrim($path, "/");
}

function resolve_dir(string $root, string $raw): string {
    $raw = trim($raw);
    if ($raw === '') $raw = '.';
    if (preg_match('~(^|[\\\\/])\\.\\.($|[\\\\/])~', $raw)) {
        fwrite(STDERR, "Refusing to resolve a path with '..' segments.\n");
        exit(1);
    }
    $isAbs = str_starts_with($raw, '/') || preg_match('/^[A-Za-z]:[\\\\\\/]/', $raw);
    $path = $isAbs ? $raw : ($root . '/' . $raw);
    return normalize_path($path);
}

function ensure_within_root(string $root, string $path, string $label, bool $allowRoot = false): void {
    $rootNorm = normalize_path($root);
    $pathNorm = normalize_path($path);
    if (!$allowRoot && $pathNorm === $rootNorm) {
        fwrite(STDERR, "Refusing to use project root for {$label}.\n");
        exit(1);
    }
    if (!str_starts_with($pathNorm, $rootNorm . '/')) {
        fwrite(STDERR, ucfirst($label) . " path must live inside the project root.\n");
        exit(1);
    }
}

function is_truthy(string $raw): bool {
    $v = strtolower(trim($raw));
    return $v === '1' || $v === 'true' || $v === 'yes' || $v === 'on';
}

function remove_dir_contents(string $dir): void {
    if (!is_dir($dir)) return;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $item) {
        if ($item->isDir()) {
            @rmdir($item->getPathname());
        } else {
            @unlink($item->getPathname());
        }
    }
}

function copy_dir(string $src, string $dst): void {
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

function read_file(string $path): string {
    if (!is_file($path)) return '';
    $raw = @file_get_contents($path);
    return is_string($raw) ? $raw : '';
}

function sanitize_css_for_style_tag(string $css): string {
    return str_replace('</style', '<\\/style', $css);
}

function build_mermaid_script(): string {
    return "\n<script type=\"module\">\n" .
        "import mermaid from \"https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs\";\n" .
        "mermaid.initialize({ startOnLoad: true });\n" .
        "window.mermaid = mermaid;\n" .
        "</script>\n";
}

function find_theme_name(string $themesDir, string $preset): ?string {
    if ($preset === '' || strtolower($preset) === 'default') return null;
    $themes = list_available_themes($themesDir);
    foreach ($themes as $t) {
        $name = (string)($t['name'] ?? '');
        if ($name !== '' && strcasecmp($name, $preset) === 0) return $name;
    }
    return null;
}

function build_overrides_css(array $overrides): string {
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

function relative_path(string $fromFile, string $toFile): string {
    $fromFile = ltrim(normalize_path($fromFile), '/');
    $toFile = ltrim(normalize_path($toFile), '/');
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

function rewrite_internal_links(string $html, string $currentHtml, array $map, bool $useBase): string {
    return preg_replace_callback('/href="index\\.php\\?file=([^"&]+)([^"]*)"/', function($m) use ($currentHtml, $map, $useBase) {
        $rawFile = rawurldecode($m[1]);
        $rawFile = ltrim(str_replace("\\", "/", $rawFile), '/');
        if (!isset($map[$rawFile])) return $m[0];
        $target = preg_replace('/\\.md$/i', '.html', $map[$rawFile]);
        $suffix = isset($m[2]) ? html_entity_decode($m[2], ENT_QUOTES, 'UTF-8') : '';
        if ($suffix !== '' && $suffix[0] === '&') {
            $suffix = '?' . substr($suffix, 1);
        }
        $href = $useBase ? $target : relative_path($currentHtml, $target);
        $href .= $suffix;
        $hrefEsc = htmlspecialchars($href, ENT_QUOTES, 'UTF-8');
        return 'href="' . $hrefEsc . '"';
    }, $html);
}

$opts = getopt('', ['out:', 'src:', 'base::', 'clean', 'only-published', 'help']);
if (isset($opts['help'])) {
    usage();
    exit(0);
}

$outRaw = isset($opts['out']) ? (string)$opts['out'] : (string)(env_str('MDW_EXPORT_DIR', 'dist') ?? 'dist');
$srcRaw = isset($opts['src']) ? (string)$opts['src'] : (string)(env_str('MDW_EXPORT_SRC', '') ?? '');
$baseHref = isset($opts['base']) ? (string)$opts['base'] : (string)(env_str('MDW_EXPORT_BASE', '') ?? '');
$clean = array_key_exists('clean', $opts);
$onlyPublished = array_key_exists('only-published', $opts) || is_truthy((string)(env_str('MDW_EXPORT_PUBLISHED_ONLY', '') ?? ''));

if (trim($outRaw) === '') {
    usage();
    exit(1);
}

$outDir = resolve_dir($root, $outRaw);
ensure_within_root($root, $outDir, 'output');

$srcDir = $srcRaw !== '' ? resolve_dir($root, $srcRaw) : $root;
ensure_within_root($root, $srcDir, 'source', true);

$srcRel = ltrim(str_replace("\\", "/", substr($srcDir, strlen($root))), '/');

if ($clean) {
    remove_dir_contents($outDir);
}

if (!is_dir($outDir) && !@mkdir($outDir, 0775, true)) {
    fwrite(STDERR, "Unable to create output directory: {$outDir}\n");
    exit(1);
}

$settings = mdw_metadata_settings();
$publisherMode = !empty($settings['publisher_mode']);
$themePreset = (string)($settings['theme_preset'] ?? '');
$overrides = isset($settings['theme_overrides']) && is_array($settings['theme_overrides'])
    ? $settings['theme_overrides']
    : [];
$customCss = (string)($settings['custom_css'] ?? '');
$appTitle = trim((string)($settings['app_title'] ?? ''));
$siteTitle = $appTitle !== '' ? $appTitle : 'Markdown Manager';

$staticDir = env_str('STATIC_DIR', 'static') ?? 'static';
$themesDir = env_str('THEMES_DIR', 'themes') ?? 'themes';
$imagesDir = env_str('IMAGES_DIR', 'images') ?? 'images';
$pluginsDir = env_str('PLUGINS_DIR', 'plugins') ?? 'plugins';
$translationsDir = env_str('TRANSLATIONS_DIR', 'translations') ?? 'translations';

$outRel = ltrim(str_replace("\\", "/", substr($outDir, strlen($root))), '/');
$reserved = [
    'root' => true,
    'HTML' => true,
    'PDF' => true,
    basename($pluginsDir) => true,
    basename($staticDir) => true,
    basename($imagesDir) => true,
    basename($themesDir) => true,
    basename($translationsDir) => true,
    basename(__DIR__) => true,
    '.git' => true,
    '.github' => true,
];
if ($outRel !== '') {
    $parts = explode('/', $outRel);
    if ($parts[0] !== '') $reserved[$parts[0]] = true;
}

$secretFile = env_path('SECRET_MDS_FILE', $root . '/secret_mds.txt', $root);
$secretList = [];
if (is_file($secretFile)) {
    $lines = @file($secretFile, FILE_IGNORE_NEW_LINES);
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $line = trim((string)$line);
            if ($line === '') continue;
            $secretList[$line] = true;
        }
    }
}

$mdFiles = [];
$map = [];
$it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($srcDir, FilesystemIterator::SKIP_DOTS)
);

foreach ($it as $fi) {
    if (!$fi->isFile()) continue;
    $full = $fi->getPathname();
    $relRoot = ltrim(str_replace("\\", "/", substr($full, strlen($root))), '/');
    $relSrc = ltrim(str_replace("\\", "/", substr($full, strlen($srcDir))), '/');
    if ($relRoot === '' || $relSrc === '') continue;

    $parts = explode('/', $relRoot);
    if ($parts[0] === '' || isset($reserved[$parts[0]])) continue;
    $skip = false;
    foreach ($parts as $p) {
        if ($p === '' || $p[0] === '.') {
            $skip = true;
            break;
        }
    }
    if ($skip) continue;

    if (strtolower(pathinfo($relRoot, PATHINFO_EXTENSION)) !== 'md') continue;
    if (isset($secretList[$relRoot])) continue;

    if ($onlyPublished && $publisherMode) {
        $raw = read_file($full);
        if ($raw === '') continue;
        $meta = [];
        mdw_hidden_meta_extract_and_remove_all($raw, $meta);
        $state = strtolower(trim((string)($meta['publishstate'] ?? '')));
        if ($state !== 'published') continue;
    }

    $mdFiles[] = $relRoot;
    $map[$relRoot] = $relSrc;
}

sort($mdFiles, SORT_NATURAL | SORT_FLAG_CASE);

$baseCss = read_file($root . '/' . trim($staticDir, '/\\') . '/htmlpreview.css');
$popiconCss = read_file($root . '/' . trim($staticDir, '/\\') . '/popicon.css');
$baseHref = trim($baseHref);
$fontHref = $baseHref !== '' ? rtrim($baseHref, '/') . '/popicon.woff2' : '/popicon.woff2';
if ($popiconCss !== '') {
    $popiconCss = preg_replace('~url\\((["\\\']?)popicon\\.woff2\\1\\)~', 'url("' . $fontHref . '")', $popiconCss);
}
$themeName = find_theme_name($themesDir, $themePreset);
$themeCss = $themeName
    ? read_file($root . '/' . trim($themesDir, '/\\') . '/' . $themeName . '_htmlpreview.css')
    : '';
$overridesCss = build_overrides_css($overrides);
$indexCss = <<<CSS
.export-index {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.export-folder {
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 0.9rem;
  padding: 0.6rem 0.8rem;
  background: color-mix(in srgb, currentColor 3%, transparent);
}
.export-folder-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
}
.export-folder-title .pi {
  font-size: 1.05rem;
  opacity: 0.8;
}
.export-notes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.export-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.35rem 0.4rem;
  border-radius: 0.5rem;
}
.export-note:hover {
  background: color-mix(in srgb, currentColor 6%, transparent);
}
.export-note .pi {
  font-size: 0.95rem;
  opacity: 0.7;
  margin-top: 0.15rem;
}
.export-note-body {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}
.export-note-body a {
  text-decoration: none;
  font-weight: 600;
}
.export-note-path {
  font-size: 0.78em;
  opacity: 0.65;
  word-break: break-word;
}
CSS;
$cssChunks = array_filter([$popiconCss, $baseCss, $themeCss, $overridesCss, $customCss], fn($c) => trim((string)$c) !== '');
$cssBase = sanitize_css_for_style_tag(implode("\n\n", $cssChunks));
$cssBlock = $cssBase !== '' ? "\n  <style data-mdw-export-css>\n{$cssBase}\n  </style>\n" : '';

$cssIndex = trim($indexCss) !== '' ? sanitize_css_for_style_tag($cssBase . "\n\n" . $indexCss) : $cssBase;
$cssIndexBlock = $cssIndex !== '' ? "\n  <style data-mdw-export-css>\n{$cssIndex}\n  </style>\n" : '';

$baseTag = $baseHref !== '' ? '  <base href="' . htmlspecialchars($baseHref, ENT_QUOTES, 'UTF-8') . '">' . "\n" : '';

$exported = [];
foreach ($mdFiles as $mdRel) {
    $full = $root . '/' . $mdRel;
    $raw = read_file($full);
    if ($raw === '') continue;

    $title = extract_title($raw);
    $body = md_to_html($raw, $mdRel, 'view');
    $body = '<article class="preview-content">' . $body . '</article>';

    $outRelFile = preg_replace('/\\.md$/i', '.html', $map[$mdRel]);
    $outRelFile = ltrim(str_replace("\\", "/", $outRelFile), '/');
    $outFull = $outDir . '/' . $outRelFile;
    $outDirName = dirname($outFull);
    if (!is_dir($outDirName)) @mkdir($outDirName, 0775, true);

    $body = rewrite_internal_links($body, $outRelFile, $map, $baseHref !== '');

    $hasMermaid = (strpos($body, 'class="mermaid"') !== false)
        || (preg_match('/^```\\s*mermaid\\b/im', $raw) === 1);
    $mermaidScript = $hasMermaid ? build_mermaid_script() : '';

    $html = "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>" .
        htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . "</title>\n" .
        $baseTag .
        $cssBlock .
        "</head>\n<body>\n" .
        $body .
        $mermaidScript .
        "\n</body>\n</html>\n";

    @file_put_contents($outFull, $html);
    $exported[] = ['path' => $outRelFile, 'title' => $title, 'source' => $mdRel];
}

// Simple index page
$folderMap = [];
foreach ($exported as $item) {
    $src = $item['source'];
    $relSrc = $map[$src] ?? $src;
    $folder = dirname($relSrc);
    if ($folder === '.' || $folder === '') $folder = 'root';
    if (!isset($folderMap[$folder])) $folderMap[$folder] = [];
    $folderMap[$folder][] = $item;
}
$folderNames = array_keys($folderMap);
usort($folderNames, function($a, $b) {
    if ($a === 'root' && $b !== 'root') return -1;
    if ($b === 'root' && $a !== 'root') return 1;
    return strcasecmp($a, $b);
});

$folderSections = '';
foreach ($folderNames as $folder) {
    $label = $folder === 'root' ? 'Root' : $folder;
    $folderEsc = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
    $folderSections .= "<section class=\"export-folder\">\n";
    $folderSections .= "  <div class=\"export-folder-title\"><span class=\"pi pi-openfolder\"></span><span>{$folderEsc}</span></div>\n";
    $folderSections .= "  <ul class=\"export-notes\">\n";
    foreach ($folderMap[$folder] as $item) {
        $href = $item['path'];
        $title = htmlspecialchars((string)$item['title'], ENT_QUOTES, 'UTF-8');
        $path = htmlspecialchars((string)$item['path'], ENT_QUOTES, 'UTF-8');
        $folderSections .= "    <li class=\"export-note\"><span class=\"pi pi-openbook\"></span><div class=\"export-note-body\"><a href=\"{$href}\">{$title}</a><div class=\"export-note-path\">{$path}</div></div></li>\n";
    }
    $folderSections .= "  </ul>\n</section>\n";
}

$indexBody = '<main class="preview-content export-index"><h1>' . htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8') .
    "</h1>\n{$folderSections}</main>";
$indexHtml = "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>" .
    htmlspecialchars($siteTitle, ENT_QUOTES, 'UTF-8') . "</title>\n" .
    $baseTag .
    $cssIndexBlock .
    "</head>\n<body>\n" .
    $indexBody .
    "\n</body>\n</html>\n";

@file_put_contents($outDir . '/index.html', $indexHtml);

// Copy images folder if present
$imagesSrc = $root . '/' . trim($imagesDir, '/\\');
$imagesDst = $outDir . '/' . trim($imagesDir, '/\\');
copy_dir($imagesSrc, $imagesDst);

// Copy icon font for pi-* classes.
$popiconFont = $root . '/' . trim($staticDir, '/\\') . '/popicon.woff2';
if (is_file($popiconFont)) {
    @copy($popiconFont, $outDir . '/popicon.woff2');
}

$count = count($exported);
fwrite(STDOUT, "Exported {$count} HTML files to {$outDir}\n");
