<?php

/**
 * AW-SSG template export plugin.
 * - Enables Jinja template download/export UI in the editor.
 * - Keeps the feature optional per instance.
 */

return [
    'id' => 'aw_ssg_template_export',
    'order' => 95,
    'enabled_pages' => ['index', 'edit'],
    'hooks' => [],
];

