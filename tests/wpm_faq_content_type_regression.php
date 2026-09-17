<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/env_loader.php';
require_once dirname(__DIR__) . '/html_preview.php';

$fail = static function (string $message): void {
    fwrite(STDERR, $message . "\n");
    exit(1);
};

$fixture = __DIR__ . '/fixtures/content-types/faq.md';
$markdown = @file_get_contents($fixture);
if (!is_string($markdown) || $markdown === '') {
    $fail('Could not read FAQ content-type fixture');
}

$html = md_to_html($markdown, 'fixtures/content-types/faq.md');
if (str_contains($html, 'faq-start') || str_contains($html, 'faqspecial') || str_contains($html, 'reading-detail')) {
    $fail('FAQ preview must not use legacy marker or site-specific classes');
}

libxml_use_internal_errors(true);
$doc = new DOMDocument();
if (!$doc->loadHTML('<!doctype html><html><body>' . $html . '</body></html>')) {
    $fail('FAQ preview HTML could not be parsed');
}
$xpath = new DOMXPath($doc);
$items = $xpath->query('//ol[contains(concat(" ", normalize-space(@class), " "), " mdw-faq-list ")]/li');
if (!$items || $items->length !== 2) {
    $fail('FAQ preview must render one generic list item per level-3 heading');
}

foreach ([0 => '01', 1 => '02'] as $index => $number) {
    $item = $items->item($index);
    $details = $xpath->query('./details', $item);
    $summaryNumber = $xpath->query('./details/summary/span', $item);
    $heading = $xpath->query('./details/summary/h3', $item);
    $answer = $xpath->query('./details/div[contains(concat(" ", normalize-space(@class), " "), " mdw-faq-answer ")]', $item);
    if (!$details || $details->length !== 1 || !$summaryNumber || trim($summaryNumber->item(0)->textContent) !== $number || !$heading || $heading->length !== 1 || !$answer || $answer->length !== 1) {
        $fail('FAQ item has an incomplete generic preview structure');
    }
    if ($index === 0 && !$details->item(0)->hasAttribute('open')) {
        $fail('The first FAQ entry must be open in preview');
    }
    if ($index > 0 && $details->item(0)->hasAttribute('open')) {
        $fail('Only the first FAQ entry may be open in preview');
    }
}

if (!str_contains($html, 'Name &amp; Birthpath Reading</em>') || !str_contains($html, 'mailto:hello@example.test') || !str_contains($html, '<ul')) {
    $fail('FAQ answers and inline Markdown must be preserved in preview');
}

$export = mdw_export_markdown_jinja_template($markdown, ['md_path' => 'faq.md']);
if (!str_contains($export, '{% extends "layouts/markdown_faq.html" %}') || !str_contains($export, "{% set content_type = 'faq' %}") || str_contains($export, 'page_content_type')) {
    $fail('FAQ content type must be exported as first-class Jinja metadata');
}
if (!str_contains($export, '{% set faq_items = ')
    || !str_contains($export, 'question_html')
    || str_contains($export, 'mdw-faq-list')
    || str_contains($export, '<h3')) {
    $fail('Managed FAQ layouts must receive serialized FAQ data, not preview DOM');
}

$normalHtml = md_to_html("### A normal heading\n\nNormal body.\n", 'normal.md');
if (str_contains($normalHtml, 'mdw-faq-list')) {
    $fail('Ordinary Markdown must not opt into FAQ rendering');
}

$invalidHtml = md_to_html("{content_type: faq}\n\nNo FAQ headings.\n", 'invalid-faq.md');
if (!str_contains($invalidHtml, 'mdw-content-type-error')) {
    $fail('FAQ content without a level-3 heading must show a clear preview error');
}

echo "WPM FAQ content-type regression checks passed\n";
