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
    $want = [];
    if (is_array($wantMetaKeys)) {
        foreach ($wantMetaKeys as $k) {
            if (!is_string($k) || $k === '') continue;
            $want[strtolower($k)] = true;
        }
    }

    if (!is_string($fullPath) || $fullPath === '' || !is_file($fullPath)) {
        return ['title' => (string)$fallbackBasename, 'meta' => []];
    }
    $h = @fopen($fullPath, 'rb');
    if (!$h) return ['title' => (string)$fallbackBasename, 'meta' => []];

    $firstNonEmpty = null;
    $title = null;
    $meta = [];
    $maxLines = 260;
    $inMeta = true;
    $seenMeta = false;
    while ($maxLines-- > 0 && ($line = fgets($h)) !== false) {
        $line = rtrim($line, "\r\n");
        if ($inMeta) {
            $k = null; $v = null;
            if (function_exists('mdw_hidden_meta_match') && mdw_hidden_meta_match($line, $k, $v)) {
                if ($k !== null && isset($want[$k])) {
                    $meta[$k] = $v;
                }
                $seenMeta = true;
                continue;
            }
            if (!empty($want)) {
                if (preg_match('/^\s*(?:_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*|\{+\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*\}+\s*)$/u', $line, $m)) {
                    $key = strtolower(trim((string)($m[1] ?? $m[3] ?? '')));
                    $val = trim((string)($m[2] ?? $m[4] ?? ''));
                    if ($key !== '') {
                        if (isset($want[$key])) {
                            $meta[$key] = $val;
                        }
                        $seenMeta = true;
                        continue;
                    }
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
    }
    fclose($h);

    if ($title !== null && $title !== '') {
        return ['title' => $title, 'meta' => $meta];
    }
    if ($firstNonEmpty !== null) {
        return ['title' => trim($firstNonEmpty), 'meta' => $meta];
    }
    $fallbackBasename = (string)$fallbackBasename;
    return ['title' => ($fallbackBasename !== '' ? $fallbackBasename : 'Untitled'), 'meta' => $meta];
}

function explorer_view_parse_date_value($value) {
    $value = trim((string)$value);
    if ($value === '') return [null, null, null];
    if (preg_match('/(\d{4})[\\-\\/_\\.](\d{2})[\\-\\/_\\.](\d{2})/', $value, $m)) {
        return [$m[1], $m[2], $m[3]];
    }
    if (preg_match('/(\d{2})[\\-\\/_\\.](\d{2})[\\-\\/_\\.](\d{2})/', $value, $m)) {
        $year = 2000 + (int)$m[1];
        return [$year, $m[2], $m[3]];
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
    $current_file = $opts['current_file'] ?? null;
    $csrf_token = $opts['csrf_token'] ?? null;
    $show_actions = !empty($opts['show_actions']);

    $folderLinkBase = ($page === 'edit') ? 'edit.php' : 'index.php';
    $fileLinkBase = ($page === 'edit') ? 'edit.php' : 'index.php';

    $folderLink = static function($folder) use ($folderLinkBase, $page, $current_file) {
        $anchor = explorer_view_folder_anchor_id($folder);
        $frag = ($page === 'index' && $anchor) ? ('#' . $anchor) : '';
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
        if ($folder_filter === 'root') {
            $dirMap = [];
            $allowedPluginFolders = [];
        } else if (isset($pluginFolderKeys[$folder_filter])) {
            $rootList = [];
            $dirMap = [];
            $allowedPluginFolders = [$folder_filter];
        } else {
            $rootList = [];
            $allowedPluginFolders = [];
            $dirMap = isset($dirMap[$folder_filter]) ? [$folder_filter => $dirMap[$folder_filter]] : [];
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
        if ($page === 'edit' && $current_file) {
            $pluginCtx['back_href'] = 'edit.php?file=' . rawurlencode($current_file);
        } else {
            $pluginCtx['back_href'] = 'index.php';
        }
    } else {
        $pluginCtx['back_href'] = null;
    }

    $backHrefAttr = '';
    if (!empty($pluginCtx['back_href'])) {
        $backHrefAttr = ' data-back-href="' . explorer_view_escape($pluginCtx['back_href']) . '"';
    }
    ?>
    <div id="contentList" class="content-list"<?=$backHrefAttr?>>
    <div class="nav-sort-row">
        <span class="nav-sort-label"><?=explorer_view_escape(explorer_view_t('nav.sort_label','Sort'))?></span>
        <select id="navSortSelect" class="input nav-sort-select" aria-label="<?=explorer_view_escape(explorer_view_t('nav.sort_label','Sort'))?>">
            <option value="date"><?=explorer_view_escape(explorer_view_t('nav.sort_date','Date'))?></option>
            <option value="title"><?=explorer_view_escape(explorer_view_t('nav.sort_title','Title'))?></option>
            <option value="slug"><?=explorer_view_escape(explorer_view_t('nav.sort_slug','Filename'))?></option>
        </select>
    </div>

    <!-- Root files -->
    <?php if (!empty($rootList)): ?>
    <?php
        $root_children_id = 'folder-children-' . substr(sha1('md:root'), 0, 10);
        $root_default_open = true;
    ?>
	    <section id="<?=explorer_view_escape(explorer_view_folder_anchor_id('root'))?>" class="nav-section" data-folder-section="root" data-default-open="<?= $root_default_open ? '1' : '0' ?>">
        <h2 class="note-group-title">
            <?php if ($folder_filter && isset($pluginCtx['back_href']) && $pluginCtx['back_href']): ?>
                <a class="icon-button folder-back" href="<?=explorer_view_escape($pluginCtx['back_href'])?>" title="<?=explorer_view_escape(explorer_view_t('common.back','Back'))?>">
                    <span class="pi pi-leftcaret"></span>
                </a>
            <?php endif; ?>
            <button type="button" class="icon-button folder-toggle" aria-expanded="<?= $root_default_open ? 'true' : 'false' ?>" aria-controls="<?=explorer_view_escape($root_children_id)?>" title="<?= $root_default_open ? explorer_view_escape(explorer_view_t('nav.collapse_folder','Collapse folder')) : explorer_view_escape(explorer_view_t('nav.expand_folder','Expand folder')) ?>">
                <span class="pi <?= $root_default_open ? 'pi-openfolder' : 'pi-folder' ?>"></span>
            </button>
            <a class="breadcrumb-link" href="<?=explorer_view_escape($folderLink('root'))?>"><?=explorer_view_escape(explorer_view_t('common.root','Root'))?></a>
        </h2>
    <div id="<?=explorer_view_escape($root_children_id)?>" class="folder-children" <?= $root_default_open ? '' : 'hidden' ?>>
    <ul class="notes-list">
    <?php foreach($rootList as $entry):
        $p   = $entry['path'];
        $info = explorer_view_extract_md_title_and_meta_from_file(
            __DIR__ . '/' . $p,
            $entry['basename'],
            ['publishstate', 'page_title', 'post_date', 'published_date']
        );
        $metaTitle = $publisher_mode ? trim((string)($info['meta']['page_title'] ?? '')) : '';
        $t   = $publisher_mode
            ? ($metaTitle !== '' ? $metaTitle : (string)($info['title'] ?? $entry['basename']))
            : (string)($info['title'] ?? $entry['basename']);
        $publishState = null;
        if ($publisher_mode) {
            $rawState = (string)(($info['meta']['publishstate'] ?? '') ?: '');
            $publishState = function_exists('mdw_publisher_normalize_publishstate')
                ? mdw_publisher_normalize_publishstate($rawState)
                : ($rawState !== '' ? $rawState : 'Concept');
            if ($publishState === '') $publishState = 'Concept';
        }
        $rawDate = trim((string)($info['meta']['published_date'] ?? ''));
        if ($rawDate === '') $rawDate = trim((string)($info['meta']['post_date'] ?? ''));
        [$dateKey, $dateLabel] = explorer_view_entry_date_key_label(
            $rawDate,
            $entry['yy'] ?? null,
            $entry['mm'] ?? null,
            $entry['dd'] ?? null
        );
        $isSecret = isset($secretMap[$p]);
        $isCurrent = ($current_file !== null && $current_file === $p);
        $publishClass = '';
        if ($publisher_mode) {
            $s = strtolower((string)$publishState);
            if ($s === 'published') $publishClass = 'publish-published';
            else if ($s === 'processing' || $s === 'to publish') $publishClass = 'publish-processing';
            else $publishClass = 'publish-concept';
        }
    ?>
    <li class="note-item doclink note-row <?= $isCurrent ? 'nav-item-current' : '' ?>" data-kind="md" data-file="<?=explorer_view_escape($p)?>" data-secret="<?= $isSecret ? 'true' : 'false' ?>" data-title="<?=explorer_view_escape($t)?>" data-slug="<?=explorer_view_escape($entry['basename'])?>" data-date="<?=explorer_view_escape($dateKey)?>">
        <a href="<?=explorer_view_escape($mdHref($p))?>" class="note-link note-link-main kbd-item <?= $isCurrent ? 'active' : '' ?>">
            <div class="note-title" style="justify-content: space-between;">
                <span><?=explorer_view_escape($t)?></span>
                <span class="note-badges" style="display:inline-flex; align-items:center; gap:0.35rem;">
                    <?php if ($publisher_mode): ?>
                        <span class="badge-publish <?=explorer_view_escape($publishClass)?>"><?=explorer_view_escape($publishState)?></span>
                    <?php endif; ?>
                    <?php if ($isSecret): ?>
                        <span class="badge-secret"><?=explorer_view_escape(explorer_view_t('common.secret','secret'))?></span>
                    <?php endif; ?>
                </span>
            </div>
            <div class="nav-item-path">
                <span class="nav-item-slug"><?=explorer_view_escape($p)?></span>
                <?php if ($dateLabel !== ''): ?>
                    <span class="nav-item-date"><?=explorer_view_escape($dateLabel)?></span>
                <?php endif; ?>
            </div>
        </a>
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
    </ul>
    </div>
    </section>
    <?php endif; ?>

    <?php
        $anyPluginFoldersRendered = explorer_view_render_plugin_hook('folders', $pluginCtx);
    ?>

    <!-- Subdirectory groups -->
    <?php foreach($dirMap as $dirname=>$list): ?>
    <?php
        $dir_children_id = 'folder-children-' . substr(sha1('md:' . $dirname), 0, 10);
        $dir_default_open = ($folder_filter !== null && $folder_filter === $dirname)
            || ($current_file && explorer_view_folder_from_path($current_file) === $dirname);
    ?>
	    <section id="<?=explorer_view_escape(explorer_view_folder_anchor_id($dirname))?>" class="nav-section" data-folder-section="<?=explorer_view_escape($dirname)?>" data-default-open="<?= $dir_default_open ? '1' : '0' ?>">
        <h2 class="note-group-title">
            <?php if ($folder_filter && isset($pluginCtx['back_href']) && $pluginCtx['back_href']): ?>
                <a class="icon-button folder-back" href="<?=explorer_view_escape($pluginCtx['back_href'])?>" title="<?=explorer_view_escape(explorer_view_t('common.back','Back'))?>">
                    <span class="pi pi-leftcaret"></span>
                </a>
            <?php endif; ?>
            <button type="button" class="icon-button folder-toggle" aria-expanded="<?= $dir_default_open ? 'true' : 'false' ?>" aria-controls="<?=explorer_view_escape($dir_children_id)?>" title="<?= $dir_default_open ? explorer_view_escape(explorer_view_t('nav.collapse_folder','Collapse folder')) : explorer_view_escape(explorer_view_t('nav.expand_folder','Expand folder')) ?>">
                <span class="pi <?= $dir_default_open ? 'pi-openfolder' : 'pi-folder' ?>"></span>
            </button>
            <a class="breadcrumb-link" href="<?=explorer_view_escape($folderLink($dirname))?>"><?=explorer_view_escape($dirname)?></a>
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

    <div id="<?=explorer_view_escape($dir_children_id)?>" class="folder-children" <?= $dir_default_open ? '' : 'hidden' ?>>
    <ul class="notes-list">
    <?php foreach($list as $entry):
        $p   = $entry['path'];
        $info = explorer_view_extract_md_title_and_meta_from_file(
            __DIR__ . '/' . $p,
            $entry['basename'],
            ['publishstate', 'page_title', 'post_date', 'published_date']
        );
        $metaTitle = $publisher_mode ? trim((string)($info['meta']['page_title'] ?? '')) : '';
        $t   = $publisher_mode
            ? ($metaTitle !== '' ? $metaTitle : (string)($info['title'] ?? $entry['basename']))
            : (string)($info['title'] ?? $entry['basename']);
        $publishState = null;
        if ($publisher_mode) {
            $rawState = (string)(($info['meta']['publishstate'] ?? '') ?: '');
            $publishState = function_exists('mdw_publisher_normalize_publishstate')
                ? mdw_publisher_normalize_publishstate($rawState)
                : ($rawState !== '' ? $rawState : 'Concept');
            if ($publishState === '') $publishState = 'Concept';
        }
        $rawDate = trim((string)($info['meta']['published_date'] ?? ''));
        if ($rawDate === '') $rawDate = trim((string)($info['meta']['post_date'] ?? ''));
        [$dateKey, $dateLabel] = explorer_view_entry_date_key_label(
            $rawDate,
            $entry['yy'] ?? null,
            $entry['mm'] ?? null,
            $entry['dd'] ?? null
        );
        $isSecret = isset($secretMap[$p]);
        $isCurrent = ($current_file !== null && $current_file === $p);
        $publishClass = '';
        if ($publisher_mode) {
            $s = strtolower((string)$publishState);
            if ($s === 'published') $publishClass = 'publish-published';
            else if ($s === 'processing' || $s === 'to publish') $publishClass = 'publish-processing';
            else $publishClass = 'publish-concept';
        }
    ?>
    <li class="note-item doclink note-row <?= $isCurrent ? 'nav-item-current' : '' ?>" data-kind="md" data-file="<?=explorer_view_escape($p)?>" data-secret="<?= $isSecret ? 'true' : 'false' ?>" data-title="<?=explorer_view_escape($t)?>" data-slug="<?=explorer_view_escape($entry['basename'])?>" data-date="<?=explorer_view_escape($dateKey)?>">
        <a href="<?=explorer_view_escape($mdHref($p))?>" class="note-link note-link-main kbd-item <?= $isCurrent ? 'active' : '' ?>">
            <div class="note-title" style="justify-content: space-between;">
                <span><?=explorer_view_escape($t)?></span>
                <span class="note-badges" style="display:inline-flex; align-items:center; gap:0.35rem;">
                    <?php if ($publisher_mode): ?>
                        <span class="badge-publish <?=explorer_view_escape($publishClass)?>"><?=explorer_view_escape($publishState)?></span>
                    <?php endif; ?>
                    <?php if ($isSecret): ?>
                        <span class="badge-secret"><?=explorer_view_escape(explorer_view_t('common.secret','secret'))?></span>
                    <?php endif; ?>
                </span>
            </div>
            <div class="nav-item-path">
                <span class="nav-item-slug"><?=explorer_view_escape($p)?></span>
                <?php if ($dateLabel !== ''): ?>
                    <span class="nav-item-date"><?=explorer_view_escape($dateLabel)?></span>
                <?php endif; ?>
            </div>
        </a>
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
    <?php if (empty($list)): ?>
        <li class="nav-empty"><?=explorer_view_escape(explorer_view_t('nav.no_notes_yet','No notes yet.'))?></li>
    <?php endif; ?>
    </ul>
    </div>
    </section>
    <?php endforeach; ?>

    <?php if (empty($rootList) && empty($dirMap) && empty($anyPluginFoldersRendered)): ?>
    <div class="nav-empty"><?=explorer_view_escape(explorer_view_t('nav.nothing_here_yet','Nothing here yet.'))?></div>
    <?php endif; ?>

    </div><!-- /contentList -->
    <?php
}
