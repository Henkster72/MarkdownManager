<?php

/**
 * Google site search plugin.
 * - Uses WPM_BASE_URL to build a site-scoped Google query.
 */

function google_search_plugin_clean_base($raw) {
    if (!is_string($raw)) return null;
    $raw = trim($raw);
    if ($raw === '') return null;
    $raw = preg_replace('~^https?://~i', '', $raw);
    $raw = rtrim($raw, "/");
    return $raw !== '' ? $raw : null;
}

return [
    'id' => 'google_search',
    'order' => 5,
    'enabled_pages' => ['index'],
    'hooks' => [
        'header' => function(array $ctx) {
            $base = null;
            if (function_exists('env_str')) {
                $base = env_str('WPM_BASE_URL', '');
            } else {
                $raw = getenv('WPM_BASE_URL');
                if ($raw !== false) $base = $raw;
            }

            $base = google_search_plugin_clean_base($base);
            if ($base === null) return false;

            $esc = $ctx['escape'] ?? fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
            $t = function_exists('mdw_t') ? 'mdw_t' : null;
            $titleText = $t ? $t('wpm.search_title', 'Search') : 'Search';
            $placeholderText = $t ? $t('wpm.search_placeholder', 'Search {site}', ['site' => $base]) : ('Search ' . $base);
            $ariaText = $t ? $t('wpm.search_aria', 'Search Google') : 'Search Google';
            $buttonTitle = $t ? $t('wpm.search_button_title', 'Search Google') : 'Search Google';
            $formId = 'wpm-google-search-form';
            $inputId = 'wpm-google-search-input';
            ?>
            <section class="nav-section">
                <div class="nav-section-title">
                    <span class="pi pi-magnify"></span>
                    <span><?= $esc($titleText) ?></span>
                </div>
                <form id="<?= $esc($formId) ?>" class="wpm-google-search" data-base="<?= $esc($base) ?>" style="margin: 0;">
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <input id="<?= $esc($inputId) ?>" class="input" type="text" name="q" placeholder="<?= $esc($placeholderText) ?>" aria-label="<?= $esc($placeholderText) ?>" style="flex: 1 1 auto;">
                        <button type="submit" class="btn btn-ghost icon-button" aria-label="<?= $esc($ariaText) ?>" title="<?= $esc($buttonTitle) ?>">
                            <span class="pi pi-magnify"></span>
                        </button>
                    </div>
                </form>
            </section>
            <script>
            (function() {
                var form = document.getElementById('<?= $esc($formId) ?>');
                if (!form || form.dataset.bound === '1') return;
                form.dataset.bound = '1';
                var input = document.getElementById('<?= $esc($inputId) ?>');
                var base = form.getAttribute('data-base') || '';
                var encodeQuery = function(value) {
                    return encodeURIComponent(value.trim()).replace(/%20/g, '+');
                };
                if (!input || !base) return;
                form.addEventListener('submit', function(event) {
                    event.preventDefault();
                    var query = input.value.trim();
                    if (!query) {
                        input.focus();
                        return;
                    }
                    var q = encodeQuery(query + ' site:' + base);
                    var url = 'https://www.google.com/search?q=' + q;
                    window.open(url, '_blank', 'noopener,noreferrer');
                });
            })();
            </script>
            <?php
            return true;
        },
    ],
];
