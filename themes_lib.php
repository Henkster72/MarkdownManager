<?php

function list_available_themes($themesDir) {
    $themesDir = is_string($themesDir) ? trim($themesDir) : '';
    if ($themesDir === '') return [];

    $fullDir = __DIR__ . '/' . $themesDir;
    if (!is_dir($fullDir)) return [];

    $map = [];

    $collect = function($suffix, $key) use ($fullDir, &$map) {
        $paths = glob($fullDir . '/*' . $suffix);
        if (!$paths) return;
        foreach ($paths as $p) {
            $base = basename($p);
            if (!preg_match('/^([A-Za-z0-9_-]+)' . preg_quote($suffix, '/') . '$/', $base, $m)) continue;
            $name = $m[1];
            if (!isset($map[$name])) $map[$name] = [
                'name' => $name,
                'label' => $name,
                'color' => null,
                'bg' => null,
                'secondary' => null,
                'htmlpreview' => false,
                'markdown' => false,
                'fonts' => null,
            ];
            $map[$name][$key] = true;
        }
    };

    $collect('_htmlpreview.css', 'htmlpreview');
    $collect('_markdown.css', 'markdown');

    foreach ($map as $name => &$theme) {
        $metaPath = $fullDir . '/' . $name . '_meta.json';
        if (is_file($metaPath)) {
            $rawMeta = @file_get_contents($metaPath);
            if (is_string($rawMeta) && $rawMeta !== '') {
                $meta = json_decode($rawMeta, true);
                if (is_array($meta)) {
                    if (isset($meta['label']) && is_string($meta['label'])) {
                        $label = trim($meta['label']);
                        if ($label !== '') $theme['label'] = $label;
                    }
                    $is_css_color = function($s) {
                        if (!is_string($s)) return false;
                        $s = trim($s);
                        if ($s === '') return false;
                        return preg_match('/^(#[0-9a-fA-F]{3,8}|rgba?\\([^\\)]+\\))$/', $s) === 1;
                    };

                    if (isset($meta['color']) && $is_css_color($meta['color'])) $theme['color'] = trim($meta['color']);
                    if (isset($meta['bg']) && $is_css_color($meta['bg'])) $theme['bg'] = trim($meta['bg']);
                    if (isset($meta['secondary']) && $is_css_color($meta['secondary'])) $theme['secondary'] = trim($meta['secondary']);
                }
            }
        }

        $manifest = $fullDir . '/' . $name . '_fonts.json';
        if (!is_file($manifest)) continue;
        $raw = @file_get_contents($manifest);
        if (!is_string($raw) || $raw === '') continue;
        $data = json_decode($raw, true);
        if (!is_array($data)) continue;

        $pre = [];
        $css = [];

        $sanitize_urls = function($arr) {
            $out = [];
            if (!is_array($arr)) return $out;
            foreach ($arr as $u) {
                if (!is_string($u)) continue;
                $u = trim($u);
                if ($u === '') continue;
                $parts = parse_url($u);
                if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) continue;
                if (strtolower($parts['scheme']) !== 'https') continue;
                $out[] = $u;
            }
            return $out;
        };

        $pre = $sanitize_urls($data['preconnect'] ?? null);
        $css = $sanitize_urls($data['stylesheets'] ?? null);

        if ($pre || $css) {
            $theme['fonts'] = [
                'preconnect' => $pre,
                'stylesheets' => $css,
            ];
        }
    }
    unset($theme);

    ksort($map, SORT_NATURAL | SORT_FLAG_CASE);
    return array_values($map);
}
