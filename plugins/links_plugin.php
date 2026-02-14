<?php

/**
 * Links/shortcuts plugin.
 * - Renders the "Shortcuts" section based on links.csv.
 */

function links_plugin_read_shortcuts_csv_fallback($csv) {
    $out = [];
    if (!is_string($csv) || $csv === '' || !is_file($csv)) return $out;
    if (($h = fopen($csv, 'r')) === false) return $out;
    fgetcsv($h); // header
    while (($row = fgetcsv($h)) !== false) {
        if (count($row) < 2) continue;
        $shortcut = trim((string)$row[0]);
        $url = trim((string)$row[1]);
        if ($shortcut === '' || $url === '') continue;
        $out[] = ['shortcut' => $shortcut, 'url' => $url];
    }
    fclose($h);
    return $out;
}

return [
    'id' => 'links',
    'order' => 10,
    'enabled_pages' => ['index'],
    'hooks' => [
        'header' => function(array $ctx) {
            $projectDir = $ctx['project_dir'] ?? dirname(__DIR__);
            $csv = $ctx['links_csv'] ?? null;
            if (!is_string($csv) || $csv === '') {
                if (function_exists('env_path')) {
                    $csv = env_path('LINKS_CSV', rtrim($projectDir, "/\\") . '/links.csv', $projectDir);
                } else {
                    $csv = rtrim($projectDir, "/\\") . '/links.csv';
                }
            }

            $read = null;
            if (function_exists('read_shortcuts_csv')) $read = 'read_shortcuts_csv';
            $shortcuts = $read ? $read($csv) : links_plugin_read_shortcuts_csv_fallback($csv);
            if (empty($shortcuts)) return false;

            $esc = $ctx['escape'] ?? fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
            $variant = strtolower(trim((string)($ctx['links_variant'] ?? 'default')));
            if ($variant === '') $variant = 'default';
            $sectionClass = 'nav-section nav-shortcuts-section';
            if ($variant === 'index') $sectionClass .= ' nav-shortcuts-section-index';
            if ($variant === 'index_split') $sectionClass .= ' nav-shortcuts-section-index-split';

            $titleClass = 'nav-section-title nav-shortcuts-title';
            if ($variant === 'index') $titleClass .= ' nav-shortcuts-title-index';
            if ($variant === 'index_split') $titleClass .= ' nav-shortcuts-title-index-split';
            ?>
            <section class="<?=$esc($sectionClass)?>">
                <div class="<?=$esc($titleClass)?>">
                    <span class="pi pi-linkchain"></span>
                    <span>Shortcuts</span>
                </div>
                <ul class="nav-list nav-shortcuts-list">
                <?php foreach ($shortcuts as $lnk): ?>
                    <li class="nav-item nav-shortcut-item">
                        <a href="<?=$esc($lnk['url'])?>" target="_blank" rel="noopener noreferrer" class="note-link nav-shortcut-link kbd-item">
                            <div class="note-title nav-shortcut-row">
                                <span><?=$esc($lnk['shortcut'])?></span>
                                <span class="pi pi-externallink nav-shortcut-icon"></span>
                            </div>
                            <div class="nav-item-path"><?=$esc($lnk['url'])?></div>
                        </a>
                    </li>
                <?php endforeach; ?>
                </ul>
            </section>
            <?php
            return true;
        },
    ],
];
