<?php

/**
 * Shared explorer (overview) renderer used by index.php and edit.php.
 *
 * This file intentionally has no side-effects besides defining functions.
 */

function explorer_view_escape($s) {
    if (function_exists('h')) return h($s);
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function explorer_view_t($key, $fallback = '') {
    if (function_exists('mdw_t')) return mdw_t($key, $fallback);
    return is_string($fallback) ? $fallback : '';
}

function explorer_view_url_encode_path($path) {
    if (function_exists('url_encode_path')) return url_encode_path($path);
    $path = str_replace("\\", "/", (string)$path);
    $segments = explode('/', $path);
    $segments = array_map('rawurlencode', $segments);
    return implode('/', $segments);
}

function explorer_view_folder_from_path($path) {
    if (function_exists('folder_from_path')) return folder_from_path($path);
    if (!$path) return null;
    $d = dirname((string)$path);
    if ($d === '.' || $d === '') return 'root';
    return $d;
}

function explorer_view_folder_anchor_id($folder) {
    $folder = (string)$folder;
    if ($folder === '') $folder = 'root';
    return 'folder-anchor-' . substr(sha1('folder:' . $folder), 0, 10);
}

function explorer_view_should_hide_editor_document($path) {
    global $MDW_SETTINGS;
    if (empty($MDW_SETTINGS['hide_markdown_editor'])) return false;
    $basename = strtolower(basename(str_replace('\\', '/', (string)$path)));
    return in_array($basename, ['readme.md', 'changelog.md'], true);
}

function &explorer_view_meta_cache_state() {
    static $state = null;
    if ($state === null) {
        $state = [
            'loaded' => false,
            'dirty' => false,
            'path' => null,
            'items' => [],
            'registered' => false,
        ];
    }
    return $state;
}

function explorer_view_meta_cache_path() {
    $tmp = (string)sys_get_temp_dir();
    if ($tmp === '') return null;
    $tmp = rtrim($tmp, "/\\");
    if ($tmp === '') return null;
    $root = realpath(__DIR__);
    if (!is_string($root) || $root === '') $root = __DIR__;
    $hash = substr(sha1($root), 0, 16);
    return $tmp . '/mdw-explorer-meta-' . $hash . '.json';
}

function explorer_view_meta_cache_flush() {
    $state =& explorer_view_meta_cache_state();
    if (empty($state['dirty'])) return;
    $path = is_string($state['path']) ? $state['path'] : null;
    if (!$path) $path = explorer_view_meta_cache_path();
    if (!$path) return;

    $payload = json_encode([
        'v' => 2,
        'items' => $state['items'],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($payload) || $payload === '') return;

    $tmp = $path . '.tmp';
    if (@file_put_contents($tmp, $payload, LOCK_EX) === false) {
        return;
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return;
    }
    $state['dirty'] = false;
}

function explorer_view_meta_cache_boot() {
    $state =& explorer_view_meta_cache_state();
    if (!empty($state['loaded'])) return;
    $state['loaded'] = true;
    $state['path'] = explorer_view_meta_cache_path();
    $state['items'] = [];

    $path = $state['path'];
    if (is_string($path) && $path !== '' && is_file($path) && is_readable($path)) {
        $raw = @file_get_contents($path);
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && (int)($decoded['v'] ?? 0) === 2 && isset($decoded['items']) && is_array($decoded['items'])) {
                $state['items'] = $decoded['items'];
            }
        }
    }

    if (empty($state['registered'])) {
        register_shutdown_function('explorer_view_meta_cache_flush');
        $state['registered'] = true;
    }
}

function explorer_view_extract_md_title_from_file($fullPath, $fallbackBasename) {
    if (function_exists('extract_title_from_file')) {
        return extract_title_from_file($fullPath, $fallbackBasename);
    }

    if (!is_string($fullPath) || $fullPath === '' || !is_file($fullPath)) return $fallbackBasename;
    $h = @fopen($fullPath, 'rb');
    if (!$h) return $fallbackBasename;

    $firstNonEmpty = null;
    $maxLines = 200;
    $inMeta = true;
    $seenMeta = false;
    while ($maxLines-- > 0 && ($line = fgets($h)) !== false) {
        $line = rtrim($line, "\r\n");
        if (preg_match('/^#\\s+(.*)$/', $line, $m)) {
            fclose($h);
            return trim($m[1]);
        }
        if ($inMeta) {
            $k = null; $v = null;
            if (function_exists('mdw_hidden_meta_match') && mdw_hidden_meta_match($line, $k, $v)) {
                $seenMeta = true;
                continue;
            }
            if (!$seenMeta && trim((string)$line) === '') {
                continue;
            }
            $inMeta = false;
        }
        if ($firstNonEmpty === null && trim($line) !== '') {
            $firstNonEmpty = $line;
        }
    }
    fclose($h);

    if ($firstNonEmpty !== null) return trim($firstNonEmpty);
    $fallbackBasename = (string)$fallbackBasename;
    return $fallbackBasename !== '' ? $fallbackBasename : 'Untitled';
}

function explorer_view_extract_md_title_and_meta_from_file($fullPath, $fallbackBasename, $wantMetaKeys = []) {
    explorer_view_meta_cache_boot();

    $want = [];
    if (is_array($wantMetaKeys)) {
        foreach ($wantMetaKeys as $k) {
            if (!is_string($k) || $k === '') continue;
            $want[strtolower($k)] = true;
        }
    }
    $wantCount = count($want);

    if (!is_string($fullPath) || $fullPath === '' || !is_file($fullPath)) {
        return ['title' => (string)$fallbackBasename, 'meta' => []];
    }

    $state =& explorer_view_meta_cache_state();
    $cacheKey = str_replace("\\", '/', $fullPath);
    $stat = @stat($fullPath);
    $sig = null;
    if (is_array($stat)) {
        $mtime = isset($stat['mtime']) ? (int)$stat['mtime'] : 0;
        $size = isset($stat['size']) ? (int)$stat['size'] : 0;
        $sig = $mtime . ':' . $size;
    }
    if ($cacheKey !== '' && $sig !== null) {
        $cached = $state['items'][$cacheKey] ?? null;
        if (is_array($cached) && (string)($cached['sig'] ?? '') === $sig) {
            $cachedTitle = (string)($cached['title'] ?? '');
            if ($cachedTitle === '') $cachedTitle = (string)$fallbackBasename;
            $cachedMeta = isset($cached['meta']) && is_array($cached['meta']) ? $cached['meta'] : [];
            $outMeta = [];
            if (!empty($want)) {
                foreach ($want as $k => $_) {
                    if (array_key_exists($k, $cachedMeta)) {
                        $outMeta[$k] = $cachedMeta[$k];
                    }
                }
            }
            return ['title' => $cachedTitle, 'meta' => $outMeta];
        }
    }

    $h = @fopen($fullPath, 'rb');
    if (!$h) return ['title' => (string)$fallbackBasename, 'meta' => []];

    $firstNonEmpty = null;
    $title = null;
    $metaAll = [];
    $foundWant = [];
    $maxLines = 120;
    $inMeta = true;
    $seenMeta = false;
    while ($maxLines-- > 0 && ($line = fgets($h)) !== false) {
        $line = rtrim($line, "\r\n");
        if ($inMeta) {
            $k = null; $v = null;
            if (function_exists('mdw_hidden_meta_match') && mdw_hidden_meta_match($line, $k, $v)) {
                if ($k !== null) {
                    $key = strtolower(trim((string)$k));
                    if ($key !== '') {
                        $metaAll[$key] = (string)$v;
                        if (isset($want[$key])) $foundWant[$key] = true;
                    }
                }
                $seenMeta = true;
                continue;
            }
            if (preg_match('/^\s*(?:_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*|\{+\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*\}+\s*)$/u', $line, $m)) {
                $rawKey = ($m[1] ?? '') !== '' ? $m[1] : ($m[3] ?? '');
                $rawVal = ($m[1] ?? '') !== '' ? ($m[2] ?? '') : ($m[4] ?? '');
                $key = strtolower(trim((string)$rawKey));
                $val = trim((string)$rawVal);
                if ($key !== '') {
                    $metaAll[$key] = $val;
                    if (isset($want[$key])) $foundWant[$key] = true;
                    $seenMeta = true;
                    continue;
                }
            }
            if (!$seenMeta && trim((string)$line) === '') {
                continue;
            }
            $inMeta = false;
        }

        if ($title === null && preg_match('/^#\\s+(.*)$/', $line, $m)) {
            $title = trim((string)($m[1] ?? ''));
        }

        if ($firstNonEmpty === null && trim($line) !== '') {
            $firstNonEmpty = $line;
        }

        if ($title !== null && !$inMeta) {
            if ($wantCount === 0 || count($foundWant) >= $wantCount) {
                break;
            }
        }
    }
    fclose($h);

    $resolvedTitle = null;
    if ($title !== null && $title !== '') {
        $resolvedTitle = $title;
    } else if ($firstNonEmpty !== null) {
        $resolvedTitle = trim($firstNonEmpty);
    } else {
        $fallbackBasename = (string)$fallbackBasename;
        $resolvedTitle = ($fallbackBasename !== '' ? $fallbackBasename : 'Untitled');
    }

    $outMeta = [];
    if (!empty($want)) {
        foreach ($want as $k => $_) {
            if (array_key_exists($k, $metaAll)) {
                $outMeta[$k] = $metaAll[$k];
            }
        }
    }

    if ($cacheKey !== '' && $sig !== null) {
        $state['items'][$cacheKey] = [
            'sig' => $sig,
            'title' => $resolvedTitle,
            'meta' => $metaAll,
            'updated' => time(),
        ];
        $state['dirty'] = true;
    }

    return ['title' => $resolvedTitle, 'meta' => $outMeta];
}

function explorer_view_parse_date_value($value) {
    $value = trim((string)$value);
    if ($value === '') return [null, null, null];
    if (preg_match('/(\d{4})[\\-\\/_\\.](\d{1,2})[\\-\\/_\\.](\d{1,2})/', $value, $m)) {
        return [$m[1], str_pad($m[2], 2, '0', STR_PAD_LEFT), str_pad($m[3], 2, '0', STR_PAD_LEFT)];
    }
    if (preg_match('/(\d{2})[\\-\\/_\\.](\d{1,2})[\\-\\/_\\.](\d{1,2})/', $value, $m)) {
        $year = 2000 + (int)$m[1];
        return [$year, str_pad($m[2], 2, '0', STR_PAD_LEFT), str_pad($m[3], 2, '0', STR_PAD_LEFT)];
    }
    $lower = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
    $lower = trim(str_replace('.', '', $lower));
    $months = [
        'januari' => '01', 'jan' => '01', 'january' => '01',
        'februari' => '02', 'feb' => '02', 'february' => '02',
        'maart' => '03', 'mar' => '03', 'march' => '03',
        'april' => '04', 'apr' => '04',
        'mei' => '05', 'may' => '05',
        'juni' => '06', 'jun' => '06', 'june' => '06',
        'juli' => '07', 'jul' => '07', 'july' => '07',
        'augustus' => '08', 'aug' => '08', 'august' => '08',
        'september' => '09', 'sep' => '09', 'sept' => '09',
        'oktober' => '10', 'okt' => '10', 'oct' => '10', 'october' => '10',
        'november' => '11', 'nov' => '11',
        'december' => '12', 'dec' => '12',
    ];
    if (preg_match('/\b(\d{1,2})\s+([[:alpha:]]+)\s+(\d{4})\b/u', $lower, $m)) {
        $month = $months[$m[2]] ?? null;
        if ($month !== null) return [$m[3], $month, str_pad($m[1], 2, '0', STR_PAD_LEFT)];
    }
    if (preg_match('/\b([[:alpha:]]+)\s+(\d{1,2}),?\s+(\d{4})\b/u', $lower, $m)) {
        $month = $months[$m[1]] ?? null;
        if ($month !== null) return [$m[3], $month, str_pad($m[2], 2, '0', STR_PAD_LEFT)];
    }
    return [null, null, null];
}

function explorer_view_format_date_key_label($year, $month, $day) {
    $y = (int)$year;
    $m = (int)$month;
    $d = (int)$day;
    if ($y <= 0 || $m <= 0 || $d <= 0) return ['', ''];
    $label = sprintf('%04d-%02d-%02d', $y, $m, $d);
    $key = sprintf('%04d%02d%02d', $y, $m, $d);
    return [$key, $label];
}

function explorer_view_entry_date_key_label($rawDate, $yy, $mm, $dd) {
    [$year, $month, $day] = explorer_view_parse_date_value($rawDate);
    if ($year !== null) {
        return explorer_view_format_date_key_label($year, $month, $day);
    }
    if ($yy !== null && $mm !== null && $dd !== null) {
        $year = strlen((string)$yy) === 2 ? (2000 + (int)$yy) : (int)$yy;
        return explorer_view_format_date_key_label($year, $mm, $dd);
    }
    return ['', ''];
}

function explorer_view_plugins_dir($projectDir = null) {
    $projectDir = $projectDir ?: __DIR__;
    if (function_exists('env_path')) {
        return env_path('PLUGINS_DIR', rtrim($projectDir, "/\\") . '/plugins', $projectDir);
    }
    $raw = getenv('PLUGINS_DIR');
    if (!is_string($raw) || trim($raw) === '') return rtrim($projectDir, "/\\") . '/plugins';
    $raw = trim($raw);
    if (str_starts_with($raw, '/') || preg_match('/^[A-Za-z]:[\\\\\\/]/', $raw)) return $raw;
    if (str_starts_with($raw, './')) $raw = substr($raw, 2);
    return rtrim($projectDir, "/\\") . '/' . ltrim($raw, "/\\");
}

function explorer_view_load_plugins($pluginsDir) {
    static $cache = [];
    $pluginsDir = (string)$pluginsDir;
    if (isset($cache[$pluginsDir])) return $cache[$pluginsDir];

    $out = [];
    if (!is_dir($pluginsDir)) {
        $cache[$pluginsDir] = $out;
        return $out;
    }

    $files = glob(rtrim($pluginsDir, "/\\") . '/*.php');
    if (!is_array($files)) $files = [];
    sort($files, SORT_NATURAL | SORT_FLAG_CASE);

    foreach ($files as $file) {
        if (!is_file($file)) continue;
        $plugin = require $file;
        if (!is_array($plugin)) continue;
        if (empty($plugin['id']) || !is_string($plugin['id'])) continue;
        $plugin['__file'] = $file;
        $out[] = $plugin;
    }

    $cache[$pluginsDir] = $out;
    return $out;
}

function explorer_view_plugin_enabled_for_page($plugin, $page) {
    $enabled = $plugin['enabled_pages'] ?? $plugin['enabled_in'] ?? null;
    if ($enabled === null) return $page === 'index';
    if (!is_array($enabled)) return false;
    return in_array($page, $enabled, true);
}

function explorer_view_get_enabled_plugins($opts) {
    $page = $opts['page'] ?? 'index';
    $pluginsEnabled = !array_key_exists('plugins_enabled', $opts) || (bool)$opts['plugins_enabled'];
    if (!$pluginsEnabled) return [];

    $projectDir = $opts['project_dir'] ?? __DIR__;
    $pluginsDir = $opts['plugins_dir'] ?? explorer_view_plugins_dir($projectDir);
    $plugins = explorer_view_load_plugins($pluginsDir);
    $plugins = array_values(array_filter($plugins, fn($p) => explorer_view_plugin_enabled_for_page($p, $page)));

    usort($plugins, function($a, $b) {
        $ao = isset($a['order']) ? (int)$a['order'] : 100;
        $bo = isset($b['order']) ? (int)$b['order'] : 100;
        if ($ao !== $bo) return $ao <=> $bo;
        return strcasecmp((string)$a['id'], (string)$b['id']);
    });

    return $plugins;
}

function explorer_view_collect_plugin_folder_keys($plugins) {
    $keys = [];
    foreach ($plugins as $p) {
        $folderKeys = $p['folder_keys'] ?? [];
        if (!is_array($folderKeys)) continue;
        foreach ($folderKeys as $k) {
            if (!is_string($k) || $k === '') continue;
            $keys[$k] = true;
        }
    }
    return $keys;
}

function explorer_view_render_plugin_hook($hook, $opts) {
    $hook = (string)$hook;
    if ($hook === '') return false;

    $plugins = explorer_view_get_enabled_plugins($opts);
    $ctx = $opts;
    $ctx['escape'] = $ctx['escape'] ?? fn($s) => explorer_view_escape($s);
    $ctx['url_encode_path'] = $ctx['url_encode_path'] ?? fn($p) => explorer_view_url_encode_path($p);
    $ctx['folder_from_path'] = $ctx['folder_from_path'] ?? fn($p) => explorer_view_folder_from_path($p);
    $ctx['extract_md_title_from_file'] = $ctx['extract_md_title_from_file'] ?? fn($full, $fallback) => explorer_view_extract_md_title_from_file($full, $fallback);

    $any = false;
    foreach ($plugins as $plugin) {
        $renderers = $plugin['hooks'] ?? $plugin['render'] ?? null;
        if (!is_array($renderers)) continue;
        $fn = $renderers[$hook] ?? null;
        if (!is_callable($fn)) continue;
        $ctx['plugin'] = $plugin;
        $res = $fn($ctx);
        if ($res === true) $any = true;
    }
    return $any;
}

function explorer_view_render_tree($opts) {
    $page = $opts['page'] ?? 'index'; // 'index' or 'edit'
    $rootList = $opts['rootList'] ?? [];
    $dirMap = $opts['dirMap'] ?? [];
    $secretMap = $opts['secretMap'] ?? [];
    $publisher_mode = !empty($opts['publisher_mode']);
    $folder_filter = $opts['folder_filter'] ?? null;
    $folder_filter = is_string($folder_filter) ? trim($folder_filter) : null;
    if ($folder_filter === '' || $folder_filter === 'root') $folder_filter = null;
    $current_file = $opts['current_file'] ?? null;
    $csrf_token = $opts['csrf_token'] ?? null;
    $show_actions = !empty($opts['show_actions']);
    $show_filter_row = !empty($opts['show_filter_row']);
    $show_filter_reset = !empty($opts['show_filter_reset']);
    $sticky_controls = !empty($opts['sticky_controls']);
    $filter_placeholder = isset($opts['filter_placeholder']) ? trim((string)$opts['filter_placeholder']) : '';
    if ($filter_placeholder === '') $filter_placeholder = explorer_view_t('common.filter_placeholder', 'Filter…');
    $lazy_notes = !empty($opts['lazy_notes']);
    $lazy_endpoint = isset($opts['lazy_endpoint']) ? trim((string)$opts['lazy_endpoint']) : '';
    $lazy_cache_ttl_ms = isset($opts['lazy_cache_ttl_ms']) ? (int)$opts['lazy_cache_ttl_ms'] : 300000;
    if ($lazy_cache_ttl_ms < 0) $lazy_cache_ttl_ms = 0;
    $current_file_path = is_string($current_file) ? trim($current_file) : '';
    $current_folder_path = $current_file_path !== '' ? explorer_view_folder_from_path($current_file_path) : 'root';
    if (!is_string($current_folder_path) || $current_folder_path === '') $current_folder_path = 'root';
    $current_edit_href = 'edit.php';
    if ($current_file_path !== '') {
        $current_edit_href = 'edit.php?file=' . rawurlencode($current_file_path) . '&folder=' . rawurlencode($current_folder_path);
    }
    $has_current_file = ($current_file_path !== '');

    $folderLinkBase = ($page === 'edit') ? 'edit.php' : 'index.php';
    $fileLinkBase = ($page === 'edit') ? 'edit.php' : 'index.php';

    $folderLink = static function($folder) use ($folderLinkBase, $page, $current_file) {
        $folder = trim((string)$folder);
        $anchor = explorer_view_folder_anchor_id($folder);
        $frag = ($page === 'index' && $anchor) ? ('#' . $anchor) : '';
        if ($folder === '' || $folder === 'root') {
            if ($page === 'edit' && $current_file) {
                return $folderLinkBase . '?file=' . rawurlencode($current_file) . $frag;
            }
            return $folderLinkBase . $frag;
        }
        if ($page === 'edit' && $current_file) {
            return $folderLinkBase . '?file=' . rawurlencode($current_file) . '&folder=' . rawurlencode($folder) . $frag;
        }
        return $folderLinkBase . '?folder=' . rawurlencode($folder) . $frag;
    };

    $mdHref = static function($p) use ($fileLinkBase, $page) {
        if ($page === 'edit') {
            return $fileLinkBase . '?file=' . rawurlencode($p);
        }
        return $fileLinkBase . '?file=' . rawurlencode($p) . '&folder=' . rawurlencode(explorer_view_folder_from_path($p)) . '&focus=' . rawurlencode($p);
    };

    $plugins = explorer_view_get_enabled_plugins($opts);
    $pluginFolderKeys = explorer_view_collect_plugin_folder_keys($plugins);

    $allowedPluginFolders = null; // null = all
    if ($folder_filter) {
        if (isset($pluginFolderKeys[$folder_filter])) {
            $rootList = [];
            $dirMap = [];
            $allowedPluginFolders = [$folder_filter];
        } else {
            $rootList = [];
            $allowedPluginFolders = [];
            $filtered = [];
            foreach ($dirMap as $dir => $list) {
                if ($dir === $folder_filter || str_starts_with($dir, $folder_filter . '/')) {
                    $filtered[$dir] = $list;
                }
            }
            $dirMap = $filtered;
        }
    }

    $pluginCtx = $opts;
    $pluginCtx['page'] = $page;
    $pluginCtx['folder_filter'] = $folder_filter;
    $pluginCtx['allowed_plugin_folders'] = $allowedPluginFolders;
    $pluginCtx['escape'] = fn($s) => explorer_view_escape($s);
    $pluginCtx['url_encode_path'] = fn($p) => explorer_view_url_encode_path($p);
    $pluginCtx['folder_from_path'] = fn($p) => explorer_view_folder_from_path($p);
    $pluginCtx['extract_md_title_from_file'] = fn($full, $fallback) => explorer_view_extract_md_title_from_file($full, $fallback);
    $pluginCtx['folder_link'] = $folderLink;
    $pluginCtx['folder_anchor_id'] = fn($f) => explorer_view_folder_anchor_id($f);
    $pluginCtx['show_back'] = (bool)$folder_filter;
    if ($folder_filter) {
        $parentFilter = null;
        $slashPos = strrpos($folder_filter, '/');
        if ($slashPos !== false) {
            $parentFilter = substr($folder_filter, 0, $slashPos);
            if ($parentFilter === '') $parentFilter = null;
        }
        $basePath = ($page === 'edit' && $current_file) ? 'edit.php' : 'index.php';
        $params = [];
        if ($page === 'edit' && $current_file) {
            $params['file'] = $current_file;
        }
        if ($parentFilter !== null) {
            $params['folder'] = $parentFilter;
        }
        $params['open'] = $folder_filter;
        $params['focus_folder'] = $folder_filter;
        $query = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
        $pluginCtx['back_href'] = $basePath
            . ($query !== '' ? ('?' . $query) : '')
            . '#' . explorer_view_folder_anchor_id($folder_filter);
    } else {
        $pluginCtx['back_href'] = null;
    }

    $backHrefAttr = '';
    if (!empty($pluginCtx['back_href'])) {
        $backHrefAttr = ' data-back-href="' . explorer_view_escape($pluginCtx['back_href']) . '"';
    }
    $lazyAttrs = '';
    if ($lazy_notes) {
        $lazyAttrs .= ' data-lazy-notes="1"';
        if ($lazy_endpoint !== '') {
            $lazyAttrs .= ' data-lazy-endpoint="' . explorer_view_escape($lazy_endpoint) . '"';
        }
        $lazyAttrs .= ' data-lazy-cache-ttl-ms="' . (int)$lazy_cache_ttl_ms . '"';
    }
    if ($publisher_mode && $csrf_token) {
        $lazyAttrs .= ' data-user-visibility-actions="1"';
    }
    if ($show_actions && $csrf_token) {
        $lazyAttrs .= ' data-note-actions="1"';
    }
    $current_folder = $current_file ? explorer_view_folder_from_path($current_file) : null;

    $renderNotes = function($list, $folderPath, $showEmpty = true) use ($publisher_mode, $secretMap, $current_file, $mdHref, $show_actions, $csrf_token, $lazy_notes) {
        $folderPath = trim((string)$folderPath);
        if ($folderPath === '') $folderPath = 'root';
    ?>
        <ul class="notes-list" data-folder-notes="<?=explorer_view_escape($folderPath)?>">
        <?php if (!$lazy_notes): ?>
        <?php foreach($list as $entry):
            $p   = $entry['path'];
            $wantMeta = $publisher_mode
                ? ['publishstate', 'page_title', 'post_date', 'creationdate', 'user_hidden']
                : ['post_date', 'published_date'];
            $info = explorer_view_extract_md_title_and_meta_from_file(
                __DIR__ . '/' . $p,
                $entry['basename'],
                $wantMeta
            );
            $metaTitle = $publisher_mode ? trim((string)($info['meta']['page_title'] ?? '')) : '';
            $t   = $publisher_mode
                ? ($metaTitle !== '' ? $metaTitle : (string)($info['title'] ?? $entry['basename']))
                : (string)($info['title'] ?? $entry['basename']);
            $publishState = null;
            $publishStateLabel = null;
            $publishIcon = '';
            if ($publisher_mode) {
                $rawState = (string)(($info['meta']['publishstate'] ?? '') ?: '');
                $publishState = function_exists('mdw_publisher_normalize_publishstate')
                    ? mdw_publisher_normalize_publishstate($rawState)
                    : ($rawState !== '' ? $rawState : 'Concept');
                if ($publishState === '') $publishState = 'Concept';
                $publishStateLabel = $publishState;
            }
            $rawDate = trim((string)($info['meta']['post_date'] ?? ''));
            if ($publisher_mode) {
                if ($rawDate === '') $rawDate = trim((string)($info['meta']['creationdate'] ?? ''));
            } else {
                $publishedDate = trim((string)($info['meta']['published_date'] ?? ''));
                if ($publishedDate !== '') $rawDate = $publishedDate;
            }
            [$dateKey, $dateLabel] = explorer_view_entry_date_key_label(
                $rawDate,
                $entry['yy'] ?? null,
                $entry['mm'] ?? null,
                $entry['dd'] ?? null
            );
            $isSecret = isset($secretMap[$p]);
            $isUserHidden = mdw_hidden_meta_is_truthy($info['meta']['user_hidden'] ?? '');
            $isCurrent = ($current_file !== null && $current_file === $p);
            $publishClass = '';
            if ($publisher_mode) {
                $s = strtolower((string)$publishState);
                if ($s === 'published') {
                    $publishClass = 'publish-published';
                    $publishIcon = 'pi-checkedcertificate';
                    $publishStateLabel = explorer_view_t('edit.publish_state.published', 'Published');
                } else if (
                    $s === 'processing'
                    || $s === 'to publish' || $s === 'topublish' || $s === 'to-publish'
                    || $s === 'to delete' || $s === 'todelete' || $s === 'to-delete'
                ) {
                    $publishClass = 'publish-processing';
                    $publishIcon = 'pi-certificate';
                    $publishStateLabel = explorer_view_t('edit.publish_state.processing', 'Processing');
                } else {
                    $publishClass = 'publish-concept';
                    $publishIcon = 'pi-lightbulb';
                    $publishStateLabel = explorer_view_t('edit.publish_state.concept', 'Concept');
                }
            }
        ?>
        <li class="note-item doclink note-row <?= $isCurrent ? 'nav-item-current' : '' ?>" data-kind="md" data-file="<?=explorer_view_escape($p)?>" data-secret="<?= $isSecret ? 'true' : 'false' ?>" data-user-hidden="<?= $isUserHidden ? 'true' : 'false' ?>" data-title="<?=explorer_view_escape($t)?>" data-slug="<?=explorer_view_escape($entry['basename'])?>" data-date="<?=explorer_view_escape($dateKey)?>" data-publish-state="<?=explorer_view_escape($publisher_mode ? strtolower((string)$publishState) : '')?>">
            <a href="<?=explorer_view_escape($mdHref($p))?>" class="note-link note-link-main kbd-item <?= $isCurrent ? 'active' : '' ?>" draggable="true">
                <span class="note-leading">
                    <span class="note-caret-spacer" aria-hidden="true"></span>
                    <span class="note-icon pi <?= $isCurrent ? 'pi-documentlabel' : 'pi-document' ?>" aria-hidden="true"></span>
                </span>
                <span class="note-text">
                    <span class="note-title">
                        <span><?=explorer_view_escape($t)?></span>
                    </span>
                    <span class="nav-item-path">
                        <span class="nav-item-slug"><?=explorer_view_escape($p)?></span>
                        <?php if ($dateLabel !== ''): ?>
                            <span class="nav-item-date"><?=explorer_view_escape($dateLabel)?></span>
                        <?php endif; ?>
                    </span>
                </span>
            </a>
            <?php if ($publisher_mode || $isSecret): ?>
            <span class="note-badges">
                <?php if ($publisher_mode): ?>
                    <span class="badge-publish <?=explorer_view_escape($publishClass)?>">
                        <?php if ($publishIcon !== ''): ?>
                            <span class="pi <?=explorer_view_escape($publishIcon)?>" aria-hidden="true"></span>
                        <?php endif; ?>
                        <span><?=explorer_view_escape($publishStateLabel ?? $publishState ?? '')?></span>
                    </span>
                <?php endif; ?>
                <?php if ($isSecret): ?>
                    <span class="badge-secret"><?=explorer_view_escape(explorer_view_t('common.secret','secret'))?></span>
                <?php endif; ?>
            </span>
            <?php endif; ?>
            <?php if ($show_actions && $csrf_token): ?>
            <div class="note-actions">
                <a href="edit.php?file=<?=rawurlencode($p)?>&folder=<?=rawurlencode(explorer_view_folder_from_path($p))?>" class="btn btn-ghost icon-button" title="<?=explorer_view_escape(explorer_view_t('common.edit','Edit'))?>">
                    <span class="pi pi-edit"></span>
                </a>
                <form method="post" class="deleteForm" data-file="<?=explorer_view_escape($p)?>">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="file" value="<?=explorer_view_escape($p)?>">
                    <input type="hidden" name="csrf" value="<?=explorer_view_escape($csrf_token)?>">
                    <button type="submit" class="btn btn-ghost icon-button" title="<?=explorer_view_escape(explorer_view_t('common.delete','Delete'))?>">
                        <span class="pi pi-bin"></span>
                    </button>
                </form>
            </div>
            <?php endif; ?>
        </li>
        <?php endforeach; ?>
        <?php endif; ?>
        <?php if ($lazy_notes): ?>
            <li class="nav-empty nav-lazy-placeholder" hidden><?=explorer_view_escape(explorer_view_t('common.loading','Loading…'))?></li>
        <?php endif; ?>
        <?php if (empty($list) && $showEmpty): ?>
            <li class="nav-empty"><?=explorer_view_escape(explorer_view_t('nav.no_notes_yet','No notes yet.'))?></li>
        <?php endif; ?>
        </ul>
    <?php
    };

    $dirTree = [];
    foreach ($dirMap as $dirname => $list) {
        if (!is_string($dirname) || $dirname === '') continue;
        $parts = explode('/', $dirname, 2);
        $parent = $parts[0];
        if ($parent === '') continue;
        if (!isset($dirTree[$parent])) {
            $dirTree[$parent] = [
                'path' => $parent,
                'label' => $parent,
                'list' => [],
                'children' => [],
            ];
        }
        if (count($parts) === 1) {
            $dirTree[$parent]['list'] = $list;
        } else {
            $childName = $parts[1];
            if ($childName === '') continue;
            $childPath = $parent . '/' . $childName;
            $dirTree[$parent]['children'][$childPath] = [
                'path' => $childPath,
                'label' => $childName,
                'list' => $list,
                'children' => [],
            ];
        }
    }
    if (!empty($dirTree)) {
        ksort($dirTree, SORT_NATURAL | SORT_FLAG_CASE);
        foreach ($dirTree as &$node) {
            if (!empty($node['children'])) {
                ksort($node['children'], SORT_NATURAL | SORT_FLAG_CASE);
            }
        }
        unset($node);
    }

    $renderFolder = function($node, $depth = 0) use (&$renderFolder, $folder_filter, $current_folder, $folderLink, $renderNotes, $pluginCtx, $show_actions, $csrf_token) {
        $dirname = $node['path'] ?? '';
        if ($dirname === '') return;
        $label = $node['label'] ?? $dirname;
        $list = $node['list'] ?? [];
        $children = $node['children'] ?? [];
        if (!empty($children)) {
            uasort($children, function($a, $b) {
                return strnatcasecmp((string)($a['label'] ?? ''), (string)($b['label'] ?? ''));
            });
        }
        $hasChildren = !empty($children);
        $dir_children_id = 'folder-children-' . substr(sha1('md:' . $dirname), 0, 10);
        $defaultOpen = ($folder_filter !== null && ($folder_filter === $dirname || str_starts_with($folder_filter, $dirname . '/')))
            || ($current_folder && ($current_folder === $dirname || str_starts_with($current_folder, $dirname . '/')));
        $sectionClass = 'nav-section' . ($depth > 0 ? ' nested-folder' : '');
        $isFocusedRoot = ($depth === 0 && $folder_filter && ($folder_filter === $dirname || str_starts_with($folder_filter, $dirname . '/')));
    ?>
	    <section id="<?=explorer_view_escape(explorer_view_folder_anchor_id($dirname))?>" class="<?=explorer_view_escape($sectionClass)?>" data-folder-section="<?=explorer_view_escape($dirname)?>" data-depth="<?= (int)$depth ?>" data-default-open="<?= $defaultOpen ? '1' : '0' ?>">
        <h2 class="note-group-title">
            <?php if ($folder_filter && $depth === 0 && isset($pluginCtx['back_href']) && $pluginCtx['back_href']): ?>
                <a class="icon-button folder-back" href="<?=explorer_view_escape($pluginCtx['back_href'])?>" title="<?=explorer_view_escape(explorer_view_t('common.back','Back'))?>">
                    <span class="pi pi-leftcaret"></span>
                </a>
            <?php endif; ?>
            <button type="button" class="icon-button folder-toggle" aria-expanded="<?= $defaultOpen ? 'true' : 'false' ?>" aria-controls="<?=explorer_view_escape($dir_children_id)?>" title="<?= $defaultOpen ? explorer_view_escape(explorer_view_t('nav.collapse_folder','Collapse folder')) : explorer_view_escape(explorer_view_t('nav.expand_folder','Expand folder')) ?>">
                <?php if (!$isFocusedRoot): ?>
                <span class="pi <?= $defaultOpen ? 'pi-downcaret' : 'pi-rightcaret' ?> folder-caret"></span>
                <?php endif; ?>
                <span class="pi <?= $defaultOpen ? 'pi-openfolder' : 'pi-folder' ?> folder-icon<?= $isFocusedRoot ? ' folder-icon-focused' : '' ?>"></span>
            </button>
            <a class="breadcrumb-link" href="<?=explorer_view_escape($folderLink($dirname))?>"><?=explorer_view_escape($label)?></a>
            <?php if ($show_actions && $csrf_token): ?>
            <div class="note-actions folder-actions" data-auth-superuser="1">
                <form method="post" class="renameFolderForm" data-folder="<?=explorer_view_escape($dirname)?>">
                    <input type="hidden" name="action" value="rename_folder">
                    <input type="hidden" name="folder" value="<?=explorer_view_escape($dirname)?>">
                    <input type="hidden" name="new_folder" value="">
                    <input type="hidden" name="csrf" value="<?=explorer_view_escape($csrf_token)?>">
                    <button type="button" class="btn btn-ghost icon-button folder-rename-btn" title="<?=explorer_view_escape(explorer_view_t('common.rename','Rename'))?>">
                        <span class="pi pi-edit"></span>
                    </button>
                </form>
                <form method="post" class="deleteFolderForm" data-folder="<?=explorer_view_escape($dirname)?>">
                    <input type="hidden" name="action" value="delete_folder">
                    <input type="hidden" name="folder" value="<?=explorer_view_escape($dirname)?>">
                    <input type="hidden" name="csrf" value="<?=explorer_view_escape($csrf_token)?>">
                    <button type="submit" class="btn btn-ghost icon-button" title="<?=explorer_view_escape(explorer_view_t('common.delete','Delete'))?>">
                        <span class="pi pi-bin"></span>
                    </button>
                </form>
            </div>
            <?php endif; ?>
        </h2>

    <div id="<?=explorer_view_escape($dir_children_id)?>" class="folder-children" <?= $defaultOpen ? '' : 'hidden' ?>>
        <?php $renderNotes($list, $dirname, !$hasChildren); ?>
        <?php if ($hasChildren): ?>
        <div class="folder-tree">
            <?php foreach ($children as $child): ?>
                <?php $renderFolder($child, $depth + 1); ?>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </div>
    </section>
    <?php
    };

    $contentListClass = 'content-list';
    if ($sticky_controls) $contentListClass .= ' content-list-sticky-controls';
    ?>
    <div id="contentList" class="<?=explorer_view_escape($contentListClass)?>"<?=$backHrefAttr?><?=$lazyAttrs?>>
    <div class="nav-controls-stack<?= $sticky_controls ? ' is-sticky' : '' ?>">
        <div class="nav-toolbar-row">
            <div class="nav-sort-row">
                <span class="nav-sort-label"><?=explorer_view_escape(explorer_view_t('nav.sort_label','Sort'))?></span>
                <select id="navSortSelect" class="input nav-sort-select" aria-label="<?=explorer_view_escape(explorer_view_t('nav.sort_label','Sort'))?>">
                    <option value="date"><?=explorer_view_escape(explorer_view_t('nav.sort_date','Date'))?></option>
                    <option value="title"><?=explorer_view_escape(explorer_view_t('nav.sort_title','Title'))?></option>
                    <option value="slug"><?=explorer_view_escape(explorer_view_t('nav.sort_slug','Filename'))?></option>
                </select>
            </div>

            <?php if ($page === 'index' || $page === 'edit'): ?>
            <div class="nav-file-actions nav-file-actions-right nav-toolbar-actions">
                <button id="newMdToggle" type="button" class="btn btn-ghost btn-small" title="<?=explorer_view_escape(explorer_view_t('index.new_markdown.toggle_title','Create a new Markdown file'))?>" aria-label="<?=explorer_view_escape(explorer_view_t('index.new_markdown.toggle_title','Create a new Markdown file'))?>">+<span class="pi pi-documentlabel"></span></button>
                <?php if ($csrf_token): ?>
                <button id="newFolderBtn" type="button" class="btn btn-ghost btn-small" title="<?=explorer_view_escape(explorer_view_t('index.new_folder_title','Create a new folder'))?>" aria-label="<?=explorer_view_escape(explorer_view_t('index.new_folder_title','Create a new folder'))?>" data-auth-superuser="1">
                    <span class="pi pi-folder"></span>
                    <span>+</span>
                </button>
                <?php endif; ?>

                <?php if ($page === 'index'): ?>
                <a id="explorerEditBtn" href="<?=explorer_view_escape($current_edit_href)?>" class="btn btn-ghost btn-small<?= $has_current_file ? '' : ' is-disabled' ?>" title="<?=explorer_view_escape(explorer_view_t('common.edit','Edit'))?>" aria-label="<?=explorer_view_escape(explorer_view_t('common.edit','Edit'))?>" data-base-href="edit.php" <?= $has_current_file ? '' : 'aria-disabled="true" tabindex="-1"' ?>>
                    <span class="pi pi-edit"></span>
                    <span class="btn-label"><?=explorer_view_escape(explorer_view_t('common.edit','Edit'))?></span>
                </a>
                <?php if ($csrf_token): ?>
                <form method="post" action="index.php" id="explorerDeleteForm" class="deleteForm" data-file="<?=explorer_view_escape($current_file_path)?>">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="file" id="explorerDeleteFileInput" value="<?=explorer_view_escape($current_file_path)?>">
                    <input type="hidden" name="csrf" value="<?=explorer_view_escape($csrf_token)?>">
                <button type="submit" class="btn btn-ghost btn-small" title="<?=explorer_view_escape(explorer_view_t('common.delete','Delete'))?>" aria-label="<?=explorer_view_escape(explorer_view_t('common.delete','Delete'))?>" <?= $has_current_file ? '' : 'disabled' ?>>
                        <span class="pi pi-bin"></span>
                        <span class="btn-label"><?=explorer_view_escape(explorer_view_t('common.delete','Delete'))?></span>
                    </button>
                </form>
                <?php endif; ?>
                <?php else: ?>
                <button type="button" id="renameFileBtn" class="btn btn-ghost btn-small" title="<?=explorer_view_escape(explorer_view_t('common.rename','Rename'))?>" aria-label="<?=explorer_view_escape(explorer_view_t('common.rename','Rename'))?>" data-auth-superuser="1" <?= $has_current_file ? '' : 'disabled' ?>>
                    <span class="pi pi-edit"></span>
                    <span class="btn-label"><?=explorer_view_escape(explorer_view_t('edit.toolbar.rename','Rename'))?></span>
                </button>
                <?php if ($csrf_token): ?>
                <form method="post" action="index.php" id="deleteForm" class="deleteForm" data-file="<?=explorer_view_escape($current_file_path)?>" data-auth-superuser="1">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="file" id="deleteFileInput" value="<?=explorer_view_escape($current_file_path)?>">
                    <input type="hidden" name="csrf" value="<?=explorer_view_escape($csrf_token)?>">
                    <button type="submit" class="btn btn-ghost btn-small" title="<?=explorer_view_escape(explorer_view_t('common.delete','Delete'))?>" aria-label="<?=explorer_view_escape(explorer_view_t('common.delete','Delete'))?>" <?= $has_current_file ? '' : 'disabled' ?>>
                        <span class="pi pi-bin"></span>
                        <span class="btn-label"><?=explorer_view_escape(explorer_view_t('edit.toolbar.delete','Delete'))?></span>
                    </button>
                </form>
                <?php endif; ?>
                <?php endif; ?>
            </div>
            <?php endif; ?>
        </div>

        <?php if ($show_filter_row): ?>
        <div class="nav-filter-row">
            <input id="filterInput" class="input" type="text" placeholder="<?=explorer_view_escape($filter_placeholder)?>">
            <?php if ($show_filter_reset): ?>
            <button id="filterClear" type="button" class="btn btn-ghost icon-button" title="<?=explorer_view_escape(explorer_view_t('index.filter_clear','Clear filter'))?>" aria-label="<?=explorer_view_escape(explorer_view_t('index.filter_clear','Clear filter'))?>" style="display:none;">
                <span class="pi pi-cross"></span>
            </button>
            <button id="filterReset" type="button" class="btn btn-ghost btn-small filter-reset"><?=explorer_view_escape(explorer_view_t('common.reset','Reset'))?></button>
            <?php endif; ?>
        </div>
        <?php endif; ?>
    </div>

    <!-- Root files -->
    <?php if (!empty($rootList)): ?>
    <?php
        $root_children_id = 'folder-children-' . substr(sha1('md:root'), 0, 10);
        $root_default_open = $current_file_path !== '' && $current_folder === 'root';
    ?>
	    <section id="<?=explorer_view_escape(explorer_view_folder_anchor_id('root'))?>" class="nav-section" data-folder-section="root" data-default-open="<?= $root_default_open ? '1' : '0' ?>">
        <h2 class="note-group-title">
            <?php if ($folder_filter && isset($pluginCtx['back_href']) && $pluginCtx['back_href']): ?>
                <a class="icon-button folder-back" href="<?=explorer_view_escape($pluginCtx['back_href'])?>" title="<?=explorer_view_escape(explorer_view_t('common.back','Back'))?>">
                    <span class="pi pi-leftcaret"></span>
                </a>
            <?php endif; ?>
            <button type="button" class="icon-button folder-toggle" aria-expanded="<?= $root_default_open ? 'true' : 'false' ?>" aria-controls="<?=explorer_view_escape($root_children_id)?>" title="<?= $root_default_open ? explorer_view_escape(explorer_view_t('nav.collapse_folder','Collapse folder')) : explorer_view_escape(explorer_view_t('nav.expand_folder','Expand folder')) ?>">
                <span class="pi <?= $root_default_open ? 'pi-downcaret' : 'pi-rightcaret' ?> folder-caret"></span>
                <span class="pi <?= $root_default_open ? 'pi-openfolder' : 'pi-folder' ?> folder-icon"></span>
            </button>
            <a class="breadcrumb-link" href="<?=explorer_view_escape($folderLink('root'))?>">/</a>
        </h2>
    <div id="<?=explorer_view_escape($root_children_id)?>" class="folder-children" <?= $root_default_open ? '' : 'hidden' ?>>
        <?php $renderNotes($rootList, 'root', true); ?>
    </div>
    </section>
    <?php endif; ?>

    <?php
        $anyPluginFoldersRendered = explorer_view_render_plugin_hook('folders', $pluginCtx);
    ?>

    <!-- Subdirectory groups -->
    <?php foreach($dirTree as $node): ?>
        <?php $renderFolder($node, 0); ?>
    <?php endforeach; ?>

    <?php if (empty($rootList) && empty($dirMap) && empty($anyPluginFoldersRendered)): ?>
    <div class="nav-empty"><?=explorer_view_escape(explorer_view_t('nav.nothing_here_yet','Nothing here yet.'))?></div>
    <?php endif; ?>

    </div><!-- /contentList -->
    <?php
}
