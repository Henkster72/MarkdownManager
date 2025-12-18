<?php

/**
 * HTML folder plugin.
 * - Exposes `HTML/` as a folder section in the explorer view.
 * - Lists `.html/.htm` recursively.
 * - Title from `<title>` (fallback `<h1>`; fallback filename).
 */

function html_plugin_is_available($dir = 'HTML') {
    $dir = trim((string)$dir);
    if ($dir === '' || strpos($dir, '..') !== false) return false;
    $dir = str_replace("\\", "/", $dir);
    $dir = trim($dir, "/");
    if ($dir === '' || strpos($dir, '/') !== false) return false;

    return is_dir(dirname(__DIR__) . '/' . $dir);
}

function html_plugin_extract_title_from_file($fullPath, $fallbackBasename) {
    if (!is_string($fullPath) || $fullPath === '' || !is_file($fullPath)) return $fallbackBasename;
    $h = @fopen($fullPath, 'rb');
    if (!$h) return $fallbackBasename;

    $buf = '';
    $maxBytes = 64 * 1024;
    while (!feof($h) && strlen($buf) < $maxBytes) {
        $chunk = fread($h, min(8192, $maxBytes - strlen($buf)));
        if ($chunk === false || $chunk === '') break;
        $buf .= $chunk;

        if (stripos($buf, '</title>') !== false || stripos($buf, '</h1>') !== false) {
            break;
        }
    }
    fclose($h);

    if ($buf !== '') {
        if (preg_match('~<title\\b[^>]*>(.*?)</title>~is', $buf, $m)) {
            $title = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            $title = trim(preg_replace('/\\s+/u', ' ', strip_tags($title)));
            if ($title !== '') return $title;
        }

        if (preg_match('~<h1\\b[^>]*>(.*?)</h1>~is', $buf, $m)) {
            $title = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            $title = trim(preg_replace('/\\s+/u', ' ', strip_tags($title)));
            if ($title !== '') return $title;
        }
    }

    $fallbackBasename = (string)$fallbackBasename;
    $fallbackBasename = preg_replace('/\\.(html?|md)$/i', '', $fallbackBasename);
    $fallbackBasename = trim($fallbackBasename);
    return $fallbackBasename !== '' ? $fallbackBasename : 'Untitled';
}

function html_plugin_parse_ymd_from_filename($basename) {
    if (preg_match('/^(\\d{2})-(\\d{2})-(\\d{2})-/', (string)$basename, $m)) {
        return [$m[1], $m[2], $m[3]];
    }
    return [null, null, null];
}

function html_plugin_compare_entries_desc_date($a, $b) {
    $aHas = isset($a['yy']) && $a['yy'] !== null;
    $bHas = isset($b['yy']) && $b['yy'] !== null;

    if ($aHas && $bHas) {
        if ($a['yy'] !== $b['yy']) return strcmp($b['yy'], $a['yy']);
        if ($a['mm'] !== $b['mm']) return strcmp($b['mm'], $a['mm']);
        if ($a['dd'] !== $b['dd']) return strcmp($b['dd'], $a['dd']);
        return strcasecmp((string)$a['basename'], (string)$b['basename']);
    }

    if ($aHas && !$bHas) return -1;
    if ($bHas && !$aHas) return 1;
    return strcasecmp((string)$a['basename'], (string)$b['basename']);
}

function html_plugin_list_html_dir_sorted($dir = 'HTML') {
    $dir = trim((string)$dir);
    if ($dir === '' || strpos($dir, '..') !== false) return [];
    $dir = str_replace("\\", "/", $dir);
    $dir = trim($dir, "/");
    if ($dir === '' || strpos($dir, '/') !== false) return [];

    $base = dirname(__DIR__) . '/' . $dir;
    if (!is_dir($base)) return [];

    $out = [];
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS)
    );

    $baseLen = strlen($base);
    foreach ($it as $fi) {
        if (!$fi->isFile()) continue;
        $name = $fi->getFilename();
        if ($name === '' || $name[0] === '.') continue;
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if ($ext !== 'html' && $ext !== 'htm') continue;

        $fullPath = $fi->getPathname();
        $rel = substr($fullPath, $baseLen);
        $rel = ltrim(str_replace(DIRECTORY_SEPARATOR, '/', $rel), '/');
        if ($rel === '' || $rel[0] === '.' || strpos($rel, '/.') !== false) continue;

        $path = $dir . '/' . $rel;
        $basename = basename($path);
        [$yy, $mm, $dd] = html_plugin_parse_ymd_from_filename($basename);
        $out[] = [
            'path' => $path,
            'basename' => $basename,
            'yy' => $yy,
            'mm' => $mm,
            'dd' => $dd,
        ];
    }

    usort($out, 'html_plugin_compare_entries_desc_date');
    return $out;
}

return [
    'id' => 'html',
    'order' => 20,
    'enabled_pages' => ['index'],
    'folder_keys' => ['HTML'],
    'hooks' => [
        'folders' => function(array $ctx) {
            $allowed = $ctx['allowed_plugin_folders'] ?? null;
            if (is_array($allowed) && !in_array('HTML', $allowed, true)) return false;

            $list = html_plugin_list_html_dir_sorted('HTML');
            if (empty($list)) return false;

            $esc = $ctx['escape'] ?? fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
            $urlEncodePath = $ctx['url_encode_path'] ?? fn($p) => (string)$p;
            $folderLink = $ctx['folder_link'] ?? fn($folder) => 'index.php?folder=' . rawurlencode((string)$folder);
            $folderAnchorId = $ctx['folder_anchor_id'] ?? null;
            $showBack = !empty($ctx['show_back']) && !empty($ctx['back_href']);
            $backHref = $ctx['back_href'] ?? null;

            $childrenId = 'folder-children-' . substr(sha1('plugin:html:HTML'), 0, 10);
            $defaultOpen = ($ctx['folder_filter'] ?? null) === 'HTML';
            $sectionId = is_callable($folderAnchorId) ? (string)$folderAnchorId('HTML') : '';
            ?>
            <section <?= $sectionId ? 'id="'.$esc($sectionId).'"' : '' ?> class="nav-section" data-folder-section="HTML" data-default-open="<?= $defaultOpen ? '1' : '0' ?>">
                <h2 class="note-group-title">
                    <?php if ($showBack): ?>
                        <a class="icon-button folder-back" href="<?= $esc($backHref) ?>" title="Back">
                            <span class="pi pi-leftcaret"></span>
                        </a>
                    <?php endif; ?>
                    <button type="button" class="icon-button folder-toggle" aria-expanded="<?= $defaultOpen ? 'true' : 'false' ?>" aria-controls="<?= $esc($childrenId) ?>" title="<?= $defaultOpen ? 'Collapse folder' : 'Expand folder' ?>">
                        <span class="pi <?= $defaultOpen ? 'pi-openfolder' : 'pi-folder' ?>"></span>
                    </button>
                    <a class="breadcrumb-link" href="<?= $esc($folderLink('HTML')) ?>">HTML</a>
                </h2>
            <div id="<?= $esc($childrenId) ?>" class="folder-children" <?= $defaultOpen ? '' : 'hidden' ?>>
            <ul class="notes-list">
            <?php foreach ($list as $entry):
                $p = $entry['path'];
                $t = html_plugin_extract_title_from_file(dirname(__DIR__) . '/' . $p, $entry['basename']);
                $href = $urlEncodePath($p);
            ?>
                <li class="note-item doclink note-row" data-kind="html" data-file="<?= $esc($p) ?>">
                    <a href="<?= $esc($href) ?>" target="_blank" rel="noopener noreferrer" class="note-link note-link-main kbd-item">
                        <div class="note-title" style="justify-content: space-between;">
                            <span><?= $esc($t) ?></span>
                            <span class="pi pi-externallink" style="font-size: 0.8em; opacity: 0.6;"></span>
                        </div>
                        <div class="nav-item-path"><?= $esc($p) ?></div>
                    </a>
                </li>
            <?php endforeach; ?>
            </ul>
            </div>
            </section>
            <?php
            return true;
        },
    ],
];
