<?php
declare(strict_types=1);

$configPath = __DIR__ . '/tmp_image_token_metadata_config.json';
putenv('METADATA_CONFIG_FILE=' . $configPath);

$baseConfig = json_decode((string)@file_get_contents(dirname(__DIR__) . '/metadata_config.json'), true);
if (!is_array($baseConfig)) {
    fwrite(STDERR, "Could not read base metadata config\n");
    exit(1);
}
$baseConfig['_settings'] = is_array($baseConfig['_settings'] ?? null) ? $baseConfig['_settings'] : [];
$baseConfig['_settings']['images_path'] = '../static/images';

if (@file_put_contents($configPath, json_encode($baseConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n") === false) {
    fwrite(STDERR, "Could not write temporary metadata config\n");
    exit(1);
}

require_once dirname(__DIR__) . '/env_loader.php';
require_once dirname(__DIR__) . '/html_preview.php';

$filename = 'A1-en-A2-beta-case%C3%AFne-melk.webp';
$html = md_to_html('![A1-en-A2-beta-caseïne-melk]({{ ' . $filename . ' }})', 'aandoeningen/diabetes.md');

@unlink($configPath);

if (str_contains($html, '%7B%7B') || str_contains($html, '{{  }}')) {
    fwrite(STDERR, "Encoded image token must not collapse into an empty template value\n");
    exit(1);
}
if (!str_contains($html, '../static/images/A1-en-A2-beta-case%C3%AFne-melk.webp')) {
    fwrite(STDERR, "Encoded image token must resolve to the configured sibling images path\n");
    exit(1);
}

echo "WPM image token regression checks passed\n";
