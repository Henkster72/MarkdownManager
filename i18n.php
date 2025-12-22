<?php

function mdw_i18n_sanitize_folder_name($folder) {
    if (!is_string($folder)) return null;
    $folder = trim($folder);
    if ($folder === '') return null;
    if (strpos($folder, '..') !== false) return null;
    $folder = str_replace("\\", "/", $folder);
    $folder = trim($folder, "/");
    if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}]+$/u', $folder)) return null;
    return $folder;
}

function mdw_i18n_dir() {
    $dir = 'translations';
    if (function_exists('env_str')) {
        $dir = (string)env_str('TRANSLATIONS_DIR', $dir);
    }
    return mdw_i18n_sanitize_folder_name($dir) ?? 'translations';
}

function mdw_i18n_list_languages($projectDir, $dirRel) {
    $dirRel = mdw_i18n_sanitize_folder_name($dirRel) ?? 'translations';
    $fullDir = rtrim($projectDir, '/') . '/' . $dirRel;
    if (!is_dir($fullDir)) return [
        ['code' => 'en', 'label' => 'English', 'native' => 'English'],
    ];

    $langs = [];
    foreach (glob($fullDir . '/*.json') ?: [] as $file) {
        $code = basename($file, '.json');
        if (!preg_match('/^[a-z]{2}(-[A-Za-z0-9]+)?$/', $code)) continue;
        $label = $code;
        $native = $code;
        $raw = @file_get_contents($file);
        if (is_string($raw) && $raw !== '') {
            $json = json_decode($raw, true);
            if (is_array($json) && isset($json['_meta']) && is_array($json['_meta'])) {
                $label = isset($json['_meta']['label']) ? (string)$json['_meta']['label'] : $label;
                $native = isset($json['_meta']['native']) ? (string)$json['_meta']['native'] : $native;
            }
        }
        $langs[] = ['code' => $code, 'label' => $label, 'native' => $native];
    }

    usort($langs, function($a, $b) {
        return strcasecmp((string)($a['code'] ?? ''), (string)($b['code'] ?? ''));
    });

    if (!$langs) $langs = [['code' => 'en', 'label' => 'English', 'native' => 'English']];
    return $langs;
}

function mdw_i18n_pick_lang($availableLangs) {
    $codes = [];
    foreach ($availableLangs as $l) {
        if (isset($l['code']) && is_string($l['code'])) $codes[$l['code']] = true;
    }
    $cookie = isset($_COOKIE['mdw_lang']) ? (string)$_COOKIE['mdw_lang'] : '';
    if ($cookie !== '' && isset($codes[$cookie])) return $cookie;
    return isset($codes['en']) ? 'en' : (array_key_first($codes) ?: 'en');
}

function mdw_i18n_load($projectDir, $dirRel, $lang) {
    $dirRel = mdw_i18n_sanitize_folder_name($dirRel) ?? 'translations';
    $lang = is_string($lang) ? trim($lang) : 'en';
    if ($lang === '') $lang = 'en';

    $base = rtrim($projectDir, '/') . '/' . $dirRel;
    $fallbackFile = $base . '/en.json';
    $file = $base . '/' . $lang . '.json';

    $data = [];
    if (is_file($fallbackFile)) {
        $raw = @file_get_contents($fallbackFile);
        $j = json_decode((string)$raw, true);
        if (is_array($j)) $data = $j;
    }

    if ($lang !== 'en' && is_file($file)) {
        $raw = @file_get_contents($file);
        $j = json_decode((string)$raw, true);
        if (is_array($j)) {
            $data = array_replace_recursive($data, $j);
        }
    }

    $GLOBALS['MDW_I18N_LANG'] = $lang;
    $GLOBALS['MDW_I18N_DIR'] = $dirRel;
    $GLOBALS['MDW_I18N'] = $data;
    return $data;
}

function mdw_i18n_get($key) {
    $data = isset($GLOBALS['MDW_I18N']) && is_array($GLOBALS['MDW_I18N']) ? $GLOBALS['MDW_I18N'] : [];
    if (!is_string($key) || $key === '') return null;
    $cur = $data;
    foreach (explode('.', $key) as $part) {
        if (!is_array($cur) || !array_key_exists($part, $cur)) return null;
        $cur = $cur[$part];
    }
    return is_string($cur) ? $cur : null;
}

function mdw_t($key, $fallback = '') {
    $v = mdw_i18n_get($key);
    if (is_string($v) && $v !== '') return $v;
    return is_string($fallback) ? $fallback : '';
}
