<?php

/**
 * Shared "New markdown" modal for index.php and edit.php.
 */

if (!function_exists('mdw_render_new_md_modal')) {
    function mdw_render_new_md_modal(array $opts = []) {
        $esc = function_exists('h')
            ? fn($s) => h($s)
            : fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
        $tr = function($k, $f) {
            if (function_exists('mdw_t')) return mdw_t($k, $f);
            return is_string($f) ? $f : '';
        };

        $csrf = (string)($opts['csrf'] ?? '');
        $formAction = trim((string)($opts['form_action'] ?? 'index.php'));
        if ($formAction === '') $formAction = 'index.php';
        $existingFolders = is_array($opts['existing_folders'] ?? null) ? $opts['existing_folders'] : [];
        $defaultFolder = trim((string)($opts['default_folder'] ?? 'root'));
        if ($defaultFolder === '') $defaultFolder = 'root';
        $todayPrefix = trim((string)($opts['today_prefix'] ?? date('y-m-d-')));
        $titleValue = (string)($opts['title'] ?? '');
        $slugValue = (string)($opts['slug'] ?? '');
        $contentValue = (string)($opts['content'] ?? '');
        $prefixChecked = !empty($opts['prefix_checked']);
        $hideMarkdownEditor = !empty($opts['hide_markdown_editor']);
        $open = !empty($opts['open']);
        $errorMessage = trim((string)($opts['error_message'] ?? ''));
        $hiddenFields = is_array($opts['hidden_fields'] ?? null) ? $opts['hidden_fields'] : [];
        ?>
        <div class="modal-overlay no-blur" id="newMdOverlay" <?= $open ? '' : 'hidden' ?>></div>
        <form method="post"
              action="<?= $esc($formAction) ?>"
              id="newMdPanel"
              class="modal new-md-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="newMdModalTitle"
              <?= $open ? '' : 'hidden' ?>
              data-initial-open="<?= $open ? '1' : '0' ?>"
              data-overlay-id="newMdOverlay">
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="csrf" value="<?= $esc($csrf) ?>">
            <?php foreach ($hiddenFields as $name => $value): ?>
                <?php if (!is_string($name) || $name === '') continue; ?>
                <input type="hidden" name="<?= $esc($name) ?>" value="<?= $esc((string)$value) ?>">
            <?php endforeach; ?>

            <div class="modal-header">
                <div>
                    <div id="newMdModalTitle" class="modal-title"><?= $esc($tr('index.new_markdown.title', 'New markdown')) ?></div>
                    <div class="status-text" style="margin-top: 0.25rem;">
                        <?= $esc($tr('index.new_markdown.relative_path', 'Pick a folder, add a title, and a slug is created for the filename.')) ?>
                    </div>
                </div>
                <button id="newMdClose" type="button" class="btn btn-ghost btn-small"><?= $esc($tr('index.new_markdown.close', 'Close')) ?></button>
            </div>

            <div class="modal-body">
                <?php if ($errorMessage !== ''): ?>
                    <div class="chip" style="background-color: var(--danger); color: white;"><?= $esc($errorMessage) ?></div>
                <?php endif; ?>

                <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
                    <select name="new_folder" class="input" style="width: auto; flex: 1 1 12rem; min-width: 10rem;" aria-label="<?= $esc($tr('common.folder', 'Folder')) ?>">
                        <option value="root" <?= $defaultFolder === 'root' ? 'selected' : '' ?>><?= $esc($tr('common.root', 'Root')) ?></option>
                        <?php foreach ($existingFolders as $folder): ?>
                            <?php if (!is_string($folder) || $folder === '') continue; ?>
                            <option value="<?= $esc($folder) ?>" <?= $defaultFolder === $folder ? 'selected' : '' ?>><?= $esc($folder) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <?php if (!$hideMarkdownEditor): ?>
                        <label class="status-text" style="display:flex; align-items:center; gap:0.35rem; white-space:nowrap;" title="<?= $esc($tr('index.new_markdown.date_prefix_title', 'Adds a yy-mm-dd- prefix so notes sort nicely by date.')) ?>">
                            <input id="newMdPrefixDate" type="checkbox" name="prefix_date" value="1" <?= $prefixChecked ? 'checked' : '' ?> data-date-prefix="<?= $esc($todayPrefix) ?>">
                            <span>yy-mm-dd-</span>
                        </label>
                    <?php endif; ?>
                </div>

                <div style="display:flex; flex-direction: column; gap: 0.35rem;">
                    <label class="status-text" for="newMdTitle"><?= $esc($tr('index.new_markdown.title_label', 'Title')) ?></label>
                    <input id="newMdTitle" name="new_title" class="input" style="width: 100%;" type="text" value="<?= $esc($titleValue) ?>" placeholder="<?= $esc($tr('index.new_markdown.title_placeholder', 'Your title')) ?>" required>
                    <div id="newMdTitleHint" class="status-text" style="display:none; margin-top: 0.1rem;"></div>
                </div>

                <div style="display:flex; flex-direction: column; gap: 0.35rem;">
                    <label class="status-text" for="newMdFile"><?= $esc($tr('index.new_markdown.slug_label', 'Slug / filename')) ?></label>
                    <div style="display:flex; align-items:center; gap: 0.4rem;">
                        <input id="newMdFile" name="new_slug" class="input" style="width: 100%;" type="text" value="<?= $esc($slugValue) ?>" placeholder="<?= $esc($tr('index.new_markdown.filename_placeholder', 'my-title')) ?>" minlength="<?= MDW_NEW_MD_SLUG_MIN ?>" maxlength="<?= MDW_NEW_MD_SLUG_MAX ?>" data-slug-min="<?= MDW_NEW_MD_SLUG_MIN ?>" data-slug-max="<?= MDW_NEW_MD_SLUG_MAX ?>" required>
                        <span class="status-text new-md-extension">.md</span>
                    </div>
                    <div id="newMdFileHint" class="status-text" style="display:none; margin-top: 0.1rem;"></div>
                    <div id="newMdFilePreview" class="status-text" data-label="<?= $esc($tr('index.new_markdown.filename_preview', 'Filename')) ?>" style="margin-top: 0.1rem; display: none;">
                        <?= $esc($tr('index.new_markdown.filename_preview', 'Filename')) ?>: <code id="newMdFilePreviewValue"></code>
                    </div>
                </div>

                <textarea name="new_content" class="input" rows="6" style="height: auto; display: block;" placeholder="<?= $esc($tr('index.new_markdown.content_placeholder', "# Title\n\nStart writing...")) ?>"><?= $esc($contentValue) ?></textarea>
            </div>

            <div class="modal-footer">
                <button type="submit" class="btn btn-primary btn-small"><?= $esc($tr('index.new_markdown.create_edit', 'Create & edit')) ?></button>
            </div>
        </form>
        <?php
    }
}
