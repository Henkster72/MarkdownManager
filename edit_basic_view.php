<?php

$basicIndexHref = static function(array $params = []) {
    $params['basic'] = '1';
    $q = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    return 'index.php' . ($q !== '' ? ('?' . $q) : '');
};

$basicEditHref = static function(array $params = []) {
    $params['basic'] = '1';
    $q = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    return 'edit.php' . ($q !== '' ? ('?' . $q) : '');
};

$basicReason = '';
if (($MDW_BASIC_REASON ?? '') === 'opera-mini') {
    $basicReason = 'Opera Mini detected: basic mode is enabled automatically.';
} else if (($MDW_BASIC_REASON ?? '') === 'query') {
    $basicReason = 'Basic mode is enabled via URL parameter.';
} else if (($MDW_BASIC_REASON ?? '') === 'post') {
    $basicReason = 'Basic mode is enabled for this browser session.';
}

$requestedSafe = isset($requested) && is_string($requested) ? $requested : '';
$requestedFolder = $requestedSafe !== '' ? (function_exists('folder_from_path') ? folder_from_path($requestedSafe) : dirname($requestedSafe)) : null;
if (!is_string($requestedFolder) || $requestedFolder === '' || $requestedFolder === '.') $requestedFolder = 'root';
$overviewHref = ($requestedFolder !== 'root')
    ? $basicIndexHref(['folder' => $requestedFolder, 'focus' => $requestedSafe])
    : $basicIndexHref(['focus' => $requestedSafe]);

$modernHrefParams = [];
if ($requestedSafe !== '') {
    $modernHrefParams['file'] = $requestedSafe;
    if ($requestedFolder !== 'root') $modernHrefParams['folder'] = $requestedFolder;
}
$modernHrefParams['basic'] = '0';
$modernHref = 'edit.php?' . http_build_query($modernHrefParams, '', '&', PHP_QUERY_RFC3986);

$rootToIndexHref = $basicIndexHref();
if ($requestedSafe !== '') {
    $rootToIndexHref = $basicIndexHref(['file' => $requestedSafe, 'folder' => $requestedFolder, 'focus' => $requestedSafe]);
}
?>
<!DOCTYPE html>
<html lang="<?= h($MDW_LANG) ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?= h($current_title) ?> • <?= h($APP_NAME) ?></title>
    <link rel="stylesheet" href="<?= h($STATIC_DIR) ?>/ui.css">
    <link rel="stylesheet" href="<?= h($STATIC_DIR) ?>/markdown.css">
    <link rel="stylesheet" href="<?= h($STATIC_DIR) ?>/htmlpreview.css">
</head>
<body class="app-body edit-page basic-mode <?= h($folderIconClass) ?>">
    <header class="app-header">
        <div class="app-header-inner basic-header-inner">
            <div class="app-header-main">
                <div class="app-header-text">
                    <div class="app-title-row">
                        <div class="app-title">
                            <span class="app-title-text"><?= h($current_title) ?></span>
                            <span class="basic-mode-chip">basic</span>
                        </div>
                    </div>
                    <div class="app-breadcrumb">
                        <a class="breadcrumb-link" href="<?= h($rootToIndexHref) ?>">/index</a>
                        <?php if ($requestedSafe !== ''): ?>
                            <?php if ($requestedFolder !== 'root'): ?>
                                <span class="breadcrumb-sep">/</span>
                                <a class="breadcrumb-link" href="<?= h($basicIndexHref(['folder' => $requestedFolder])) ?>"><?= h($requestedFolder) ?></a>
                            <?php endif; ?>
                            <span class="breadcrumb-sep">/</span>
                            <a class="breadcrumb-link app-path-segment" href="<?= h($basicEditHref(['file' => $requestedSafe, 'folder' => $requestedFolder])) ?>"><?= h(basename($requestedSafe)) ?></a>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            <div class="app-header-actions basic-header-actions">
                <a class="btn btn-ghost btn-small" href="<?= h($overviewHref) ?>"><?= h(mdw_t('common.overview', 'Overview')) ?></a>
                <a class="btn btn-ghost btn-small" href="<?= h($modernHref) ?>"><?= h(mdw_t('common.modern_ui', 'Modern UI')) ?></a>
            </div>
        </div>
    </header>

    <main class="app-main">
        <div class="app-main-inner basic-main-inner">
            <?php if ($basicReason !== ''): ?>
                <section class="basic-notice"><?= h($basicReason) ?></section>
            <?php endif; ?>

            <?php if (!empty($saved_flag) && empty($save_error)): ?>
                <section class="basic-flash"><div class="basic-flash-ok"><?= h(mdw_t('common.saved', 'Saved')) ?></div></section>
            <?php endif; ?>
            <?php if (!empty($save_error)): ?>
                <section class="basic-flash">
                    <div class="basic-flash-error"><?= h($save_error) ?></div>
                    <?php if (!empty($save_error_details)): ?>
                        <pre class="status-text" style="margin-top:0.45rem; white-space:pre-wrap;"><?= h($save_error_details) ?></pre>
                    <?php endif; ?>
                </section>
            <?php endif; ?>
            <?php if (!empty($save_warning) && is_array($save_warning)): ?>
                <section class="basic-flash">
                    <?php foreach ($save_warning as $warn): ?>
                        <div class="status-text" style="margin:0.2rem 0;"><?= h((string)$warn) ?></div>
                    <?php endforeach; ?>
                </section>
            <?php endif; ?>

            <?php if ($requestedSafe === ''): ?>
                <section class="basic-notice"><?= h(mdw_t('edit.no_file_selected', 'No file selected. Choose a note from the overview.')) ?></section>
            <?php else: ?>
                <section class="basic-view-toolbar">
                    <a class="btn btn-ghost btn-small" href="<?= h($overviewHref) ?>"><?= h(mdw_t('common.back_to_overview', 'Back to overview')) ?></a>
                    <a class="btn btn-ghost btn-small" href="<?= h($basicIndexHref(['new' => '1'])) ?>"><?= h(mdw_t('index.new_markdown.create_btn', 'Create note')) ?></a>
                    <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
                        <span class="basic-note-badge"><?= h(mdw_t('edit.publish_state_label', 'Publish state')) ?>: <?= h($current_publish_state_ui ?? 'Concept') ?></span>
                    <?php endif; ?>
                </section>

                <section class="basic-action-card">
                    <h2><?= h(mdw_t('edit.editor_title', 'Markdown editor')) ?></h2>
                    <form method="post" action="<?= h($basicEditHref(['file' => $requestedSafe])) ?>" class="basic-form" autocomplete="off">
                        <input type="hidden" name="action" value="save">
                        <input type="hidden" name="file" value="<?= h($requestedSafe) ?>">
                        <input type="hidden" name="basic" value="1">
                        <textarea id="editor" name="content" class="input basic-content-input" rows="20" spellcheck="false"><?= htmlspecialchars((string)$current_content, ENT_QUOTES, 'UTF-8') ?></textarea>
                        <div class="basic-form-actions">
                            <button type="submit" class="btn btn-primary"><?= h(mdw_t('edit.toolbar.save', 'Save')) ?></button>
                            <a class="btn btn-ghost" href="<?= h($modernHref) ?>"><?= h(mdw_t('common.modern_ui', 'Modern UI')) ?></a>
                        </div>
                    </form>
                </section>

                <section class="basic-action-card">
                    <h2><?= h(mdw_t('edit.preview_title', 'HTML preview')) ?></h2>
                    <article class="preview-content"><?= $current_html ?></article>
                </section>
            <?php endif; ?>

            <?php
            explorer_view_basic_render_tree([
                'page' => 'edit',
                'rootList' => $rootList,
                'dirMap' => $dirMap,
                'existing_folders' => $existingFolders ?? [],
                'secretMap' => $secretMap,
                'publisher_mode' => !empty($MDW_PUBLISHER_MODE),
                'folder_filter' => $folder_filter,
                'current_file' => $requestedSafe !== '' ? $requestedSafe : null,
                'csrf_token' => $CSRF_TOKEN,
                'show_actions' => false,
                'basic_mode' => true,
            ]);
            ?>
        </div>
    </main>

    <footer class="app-footer basic-footer">
        <?= date('Y') ?> • <a href="https://github.com/Henkster72/MarkdownManager" target="_blank" rel="noopener noreferrer">Markdown Manager</a>
    </footer>
</body>
</html>

