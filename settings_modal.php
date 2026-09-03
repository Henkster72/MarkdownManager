			<div class="modal-overlay no-blur" id="themeModalOverlay" hidden></div>
				<div class="modal theme-modal" id="themeModal" role="dialog" aria-modal="true" aria-labelledby="themeModalTitle" hidden>
				    <div class="modal-header">
				        <div class="modal-title" id="themeModalTitle"><?=h(mdw_t('theme.title','Settings'))?></div>
				        <button type="button" class="btn btn-ghost icon-button" id="themeModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
				            <span class="pi pi-cross"></span>
				        </button>
				    </div>
				    <div class="modal-body">
				        <details class="theme-modal-section" style="margin-bottom: 0.8rem;">
				            <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.ui.title','User interface'))?></span></summary>
				            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
<?php if (!empty($settings_modal_editor_context)): ?>
				                <div class="modal-field">
				                    <div class="modal-label"><?=h(mdw_t('theme.editor_view.title','Editor view'))?></div>
				                    <div class="modal-row" style="gap: 0.6rem; margin: 0; flex-wrap: wrap;">
				                        <button type="button" id="wrapToggle" class="btn btn-ghost btn-small toggle-btn" title="<?=h(mdw_t('edit.toolbar.wrap_title','Word wrap'))?>" aria-pressed="false" aria-label="<?=h(mdw_t('edit.toolbar.wrap_title','Word wrap'))?>">
				                            <span class="toggle-box" aria-hidden="true"><span class="pi pi-checkmark"></span></span>
				                            <span class="btn-label"><?=h(mdw_t('edit.toolbar.wrap','Wrap'))?></span>
				                        </button>
				                        <button type="button" id="lineNumbersToggle" class="btn btn-ghost btn-small toggle-btn" title="<?=h(mdw_t('edit.toolbar.lines_title','Line numbers'))?>" aria-pressed="true" aria-label="<?=h(mdw_t('edit.toolbar.lines_title','Line numbers'))?>">
				                            <span class="toggle-box" aria-hidden="true"><span class="pi pi-checkmark"></span></span>
				                            <span class="btn-label"><?=h(mdw_t('edit.toolbar.lines','Lines'))?></span>
				                        </button>
				                    </div>
				                </div>
<?php endif; ?>

				                <div class="modal-field">
				                    <div class="modal-label"><?=h(mdw_t('theme.kbd_modifier.label','Keyboard shortcuts system'))?></div>
				                    <div class="modal-row" style="gap: 1rem; margin: 0;">
				                        <label class="radio">
				                            <input type="radio" name="kbdShortcutMod" id="kbdShortcutModOption" value="option">
				                        <span><?=h(mdw_t('theme.kbd_modifier.option','Windows / Linux (Ctrl + Alt)'))?></span>
				                    </label>
				                    <label class="radio">
				                        <input type="radio" name="kbdShortcutMod" id="kbdShortcutModCommand" value="command">
				                        <span><?=h(mdw_t('theme.kbd_modifier.command','Mac (Ctrl + Command)'))?></span>
				                    </label>
				                </div>
				                <div class="status-text">
				                    <?=h(mdw_t('theme.kbd_modifier.tip','Choose the system your shortcuts should follow (saved in this browser).'))?>
				                </div>
				            </div>

				            <div class="modal-field">
				                <label class="modal-label" for="langSelect"><?=h(mdw_t('theme.language.label','Language'))?></label>
				                <select id="langSelect" class="input" style="width: 100%;">
				                    <?php foreach ($MDW_LANGS as $l): ?>
				                        <?php
				                            $code = (string)($l['code'] ?? '');
				                            $label = (string)($l['native'] ?? ($l['label'] ?? $code));
				                        ?>
				                        <option value="<?=h($code)?>" <?= $MDW_LANG === $code ? 'selected' : '' ?>><?=h($label)?></option>
				                    <?php endforeach; ?>
				                </select>
				                <div class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.language.hint','Choose UI language (auto-detected from translations/*.json).'))?>
					            </div>
				            </div>

				            <div class="modal-field">
				                <div class="modal-label"><?=h(mdw_t('theme.delete_after.label','After deleting a note'))?></div>
				                <div class="modal-row" style="gap: 1rem; margin: 0;">
				                    <label class="radio">
				                        <input type="radio" name="deleteAfter" id="deleteAfterOverview" value="overview">
				                        <span><?=h(mdw_t('theme.delete_after.overview','Back to overview'))?></span>
				                    </label>
				                    <label class="radio">
				                        <input type="radio" name="deleteAfter" id="deleteAfterNext" value="next">
				                        <span><?=h(mdw_t('theme.delete_after.next','Open next note'))?></span>
				                    </label>
				                </div>
				                <div class="status-text">
				                    <?=h(mdw_t('theme.delete_after.hint','Saved in this browser.'))?>
				                </div>
				            </div>

				            <div class="modal-field">
				                <label class="modal-label" for="offlineDelaySelect"><?=h(mdw_t('theme.offline_delay.label','Offline indicator delay'))?></label>
				                <select id="offlineDelaySelect" class="input" style="width: 100%;">
				                    <?php foreach ([1, 2, 3, 5, 10, 15, 20, 30, 45, 60] as $i): ?>
				                        <option value="<?= $i ?>"><?=h(mdw_t('theme.offline_delay.option_minutes','{n} min', ['n' => $i]))?></option>
				                    <?php endforeach; ?>
				                </select>
				                <div class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.offline_delay.hint','Wait before showing Offline after network errors.'))?>
				                </div>
				            </div>

				            <div class="modal-field" data-auth-superuser="1">
				                <label class="modal-label" for="appTitleInput"><?=h(mdw_t('theme.app_title.label','App title'))?></label>
				                <div class="modal-row" style="gap: 0.6rem; margin: 0;">
				                    <input id="appTitleInput" type="text" class="input" style="flex: 1 1 auto;" placeholder="<?=h(mdw_t('theme.app_title.placeholder','Markdown Manager'))?>" value="<?=h($APP_TITLE_OVERRIDE)?>" data-auth-superuser-enable="1">
				                    <button type="button" class="btn btn-ghost btn-small" id="appTitleSaveBtn" data-auth-superuser-enable="1"><?=h(mdw_t('theme.app_title.save','Save title'))?></button>
				                </div>
				                <div id="appTitleStatus" class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.app_title.hint','Leave blank to use the default.'))?>
				                </div>
				            </div>

			            <div class="modal-field" data-auth-superuser="1">
			                <label class="modal-label" for="internalLinkPrefixInput"><?=h(mdw_t('theme.internal_links.prefix_label','Internal link URL prefix'))?></label>
				                <div class="modal-row" style="gap: 0.6rem; margin: 0;">
				                    <input id="internalLinkPrefixInput" type="text" class="input" style="flex: 1 1 auto;" placeholder="<?=h(mdw_t('theme.internal_links.prefix_placeholder','https://example.com/markdownmanager/'))?>" value="<?=h($internalLinkPrefix)?>" data-auth-superuser-enable="1">
				                    <button type="button" class="btn btn-ghost btn-small" id="internalLinkPrefixSaveBtn" data-auth-superuser-enable="1"><?=h(mdw_t('theme.internal_links.prefix_save','Save prefix'))?></button>
				                </div>
				                <div id="internalLinkPrefixStatus" class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.internal_links.prefix_hint','Prefix is added before index.php?file= (leave empty for relative links).'))?>
				                </div>
				            </div>

			            <div class="modal-field" data-auth-superuser="1">
			                <label class="modal-label" for="folderIconStyleSelect"><?=h(mdw_t('theme.folder_icons.label','Folder icons'))?></label>
				                <select id="folderIconStyleSelect" class="input" data-auth-superuser-enable="1">
				                    <option value="folder" <?= $folderIconStyle === 'folder' ? 'selected' : '' ?>><?=h(mdw_t('theme.folder_icons.option_folder','Folder'))?></option>
				                    <option value="caret" <?= $folderIconStyle === 'caret' ? 'selected' : '' ?>><?=h(mdw_t('theme.folder_icons.option_caret','Caret'))?></option>
				                </select>
			                <div id="folderIconStyleStatus" class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.folder_icons.hint','Saved for all users.'))?>
			                </div>
			            </div>

			            <div class="modal-field" data-auth-superuser="1">
			                <label class="modal-label" for="paneHeaderOrderSelect"><?=h(mdw_t('theme.pane_header.label','Pane header order'))?></label>
			                <select id="paneHeaderOrderSelect" class="input" data-auth-superuser-enable="1">
			                    <option value="actions_left" <?= $paneHeaderOrder === 'actions_left' ? 'selected' : '' ?>><?=h(mdw_t('theme.pane_header.actions_left','Toolbar left, title right'))?></option>
			                    <option value="title_left" <?= $paneHeaderOrder === 'title_left' ? 'selected' : '' ?>><?=h(mdw_t('theme.pane_header.title_left','Title left, toolbar right'))?></option>
			                </select>
			                <div id="paneHeaderOrderStatus" class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.pane_header.hint','Saved for all users. Toolbar remains visible when space is limited.'))?>
			                </div>
			            </div>

            <div class="modal-field" data-auth-superuser="1">
	                <div class="modal-label"><?=h(mdw_t('theme.index_layout.label','Index overview layout'))?></div>
				                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                    <input id="indexDualPaneToggle" type="checkbox" <?= $indexDualPaneEnabled ? 'checked' : '' ?> data-auth-superuser-enable="1">
				                    <span class="status-text"><?=h(mdw_t('theme.index_layout.dual','Show overview + preview split view'))?></span>
				                </label>
				                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                    <input id="hideMarkdownEditorToggle" type="checkbox" <?= $hideMarkdownEditor ? 'checked' : '' ?> data-auth-superuser-enable="1">
				                    <span class="status-text"><?=h(mdw_t('theme.index_layout.hide_markdown','Hide markdown'))?></span>
				                </label>
				                <div id="indexLayoutStatus" class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.index_layout.hint','Turn off to use the classic overview-only index page.'))?>
	                </div>
	            </div>

            <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
            <div class="modal-field" data-auth-superuser="1">
                <div class="modal-label"><?=h(mdw_t('theme.custom_format.label','Custom format sources'))?></div>
                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
                    <input id="customFormatCustomCssToggle" type="checkbox" <?= $customFormatCss ? 'checked' : '' ?> data-auth-superuser-enable="1">
                    <span class="status-text"><?=h(mdw_t('theme.custom_format.custom_css','Show custom.css'))?></span>
                </label>
                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
                    <input id="customFormatSectionsToggle" type="checkbox" <?= $customFormatSections ? 'checked' : '' ?> data-auth-superuser-enable="1">
                    <span class="status-text"><?=h(mdw_t('theme.custom_format.sections','Show sections'))?></span>
                </label>
                <div id="customFormatStatus" class="status-text" style="margin-top: 0.35rem;">
                    <?=h(mdw_t('theme.custom_format.hint','Choose which sources appear in the custom format toolbar.'))?>
                </div>
            </div>
            <div class="modal-field" data-auth-superuser="1">
                <div class="modal-label"><?=h(mdw_t('theme.critical_sections.label','Critical custom sections'))?></div>
                <div id="criticalSectionsList" style="display:flex; flex-direction:column; gap:0.35rem;"></div>
                <div id="criticalSectionsStatus" class="status-text" style="margin-top:0.35rem;"><?=h(mdw_t('theme.critical_sections.hint','Warn regular users before they send Markdown containing these sections.'))?></div>
            </div>
            <?php endif; ?>

            <div class="modal-field" data-auth-superuser="1">
                <div class="modal-label"><?=h(mdw_t('theme.asset_paths.title','Asset paths'))?></div>
                <label class="modal-label" for="staticPathInput"><?=h(mdw_t('theme.asset_paths.static_label','Static folder path'))?></label>
                <input id="staticPathInput" type="text" class="input" value="<?=h($assetStaticPath)?>" data-auth-superuser-enable="1">
                <label class="modal-label" for="imagesPathInput" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.asset_paths.images_label','Images folder path'))?></label>
                <input id="imagesPathInput" type="text" class="input" value="<?=h($assetImagesPath)?>" data-auth-superuser-enable="1">
                <label class="modal-label" for="appLogoInput" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.asset_paths.logo_label','App logo'))?></label>
                <input id="appLogoInput" type="text" class="input" list="appLogoImageOptions" value="<?=h($appLogoFile)?>" placeholder="logo.svg" data-auth-superuser-enable="1">
                <datalist id="appLogoImageOptions"></datalist>
                <img id="appLogoPreview" class="settings-logo-preview" alt="" hidden>
                <div class="status-text" style="margin-top: 0.35rem;"><?=h(mdw_t('theme.asset_paths.logo_hint','Choose a PNG or SVG from the images folder. Leave empty for the default logo.'))?></div>
                <div class="status-text" style="margin-top: 0.35rem;"><?=h(mdw_t('theme.asset_paths.hint','Relative to the editor folder, for example ../static and ../static/images.'))?></div>
            </div>

	            <div class="modal-field" data-auth-superuser="1">
				                <div class="modal-label"><?=h(mdw_t('theme.permissions.title','Permissions'))?></div>
				                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                    <input id="allowUserPublishToggle" type="checkbox" <?= !empty($MDW_SETTINGS['allow_user_publish']) ? 'checked' : '' ?> data-auth-superuser-enable="1">
				                    <span class="status-text"><?=h(mdw_t('theme.permissions.allow_user_publish','Allow users to publish'))?></span>
				                </label>
				                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                    <input id="allowUserDeleteToggle" type="checkbox" <?= !array_key_exists('allow_user_delete', $MDW_SETTINGS) || !empty($MDW_SETTINGS['allow_user_delete']) ? 'checked' : '' ?> data-auth-superuser-enable="1">
				                    <span class="status-text"><?=h(mdw_t('theme.permissions.allow_user_delete','Allow users to delete notes'))?></span>
				                </label>
				                <div id="allowUserDeleteStatus" class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.permissions.hint','Saved for all users.'))?>
				                </div>
				            </div>

					            <div class="modal-field" data-auth-superuser="1">
					                <div class="modal-label"><?=h(mdw_t('theme.copy.title','Copy buttons'))?></div>
					                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
					                    <input id="copyButtonsToggle" type="checkbox" <?= $copyButtonsEnabled ? 'checked' : '' ?> data-auth-superuser-enable="1">
					                    <span class="status-text"><?=h(mdw_t('theme.copy.show_buttons','Show preview copy buttons'))?></span>
					                </label>
					            </div>

<?php if (!empty($settings_modal_editor_context)): ?>
				            <div class="modal-field" data-auth-superuser="1">
				                <div class="modal-label"><?=h(mdw_t('theme.debug.title','Editor diagnostics'))?></div>
				                <label style="display:flex; align-items:flex-start; gap:0.5rem; margin-top: 0.35rem;">
				                    <input id="editorDebugLoggingToggle" type="checkbox" <?= $editorDebugLogging ? 'checked' : '' ?> data-auth-superuser-enable="1">
				                    <span class="status-text"><?=h(mdw_t('theme.debug.enable','Enable visual editor cursor/image diagnostics in the browser console'))?></span>
				                </label>
				                <div id="editorDebugLoggingStatus" class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.debug.hint','Off by default. Enable temporarily when investigating editor behavior.'))?>
				                </div>
				            </div>
<?php endif; ?>
			        </div>
					    </details>

					    <details class="theme-modal-section" style="margin-top: 0.8rem;">
					        <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.html_preview.title','HTML preview settings'))?></span></summary>
					        <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
					            <div class="modal-field" data-auth-superuser="1">
					                <div class="modal-label"><?=h(mdw_t('theme.copy.title','Copy buttons'))?></div>
					                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
					                    <input id="copyIncludeMetaToggle" type="checkbox" <?= $copyIncludeMeta ? 'checked' : '' ?> data-auth-superuser-enable="1">
					                    <span class="status-text"><?=h(mdw_t('theme.copy.include_meta','Include metadata in copy'))?></span>
					                </label>
					                <label class="modal-label" for="copyHtmlModeSelect" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.copy.html_mode_label','HTML copy mode'))?></label>
					                <select id="copyHtmlModeSelect" class="input" data-auth-superuser-enable="1">
					                    <option value="dry" <?= $copyHtmlMode === 'dry' ? 'selected' : '' ?>><?=h(mdw_t('theme.copy.html_mode_dry','Dry HTML (no classes/styles)'))?></option>
					                    <option value="medium" <?= $copyHtmlMode === 'medium' ? 'selected' : '' ?>><?=h(mdw_t('theme.copy.html_mode_medium','Medium dry HTML (classes only)'))?></option>
					                    <option value="wet" <?= $copyHtmlMode === 'wet' ? 'selected' : '' ?>><?=h(mdw_t('theme.copy.html_mode_wet','Wet HTML (inline styles)'))?></option>
					                </select>
					                <label class="modal-label" for="exportClassPrefixInput" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.copy.class_prefix_label','Export class prefix'))?></label>
					                <div class="modal-row" style="gap: 0.6rem; margin: 0;">
					                    <input id="exportClassPrefixInput" type="text" class="input" style="flex: 1 1 auto;" placeholder="<?=h(mdw_t('theme.copy.class_prefix_placeholder','md-'))?>" value="<?=h($exportClassPrefix)?>" data-auth-superuser-enable="1">
					                    <button type="button" class="btn btn-ghost btn-small" id="exportClassPrefixSaveBtn" data-auth-superuser-enable="1"><?=h(mdw_t('theme.copy.class_prefix_save','Save prefix'))?></button>
					                </div>
					                <div id="exportClassPrefixStatus" class="status-text" style="margin-top: 0.35rem;">
					                    <?=h(mdw_t('theme.copy.class_prefix_hint','Applies to medium/wet HTML export; dry export removes all classes.'))?>
					                </div>
					                <label class="modal-label" for="tocMenuSelect" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.toc_menu.label','TOC menu'))?></label>
					                <select id="tocMenuSelect" class="input" data-auth-superuser-enable="1">
					                    <option value="inline" <?= $tocMenu === 'inline' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.option_inline','Inline (default)'))?></option>
					                    <option value="left" <?= $tocMenu === 'left' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.option_left','Left sidebar'))?></option>
					                    <option value="right" <?= $tocMenu === 'right' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.option_right','Right sidebar'))?></option>
					                </select>
					                <label class="modal-label" for="tocExportStyleSelect" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.toc_menu.export_label','TOC export format'))?></label>
					                <select id="tocExportStyleSelect" class="input" data-auth-superuser-enable="1">
					                    <option value="list" <?= $tocExportStyle === 'list' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.export_list','List'))?></option>
					                    <option value="flat_links" <?= $tocExportStyle === 'flat_links' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.export_flat_links','Flat links'))?></option>
					                </select>
					                <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
					                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
					                    <input id="tocButtonToggle" type="checkbox" <?= $tocButtonEnabled ? 'checked' : '' ?> data-auth-superuser-enable="1">
					                    <span class="status-text"><?=h(mdw_t('theme.toc_menu.show_button','Show TOC toolbar button'))?></span>
					                </label>
					                <?php endif; ?>
					                <div id="copySettingsStatus" class="status-text" style="margin-top: 0.35rem;">
					                    <?=h(mdw_t('theme.copy.hint','Saved for all users.'))?>
					                </div>
					                <div id="tocMenuStatus" class="status-text" style="margin-top: 0.35rem;">
					                    <?=h(mdw_t('theme.toc_menu.hint','Side menu appears in preview/view and only exports in wet HTML.'))?>
					                </div>
					            </div>

					            <div class="modal-field" data-auth-superuser="1">
					                <label class="modal-label" for="postDateFormatSelect"><?=h(mdw_t('theme.post_date_format.label','Post date format'))?></label>
					                <select id="postDateFormatSelect" class="input" data-auth-superuser-enable="1">
					                    <option value="mdy_short" <?= $postDateFormat === 'mdy_short' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_format.option_mdy_short','Nov 20, 2025'))?></option>
					                    <option value="dmy_long" <?= $postDateFormat === 'dmy_long' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_format.option_dmy_long','16 December 2025'))?></option>
					                </select>
					                <div id="postDateFormatStatus" class="status-text" style="margin-top: 0.35rem;">
					                    <?=h(mdw_t('theme.post_date_format.hint','Saved for all users.'))?>
					                </div>
					            </div>
					            <div class="modal-field" data-auth-superuser="1">
					                <label class="modal-label" for="postDateAlignSelect"><?=h(mdw_t('theme.post_date_align.label','Post date alignment'))?></label>
					                <select id="postDateAlignSelect" class="input" data-auth-superuser-enable="1">
					                    <option value="left" <?= $postDateAlign === 'left' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_align.option_left','Left'))?></option>
					                    <option value="center" <?= $postDateAlign === 'center' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_align.option_center','Center'))?></option>
					                    <option value="right" <?= $postDateAlign === 'right' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_align.option_right','Right'))?></option>
					                </select>
					                <div id="postDateAlignStatus" class="status-text" style="margin-top: 0.35rem;">
					                    <?=h(mdw_t('theme.post_date_align.hint','Saved for all users.'))?>
					                </div>
					            </div>
					        </div>
					    </details>

					    <details class="theme-modal-section" style="margin-top: 0.8rem;">
					        <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.theme_settings.title','Theme settings'))?></span></summary>
					        <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
						        <div class="modal-field">
							            <label class="modal-label" for="themePreset"><?=h(mdw_t('theme.preset','Theme'))?></label>
						            <div style="display:flex; align-items:center; gap:0.6rem;">
							            <select id="themePreset" class="input" style="flex: 1 1 auto;">
					                <option value="default"><?=h(mdw_t('theme.default','Default'))?></option>
					                <?php foreach ($themesList as $t): ?>
					                    <?php
					                        $label = (isset($t['label']) && is_string($t['label']) && $t['label'] !== '') ? $t['label'] : $t['name'];
					                        if (isset($t['color']) && is_string($t['color']) && $t['color'] !== '') $label .= ' • ' . $t['color'];
					                    ?>
					                    <option value="<?=h($t['name'])?>"><?=h($label)?></option>
					                <?php endforeach; ?>
						            </select>
						            <div aria-hidden="true" style="display:flex; gap:0.35rem; align-items:center;">
						                <span id="themeSwatchPrimary" style="width: 1rem; height: 1rem; border-radius: 0.35rem; border:1px solid var(--border-soft);"></span>
						                <span id="themeSwatchSecondary" style="width: 1rem; height: 1rem; border-radius: 0.35rem; border:1px solid var(--border-soft);"></span>
						            </div>
					            </div>
				            <div class="status-text" style="margin-top: 0.4rem;">
				                <?=h(mdw_t('theme.applies_hint','Applies only to the Markdown editor + HTML preview.'))?>
				            </div>
					        </div>

					        <div style="margin-top: 0.35rem;">
						            <div class="modal-label" style="font-weight: 600;"><?=h(mdw_t('theme.overrides.summary','Theme adjustments (optional)'))?></div>
					            <div style="margin-top: 0.55rem; display:flex; flex-direction:column; gap: 0.75rem;">
					                <div class="status-text">
					                    <?=h(mdw_t('theme.overrides.saved_auto','Theme adjustments are saved in your browser (localStorage) automatically as you type.'))?>
				                    <span id="themeOverridesStatus" class="chip theme-overrides-status" hidden aria-live="polite"></span>
				                </div>
				                <div class="modal-field">
				                    <div class="modal-label" style="margin-bottom: 0.35rem;"><?=h(mdw_t('theme.overrides.preview_section','HTML preview'))?></div>
				                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
				                        <input id="themePreviewBg" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.preview_bg','Background (e.g. #ffffff)'))?>">
				                        <input id="themePreviewText" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.preview_text','Text color (e.g. #111827)'))?>">
				                        <input id="themePreviewFont" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.preview_font','Font family (e.g. Playfair Display)'))?>">
				                        <input id="themePreviewFontSize" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.preview_font_size','Font size (e.g. 16px)'))?>">
				                        <input id="themeHeadingFont" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.heading_font','Heading font family (e.g. Montserrat)'))?>">
				                        <input id="themeHeadingColor" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.heading_color','Heading color (e.g. rgb(229,33,157))'))?>">
				                        <input id="themeListColor" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.list_color','List color (optional)'))?>">
				                        <input id="themeBlockquoteTint" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.blockquote_tint','Blockquote tint (optional)'))?>">
				                    </div>
				                </div>

				                <div class="modal-field">
				                    <div class="modal-label" style="margin-bottom: 0.35rem;"><?=h(mdw_t('theme.overrides.editor_section','Markdown editor'))?></div>
				                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
				                        <input id="themeEditorFont" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.editor_font','Font family (e.g. Playfair Display)'))?>">
				                        <input id="themeEditorFontSize" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.editor_font_size','Font size (e.g. 15px)'))?>">
				                        <input id="themeEditorAccent" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.editor_accent','Accent color (e.g. rgb(229,33,157))'))?>">
				                    </div>
				                </div>
				                <div class="modal-field">
				                    <label class="modal-label" for="themeCustomCss"><?=h(mdw_t('theme.overrides.custom_css_label','Custom CSS'))?></label>
				                    <textarea id="themeCustomCss" class="input" rows="6" placeholder="<?=h(mdw_t('theme.overrides.custom_css_placeholder','e.g. .callout { padding: 12px; border-radius: 10px; }'))?>"></textarea>
				                    <div class="status-text" style="margin-top: 0.35rem;">
				                        <?=h(mdw_t('theme.overrides.custom_css_hint','Applies to the HTML preview and wet HTML export.'))?>
				                    </div>
				                </div>

				                <div style="display:flex; gap: 0.6rem; align-items:center; justify-content:flex-end;">
					                    <button type="button" class="btn btn-ghost btn-small" id="themeSaveOverridesBtn" title="<?=h(mdw_t('theme.overrides.save_title','Save theme adjustments now'))?>"><?=h(mdw_t('theme.overrides.save_btn','Save theme adjustments'))?></button>
					                    <button type="button" class="btn btn-ghost btn-small" id="themeResetBtn" title="<?=h(mdw_t('theme.overrides.reset_title','Clear theme adjustments'))?>"><?=h(mdw_t('theme.overrides.reset_btn','Reset theme adjustments'))?></button>
				                </div>
					            </div>
					        </div>
					        </div>
					    </details>

				        <details class="theme-modal-section" style="margin-top: 0.8rem;">
				            <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.metadata.title','Metadata'))?></span></summary>
				            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
				                <?php
				                    $publisherMode = !empty(($META_CFG['_settings']['publisher_mode'] ?? false));
				                    $publisherAuthor = (string)($META_CFG['_settings']['publisher_default_author'] ?? '');
				                    $publisherRequireH2 = !array_key_exists('publisher_require_h2', ($META_CFG['_settings'] ?? []))
				                        ? true
				                        : !empty($META_CFG['_settings']['publisher_require_h2']);
				                ?>
				                <div class="modal-field" style="margin: 0;">
				                    <div class="modal-label"><?=h(mdw_t('theme.publisher.title','WPM (Website publication mode)'))?></div>
				                    <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                        <input id="publisherModeToggle" type="checkbox" <?= $publisherMode ? 'checked' : '' ?>>
				                        <span class="status-text"><?=h(mdw_t('theme.publisher.enable','Enable WPM'))?></span>
				                    </label>
				                    <div class="status-text" style="margin-top: 0.35rem;">
				                        <?=h(mdw_t('theme.publisher.hint','WPM adds publish states (Concept / Processing / Published) and shows them in the overview. Requires an author name; subtitle requirement is optional.'))?>
				                    </div>
				                    <div style="display:grid; grid-template-columns: 1fr; gap: 0.35rem; margin-top: 0.6rem;">
				                        <label class="status-text" for="publisherAuthorInput"><?=h(mdw_t('theme.publisher.author_label','Author name'))?></label>
				                        <input id="publisherAuthorInput" type="text" class="input" value="<?=h($publisherAuthor)?>" placeholder="<?=h(mdw_t('theme.publisher.author_placeholder','Your name'))?>">
				                    </div>
				                    <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.6rem;">
				                        <input id="publisherRequireH2Toggle" type="checkbox" <?= $publisherRequireH2 ? 'checked' : '' ?>>
				                        <span class="status-text"><?=h(mdw_t('theme.publisher.require_subtitle','Require subtitle (##)'))?></span>
				                    </label>
				                </div>
				                <div class="status-text">
				                    <?=h(mdw_t('theme.metadata.hint','Control whether metadata is shown in the Markdown editor and/or HTML preview. If hidden in Markdown, it is also hidden in HTML preview.'))?>
				                </div>
				                <?php if (!empty($aw_ssg_template_plugin_loaded)): ?>
				                <div class="modal-field" style="margin: 0;">
				                    <label class="modal-label" for="jinjaMetaPrefixInput"><?=h(mdw_t('theme.metadata.jinja_prefix_label','Jinja mapped prefix'))?></label>
				                    <div class="modal-row" style="gap: 0.6rem; margin: 0;">
				                        <input id="jinjaMetaPrefixInput" type="text" class="input" style="flex: 1 1 auto;" value="<?=h($jinjaMetaPrefix)?>" placeholder="<?=h(mdw_t('theme.metadata.jinja_prefix_placeholder','page_'))?>">
				                        <button type="button" class="btn btn-ghost btn-small" id="jinjaMetaPrefixSaveBtn"><?=h(mdw_t('theme.metadata.jinja_prefix_save','Save prefix'))?></button>
				                    </div>
				                    <div id="jinjaMetaPrefixStatus" class="status-text" style="margin-top: 0.35rem;">
				                        <?=h(mdw_t('theme.metadata.jinja_prefix_hint','Maps metadata keys like page_picture -> blog_picture in Template download (default: page_).'))?>
				                    </div>
				                </div>
				                <?php endif; ?>
				                <div style="display:grid; grid-template-columns: 1fr auto auto auto minmax(10rem, 1fr); gap: 0.5rem 0.75rem; align-items:center;">
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.field','Field'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_markdown','Markdown'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_html','HTML'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.obligatory','Obligatory'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.default_value','Default value'))?></div>
				                    <?php foreach (($META_CFG['fields'] ?? []) as $k => $f): ?>
				                        <?php
				                            $label = (string)($f['label'] ?? $k);
				                            $mdVis = !empty($f['markdown_visible']);
				                            $allowHtmlNoMd = ($k === 'author');
				                            $htmlVis = !empty($f['html_visible']) && ($mdVis || $allowHtmlNoMd);
				                            $obligatory = !empty($f['obligatory']);
				                            $defaultValue = trim((string)($f['default_value'] ?? ''));
				                            $defaultIsBoolean = in_array(strtolower($defaultValue), ['true', 'false'], true);
				                        ?>
				                        <div><?=h($label)?></div>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="markdown" <?= $mdVis ? 'checked' : '' ?>>
				                        </label>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="html" <?= $htmlVis ? 'checked' : '' ?> <?= ($mdVis || $allowHtmlNoMd) ? '' : 'disabled' ?>>
				                        </label>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="obligatory" <?= $obligatory ? 'checked' : '' ?>>
				                        </label>
				                        <?php if ($defaultIsBoolean): ?>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:flex-start; gap:0.4rem;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="default_value_boolean" <?= strtolower($defaultValue) === 'true' ? 'checked' : '' ?> aria-label="<?=h(mdw_t('theme.metadata.default_value','Default value'))?>">
				                            <span class="status-text" data-meta-boolean-label></span>
				                        </label>
				                        <?php else: ?>
				                        <input type="text" class="input" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="default_value" value="<?=h($defaultValue)?>" placeholder="<?=h(mdw_t('theme.metadata.default_value_placeholder','e.g. True'))?>">
				                        <?php endif; ?>
				                    <?php endforeach; ?>
				                </div>
				                <div id="publisherMetaFields" style="<?= $publisherMode ? '' : 'display:none;' ?> border-top: 1px solid var(--border-soft); padding-top: 0.75rem; margin-top: 0.25rem;">
				                    <div class="status-text" style="font-weight: 600; margin-bottom: 0.4rem;"><?=h(mdw_t('theme.publisher.title','WPM (Website publication mode)'))?></div>
				                    <div style="display:grid; grid-template-columns: 1fr auto auto auto minmax(10rem, 1fr); gap: 0.5rem 0.75rem; align-items:center;">
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.field','Field'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_markdown','Markdown'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_html','HTML'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.obligatory','Obligatory'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.default_value','Default value'))?></div>
				                        <?php foreach (($META_PUBLISHER_CFG['fields'] ?? []) as $k => $f): ?>
				                            <?php
				                                $label = (string)($f['label'] ?? $k);
				                                $mdVis = !empty($f['markdown_visible']);
				                                $allowHtmlNoMd = ($k === 'author');
				                                $htmlVis = !empty($f['html_visible']) && ($mdVis || $allowHtmlNoMd);
				                                $obligatory = !empty($f['obligatory']);
				                                $defaultValue = trim((string)($f['default_value'] ?? ''));
				                                $defaultIsBoolean = in_array(strtolower($defaultValue), ['true', 'false'], true);
				                            ?>
				                            <div><?=h($label)?></div>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="markdown" <?= $mdVis ? 'checked' : '' ?>>
				                            </label>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="html" <?= $htmlVis ? 'checked' : '' ?> <?= ($mdVis || $allowHtmlNoMd) ? '' : 'disabled' ?>>
				                            </label>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="obligatory" <?= $obligatory ? 'checked' : '' ?>>
				                            </label>
				                            <?php if ($defaultIsBoolean): ?>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:flex-start; gap:0.4rem;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="default_value_boolean" <?= strtolower($defaultValue) === 'true' ? 'checked' : '' ?> aria-label="<?=h(mdw_t('theme.metadata.default_value','Default value'))?>">
				                                <span class="status-text" data-meta-boolean-label></span>
				                            </label>
				                            <?php else: ?>
				                            <input type="text" class="input" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="default_value" value="<?=h($defaultValue)?>" placeholder="<?=h(mdw_t('theme.metadata.default_value_placeholder','e.g. True'))?>">
				                            <?php endif; ?>
				                        <?php endforeach; ?>
				                    </div>
				                </div>
				                <div style="display:flex; align-items:center; gap: 0.6rem; justify-content:flex-end;">
				                    <span id="metaSettingsStatus" class="status-text"></span>
				                    <button type="button" class="btn btn-ghost btn-small" id="metaSettingsSaveBtn"><?=h(mdw_t('theme.metadata.save','Save metadata settings'))?></button>
				                </div>
				            </div>
				        </details>
                        <?php if ($github_pages_plugin_loaded): ?>
                        <details class="theme-modal-section" style="margin-top: 0.8rem;" data-auth-superuser="1">
                            <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.github_pages.title','GitHub Pages export'))?></span></summary>
                            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.6rem;">
                                <div class="status-text"><?=h(mdw_t('theme.github_pages.hint','Run a configuration check before exporting.'))?></div>
                                <div style="display:flex; align-items:center; gap: 0.6rem; flex-wrap: wrap;">
                                    <button type="button" id="githubPagesCheckBtn" class="btn btn-ghost btn-small" data-auth-superuser-enable="1"><?=h(mdw_t('theme.github_pages.check_btn','Check GitHub Pages config'))?></button>
                                </div>
                                <div id="githubPagesCheckStatus" class="status-text"></div>
                                <div id="githubPagesCheckDetails" class="status-text" style="white-space: pre-line;"></div>
                            </div>
                        </details>
                        <?php endif; ?>
				        <details class="theme-modal-section" style="margin-top: 0.8rem;" data-auth-superuser="1">
				            <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.settings_io.title','Settings import/export'))?></span></summary>
				            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
				                <div class="settings-io-grid">
				                    <div class="modal-field" style="margin: 0;">
				                        <div class="modal-label"><?=h(mdw_t('theme.settings_io.export_label','Export'))?></div>
				                        <button type="button" id="settingsExportBtn" class="btn btn-ghost btn-small" data-auth-superuser-enable="1"><?=h(mdw_t('theme.settings_io.export_btn','Export settings'))?></button>
				                    </div>
				                    <div class="modal-field" style="margin: 0;">
				                        <label class="modal-label" for="settingsImportFile"><?=h(mdw_t('theme.settings_io.import_label','Import'))?></label>
				                        <div style="display:flex; align-items:center; gap: 0.6rem; flex-wrap:wrap;">
				                            <input id="settingsImportFile" type="file" class="input" accept="application/json" data-auth-superuser-enable="1">
				                            <button type="button" id="settingsImportBtn" class="btn btn-ghost btn-small" data-auth-superuser-enable="1"><?=h(mdw_t('theme.settings_io.import_btn','Import settings'))?></button>
				                        </div>
				                    </div>
				                </div>
				                <div id="settingsImportExportStatus" class="status-text"></div>
				            </div>
				        </details>
		    </div>
		    <div class="modal-footer">
				        <button type="button" class="btn btn-ghost" id="themeModalCancel"><?=h(mdw_t('common.close','Close'))?></button>
				    </div>
				</div>
