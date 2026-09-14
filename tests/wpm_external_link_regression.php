<?php
declare(strict_types=1);

$configPath = __DIR__ . '/tmp_external_link_metadata_config.json';
$baseConfig = json_decode((string)file_get_contents(dirname(__DIR__) . '/metadata_config.json'), true);
if (!is_array($baseConfig)) {
    fwrite(STDERR, "Could not read base metadata config\n");
    exit(1);
}
$baseConfig['_settings']['publisher_mode'] = true;
file_put_contents($configPath, json_encode($baseConfig, JSON_UNESCAPED_SLASHES) . "\n");
register_shutdown_function(static function () use ($configPath): void {
    @unlink($configPath);
});
putenv('METADATA_CONFIG_FILE=' . $configPath);

require_once dirname(__DIR__) . '/env_loader.php';
require_once dirname(__DIR__) . '/html_preview.php';

$html = md_to_html(implode("\n", [
    '[External](https://example.com)',
    '[Bare domain](example.com/path)',
    '[Internal](other-page)',
    '[Already marked](https://example.org) {: class="externlink"}',
]), 'test.md', 'edit', ['external_link_class' => 'externlink']);

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
};

$assert((bool)preg_match('/<a class="md-link externlink" href="https:\/\/example\.com"/', $html), 'External links must receive externlink in WPM preview');
$assert((bool)preg_match('/<a class="md-link externlink" href="https:\/\/example\.com\/path"/', $html), 'Bare domains must receive externlink in WPM preview');
$assert((bool)preg_match('/<a class="md-link" href="other-page"/', $html), 'Internal links must not receive externlink');
$assert(substr_count($html, 'class="md-link externlink"') === 3, 'Explicit externlink must not be duplicated');

echo "WPM external link regression checks passed\n";
