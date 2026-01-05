<?php

/**
 * GitHub Pages export plugin.
 * - Build automation lives in tools/export-wet-html.php + GitHub Actions.
 * - No UI hooks by default; this plugin is a marker for the workflow.
 */

return [
    'id' => 'github_pages_export',
    'order' => 90,
    'enabled_pages' => ['index', 'edit'],
    'hooks' => [],
];
