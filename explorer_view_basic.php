<?php

/**
 * Basic explorer (no-JS): server-rendered nested folders/files for old browsers.
 */

function explorer_view_basic_escape($s) {
    if (function_exists('explorer_view_escape')) return explorer_view_escape($s);
    if (function_exists('h')) return h($s);
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function explorer_view_basic_t($key, $fallback = '') {
    if (function_exists('explorer_view_t')) return explorer_view_t($key, $fallback);
    if (function_exists('mdw_t')) return mdw_t($key, $fallback);
    return is_string($fallback) ? $fallback : '';
}

function explorer_view_basic_render_tree($opts) {
    $page = $opts['page'] ?? 'index'; // 'index' or 'edit'
    $rootList = isset($opts['rootList']) && is_array($opts['rootList']) ? $opts['rootList'] : [];
    $dirMap = isset($opts['dirMap']) && is_array($opts['dirMap']) ? $opts['dirMap'] : [];
    $existingFolders = isset($opts['existing_folders']) && is_array($opts['existing_folders']) ? $opts['existing_folders'] : [];
    $secretMap = isset($opts['secretMap']) && is_array($opts['secretMap']) ? $opts['secretMap'] : [];
    $publisher_mode = !empty($opts['publisher_mode']);
    $show_actions = !empty($opts['show_actions']);
    $csrf_token = isset($opts['csrf_token']) ? (string)$opts['csrf_token'] : '';
    $basic_mode = !empty($opts['basic_mode']);
    $current_file = isset($opts['current_file']) ? trim((string)$opts['current_file']) : '';
    $folder_filter = isset($opts['folder_filter']) ? trim((string)$opts['folder_filter']) : '';
    if ($folder_filter === '' || $folder_filter === 'root') $folder_filter = null;
    $current_folder = $current_file !== ''
        ? (function_exists('explorer_view_folder_from_path') ? explorer_view_folder_from_path($current_file) : dirname($current_file))
        : null;
    if (!is_string($current_folder) || $current_folder === '') $current_folder = 'root';

    $baseParams = [];
    if ($basic_mode) {
        $baseParams['basic'] = '1';
    }

    $makeHref = static function($base, $params = []) use ($baseParams) {
        $merged = $baseParams;
        foreach ($params as $k => $v) {
            if ($v === null) continue;
            $merged[$k] = $v;
        }
        $q = http_build_query($merged, '', '&', PHP_QUERY_RFC3986);
        return $base . ($q !== '' ? ('?' . $q) : '');
    };

    $folderHref = static function($folder) use ($page, $current_file, $makeHref) {
        $folder = trim((string)$folder);
        if ($page === 'edit') {
            $params = [];
            if ($current_file !== '') $params['file'] = $current_file;
            if ($folder !== '' && $folder !== 'root') $params['folder'] = $folder;
            return $makeHref('edit.php', $params);
        }
        if ($folder === '' || $folder === 'root') return $makeHref('index.php', []);
        return $makeHref('index.php', ['folder' => $folder]);
    };

    $mdHref = static function($path) use ($page, $makeHref) {
        $path = (string)$path;
        $folder = function_exists('explorer_view_folder_from_path')
            ? explorer_view_folder_from_path($path)
            : dirname($path);
        if (!is_string($folder) || $folder === '' || $folder === '.') $folder = 'root';
        if ($page === 'edit') {
            return $makeHref('edit.php', ['file' => $path, 'folder' => $folder]);
        }
        return $makeHref('index.php', ['file' => $path, 'folder' => $folder, 'focus' => $path]);
    };

    $nodes = [
        'root' => [
            'path' => 'root',
            'label' => '/',
            'files' => $rootList,
            'children' => [],
        ],
    ];

    $ensureNode = static function($path, $label = null) use (&$nodes) {
        if (!isset($nodes[$path])) {
            $defaultLabel = ($path === 'root') ? '/' : basename((string)$path);
            $nodes[$path] = [
                'path' => $path,
                'label' => ($label !== null && $label !== '') ? $label : $defaultLabel,
                'files' => [],
                'children' => [],
            ];
        } else if ($label !== null && $label !== '') {
            $nodes[$path]['label'] = $label;
        }
    };

    $ensurePath = static function($folderPath) use (&$nodes, $ensureNode) {
        $folderPath = trim(str_replace("\\", '/', (string)$folderPath), '/');
        if ($folderPath === '' || $folderPath === 'root') return 'root';
        $parts = array_values(array_filter(explode('/', $folderPath), static fn($p) => $p !== ''));
        $parent = 'root';
        foreach ($parts as $part) {
            $path = ($parent === 'root') ? $part : ($parent . '/' . $part);
            $ensureNode($path, $part);
            if (!in_array($path, $nodes[$parent]['children'], true)) {
                $nodes[$parent]['children'][] = $path;
            }
            $parent = $path;
        }
        return $parent;
    };

    foreach ($existingFolders as $folderPath) {
        if (!is_string($folderPath) || trim($folderPath) === '') continue;
        $ensurePath($folderPath);
    }

    foreach ($dirMap as $folderPath => $list) {
        if (!is_string($folderPath) || trim($folderPath) === '') continue;
        $leaf = $ensurePath($folderPath);
        $nodes[$leaf]['files'] = is_array($list) ? array_values($list) : [];
    }

    $sortChildren = static function($path) use (&$sortChildren, &$nodes) {
        if (!isset($nodes[$path])) return;
        if (empty($nodes[$path]['children'])) return;
        usort($nodes[$path]['children'], static function($a, $b) use (&$nodes) {
            $la = (string)($nodes[$a]['label'] ?? basename((string)$a));
            $lb = (string)($nodes[$b]['label'] ?? basename((string)$b));
            return strnatcasecmp($la, $lb);
        });
        foreach ($nodes[$path]['children'] as $childPath) {
            $sortChildren($childPath);
        }
    };
    $sortChildren('root');

    $startPath = 'root';
    if ($folder_filter !== null) {
        $startPath = trim(str_replace("\\", '/', $folder_filter), '/');
        if ($startPath === '' || $startPath === 'root') $startPath = 'root';
    }

    $showBack = ($startPath !== 'root');
    $backHref = null;
    if ($showBack) {
        $parent = null;
        $pos = strrpos($startPath, '/');
        if ($pos !== false) {
            $parent = substr($startPath, 0, $pos);
        }
        if ($parent !== null && $parent !== '') {
            $backHref = $folderHref($parent);
        } else {
            $backHref = $folderHref('root');
        }
    }

    $renderNotes = static function($entries, $activeFilter = null) use (
        $publisher_mode,
        $secretMap,
        $current_file,
        $show_actions,
        $csrf_token,
        $basic_mode,
        $folder_filter,
        $mdHref,
        $makeHref
    ) {
        if (!is_array($entries) || empty($entries)) return;
        foreach ($entries as $entry) {
            if (!is_array($entry)) continue;
            $p = isset($entry['path']) ? trim((string)$entry['path']) : '';
            if ($p === '') continue;
            $basename = isset($entry['basename']) && is_string($entry['basename']) && $entry['basename'] !== ''
                ? $entry['basename']
                : basename($p);
            $wantMeta = $publisher_mode
                ? ['publishstate', 'page_title', 'post_date', 'creationdate']
                : ['post_date', 'published_date'];
            $info = function_exists('explorer_view_extract_md_title_and_meta_from_file')
                ? explorer_view_extract_md_title_and_meta_from_file(__DIR__ . '/' . $p, $basename, $wantMeta)
                : ['title' => $basename, 'meta' => []];

            $metaTitle = $publisher_mode ? trim((string)($info['meta']['page_title'] ?? '')) : '';
            $title = $publisher_mode
                ? ($metaTitle !== '' ? $metaTitle : (string)($info['title'] ?? $basename))
                : (string)($info['title'] ?? $basename);

            $rawDate = trim((string)($info['meta']['post_date'] ?? ''));
            if ($publisher_mode) {
                if ($rawDate === '') $rawDate = trim((string)($info['meta']['creationdate'] ?? ''));
            } else {
                $publishedDate = trim((string)($info['meta']['published_date'] ?? ''));
                if ($publishedDate !== '') $rawDate = $publishedDate;
            }
            if (function_exists('explorer_view_entry_date_key_label')) {
                [, $dateLabel] = explorer_view_entry_date_key_label(
                    $rawDate,
                    $entry['yy'] ?? null,
                    $entry['mm'] ?? null,
                    $entry['dd'] ?? null
                );
            } else {
                $dateLabel = '';
            }

            $publishState = '';
            $publishLabel = '';
            if ($publisher_mode) {
                $rawState = (string)(($info['meta']['publishstate'] ?? '') ?: '');
                $publishState = function_exists('mdw_publisher_normalize_publishstate')
                    ? mdw_publisher_normalize_publishstate($rawState)
                    : ($rawState !== '' ? $rawState : 'Concept');
                if ($publishState === '') $publishState = 'Concept';
                $s = strtolower($publishState);
                if ($s === 'published') {
                    $publishLabel = explorer_view_basic_t('edit.publish_state.published', 'Published');
                } else if (
                    $s === 'processing'
                    || $s === 'to publish' || $s === 'topublish' || $s === 'to-publish'
                    || $s === 'to delete' || $s === 'todelete' || $s === 'to-delete'
                ) {
                    $publishLabel = explorer_view_basic_t('edit.publish_state.processing', 'Processing');
                } else {
                    $publishLabel = explorer_view_basic_t('edit.publish_state.concept', 'Concept');
                }
            }

            $isCurrent = ($current_file !== '' && $current_file === $p);
            $isSecret = isset($secretMap[$p]);
            $folder = function_exists('explorer_view_folder_from_path')
                ? explorer_view_folder_from_path($p)
                : dirname($p);
            if (!is_string($folder) || $folder === '' || $folder === '.') $folder = 'root';
            $editHref = $makeHref('edit.php', ['file' => $p, 'folder' => $folder]);
            ?>
            <li class="basic-note-item<?= $isCurrent ? ' is-current' : '' ?>">
                <a class="basic-note-link" href="<?= explorer_view_basic_escape($mdHref($p)) ?>">
                    <?= explorer_view_basic_escape($title) ?>
                </a>
                <div class="basic-note-meta">
                    <span class="basic-note-path"><?= explorer_view_basic_escape($p) ?></span>
                    <?php if ($dateLabel !== ''): ?>
                        <span class="basic-note-badge"><?= explorer_view_basic_escape($dateLabel) ?></span>
                    <?php endif; ?>
                    <?php if ($publisher_mode && $publishLabel !== ''): ?>
                        <span class="basic-note-badge"><?= explorer_view_basic_escape($publishLabel) ?></span>
                    <?php endif; ?>
                    <?php if ($isSecret): ?>
                        <span class="basic-note-badge"><?= explorer_view_basic_escape(explorer_view_basic_t('common.secret', 'secret')) ?></span>
                    <?php endif; ?>
                </div>
                <?php if ($show_actions && $csrf_token !== ''): ?>
                    <div class="basic-note-actions">
                        <a class="btn btn-ghost btn-small" href="<?= explorer_view_basic_escape($editHref) ?>">
                            <?= explorer_view_basic_escape(explorer_view_basic_t('common.edit', 'Edit')) ?>
                        </a>
                        <form method="post" class="basic-inline-form">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="file" value="<?= explorer_view_basic_escape($p) ?>">
                            <input type="hidden" name="csrf" value="<?= explorer_view_basic_escape($csrf_token) ?>">
                            <?php if ($basic_mode): ?><input type="hidden" name="basic" value="1"><?php endif; ?>
                            <?php if ($activeFilter !== null): ?><input type="hidden" name="return_filter" value="<?= explorer_view_basic_escape($activeFilter) ?>"><?php endif; ?>
                            <?php if ($folder_filter !== null && $activeFilter === null): ?><input type="hidden" name="return_filter" value="<?= explorer_view_basic_escape($folder_filter) ?>"><?php endif; ?>
                            <button type="submit" class="btn btn-ghost btn-small"><?= explorer_view_basic_escape(explorer_view_basic_t('common.delete', 'Delete')) ?></button>
                        </form>
                    </div>
                <?php endif; ?>
            </li>
            <?php
        }
    };

    $renderFolder = static function($nodePath, $depth = 0, $activeFilter = null) use (&$renderFolder, $nodes, $folderHref, $renderNotes, $current_folder) {
        if (!isset($nodes[$nodePath])) return;
        $node = $nodes[$nodePath];
        $path = (string)($node['path'] ?? '');
        if ($path === '') return;
        $label = (string)($node['label'] ?? ($path === 'root' ? '/' : basename($path)));
        $files = isset($node['files']) && is_array($node['files']) ? $node['files'] : [];
        $children = isset($node['children']) && is_array($node['children']) ? $node['children'] : [];
        $isCurrentFolder = ($current_folder === $path)
            || ($current_folder !== 'root' && $path !== 'root' && str_starts_with($current_folder, $path . '/'));
        ?>
        <li class="basic-folder-item depth-<?= (int)$depth ?><?= $isCurrentFolder ? ' is-current-folder' : '' ?>">
            <div class="basic-folder-row">
                <a class="basic-folder-link" href="<?= explorer_view_basic_escape($folderHref($path)) ?>"><?= explorer_view_basic_escape($label) ?></a>
                <?php if ($path !== 'root'): ?>
                    <span class="basic-folder-path"><?= explorer_view_basic_escape($path) ?></span>
                <?php endif; ?>
            </div>
            <?php if (!empty($files) || !empty($children)): ?>
                <ul class="basic-children">
                    <?php $renderNotes($files, $activeFilter); ?>
                    <?php foreach ($children as $childPath): ?>
                        <?php $renderFolder($childPath, $depth + 1, $activeFilter); ?>
                    <?php endforeach; ?>
                </ul>
            <?php else: ?>
                <div class="basic-empty-folder"><?= explorer_view_basic_escape(explorer_view_basic_t('nav.no_notes_yet', 'No notes yet.')) ?></div>
            <?php endif; ?>
        </li>
        <?php
    };

    $hasStartNode = isset($nodes[$startPath]);
    ?>
    <section class="basic-tree-wrap" id="basicTree">
        <div class="basic-tree-toolbar">
            <?php if ($showBack && $backHref): ?>
                <a class="btn btn-ghost btn-small" href="<?= explorer_view_basic_escape($backHref) ?>">
                    <?= explorer_view_basic_escape(explorer_view_basic_t('common.back', 'Back')) ?>
                </a>
            <?php endif; ?>
            <?php if ($folder_filter !== null): ?>
                <span class="basic-tree-filter">
                    <?= explorer_view_basic_escape(explorer_view_basic_t('common.folder', 'Folder')) ?>:
                    <strong><?= explorer_view_basic_escape($folder_filter) ?></strong>
                </span>
            <?php endif; ?>
        </div>

        <?php if ($hasStartNode): ?>
            <ul class="basic-tree-root">
                <?php $renderFolder($startPath, 0, $folder_filter); ?>
            </ul>
        <?php else: ?>
            <div class="basic-empty-folder"><?= explorer_view_basic_escape(explorer_view_basic_t('nav.nothing_here_yet', 'Nothing here yet.')) ?></div>
        <?php endif; ?>
    </section>
    <?php
}
