<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/env_loader.php';
require_once dirname(__DIR__) . '/html_preview.php';

$raw = implode("\n", [
    '{date: 6 november 2026}',
    '{post_date: NOV 6, 2026}',
    '{published_date: November 6, 2026}',
    '{creationdate: 2026-11-04 19:33}',
    '',
    'Body',
]);
$normalized = mdw_hidden_meta_ensure_block($raw, 'blog/example.md', [
    'settings' => ['publisher_mode' => true, 'publisher_default_author' => ''],
]);

foreach ([
    '{date: 2026-11-06}',
    '{post_date: 2026-11-06}',
    '{published_date: 2026-11-06}',
    '{creationdate: 2026-11-04 19:33}',
] as $expected) {
    if (!str_contains($normalized, $expected)) {
        fwrite(STDERR, "Missing canonical metadata: {$expected}\n");
        exit(1);
    }
}

$unchanged = mdw_normalize_date_iso('2026-11-06');
if ($unchanged !== '2026-11-06') {
    fwrite(STDERR, "ISO date must remain unchanged\n");
    exit(1);
}

$timestampRaw = implode("\n", [
    '{creationdate: 2026/11/04 19:33}',
    '{changedate: 4 november 2026 17:10}',
    '',
    'Body',
]);
$timestampNormalized = mdw_hidden_meta_ensure_block($timestampRaw, 'blog/example.md', [
    'preserve_only' => true,
]);
foreach ([
    '{creationdate: 2026-11-04 19:33}',
    '{changedate: 2026-11-04 17:10}',
] as $expected) {
    if (!str_contains($timestampNormalized, $expected)) {
        fwrite(STDERR, "Timestamp normalization changed or lost the existing time: {$expected}\n");
        exit(1);
    }
}
if (!preg_match('/\{changedate: \d{4}-\d{2}-\d{2} \d{2}:\d{2}\}/', $normalized)) {
    fwrite(STDERR, "changedate must remain an ISO timestamp\n");
    exit(1);
}

$html = md_to_html(implode("\n", [
    '{blog: True}',
    '{post_date: 2026-11-06}',
    '',
    'Body',
]), 'blog/example.md');
if (!str_contains($html, '<span class="datum">Nov 6, 2026</span>')) {
    fwrite(STDERR, "Presentation must still use the configured readable date\n");
    exit(1);
}

$template = mdw_export_markdown_jinja_template(implode("\n", [
    '{post_date: Nov 6, 2026}',
    '',
    'Body',
]), ['md_path' => 'blog/example.md']);
if (!str_contains($template, '{% set post_date = "2026-11-06" | dateformat %}')) {
    fwrite(STDERR, "Jinja export must keep post_date canonical and site-formatted at render time\n");
    exit(1);
}
if (str_contains($template, 'Nov 6, 2026') || str_contains($template, 'November 6, 2026')) {
    fwrite(STDERR, "New Jinja exports must not contain a localized post_date literal\n");
    exit(1);
}

$withoutPostDate = mdw_export_markdown_jinja_template(implode("\n", [
    '{page_title: No date}',
    '',
    'Body',
]), ['md_path' => 'blog/no-date.md']);
if (str_contains($withoutPostDate, 'set post_date')) {
    fwrite(STDERR, "Exports without post_date must remain without a post_date assignment\n");
    exit(1);
}

echo "WPM date normalization regression checks passed\n";
