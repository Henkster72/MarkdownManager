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
            $variant = $ctx['links_variant'] ?? 'default';
            $titleStyle = ($variant === 'index')
                ? ' style="justify-content: center; margin-bottom: 1rem; font-size: 1.25rem;"'
                : '';
            ?>
            <section class="nav-section">
                <div class="nav-section-title"<?=$titleStyle?>>
                    <span class="pi pi-linkchain"></span>
                    <span>Shortcuts</span>
                </div>
                <ul class="nav-list">
                <?php foreach ($shortcuts as $lnk): ?>
                    <li class="nav-item">
                        <a href="<?=$esc($lnk['url'])?>" target="_blank" rel="noopener noreferrer" class="note-link kbd-item">
                            <div class="note-title" style="justify-content: space-between;">
                                <span><?=$esc($lnk['shortcut'])?></span>
                                <span class="pi pi-externallink" style="font-size: 0.8em; opacity: 0.6;"></span>
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

