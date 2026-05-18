<?php

$basicHref = static function(array $params = []) {
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

$existingFoldersSafe = isset($existingFolders) && is_array($existingFolders) ? $existingFolders : [];
$defaultFolderSafe = isset($default_new_folder) && is_string($default_new_folder) ? $default_new_folder : 'root';
$newTitleSafe = isset($new_md_title_value) ? (string)$new_md_title_value : '';
$newSlugSafe = isset($new_md_slug_value) ? (string)$new_md_slug_value : '';
$newContentSafe = isset($new_md_content_value) ? (string)$new_md_content_value : '';
$newPrefixSafe = !empty($new_md_prefix_checked);

$currentFolderForBack = null;
if (isset($requested) && is_string($requested) && $requested !== '') {
    $currentFolderForBack = function_exists('folder_from_path') ? folder_from_path($requested) : dirname($requested);
}
if (!is_string($currentFolderForBack) || $currentFolderForBack === '' || $currentFolderForBack === '.') {
    $currentFolderForBack = isset($folder_filter) && is_string($folder_filter) && $folder_filter !== '' ? $folder_filter : 'root';
}
$backOverviewHref = ($currentFolderForBack && $currentFolderForBack !== 'root')
    ? $basicHref(['folder' => $currentFolderForBack])
    : $basicHref();

$prevHref = null;
if (isset($view_prev) && is_string($view_prev) && $view_prev !== '') {
    $prevHref = $basicHref(['file' => $view_prev, 'folder' => (function_exists('folder_from_path') ? folder_from_path($view_prev) : dirname($view_prev)), 'focus' => $view_prev]);
}
$nextHref = null;
if (isset($view_next) && is_string($view_next) && $view_next !== '') {
    $nextHref = $basicHref(['file' => $view_next, 'folder' => (function_exists('folder_from_path') ? folder_from_path($view_next) : dirname($view_next)), 'focus' => $view_next]);
}

$publisherDefaultAuthor = trim((string)($MDW_SETTINGS['publisher_default_author'] ?? ''));
?>
<!DOCTYPE html>
<html lang="<?= h($MDW_LANG) ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?= h($APP_NAME) ?> • <?= h($article_title) ?></title>
    <link rel="stylesheet" href="<?= h($STATIC_DIR) ?>/ui.css">
    <link rel="stylesheet" href="<?= h($STATIC_DIR) ?>/markdown.css">
    <link rel="stylesheet" href="<?= h($STATIC_DIR) ?>/htmlpreview.css">
</head>
<body class="app-body index-page basic-mode">
    <header class="app-header">
        <div class="app-header-inner basic-header-inner">
            <div class="app-header-main">
                <div class="app-header-text">
                    <div class="app-title-row">
                        <div class="app-title">
                            <span class="app-title-text"><?= h($APP_NAME) ?></span>
                            <span class="basic-mode-chip">basic</span>
                        </div>
                    </div>
                    <div class="app-breadcrumb">
                        <a class="breadcrumb-link" href="<?= h($basicHref()) ?>">/index</a>
                        <?php if (!empty($active_folder_for_breadcrumb)): ?>
                            <span class="breadcrumb-sep">/</span>
                            <a class="breadcrumb-link" href="<?= h($basicHref(['folder' => $active_folder_for_breadcrumb])) ?>"><?= h($active_folder_for_breadcrumb) ?></a>
                        <?php endif; ?>
                        <?php if (($mode ?? '') === 'view' && !empty($requested)): ?>
                            <span class="breadcrumb-sep">/</span>
                            <span class="app-path-segment"><?= h(basename((string)$requested)) ?></span>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            <div class="app-header-actions basic-header-actions">
                <a class="btn btn-ghost btn-small" href="<?= h($basicHref()) ?>"><?= h(mdw_t('common.overview', 'Overview')) ?></a>
                <a class="btn btn-ghost btn-small" href="index.php?basic=0"><?= h(mdw_t('common.modern_ui', 'Modern UI')) ?></a>
            </div>
        </div>
    </header>

    <main class="app-main">
        <div class="app-main-inner basic-main-inner">
            <?php if ($basicReason !== ''): ?>
                <section class="basic-notice"><?= h($basicReason) ?></section>
            <?php endif; ?>

            <?php if (!empty($flash_ok) || !empty($flash_error)): ?>
                <section class="basic-flash">
                    <?php if (!empty($flash_ok)): ?>
                        <div class="basic-flash-ok"><?= h($flash_ok) ?></div>
                    <?php else: ?>
                        <div class="basic-flash-error"><?= h($flash_error) ?></div>
                    <?php endif; ?>
                </section>
            <?php endif; ?>

            <?php if (($mode ?? '') === 'secret_prompt'): ?>
                <section class="editor-pane basic-secret-pane">
                    <h1><?= h(mdw_t('secret.title', 'Protected document')) ?></h1>
                    <p><?= h(mdw_t('secret.desc', 'This note is protected. Enter the password to continue.')) ?></p>
                    <?php if (!empty($secret_error)): ?>
                        <div class="basic-flash-error"><?= h($secret_error) ?></div>
                    <?php endif; ?>
                    <form method="post" class="basic-form">
                        <input type="hidden" name="basic" value="1">
                        <input type="password" name="secret_password" autocomplete="current-password" class="input" placeholder="<?= h(mdw_t('secret.password_placeholder', 'Password')) ?>">
                        <div class="basic-form-actions">
                            <button type="submit" class="btn btn-primary"><?= h(mdw_t('secret.unlock_btn', 'Unlock')) ?></button>
                            <a class="btn btn-ghost" href="<?= h($basicHref()) ?>"><?= h(mdw_t('secret.back_to_index', 'Back to index')) ?></a>
                        </div>
                    </form>
                </section>
            <?php elseif (($mode ?? '') === 'view'): ?>
                <section class="basic-view-toolbar">
                    <a class="btn btn-ghost btn-small" href="<?= h($backOverviewHref) ?>"><?= h(mdw_t('common.back_to_overview', 'Back to overview')) ?></a>
                    <?php if (!empty($requested)): ?>
                        <?php $requestedFolder = function_exists('folder_from_path') ? folder_from_path((string)$requested) : dirname((string)$requested); ?>
                        <a class="btn btn-ghost btn-small" href="<?= h($basicEditHref(['file' => (string)$requested, 'folder' => (string)$requestedFolder])) ?>"><?= h(mdw_t('common.edit', 'Edit')) ?></a>
                    <?php endif; ?>
                    <?php if ($prevHref !== null): ?>
                        <a class="btn btn-ghost btn-small" href="<?= h($prevHref) ?>"><?= h(mdw_t('common.previous', 'Previous')) ?></a>
                    <?php endif; ?>
                    <?php if ($nextHref !== null): ?>
                        <a class="btn btn-ghost btn-small" href="<?= h($nextHref) ?>"><?= h(mdw_t('common.next', 'Next')) ?></a>
                    <?php endif; ?>
                </section>
                <div class="preview-container basic-preview-container">
                    <article class="preview-content" id="preview"><?= $article_html ?></article>
                </div>
            <?php else: ?>
                <?php
                explorer_view_render_plugin_hook('header', [
                    'page' => 'index',
                    'project_dir' => __DIR__,
                    'plugins_enabled' => true,
                    'links_csv' => $LINKS_CSV,
                    'links_variant' => 'index',
                ]);
                ?>

                <section class="basic-actions">
                    <div class="basic-action-card">
                        <h2><?= h(mdw_t('index.new_markdown.title', 'Create note')) ?></h2>
                        <form method="post" class="basic-form">
                            <input type="hidden" name="action" value="create">
                            <input type="hidden" name="csrf" value="<?= h($CSRF_TOKEN) ?>">
                            <input type="hidden" name="basic" value="1">
                            <label class="modal-label" for="basicNewTitle"><?= h(mdw_t('index.new_markdown.title_label', 'Title')) ?></label>
                            <input id="basicNewTitle" class="input" type="text" name="new_title" minlength="<?= (int)MDW_NEW_MD_TITLE_MIN ?>" maxlength="<?= (int)MDW_NEW_MD_TITLE_MAX ?>" required value="<?= h($newTitleSafe) ?>">

                            <label class="modal-label" for="basicNewSlug"><?= h(mdw_t('index.new_markdown.slug_label', 'Slug (optional)')) ?></label>
                            <input id="basicNewSlug" class="input" type="text" name="new_slug" value="<?= h($newSlugSafe) ?>" placeholder="<?= h(mdw_t('index.new_markdown.slug_placeholder', 'optional-custom-slug')) ?>">

                            <label class="modal-label" for="basicNewFolder"><?= h(mdw_t('index.new_markdown.folder_label', 'Folder')) ?></label>
                            <select id="basicNewFolder" class="input" name="new_folder">
                                <option value="root" <?= $defaultFolderSafe === 'root' ? 'selected' : '' ?>>/ (root)</option>
                                <?php foreach ($existingFoldersSafe as $folderName): ?>
                                    <?php if (!is_string($folderName) || $folderName === '') continue; ?>
                                    <option value="<?= h($folderName) ?>" <?= $defaultFolderSafe === $folderName ? 'selected' : '' ?>><?= h($folderName) ?></option>
                                <?php endforeach; ?>
                            </select>

                            <label class="checkbox basic-checkbox">
                                <input type="checkbox" name="prefix_date" value="1" <?= $newPrefixSafe ? 'checked' : '' ?>>
                                <span><?= h(mdw_t('index.new_markdown.prefix_date', 'Prefix filename with today (yy-mm-dd-)')) ?></span>
                            </label>

                            <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
                                <label class="modal-label" for="basicPublisherAuthor"><?= h(mdw_t('theme.publisher.author_label', 'Author name')) ?></label>
                                <input id="basicPublisherAuthor" class="input" type="text" name="publisher_author" value="<?= h($publisherDefaultAuthor) ?>" placeholder="<?= h(mdw_t('theme.publisher.author_placeholder', 'Your name')) ?>">
                            <?php endif; ?>

                            <label class="modal-label" for="basicNewContent"><?= h(mdw_t('index.new_markdown.content_label', 'Initial content (optional)')) ?></label>
                            <textarea id="basicNewContent" class="input basic-content-input" name="new_content" rows="6"><?= h($newContentSafe) ?></textarea>

                            <div class="basic-form-actions">
                                <button type="submit" class="btn btn-primary"><?= h(mdw_t('index.new_markdown.create_btn', 'Create note')) ?></button>
                            </div>
                        </form>
                    </div>

                    <div class="basic-action-card">
                        <h2><?= h(mdw_t('index.new_folder_title', 'Create a new folder')) ?></h2>
                        <form method="post" class="basic-form">
                            <input type="hidden" name="action" value="create_folder">
                            <input type="hidden" name="csrf" value="<?= h($CSRF_TOKEN) ?>">
                            <input type="hidden" name="basic" value="1">
                            <label class="modal-label" for="basicNewFolderName"><?= h(mdw_t('index.new_folder_name', 'Folder name')) ?></label>
                            <input id="basicNewFolderName" class="input" type="text" name="folder_name" required placeholder="<?= h(mdw_t('index.new_folder_placeholder', 'example-folder')) ?>">
                            <div class="basic-form-actions">
                                <button type="submit" class="btn btn-primary"><?= h(mdw_t('index.new_folder_create', 'Create folder')) ?></button>
                            </div>
                        </form>
                    </div>
                </section>

                <?php
                explorer_view_basic_render_tree([
                    'page' => 'index',
                    'rootList' => $rootList,
                    'dirMap' => $dirMap,
                    'existing_folders' => $existingFoldersSafe,
                    'secretMap' => $secretMap,
                    'publisher_mode' => !empty($MDW_PUBLISHER_MODE),
                    'folder_filter' => $folder_filter,
                    'current_file' => null,
                    'csrf_token' => $CSRF_TOKEN,
                    'show_actions' => true,
                    'basic_mode' => true,
                ]);
                ?>
            <?php endif; ?>
        </div>
    </main>

    <footer class="app-footer basic-footer">
        <?= date('Y') ?> • <a href="https://github.com/Henkster72/MarkdownManager" target="_blank" rel="noopener noreferrer">Markdown Manager</a>
    </footer>
</body>
</html>
