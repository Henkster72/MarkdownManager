<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/env_loader.php';
require_once dirname(__DIR__) . '/html_preview.php';

$markdown = implode("\n", [
    '{page_title: Test title}',
    '{page_subtitle: Test subtitle}',
    '{page_picture: banner.jpg}',
    '',
    "{% import 'macros/macro_overviewheader.html' as overview %} {{ overview.add_header(header_title=page_title, header_subtitle=page_subtitle, button_link=None, button_text=None, depth=depth) }}",
    '',
    '{{ special.bigheader("Preview headline") }}',
]);

$html = md_to_html($markdown, 'test.md');
if (str_contains($html, '>None<') || str_contains($html, 'href="None"')) {
    fwrite(STDERR, "Jinja None must not render as a preview link\n");
    exit(1);
}
if (str_contains($html, 'mdw-preview-overview-button')) {
    fwrite(STDERR, "Overview macro must omit an empty button\n");
    exit(1);
}
if (!preg_match('/data-mdw-macro-source="[A-Za-z0-9+\/=]+"/', $html)) {
    fwrite(STDERR, "Preview macro source marker is missing\n");
    exit(1);
}
if (substr_count($html, '--mdw-preview-header-image') !== 1 || str_contains($html, '<img class="md-img" src="images/banner.jpg"')) {
    fwrite(STDERR, "Overview macro must be the only preview renderer for page_picture\n");
    exit(1);
}
if (!str_contains($html, 'mdw-preview-overview-header headerimage basegradient') || !str_contains($html, 'headercontent mdw-preview-overview-header-content')) {
    fwrite(STDERR, "Overview macro must retain the live header layout hooks\n");
    exit(1);
}
if (!str_contains($html, "--bg: url('images/banner.jpg')")) {
    fwrite(STDERR, "Overview macro must populate the target header background variable\n");
    exit(1);
}
if (substr_count($html, '<section class="mdw-preview-overview-header') !== 1) {
    fwrite(STDERR, "Overview macro must render exactly one preview header\n");
    exit(1);
}
if (mdw_preview_markdown_has_parent_folder(dirname(__DIR__) . '/root.md')) {
    fwrite(STDERR, "Root Markdown files must not enable folder-only auto sections\n");
    exit(1);
}
if (!mdw_preview_markdown_has_parent_folder(dirname(__DIR__) . '/blog/test.md')) {
    fwrite(STDERR, "Nested Markdown files must enable folder-only auto sections\n");
    exit(1);
}
if (!str_contains($html, 'data-mdw-macro="special.bigheader"') || !str_contains($html, '>Preview headline</div>')) {
    fwrite(STDERR, "Special bigheader macro is missing from the preview\n");
    exit(1);
}

$feedbackHtml = md_to_html(implode("\n", [
    '{feedbackpopup: True}',
    '',
    '<div data-mdw-feedback-slot="after-sharing"></div>',
    '',
    'Footer content',
]), 'test.md');
$feedbackPos = strpos($feedbackHtml, 'mdw-preview-feedback-widget');
$footerPos = strpos($feedbackHtml, 'Footer content');
if ($feedbackPos === false || $footerPos === false || $feedbackPos > $footerPos) {
    fwrite(STDERR, "Feedback widget must use the sharing section placement slot\n");
    exit(1);
}

$exportMarkdown = implode("\n", [
    '{page_title: Test title}',
    '{page_subtitle: Test subtitle}',
    '{page_picture: banner.jpg}',
    '',
    "{% import 'macros/macro_overviewheader.html' as overview %}",
    '{{ overview.add_header(header_title=page_title, header_subtitle=page_subtitle, depth=depth) }}',
    '',
    '{% include "section_sharingcaring.html" %}',
]);
$template = mdw_export_markdown_jinja_template($exportMarkdown, ['md_path' => 'test.md']);
if (str_contains($template, 'data-mdw-') || !str_contains($template, "{% import 'macros/macro_overviewheader.html' as overview %}") || !str_contains($template, '{{ overview.add_header(') || !str_contains($template, '{% include "section_sharingcaring.html" %}')) {
    fwrite(STDERR, "Jinja exports must preserve macros and section includes without preview markers\n");
    exit(1);
}

echo "WPM preview macro regression checks passed\n";
