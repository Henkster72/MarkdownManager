<?php
declare(strict_types=1);

putenv('METADATA_CONFIG_FILE=' . __DIR__ . '/tmp_metadata_config.json');

$baseConfigRaw = @file_get_contents(dirname(__DIR__) . '/metadata_config.json');
$baseConfig = json_decode((string)$baseConfigRaw, true);
if (!is_array($baseConfig)) {
    fwrite(STDERR, "Could not read base metadata config\n");
    exit(1);
}
if (!isset($baseConfig['_settings']) || !is_array($baseConfig['_settings'])) {
    $baseConfig['_settings'] = [];
}
$baseConfig['_settings']['publisher_mode'] = true;
$baseConfig['_settings']['toc_menu'] = 'right';

if (@file_put_contents(__DIR__ . '/tmp_metadata_config.json', json_encode($baseConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n") === false) {
    fwrite(STDERR, "Could not write temporary metadata config\n");
    exit(1);
}

require_once dirname(__DIR__) . '/env_loader.php';
require_once dirname(__DIR__) . '/html_preview.php';

$markdown = implode("\n", [
    '{page_title: TOC regression title}',
    '{page_picture: toc-test.jpg}',
    '{post_date: 25_11_30}',
    '{author: Test Author}',
    '',
    'Intro paragraph before toc.',
    '',
    '{TOC}',
    '',
    '### First section',
    '',
    'Body text.',
    '',
    '### Second section',
    '',
    'More body text.',
]);

$html = md_to_html($markdown, 'tests/toc-layout.md');

$fail = static function (string $message): void {
    fwrite(STDERR, $message . "\n");
    exit(1);
};

libxml_use_internal_errors(true);
$doc = new DOMDocument();
$wrapped = '<!doctype html><html><body>' . $html . '</body></html>';
if (!$doc->loadHTML($wrapped)) {
    $fail('Rendered HTML could not be parsed');
}
$xpath = new DOMXPath($doc);

$layouts = $xpath->query('//div[contains(concat(" ", normalize-space(@class), " "), " md-toc-layout ") and contains(concat(" ", normalize-space(@class), " "), " md-toc-right ")]');
if (!$layouts || $layouts->length !== 1) {
    $fail('Expected exactly one right-side TOC layout');
}

$layout = $layouts->item(0);
$side = $xpath->query('.//nav[contains(concat(" ", normalize-space(@class), " "), " md-toc-side ")]', $layout);
$body = $xpath->query('.//div[contains(concat(" ", normalize-space(@class), " "), " md-toc-body ")]', $layout);
if (!$side || $side->length !== 1 || !$body || $body->length !== 1) {
    $fail('TOC layout is missing side or body column');
}

$bodyNode = $body->item(0);
$h1 = $xpath->query('.//h1', $bodyNode);
$h3 = $xpath->query('.//h3', $bodyNode);
if (!$h1 || $h1->length !== 1) {
    $fail('TOC body must contain the rendered H1 title');
}
if (!$h3 || $h3->length < 2) {
    $fail('TOC body must contain the H3 headings');
}

$css = (string)file_get_contents(dirname(__DIR__) . '/static/htmlpreview.css');
if ($css === '') {
    $fail('Could not read static/htmlpreview.css');
}

$assertCss = static function (string $css, string $selector, string $needle) use ($fail): void {
    $quoted = preg_quote($selector, '/');
    if (!preg_match('/' . $quoted . '\s*\{([^}]*)\}/s', $css, $m)) {
        $fail('Missing CSS selector: ' . $selector);
    }
    if (stripos($m[1], $needle) === false) {
        $fail('Missing CSS rule "' . $needle . '" in selector ' . $selector);
    }
};

$assertCss($css, '.preview-content .md-toc-layout.md-toc-right .md-toc-side', 'grid-row: 1;');
$assertCss($css, '.preview-content .md-toc-layout.md-toc-right .md-toc-body', 'grid-row: 1;');
$assertCss($css, '.edit-page #panePreview .preview-content .md-toc-side,
.index-page.index-split-layout #panePreview .preview-content .md-toc-side', 'position: sticky;');
$assertCss($css, '.edit-page #panePreview .preview-content .md-toc-side,
.index-page.index-split-layout #panePreview .preview-content .md-toc-side', 'top: 0.75rem;');

@unlink(__DIR__ . '/tmp_metadata_config.json');
echo "TOC regression checks passed\n";
