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
if (substr_count($html, 'images/banner.jpg') !== 1) {
    fwrite(STDERR, "Overview macro must be the only preview renderer for page_picture\n");
    exit(1);
}
if (!str_contains($html, 'data-mdw-macro="special.bigheader"') || !str_contains($html, '>Preview headline</div>')) {
    fwrite(STDERR, "Special bigheader macro is missing from the preview\n");
    exit(1);
}

echo "WPM preview macro regression checks passed\n";
