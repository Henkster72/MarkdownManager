(function(){
    const btn = document.getElementById('themeToggle');
    const icon = document.getElementById('themeIcon');
    const root = document.documentElement;

    if (!btn || !icon) return;

    function updateIcon() {
        const isDark = root.classList.contains('dark');
        icon.classList.toggle('pi-moon', isDark);
        icon.classList.toggle('pi-sun', !isDark);
    }

    function setTheme(mode) {
        const useDark = mode === 'dark';
        root.classList.toggle('dark', useDark);
        root.classList.toggle('theme-light', !useDark);
        localStorage.setItem('mdsite-theme', useDark ? 'dark' : 'light');
        updateIcon();
    }

    btn.addEventListener('click', function(){
        const next = root.classList.contains('dark') ? 'light' : 'dark';
        setTheme(next);
    });

    updateIcon();
})();

// Theme presets + overrides (edit.php + index.php)
(function(){
    const STORAGE_PRESET = 'mdw-theme-preset';
    const STORAGE_OVERRIDES = 'mdw-theme-overrides';
    const STYLE_ID = 'mdwThemeStyle';

    const listThemes = () => Array.isArray(window.MDW_THEMES) ? window.MDW_THEMES : [];
    const findTheme = (name) => {
        const q = String(name || '').trim().toLowerCase();
        if (!q) return null;
        for (const t of listThemes()) {
            if (!t || typeof t.name !== 'string') continue;
            if (t.name.toLowerCase() === q) return t;
        }
        return null;
    };

    const readPreset = () => {
        const raw = String(localStorage.getItem(STORAGE_PRESET) || '').trim();
        if (!raw) return 'default';
        if (raw.toLowerCase() === 'candy' && findTheme('Candy')) return 'Candy';
        const t = findTheme(raw);
        return t ? t.name : 'default';
    };

    const readOverrides = () => {
        try {
            const raw = localStorage.getItem(STORAGE_OVERRIDES);
            if (!raw) return { preview: {}, editor: {} };
            const obj = JSON.parse(raw);
            const preview = (obj && typeof obj.preview === 'object' && obj.preview) ? obj.preview : {};
            const editor = (obj && typeof obj.editor === 'object' && obj.editor) ? obj.editor : {};
            return { preview, editor };
        } catch {
            return { preview: {}, editor: {} };
        }
    };

    const writeOverrides = (o) => {
        localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(o || { preview: {}, editor: {} }));
    };

    const ensureStyleEl = () => {
        let el = document.getElementById(STYLE_ID);
        if (el && el.tagName === 'STYLE') return el;
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
        return el;
    };

    const ensureThemeLink = (id) => {
        let el = document.getElementById(id);
        if (el && el.tagName === 'LINK') return el;
        el = document.createElement('link');
        el.id = id;
        el.rel = 'stylesheet';
        document.head.appendChild(el);
        return el;
    };

    const setThemeLink = (id, href) => {
        const el = ensureThemeLink(id);
        const next = String(href || '').trim();
        if (!next) {
            el.disabled = true;
            el.removeAttribute('href');
            return;
        }
        el.disabled = false;
        el.href = next;
    };

    const clearThemeFontLinks = () => {
        document.querySelectorAll('link[data-mdw-theme-font]').forEach((el) => el.remove());
    };

    const applyThemeFonts = (theme) => {
        clearThemeFontLinks();
        const fonts = theme?.fonts;
        const preconnect = Array.isArray(fonts?.preconnect) ? fonts.preconnect : [];
        const stylesheets = Array.isArray(fonts?.stylesheets) ? fonts.stylesheets : [];

        const addLink = (rel, href, extra) => {
            const link = document.createElement('link');
            link.rel = rel;
            link.href = href;
            link.setAttribute('data-mdw-theme-font', '1');
            if (extra && typeof extra === 'object') {
                for (const [k, v] of Object.entries(extra)) {
                    if (v == null) continue;
                    link.setAttribute(k, String(v));
                }
            }
            document.head.appendChild(link);
        };

        for (const href of preconnect) {
            const h = String(href || '').trim();
            if (!h) continue;
            const extra = h.includes('fonts.gstatic.com') ? { crossorigin: 'anonymous' } : null;
            addLink('preconnect', h, extra);
        }

        for (const href of stylesheets) {
            const h = String(href || '').trim();
            if (!h) continue;
            addLink('stylesheet', h);
        }
    };

    const overridesCss = (ov) => {
        const preview = ov?.preview || {};
        const editor = ov?.editor || {};
        const css = [];

        const add = (s) => { if (s) css.push(s); };
        const val = (x) => String(x || '').trim();

        const pBg = val(preview.bg);
        const pText = val(preview.text);
        const pFont = val(preview.font);
        const pSize = val(preview.fontSize);
        const hFont = val(preview.headingFont);
        const hColor = val(preview.headingColor);
        const listColor = val(preview.listColor);
        const bqTint = val(preview.blockquoteTint);

        if (pBg || pText || pFont || pSize) {
            const props = [];
            if (pBg) props.push(`background: ${pBg};`);
            if (pText) props.push(`color: ${pText};`);
            if (pFont) props.push(`font-family: ${pFont};`);
            if (pSize) props.push(`font-size: ${pSize};`);
            add(`.preview-content { ${props.join(' ')} }`);
        }

        if (hFont || hColor) {
            const props = [];
            if (hFont) props.push(`font-family: ${hFont};`);
            if (hColor) props.push(`color: ${hColor};`);
            add(`.preview-content h1, .preview-content h2, .preview-content h3, .preview-content h4, .preview-content h5, .preview-content h6 { ${props.join(' ')} }`);
        }

        if (pText) {
            add(`.preview-content p { color: ${pText}; }`);
        }

        if (listColor) {
            add(`.preview-content ul, .preview-content ol, .preview-content li { color: ${listColor}; }`);
        }

        if (bqTint) {
            add(`.preview-content blockquote { border-left-color: ${bqTint}; background-color: color-mix(in srgb, ${bqTint} 12%, transparent); color: color-mix(in srgb, ${bqTint} 70%, currentColor); }`);
        }

        const eFont = val(editor.font);
        const eSize = val(editor.fontSize);
        const eAccent = val(editor.accent);

        if (eFont || eSize) {
            const props = [];
            if (eFont) props.push(`font-family: ${eFont};`);
            if (eSize) props.push(`font-size: ${eSize};`);
            add(`.editor-textarea { ${props.join(' ')} }`);
        }

        if (eAccent) {
            add(`.editor-lines { color: ${eAccent}; }`);
            add(`.editor-textarea { caret-color: ${eAccent}; }`);
            add(`.editor-textarea::selection { background-color: color-mix(in srgb, ${eAccent} 22%, transparent); }`);
        }

        return css.join('\n');
    };

    const applyTheme = () => {
        const preset = readPreset();
        const overrides = readOverrides();

        const dir = String(window.MDW_THEMES_DIR || 'themes').replace(/\\/g, '/').replace(/\/+$/, '');
        const t = preset === 'default' ? null : findTheme(preset);

        if (!t) {
            setThemeLink('mdwThemeHtmlpreviewCss', '');
            setThemeLink('mdwThemeMarkdownCss', '');
            applyThemeFonts(null);
        } else {
            const name = t.name;
            const base = `${dir}/${encodeURIComponent(name)}`;
            setThemeLink('mdwThemeHtmlpreviewCss', t.htmlpreview ? `${base}_htmlpreview.css` : '');
            setThemeLink('mdwThemeMarkdownCss', t.markdown ? `${base}_markdown.css` : '');
            applyThemeFonts(t);
        }

        const css = overridesCss(overrides).trim();
        const styleEl = ensureStyleEl();
        styleEl.textContent = css ? (css + '\n') : '';
    };

    window.__mdwApplyTheme = applyTheme;

    // UI (optional)
    const btn = document.getElementById('themeSettingsBtn');
    const modal = document.getElementById('themeModal');
    const overlay = document.getElementById('themeModalOverlay');
    const presetSelect = document.getElementById('themePreset');
    const presetPreview = document.getElementById('themePresetPreview');
    const swatchPrimary = document.getElementById('themeSwatchPrimary');
    const swatchSecondary = document.getElementById('themeSwatchSecondary');
    const closeBtn = document.getElementById('themeModalClose');
    const cancelBtn = document.getElementById('themeModalCancel');
    const resetBtn = document.getElementById('themeResetBtn');
    const saveBtn = document.getElementById('themeSaveOverridesBtn');
    const overridesStatus = document.getElementById('themeOverridesStatus');

    const inputs = {
        previewBg: document.getElementById('themePreviewBg'),
        previewText: document.getElementById('themePreviewText'),
        previewFont: document.getElementById('themePreviewFont'),
        previewFontSize: document.getElementById('themePreviewFontSize'),
        headingFont: document.getElementById('themeHeadingFont'),
        headingColor: document.getElementById('themeHeadingColor'),
        listColor: document.getElementById('themeListColor'),
        blockquoteTint: document.getElementById('themeBlockquoteTint'),
        editorFont: document.getElementById('themeEditorFont'),
        editorFontSize: document.getElementById('themeEditorFontSize'),
        editorAccent: document.getElementById('themeEditorAccent'),
    };

    const setOverridesStatus = (msg, kind = 'info') => {
        if (!overridesStatus) return;
        overridesStatus.textContent = String(msg || '');
        overridesStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const updateThemeUi = () => {
        const selected = presetSelect ? presetSelect.value : '';
        const t = selected && selected !== 'default' ? findTheme(selected) : null;

        const name = t?.label || t?.name || 'Default';
        const color = String(t?.color || '').trim();
        const bg = String(t?.bg || '').trim();
        const secondary = String(t?.secondary || '').trim();

        if (presetSelect instanceof HTMLSelectElement) {
            presetSelect.style.color = color || '';
            presetSelect.style.backgroundColor = bg || '';
            presetSelect.style.borderColor = color ? 'rgba(148, 163, 184, 0.55)' : '';
        }

        if (swatchPrimary instanceof HTMLElement) {
            swatchPrimary.style.backgroundColor = color || 'transparent';
            swatchPrimary.title = color ? `Primary: ${color}` : 'Primary';
        }
        if (swatchSecondary instanceof HTMLElement) {
            swatchSecondary.style.backgroundColor = secondary || 'transparent';
            swatchSecondary.title = secondary ? `Secondary: ${secondary}` : 'Secondary';
        }

        if (presetPreview instanceof HTMLElement) {
            if (!t) {
                presetPreview.textContent = 'Default theme (uses built-in styles)';
                presetPreview.style.color = '';
                presetPreview.style.backgroundColor = '';
                presetPreview.style.borderColor = '';
            } else {
                presetPreview.textContent = `${name} • preview`;
                presetPreview.style.backgroundColor = bg || '';
                presetPreview.style.color = color || '';
                presetPreview.style.borderColor = color ? 'rgba(148, 163, 184, 0.55)' : '';
            }
        }
    };

    const open = () => {
        if (typeof window.__mdwCloseLinkModal === 'function') window.__mdwCloseLinkModal();
        if (typeof window.__mdwCloseImageModal === 'function') window.__mdwCloseImageModal();

        const preset = readPreset();
        if (presetSelect instanceof HTMLSelectElement) presetSelect.value = preset;
        updateThemeUi();

        const ov = readOverrides();
        if (inputs.previewBg instanceof HTMLInputElement) inputs.previewBg.value = String(ov.preview?.bg || '');
        if (inputs.previewText instanceof HTMLInputElement) inputs.previewText.value = String(ov.preview?.text || '');
        if (inputs.previewFont instanceof HTMLInputElement) inputs.previewFont.value = String(ov.preview?.font || '');
        if (inputs.previewFontSize instanceof HTMLInputElement) inputs.previewFontSize.value = String(ov.preview?.fontSize || '');
        if (inputs.headingFont instanceof HTMLInputElement) inputs.headingFont.value = String(ov.preview?.headingFont || '');
        if (inputs.headingColor instanceof HTMLInputElement) inputs.headingColor.value = String(ov.preview?.headingColor || '');
        if (inputs.listColor instanceof HTMLInputElement) inputs.listColor.value = String(ov.preview?.listColor || '');
        if (inputs.blockquoteTint instanceof HTMLInputElement) inputs.blockquoteTint.value = String(ov.preview?.blockquoteTint || '');
        if (inputs.editorFont instanceof HTMLInputElement) inputs.editorFont.value = String(ov.editor?.font || '');
        if (inputs.editorFontSize instanceof HTMLInputElement) inputs.editorFontSize.value = String(ov.editor?.fontSize || '');
        if (inputs.editorAccent instanceof HTMLInputElement) inputs.editorAccent.value = String(ov.editor?.accent || '');

        overlay.hidden = false;
        modal.hidden = false;
        document.documentElement.classList.add('modal-open');
        setTimeout(() => presetSelect?.focus(), 0);
    };

    const close = () => {
        overlay.hidden = true;
        modal.hidden = true;
        document.documentElement.classList.remove('modal-open');
        btn?.focus();
    };

    window.__mdwCloseThemeModal = close;

    const persistFromInputs = () => {
        const ov = readOverrides();
        ov.preview = ov.preview || {};
        ov.editor = ov.editor || {};

        const set = (obj, key, inputEl) => {
            if (!(inputEl instanceof HTMLInputElement)) return;
            const v = String(inputEl.value || '').trim();
            if (v) obj[key] = v;
            else delete obj[key];
        };

        set(ov.preview, 'bg', inputs.previewBg);
        set(ov.preview, 'text', inputs.previewText);
        set(ov.preview, 'font', inputs.previewFont);
        set(ov.preview, 'fontSize', inputs.previewFontSize);
        set(ov.preview, 'headingFont', inputs.headingFont);
        set(ov.preview, 'headingColor', inputs.headingColor);
        set(ov.preview, 'listColor', inputs.listColor);
        set(ov.preview, 'blockquoteTint', inputs.blockquoteTint);
        set(ov.editor, 'font', inputs.editorFont);
        set(ov.editor, 'fontSize', inputs.editorFontSize);
        set(ov.editor, 'accent', inputs.editorAccent);

        writeOverrides(ov);
        applyTheme();
        setOverridesStatus('Saved', 'ok');
    };

    const resetOverrides = () => {
        writeOverrides({ preview: {}, editor: {} });
        Object.values(inputs).forEach((el) => {
            if (el instanceof HTMLInputElement) el.value = '';
        });
        applyTheme();
        setOverridesStatus('Cleared', 'ok');
    };

    if (btn && modal && overlay) {
        btn.addEventListener('click', open);
        overlay.addEventListener('click', close);
        closeBtn?.addEventListener('click', close);
        cancelBtn?.addEventListener('click', close);
        resetBtn?.addEventListener('click', resetOverrides);
        saveBtn?.addEventListener('click', persistFromInputs);

        presetSelect?.addEventListener('change', () => {
            const v = String(presetSelect.value || '').trim();
            const t = findTheme(v);
            localStorage.setItem(STORAGE_PRESET, t ? t.name : 'default');
            updateThemeUi();
            applyTheme();
        });

        Object.values(inputs).forEach((el) => {
            el?.addEventListener('input', persistFromInputs);
        });

        document.addEventListener('keydown', (e) => {
            if (modal.hidden) return;
            if (e.key !== 'Escape' && e.key !== 'Esc') return;
            e.preventDefault();
            close();
        });
    }

    // Always apply on load (even if the UI isn't on this page)
    applyTheme();
})();

// Header show on scroll up, hide on scroll down (index.php + edit.php)
(function(){
    const root = document.documentElement;
    const header = document.querySelector('.app-header');
    const scroller = document.querySelector('.app-main');
    if (!header || !scroller) return;

    let headerHeight = 0;
    const measure = () => {
        headerHeight = Math.max(0, Math.ceil(header.getBoundingClientRect().height));
        if (headerHeight) {
            root.style.setProperty('--app-header-height', headerHeight + 'px');
        }
    };

    measure();
    window.addEventListener('resize', measure, { passive: true });

    let hidden = false;

    const setHidden = (nextHidden) => {
        hidden = nextHidden;
        root.classList.toggle('header-hidden', hidden);
    };

    const attachScroller = (el) => {
        let lastTop = el.scrollTop;
        let ticking = false;

        const onScroll = () => {
            const isEdit = document.body?.classList.contains('edit-page');
            const isNarrow = window.matchMedia('(max-width: 960px)').matches;
            const allowInner = isEdit && isNarrow;
            const isPrimary = el === scroller;
            if (!isPrimary && !allowInner) return;

            const top = el.scrollTop;
            root.classList.toggle('header-scrolled', top > 2);

            if (root.classList.contains('nav-open')) {
                setHidden(false);
                lastTop = top;
                return;
            }

            const topThreshold = allowInner ? 2 : 6;
            if (top < topThreshold) {
                setHidden(false);
                lastTop = top;
                return;
            }

            const delta = top - lastTop;
            lastTop = top;

            const deltaThreshold = allowInner ? 4 : 8;
            if (Math.abs(delta) < deltaThreshold) return;

            const hideAfter = allowInner ? 24 : (headerHeight + 24);
            if (delta > 0 && top > hideAfter) {
                if (!hidden) setHidden(true);
            } else if (delta < 0) {
                if (hidden) setHidden(false);
            }
        };

        el.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                onScroll();
                ticking = false;
            });
        }, { passive: true });

        onScroll();
    };

    attachScroller(scroller);

    const editor = document.getElementById('editor');
    if (editor) attachScroller(editor);

    const previewBody = document.querySelector('#panePreview .pane-body');
    if (previewBody) attachScroller(previewBody);
})();

// Delete confirm (shared: index.php + edit.php)
(function(){
    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.classList.contains('deleteForm')) return;
        const file = form.dataset.file || form.querySelector('input[name="file"]')?.value || 'this file';
        if (!confirm(`Delete "${file}"?`)) {
            e.preventDefault();
        }
    }, true);
})();

// +MD panel toggle (index.php)
(function(){
    const newMdToggle = document.getElementById('newMdToggle');
    const newMdPanel = document.getElementById('newMdPanel');
    const newMdClose = document.getElementById('newMdClose');
    const newMdPrefixDate = document.getElementById('newMdPrefixDate');
    const newMdFile = document.getElementById('newMdFile');
    const newMdForm = newMdFile?.closest?.('form');
    const newFolderBtn = document.getElementById('newFolderBtn');
    const newFolderForm = document.getElementById('newFolderForm');
    const newFolderName = document.getElementById('newFolderName');

    if (!newMdToggle || !newMdPanel) return;

    const open = () => {
        newMdPanel.style.display = 'block';
        if (newMdFile instanceof HTMLInputElement) {
            newMdFile.focus();
            if (newMdFile.value) newMdFile.setSelectionRange(newMdFile.value.length, newMdFile.value.length);
        }
    };
    const close = () => { newMdPanel.style.display = 'none'; };
    const toggle = () => {
        const show = (newMdPanel.style.display === 'none' || newMdPanel.style.display === '');
        if (show) open();
        else close();
    };

    newMdToggle.addEventListener('click', toggle);
    newMdClose?.addEventListener('click', close);

    const ensureMdExtension = () => {
        if (!(newMdFile instanceof HTMLInputElement)) return;
        const v = (newMdFile.value || '').trim();
        if (!v) return;
        if (/\.md$/i.test(v)) return;
        newMdFile.value = v + '.md';
    };

    const applyPrefixToggle = () => {
        if (!(newMdPrefixDate instanceof HTMLInputElement)) return;
        if (!(newMdFile instanceof HTMLInputElement)) return;
        const prefix = newMdPrefixDate.dataset.datePrefix || '';
        const v = newMdFile.value || '';

        if (newMdPrefixDate.checked) {
            if (v.trim() === '' && prefix) {
                newMdFile.value = prefix;
                return;
            }
            if (!/^\d{2}-\d{2}-\d{2}-/.test(v) && prefix) {
                newMdFile.value = prefix + v;
            }
            return;
        }

        // Remove an existing yy-mm-dd- prefix when unchecked.
        newMdFile.value = v.replace(/^\d{2}-\d{2}-\d{2}-/, '');
    };

    newMdPrefixDate?.addEventListener('change', applyPrefixToggle);
    newMdFile?.addEventListener('blur', ensureMdExtension);
    if (newMdForm instanceof HTMLFormElement) {
        newMdForm.addEventListener('submit', () => {
            applyPrefixToggle();
            ensureMdExtension();
        });
    }

    if (newMdPanel.style.display !== 'none' && newMdPanel.style.display !== '') {
        open();
    }
    applyPrefixToggle();

    newFolderBtn?.addEventListener('click', () => {
        if (!(newFolderForm instanceof HTMLFormElement)) return;
        if (!(newFolderName instanceof HTMLInputElement)) return;
        const name = window.prompt('New folder name (no slashes):', '');
        if (name === null) return;
        const folder = name.trim();
        if (!folder) return;
        if (folder.includes('/') || folder.includes('\\') || folder.includes('..')) {
            alert('Invalid folder name.');
            return;
        }
        newFolderName.value = folder;
        newFolderForm.submit();
    });
})();

// Ctrl/Cmd-Shift-N: create new markdown (opens +MD panel or redirects to index)
(function(){
    const inferFolderFromUrl = () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const folder = params.get('folder');
            if (folder) return folder;
            const file = params.get('file');
            if (file && file.includes('/')) return file.split('/')[0];
        } catch {}
        return null;
    };

    document.addEventListener('keydown', (e) => {
        if (!((e.ctrlKey || e.metaKey) && e.shiftKey)) return;
        if (!(e.key === 'n' || e.key === 'N')) return;

        const newMdPanel = document.getElementById('newMdPanel');
        const newMdFile = document.getElementById('newMdFile');
        if (newMdPanel && newMdFile instanceof HTMLInputElement) {
            e.preventDefault();
            newMdPanel.style.display = 'block';
            newMdFile.focus();
            if (newMdFile.value) newMdFile.setSelectionRange(newMdFile.value.length, newMdFile.value.length);
            return;
        }

        // Fallback: navigate to index and open panel.
        const folder = inferFolderFromUrl();
        const url = folder ? `index.php?new=1&folder=${encodeURIComponent(folder)}` : 'index.php?new=1';
        window.location.href = url;
    });
})();

// Keyboard shortcuts (index.php + edit.php)
(function(){
    const overview = document.getElementById('links_md_overview');
    if (!overview) return;

    const isEditorPage = !!document.getElementById('editor');
    const isIndexPage = document.body.classList.contains('index-page');
    const isIndexOverviewMode = (() => {
        if (!isIndexPage) return false;
        const params = new URLSearchParams(window.location.search);
        return !params.get('file');
    })();
    const getItems = () => Array.from(overview.querySelectorAll('a.kbd-item'))
        .filter(a => a instanceof HTMLAnchorElement)
        .filter(a => a.offsetParent !== null);

    let lastFocusedItem = null;
    const scrollFocus = (el) => {
        try { el.focus({preventScroll: true}); } catch { el.focus(); }
        el.scrollIntoView({block: 'nearest', inline: 'nearest'});
        lastFocusedItem = el;
    };

    const focusRelative = (delta) => {
        const items = getItems();
        if (items.length === 0) return;
        const active = document.activeElement;
        let idx = items.findIndex(el => el === active);
        if (idx === -1) {
            idx = delta > 0 ? -1 : items.length;
        }
        const next = Math.max(0, Math.min(items.length - 1, idx + delta));
        scrollFocus(items[next]);
    };

    const getFileForActive = () => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return null;
        const anchor = active.closest('a');
        if (!anchor) return null;
        const row = anchor.closest('[data-file]');
        if (row?.dataset?.kind && row.dataset.kind !== 'md') return null;
        if (row?.dataset?.file) return row.dataset.file;
        try {
            const url = new URL(anchor.getAttribute('href') || '', window.location.href);
            return url.searchParams.get('file');
        } catch {
            return null;
        }
    };

    const submitForm = (form) => {
        if (!form) return;
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
            return;
        }
        const btn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (btn) {
            btn.click();
            return;
        }
        form.submit();
    };

    const deleteFile = (file) => {
        if (!file) return;
        if (isEditorPage) {
            const input = document.getElementById('deleteFileInput');
            const form = document.getElementById('deleteForm');
            if (input) input.value = file;
            if (form) form.dataset.file = file;
            submitForm(form);
            return;
        }
        const row = overview.querySelector(`[data-file="${CSS.escape(file)}"]`);
        const form = row?.querySelector('form.deleteForm') || document.querySelector('form.deleteForm');
        submitForm(form);
    };

    const editFocused = (file) => {
        if (!file) return;
        if (isEditorPage) {
            document.getElementById('editor')?.focus();
        } else {
            window.location.href = `edit.php?file=${encodeURIComponent(file)}`;
        }
    };

    const focusFromQuery = () => {
        if (!isIndexPage) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('file')) return;
        const focusFile = params.get('focus');
        if (!focusFile) return;
        const el = overview.querySelector(`[data-file="${CSS.escape(focusFile)}"] a.kbd-item`);
        if (el instanceof HTMLAnchorElement) {
            scrollFocus(el);
        }
    };

    focusFromQuery();

    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return;
        if (isEditorPage) {
            if (!overview.contains(active)) return;
        } else if (isIndexOverviewMode) {
            // allow arrow navigation even when focus is not inside the list yet
        } else {
            if (!overview.contains(active)) return;
        }

        if (active.matches('input, textarea, [contenteditable="true"]')) return;

        if (e.key === 'Enter') {
            const items = getItems();
            if (items.length === 0) return;
            if (!overview.contains(active) && isIndexOverviewMode) {
                // Let Enter keep default behavior outside overview on index page
                return;
            }
            e.preventDefault();
            const a = (active instanceof HTMLAnchorElement && active.classList.contains('kbd-item'))
                ? active
                : active.closest?.('a.kbd-item');
            const toOpen = (a instanceof HTMLAnchorElement) ? a : lastFocusedItem;
            if (toOpen instanceof HTMLAnchorElement) {
                toOpen.click();
            } else {
                scrollFocus(items[0]);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            if (isIndexOverviewMode && !overview.contains(active)) {
                e.preventDefault();
                const items = getItems();
                if (items.length) scrollFocus(lastFocusedItem || items[0]);
                return;
            }
            e.preventDefault();
            focusRelative(1);
            return;
        }
        if (e.key === 'ArrowUp') {
            if (isIndexOverviewMode && !overview.contains(active)) {
                e.preventDefault();
                const items = getItems();
                if (items.length) scrollFocus(lastFocusedItem || items[items.length - 1]);
                return;
            }
            e.preventDefault();
            focusRelative(-1);
            return;
        }
        if (e.key === 'Delete') {
            const file = getFileForActive();
            if (!file) return;
            e.preventDefault();
            deleteFile(file);
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
            const file = getFileForActive();
            if (!file) return;
            e.preventDefault();
            editFocused(file);
        }
    });
})();

// Index preview-mode shortcuts (index.php?file=...)
(function(){
    if (!document.body.classList.contains('index-page')) return;
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    if (!file) return;

    const folderParam = params.get('folder');
    const inferredFolder = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : 'root';
    const folder = folderParam || inferredFolder;
    const focus = params.get('focus') || file;

    document.addEventListener('keydown', (e) => {
        const t = e.target;
        if (t instanceof HTMLElement && t.matches('input, textarea, [contenteditable="true"]')) return;

        if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const form = document.querySelector('form.deleteForm');
            if (!(form instanceof HTMLFormElement)) return;
            e.preventDefault();
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
                return;
            }
            const btn = form.querySelector('button[type="submit"], input[type="submit"]');
            if (btn instanceof HTMLElement) {
                btn.click();
                return;
            }
            form.submit();
            return;
        }

        if ((e.key === 'Backspace' || e.key === 'Escape' || e.key === 'Esc') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const url = `index.php?folder=${encodeURIComponent(folder)}&focus=${encodeURIComponent(focus)}`;
            window.location.href = url;
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
            e.preventDefault();
            const url = `edit.php?file=${encodeURIComponent(file)}&folder=${encodeURIComponent(folder)}`;
            window.location.href = url;
        }
    });
})();

// NAVIGATIE, FILTER & DOCUMENT LADEN
(function(){
    const normalizeNewlines = (s) => String(s ?? '').replace(/\r\n?/g, '\n');

    const overview = document.getElementById('links_md_overview');
    if (!overview) return;

    const isEditorPage = !!document.getElementById('editor');

    const filterInput = document.getElementById('filterInput');
    const editorForm = document.querySelector('.editor-form');
    const navOverlay = document.getElementById('navOverlay');
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    const mobileNavClose  = document.getElementById('mobileNavClose');
    const filterReset = document.getElementById('filterReset');
    const filterClear = document.getElementById('filterClear');

    if (!filterInput) return;

    const navCount = document.getElementById('navCount') || (() => {
        const counter = document.createElement('div');
        counter.id = 'filterCount';
        counter.className = 'status-text';
        counter.style.textAlign = 'center';
        counter.style.marginTop = '0.5rem';
        const filterWrap = document.getElementById('filterWrap');
        if (filterWrap && filterWrap.contains(filterInput)) {
            filterWrap.insertAdjacentElement('afterend', counter);
        } else {
            filterInput.insertAdjacentElement('afterend', counter);
        }
        return counter;
    })();

    const getFolderDefaultOpen = (section) => section.getAttribute('data-default-open') === '1';
    const getFolderUserOpen = (section) => {
        const v = section.getAttribute('data-user-open');
        if (v === null) return null;
        return v === '1';
    };
    const getFolderOpen = (section) => {
        const user = getFolderUserOpen(section);
        if (user !== null) return user;
        return getFolderDefaultOpen(section);
    };
    const setFolderOpen = (section, open) => {
        if (!(section instanceof HTMLElement)) return;
        const btn = section.querySelector('button.folder-toggle');
        if (!(btn instanceof HTMLButtonElement)) return;

        const id = btn.getAttribute('aria-controls');
        if (!id) return;
        const children = document.getElementById(id);
        if (!children) return;

        children.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.title = open ? 'Collapse folder' : 'Expand folder';

        const icon = btn.querySelector('.pi');
        if (icon) {
            icon.classList.toggle('pi-openfolder', open);
            icon.classList.toggle('pi-folder', !open);
        }
    };

    document.querySelectorAll('[data-folder-section]').forEach(section => {
        const btn = section.querySelector('button.folder-toggle');
        if (!(btn instanceof HTMLButtonElement)) return;
        btn.addEventListener('click', () => {
            const next = !getFolderOpen(section);
            section.setAttribute('data-user-open', next ? '1' : '0');
            setFolderOpen(section, next);
        });
        setFolderOpen(section, getFolderOpen(section));
    });

    const closeNav = () => {
        document.documentElement.classList.remove('nav-open');
    };
    const openNav = () => {
        document.documentElement.classList.add('nav-open');
    };

    mobileNavToggle?.addEventListener('click', openNav);
    mobileNavClose?.addEventListener('click', closeNav);
    navOverlay?.addEventListener('click', closeNav);

    function update() {
        const q = filterInput.value.toLowerCase();
        const docs = Array.from(overview.querySelectorAll('.doclink'))
            .filter(el => el instanceof HTMLElement);
        let visible = 0;
        docs.forEach(el => {
            const text = (el.innerText || el.textContent || '').toLowerCase();
            const match = text.includes(q);
            el.style.display = match ? '' : 'none'; // Gebruik class voor betere controle
            if (match) visible++;
        });
        navCount.textContent = q
            ? `${visible} item${visible === 1 ? '' : 's'}`
            : `${docs.length} total items`;
        if (filterReset) {
            filterReset.disabled = q.length === 0;
        }
        if (filterClear) {
            filterClear.style.display = q.length === 0 ? 'none' : '';
        }

        document.querySelectorAll('[data-folder-section]').forEach(section => {
            if (!(section instanceof HTMLElement)) return;
            if (!q) {
                setFolderOpen(section, getFolderOpen(section));
                return;
            }
            const anyVisible = Array.from(section.querySelectorAll('.doclink'))
                .some(el => el instanceof HTMLElement && el.style.display !== 'none');
            setFolderOpen(section, anyVisible);
        });
    }

    // q parameter uit URL
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    if (qParam) {
        filterInput.value = qParam;
    }

    filterInput.addEventListener('input', update);
    const clearFilter = () => {
        filterInput.value = '';
        update();
        filterInput.focus();
    };
    filterReset?.addEventListener('click', clearFilter);
    filterClear?.addEventListener('click', clearFilter);

    // Editor: SPA-achtige navigatie (only markdown items)
    if (isEditorPage) {
        const navItems = Array.from(overview.querySelectorAll('.doclink[data-kind="md"]'))
            .filter(el => el instanceof HTMLElement);

        const setCurrentItem = (item) => {
            if (!(item instanceof HTMLElement)) return;
            document.querySelectorAll('.nav-item-current').forEach(el => {
                el.classList.remove('nav-item-current', 'dirty');
                const a = el.querySelector('a.kbd-item');
                if (a) a.classList.remove('active');
            });
            item.classList.add('nav-item-current');
            const a = item.querySelector('a.kbd-item');
            if (a) a.classList.add('active');
        };

        const focusCurrentInExplorer = () => {
            const a = overview.querySelector('.nav-item-current a.kbd-item');
            if (a instanceof HTMLAnchorElement) {
                a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        };

        focusCurrentInExplorer();

        navItems.forEach(item => {
            const link = item.querySelector('a.kbd-item');
            if (!(link instanceof HTMLAnchorElement)) return;
            link.addEventListener('click', function(e) {
                if (e.defaultPrevented) return;
                if (e.button !== 0) return; // left click only
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

                const url = new URL(this.href, window.location.href);
                const file = url.searchParams.get('file');
                if (!file) return;
                e.preventDefault();

                const isSecret = item.dataset.secret === 'true';

                if (file === window.CURRENT_FILE) {
                    closeNav();
                    return;
                }

                if (window.__mdDirty) {
                    if (!confirm('You have unsaved changes. Discard them and continue?')) {
                        return;
                    }
                }

                if (isSecret && !window.IS_SECRET_AUTHENTICATED) {
                    window.location.href = this.href.replace('edit.php', 'index.php');
                    return;
                }

                setCurrentItem(item);
                loadDocument(file);
                closeNav();
            });
        });
    }

    async function loadDocument(file) {
        try {
            const response = await fetch(`edit.php?file=${encodeURIComponent(file)}&json=1`);
            if (response.status === 403) {
                window.location.href = `index.php?file=${encodeURIComponent(file)}`;
                return;
            }
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();

            // Update globale variabelen
            window.CURRENT_FILE = data.file;
            window.initialContent = normalizeNewlines(data.content);
            window.__mdDirty = false;
            if (typeof data.secret_authenticated === 'boolean') {
                window.IS_SECRET_AUTHENTICATED = data.secret_authenticated;
            }

            // Update UI
            document.title = `${data.title} • md edit`;
            document.querySelector('.app-title').textContent = data.title;
            const pathSegment = document.querySelector('.app-path-segment');
            if (pathSegment) pathSegment.textContent = data.file;

            const mdSubtitle = document.querySelector('#paneMarkdown .pane-subtitle.small');
            if (mdSubtitle) mdSubtitle.textContent = data.file;

            const headerSecretBadge = document.getElementById('headerSecretBadge');
            if (headerSecretBadge) {
                headerSecretBadge.style.display = data.is_secret ? '' : 'none';
            }
            
            const editorTextarea = document.getElementById('editor');
            const preview = document.getElementById('preview');
            const fileInput = editorForm.querySelector('input[name="file"]');

            editorTextarea.value = normalizeNewlines(data.content);
            preview.innerHTML = data.html;
            fileInput.value = data.file;

            const deleteFileInput = document.getElementById('deleteFileInput');
            if (deleteFileInput) deleteFileInput.value = data.file;
            const deleteForm = document.getElementById('deleteForm');
            if (deleteForm) deleteForm.dataset.file = data.file;
            const deleteBtn = deleteForm?.querySelector('button[type="submit"]');
            if (deleteBtn) deleteBtn.disabled = !data.file;

            if (window.MathJax?.typesetPromise) {
                try { await window.MathJax.typesetPromise([preview]); } catch {}
            }

            // Update browser history
            history.pushState({file: data.file}, '', `?file=${encodeURIComponent(data.file)}`);
            
            // Trigger line number update en andere afhankelijke functies
            editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));

        } catch (error) {
            console.error('Failed to load document:', error);
            document.getElementById('liveStatus').textContent = 'Error loading file.';
        }
    }

    update();
})();

	// Add link modal (edit.php)
	(function(){
	    const btn = document.getElementById('addLinkBtn');
	    const modal = document.getElementById('linkModal');
	    const overlay = document.getElementById('linkModalOverlay');
    const closeBtn = document.getElementById('linkModalClose');
    const cancelBtn = document.getElementById('linkModalCancel');
    const insertBtn = document.getElementById('linkModalInsert');
    const editor = document.getElementById('editor');
    if (!btn || !modal || !overlay || !insertBtn || !editor) return;

    const internalSection = document.getElementById('linkModalInternal');
    const externalSection = document.getElementById('linkModalExternal');
    const picker = document.getElementById('linkPicker');
    const pickerFilter = document.getElementById('linkPickerFilter');
    const pickerFilterClear = document.getElementById('linkPickerFilterClear');
    const externalText = document.getElementById('externalLinkText');
    const externalUrl = document.getElementById('externalLinkUrl');

    const normalizePath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const dirname = (p) => {
        p = normalizePath(p);
        const idx = p.lastIndexOf('/');
        return idx === -1 ? '' : p.slice(0, idx);
    };

    const relativePath = (fromFile, toFile) => {
        const fromDir = dirname(fromFile);
        const fromParts = fromDir ? fromDir.split('/').filter(Boolean) : [];
        const to = normalizePath(toFile);
        const toParts = to.split('/').filter(Boolean);
        if (toParts.length === 0) return '';
        const toDirParts = toParts.slice(0, -1);
        const toName = toParts[toParts.length - 1];

        let i = 0;
        while (i < fromParts.length && i < toDirParts.length && fromParts[i] === toDirParts[i]) i++;
        const up = fromParts.length - i;
        const down = toDirParts.slice(i);
        const out = [];
        for (let k = 0; k < up; k++) out.push('..');
        out.push(...down);
        out.push(toName);
        return out.join('/');
    };

    let mode = 'internal';
    let selectedPath = null;
    let selectedTitle = null;

    const setMode = (next) => {
        mode = next === 'external' ? 'external' : 'internal';
        if (internalSection) internalSection.hidden = mode !== 'internal';
        if (externalSection) externalSection.hidden = mode !== 'external';
        validate();
        if (mode === 'external') {
            externalUrl?.focus();
        } else {
            pickerFilter?.focus();
        }
    };

	    const open = () => {
	        if (typeof window.__mdwCloseImageModal === 'function') {
	            window.__mdwCloseImageModal();
	        }
	        if (typeof window.__mdwCloseThemeModal === 'function') {
	            window.__mdwCloseThemeModal();
	        }
	        overlay.hidden = false;
	        modal.hidden = false;
	        document.documentElement.classList.add('modal-open');

        if (pickerFilter) pickerFilter.value = '';
        if (pickerFilterClear) pickerFilterClear.style.display = 'none';

        const checked = modal.querySelector('input[name="linkMode"][value="internal"]');
        if (checked instanceof HTMLInputElement) checked.checked = true;
        setMode('internal');
    };

	    const close = () => {
	        overlay.hidden = true;
	        modal.hidden = true;
	        document.documentElement.classList.remove('modal-open');

        selectedPath = null;
        selectedTitle = null;
        picker?.querySelectorAll('.link-pick-item.is-selected').forEach(el => el.classList.remove('is-selected'));
        if (pickerFilter) pickerFilter.value = '';
        if (pickerFilterClear) pickerFilterClear.style.display = 'none';
        if (externalText) externalText.value = '';
        if (externalUrl) externalUrl.value = '';
        validate();
        btn.focus();
	    };

	    window.__mdwCloseLinkModal = close;

	    const getEditorSelectionText = () => {
	        const start = editor.selectionStart ?? 0;
	        const end = editor.selectionEnd ?? 0;
	        if (end > start) return editor.value.slice(start, end);
        return '';
    };

    const insertAtSelection = (text) => {
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? 0;
        const before = editor.value.slice(0, start);
        const after = editor.value.slice(end);
        editor.value = before + text + after;
        const pos = start + text.length;
        editor.setSelectionRange(pos, pos);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.focus();
    };

    const validate = () => {
        if (mode === 'external') {
            const url = String(externalUrl?.value || '').trim();
            insertBtn.disabled = url === '';
            return;
        }
        insertBtn.disabled = !selectedPath;
    };

    btn.addEventListener('click', open);
    overlay.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
        if (modal.hidden) return;
        if (e.key !== 'Escape' && e.key !== 'Esc') return;
        e.preventDefault();
        close();
    });

    modal.addEventListener('change', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (t.name !== 'linkMode') return;
        setMode(t.value);
    });

    externalUrl?.addEventListener('input', validate);

    picker?.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target.closest('.link-pick-item') : null;
        if (!(target instanceof HTMLElement)) return;
        const path = target.getAttribute('data-path');
        const title = target.getAttribute('data-title') || '';
        if (!path) return;

        picker.querySelectorAll('.link-pick-item.is-selected').forEach(el => el.classList.remove('is-selected'));
        target.classList.add('is-selected');
        selectedPath = path;
        selectedTitle = title || path;
        validate();
    });

    const applyPickerFilter = () => {
        if (!picker || !pickerFilter) return;
        const q = String(pickerFilter.value || '').trim().toLowerCase();
        if (pickerFilterClear) pickerFilterClear.style.display = q ? '' : 'none';

        picker.querySelectorAll('.nav-section').forEach(section => {
            if (!(section instanceof HTMLElement)) return;
            const items = Array.from(section.querySelectorAll('.link-pick-item'))
                .filter(el => el instanceof HTMLElement);
            let any = false;
            items.forEach(el => {
                const text = (el.textContent || '').toLowerCase();
                const match = !q || text.includes(q);
                el.closest('li')?.toggleAttribute('hidden', !match);
                if (match) any = true;
            });
            section.toggleAttribute('hidden', !any);
        });

        const selectedEl = picker.querySelector('.link-pick-item.is-selected');
        if (selectedEl instanceof HTMLElement) {
            const li = selectedEl.closest('li');
            const visible = li && !li.hasAttribute('hidden');
            if (!visible) {
                selectedEl.classList.remove('is-selected');
                selectedPath = null;
                selectedTitle = null;
                validate();
            }
        }
    };

    pickerFilter?.addEventListener('input', applyPickerFilter);
    pickerFilterClear?.addEventListener('click', () => {
        if (!pickerFilter) return;
        pickerFilter.value = '';
        applyPickerFilter();
        pickerFilter.focus();
    });

    const insertLink = () => {
        if (mode === 'external') {
            const url = String(externalUrl?.value || '').trim();
            if (!url) return;
            const selection = getEditorSelectionText();
            const text = selection || String(externalText?.value || '').trim() || url;
            insertAtSelection(`[${text}](${url})`);
            close();
            return;
        }

        if (!selectedPath) return;
        const selection = getEditorSelectionText();
        const text = selection || selectedTitle || selectedPath;
        const href = relativePath(window.CURRENT_FILE || '', selectedPath);
        insertAtSelection(`[${text}](${href})`);
        close();
    };

    insertBtn.addEventListener('click', insertLink);
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (!insertBtn.disabled) insertLink();
        }
    });

    applyPickerFilter();
    validate();
})();

	// Image manager modal (edit.php)
	(function(){
	    const btn = document.getElementById('addImageBtn');
	    const modal = document.getElementById('imageModal');
	    const overlay = document.getElementById('imageModalOverlay');
    const closeBtn = document.getElementById('imageModalClose');
    const cancelBtn = document.getElementById('imageModalCancel');
    const uploadInput = document.getElementById('imageUploadInput');
    const uploadBtn = document.getElementById('imageUploadBtn');
    const altInput = document.getElementById('imageAltInput');
    const csrfInput = document.getElementById('imageCsrf');
    const listEl = document.getElementById('imageList');
    const filterEl = document.getElementById('imageFilter');
    const filterClear = document.getElementById('imageFilterClear');
    const statusEl = document.getElementById('imageStatus');
    const editor = document.getElementById('editor');
    if (!btn || !modal || !overlay || !uploadBtn || !listEl || !filterEl || !editor) return;

    const apiUrl = 'image_manager.php';
    let items = [];

    const setStatus = (msg, kind = 'info') => {
        if (!statusEl) return;
        statusEl.textContent = String(msg || '');
        statusEl.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const insertAtSelection = (text) => {
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? 0;
        editor.setRangeText(text, start, end, 'end');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.focus();
    };

    const guessAlt = (file) => {
        const base = String(file || '').replace(/\.[a-z0-9]+$/i, '');
        const s = base.replace(/[_-]+/g, ' ').trim().replace(/\s+/g, ' ');
        if (!s) return 'Image';
        return s.replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const render = () => {
        const q = String(filterEl.value || '').trim().toLowerCase();
        if (filterClear) filterClear.style.display = q ? '' : 'none';

        const filtered = !q
            ? items
            : items.filter(it => {
                const hay = `${it.file || ''} ${it.alt || ''} ${it.path || ''}`.toLowerCase();
                return hay.includes(q);
            });

        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="status-text" style="padding:0.5rem;">No images found.</div>';
            return;
        }

        const rows = filtered.map(it => {
            const path = String(it.path || '');
            const file = String(it.file || '');
            const alt = String(it.alt || '');
            const size = (typeof it.size_kb === 'number') ? `${it.size_kb} KB` : '';
            const esc = (s) => String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

            return `
                <button type="button" class="btn btn-ghost" data-path="${esc(path)}" data-file="${esc(file)}" data-alt="${esc(alt)}"
                    style="width:100%; justify-content:flex-start; gap:0.6rem; padding:0.45rem 0.6rem; margin:0.35rem 0;">
                    <img src="${esc(path)}" alt="" loading="lazy" decoding="async"
                        style="width:44px; height:44px; object-fit:cover; border-radius:0.5rem; border:1px solid var(--border-soft); background: var(--surface-code);">
                    <span style="display:flex; flex-direction:column; align-items:flex-start; min-width:0;">
                        <span style="font-size:0.8rem; font-weight:600; max-width: 36ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(alt || file || path)}</span>
                        <span class="status-text" style="max-width: 42ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(path)}${size ? ` • ${esc(size)}` : ''}</span>
                    </span>
                </button>
            `;
        }).join('');

        listEl.innerHTML = rows;
    };

    const loadList = async () => {
        setStatus('');
        listEl.innerHTML = '<div class="status-text" style="padding:0.5rem;">Loading…</div>';
        try {
            const res = await fetch(`${apiUrl}?action=list`, { headers: { 'Accept': 'application/json' } });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok !== true) {
                throw new Error((data && data.error) ? data.error : 'Failed to load images.');
            }
            items = Array.isArray(data.images) ? data.images : [];
            render();
        } catch (err) {
            items = [];
            listEl.innerHTML = '<div class="status-text" style="padding:0.5rem;">Failed to load images.</div>';
            setStatus(err?.message || 'Failed to load images.', 'error');
        }
    };

	    const open = () => {
	        if (typeof window.__mdwCloseLinkModal === 'function') {
	            window.__mdwCloseLinkModal();
	        }
	        if (typeof window.__mdwCloseThemeModal === 'function') {
	            window.__mdwCloseThemeModal();
	        }
	        overlay.hidden = false;
	        modal.hidden = false;
	        document.documentElement.classList.add('modal-open');
	        setStatus('');
        if (filterEl) filterEl.value = '';
        if (altInput) altInput.value = '';
        loadList();
        setTimeout(() => filterEl?.focus(), 0);
    };

	    const close = () => {
	        overlay.hidden = true;
	        modal.hidden = true;
	        document.documentElement.classList.remove('modal-open');
	        setStatus('');
	    };

	    window.__mdwCloseImageModal = close;

	    btn.addEventListener('click', open);
	    closeBtn?.addEventListener('click', close);
	    cancelBtn?.addEventListener('click', close);
	    overlay.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
        if (modal.hidden) return;
        if (e.key !== 'Escape' && e.key !== 'Esc') return;
        e.preventDefault();
        close();
    });

    filterEl.addEventListener('input', render);
    filterClear?.addEventListener('click', () => {
        filterEl.value = '';
        render();
        filterEl.focus();
    });

    uploadBtn.addEventListener('click', async () => {
        if (!(uploadInput instanceof HTMLInputElement)) return;
        const file = uploadInput.files && uploadInput.files[0];
        if (!file) {
            setStatus('Choose an image first.', 'error');
            uploadInput.focus();
            return;
        }
        const csrf = (csrfInput instanceof HTMLInputElement) ? csrfInput.value : '';
        if (!csrf) {
            setStatus('Missing CSRF token. Reload the page.', 'error');
            return;
        }

        setStatus('Uploading…');
        uploadBtn.disabled = true;
        try {
            const fd = new FormData();
            fd.append('action', 'upload');
            fd.append('csrf', csrf);
            fd.append('image', file);

            const res = await fetch(apiUrl, { method: 'POST', body: fd });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok !== true) {
                throw new Error((data && data.error) ? data.error : 'Upload failed.');
            }

            const path = String(data.path || '');
            const alt = String(altInput?.value || '').trim() || String(data.alt || '') || guessAlt(path);
            if (path) {
                insertAtSelection(`![${alt}](${path})`);
            }

            uploadInput.value = '';
            if (altInput instanceof HTMLInputElement) altInput.value = '';
            setStatus('Uploaded.', 'ok');
            await loadList();
        } catch (err) {
            setStatus(err?.message || 'Upload failed.', 'error');
        } finally {
            uploadBtn.disabled = false;
        }
    });

    listEl.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target.closest('button[data-path]') : null;
        if (!(target instanceof HTMLElement)) return;
        const path = target.getAttribute('data-path') || '';
        const file = target.getAttribute('data-file') || '';
        const suggestedAlt = target.getAttribute('data-alt') || '';
        if (!path) return;

        const alt = String(altInput?.value || '').trim() || suggestedAlt || guessAlt(file || path);
        insertAtSelection(`![${alt}](${path})`);
        close();
    });
})();

// LINE NUMBERS + LIVE PREVIEW
(function(){
    const normalizeNewlines = (s) => String(s ?? '').replace(/\r\n?/g, '\n');

    const ta = document.getElementById('editor');
    const ln = document.getElementById('lineNumbers');
    const prev = document.getElementById('preview');
    const status = document.getElementById('liveStatus');
    const btnRevert = document.getElementById('btnRevert');
    const editorForm = document.getElementById('editor-form');
    const deleteForm = document.getElementById('deleteForm');
    const dirtyStar = document.getElementById('dirtyStar');

    if (!ta || !ln || !prev) return;

    let ignoreBeforeUnload = false;
    const setIgnoreBeforeUnload = () => { ignoreBeforeUnload = true; };

    editorForm?.addEventListener('submit', setIgnoreBeforeUnload);
    deleteForm?.addEventListener('submit', setIgnoreBeforeUnload);

    function setDirty(isDirty) {
        window.__mdDirty = !!isDirty;
        if (dirtyStar) dirtyStar.style.display = isDirty ? '' : 'none';
        const currentNavItem = document.querySelector('.nav-item-current');
        if (currentNavItem) currentNavItem.classList.toggle('dirty', isDirty);
        document.title = isDirty
            ? document.title.replace(/\s*\*$/, '') + ' *'
            : document.title.replace(/\s*\*$/, '');
    }

    function recomputeDirty() {
        if (!window.CURRENT_FILE) return;
        setDirty(
            normalizeNewlines(ta.value) !== normalizeNewlines(window.initialContent || '')
        );
    }

    window.addEventListener('beforeunload', (e) => {
        if (ignoreBeforeUnload) return;
        if (!window.__mdDirty) return;
        e.preventDefault();
        e.returnValue = '';
    });

    function updateLineNumbers() {
        const lines = ta.value.split('\n').length;
        let out = '';
        for (let i = 1; i <= lines; i++) {
            out += i + '\n';
        }
        ln.textContent = out;
    }

    let previewTimer = null;
    function schedulePreview() {
        if (!window.CURRENT_FILE) return;
        clearTimeout(previewTimer);
        previewTimer = setTimeout(sendPreview, 350);
        status.textContent = 'Updating preview…';
    }

    function sendPreview() {
        const body = 'content=' + encodeURIComponent(ta.value);
        fetch('edit.php?file=' + encodeURIComponent(window.CURRENT_FILE) + '&preview=1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        })
        .then(r => r.text())
        .then(html => {
            prev.innerHTML = html;
            if (window.MathJax?.typesetPromise) {
                window.MathJax.typesetPromise([prev]).catch(() => {});
            }
            status.textContent = 'Preview up to date';
        })
        .catch(() => {
            status.textContent = 'Preview error';
        });
    }

    ta.addEventListener('input', function(){
        updateLineNumbers();
        recomputeDirty();
        schedulePreview();
    });
    ta.addEventListener('scroll', function(){
        ln.scrollTop = ta.scrollTop;
    });

    // Revert naar initialContent
    if (btnRevert) {
        btnRevert.addEventListener('click', function(){
            ta.value = normalizeNewlines(window.initialContent || '');
            updateLineNumbers();
            recomputeDirty();
            schedulePreview();
        });
    }

    updateLineNumbers();
    window.initialContent = normalizeNewlines(window.initialContent || '');
    recomputeDirty();
})();

// RESIZABLE COLUMNS
(function () {
    const grid = document.getElementById('editorGrid');
    if (!grid) return;

    const STORAGE_KEY = 'mdw_editor_col_widths';

    function applyWidths(left, mid, right, save) {
        const root = document.documentElement;
        root.style.setProperty('--col-left', left);
        root.style.setProperty('--col-mid',  mid);
        root.style.setProperty('--col-right', right);

        if (save) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                left, mid, right
            }));
        }
    }

    // laad opgeslagen waarden
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved && saved.left && saved.mid && saved.right) {
            applyWidths(saved.left, saved.mid, saved.right, false);
        }
    } catch (e) {
        console.warn('width state broken, ignoring', e);
    }

    let active = null;

    function startDrag(ev, which) {
        ev.preventDefault();
        active = { which };
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', stopDrag);
    }

    function stopDrag() {
        document.removeEventListener('mousemove', onMove);
        document.body.style.cursor = '';
        document.removeEventListener('mouseup', stopDrag);
        active = null;
    }

    function onMove(ev) {
        if (!active) return;

        const rect = grid.getBoundingClientRect();
        const total = rect.width;

        // huidige percentages zonder '%' → float
        const rootStyles = getComputedStyle(document.documentElement);
        let leftPct  = parseFloat(rootStyles.getPropertyValue('--col-left'));
        let midPct   = parseFloat(rootStyles.getPropertyValue('--col-mid'));
        let rightPct = parseFloat(rootStyles.getPropertyValue('--col-right'));

        // clamp helper
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        if (active.which === 'left') {
            const x = ev.clientX - rect.left;
            const newLeftPct = clamp((x / total) * 100, 10, 80);
            const delta = leftPct - newLeftPct;
            midPct += delta;
            leftPct = newLeftPct; // update left

        } else if (active.which === 'right') {
            const xFromRight = rect.right - ev.clientX;
            const newRightPct = clamp((xFromRight / total) * 100, 10, 80);
            const delta = rightPct - newRightPct;
            midPct += delta;
            rightPct = newRightPct; // update right
        }

        // Zorg ervoor dat de middelste kolom niet te klein wordt
        if (midPct < 10) {
            // Prevent further movement if mid is too small
            return;
        }

        applyWidths(
            leftPct.toFixed(2) + '%',
            midPct.toFixed(2) + '%',
            (100 - leftPct - midPct).toFixed(2) + '%',
            true
        );
    }

    document.querySelectorAll('.col-resizer').forEach(r => {
        const which = r.dataset.resizer;
        r.addEventListener('mousedown', ev => startDrag(ev, which));
    });
})();

// Export HTML preview (edit.php)
(function(){
    const btn = document.getElementById('exportHtmlBtn');
    const copyBtn = document.getElementById('copyHtmlBtn');
    const preview = document.getElementById('preview');
    if ((!btn && !copyBtn) || !preview) return;

    const editor = document.getElementById('editor');

    const normalizePath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const dirname = (p) => {
        p = normalizePath(p);
        const idx = p.lastIndexOf('/');
        return idx === -1 ? '' : p.slice(0, idx);
    };
    const relativePath = (fromFile, toFile) => {
        const fromDir = dirname(fromFile);
        const fromParts = fromDir ? fromDir.split('/').filter(Boolean) : [];
        const to = normalizePath(toFile);
        const toParts = to.split('/').filter(Boolean);
        if (toParts.length === 0) return '';
        const toDirParts = toParts.slice(0, -1);
        const toName = toParts[toParts.length - 1];

        let i = 0;
        while (i < fromParts.length && i < toDirParts.length && fromParts[i] === toDirParts[i]) i++;
        const up = fromParts.length - i;
        const down = toDirParts.slice(i);
        const out = [];
        for (let k = 0; k < up; k++) out.push('..');
        out.push(...down);
        out.push(toName);
        return out.join('/');
    };

    const getBasename = (p) => {
        const s = normalizePath(p);
        const parts = s.split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : 'export.md';
    };

    const escapeHtml = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const rewriteInternalMdLinksForExport = (rootEl) => {
        if (!rootEl || !(rootEl instanceof HTMLElement)) return;
        rootEl.querySelectorAll('a[href]').forEach(a => {
            const rawHref = a.getAttribute('href') || '';
            if (!rawHref || rawHref.startsWith('#')) return;

            let url;
            try {
                url = new URL(rawHref, window.location.href);
            } catch {
                return;
            }

            const fileParam = url.searchParams.get('file');
            if (!fileParam) return;
            const targetFile = normalizePath(fileParam);
            if (!/\.md$/i.test(targetFile)) return;

            const other = new URLSearchParams(url.searchParams);
            other.delete('file');
            const qs = other.toString();
            const hash = url.hash || '';

            let outHref = relativePath(window.CURRENT_FILE || '', targetFile);
            if (qs) outHref += '?' + qs;
            if (hash) outHref += hash;

            a.setAttribute('href', outHref);
            a.removeAttribute('target');
            a.removeAttribute('rel');
        });
    };

    const stripAllClassesForExport = (rootEl) => {
        if (!rootEl || !(rootEl instanceof HTMLElement)) return;
        rootEl.querySelectorAll('[class]').forEach(el => {
            el.removeAttribute('class');
        });
    };

    const getServerRenderedHtml = async () => {
        if (!window.CURRENT_FILE) return '';
        if (!(editor instanceof HTMLTextAreaElement)) return preview.innerHTML || '';
        const fd = new FormData();
        fd.set('content', editor.value || '');
        const res = await fetch('edit.php?file=' + encodeURIComponent(window.CURRENT_FILE) + '&preview=1', {
            method: 'POST',
            body: fd,
        });
        if (!res.ok) throw new Error('Preview request failed');
        return await res.text();
    };

    const buildExportHtml = async () => {
        const title = (document.querySelector('.app-title')?.textContent || '').trim() || 'Markdown export';
        const src = getBasename(window.CURRENT_FILE || 'export.md').replace(/\.md$/i, '');
        const filename = `${src || 'export'}.html`;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = await getServerRenderedHtml();
        rewriteInternalMdLinksForExport(wrapper);
        stripAllClassesForExport(wrapper);

        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body>
${wrapper.innerHTML}
</body>
</html>`;

        return { filename, html };
    };

    const downloadTextFile = (filename, text, mime) => {
        const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2500);
    };

    const copyTextToClipboard = async (text) => {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                // fall back
            }
        }
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            const ok = document.execCommand('copy');
            ta.remove();
            return !!ok;
        } catch {
            return false;
        }
    };

    const flashBtnLabel = (buttonEl, nextLabel, ms) => {
        const labelEl = buttonEl?.querySelector('.btn-label');
        if (!labelEl) return;
        const old = labelEl.textContent;
        labelEl.textContent = nextLabel;
        window.setTimeout(() => { labelEl.textContent = old; }, ms || 1200);
    };

    if (btn) {
        btn.addEventListener('click', async () => {
            if (!window.CURRENT_FILE) return;
            btn.disabled = true;
            try {
                const { filename, html } = await buildExportHtml();
                downloadTextFile(filename, html, 'text/html;charset=utf-8');
            } catch (e) {
                console.error('Export failed', e);
                alert('Export failed. Check the console for details.');
            } finally {
                btn.disabled = false;
            }
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (!window.CURRENT_FILE) return;
            copyBtn.disabled = true;
            try {
                const { html } = await buildExportHtml();
                const ok = await copyTextToClipboard(html);
                if (!ok) throw new Error('Copy failed');
                flashBtnLabel(copyBtn, 'Copied', 1200);
            } catch (e) {
                console.error('Copy failed', e);
                alert('Copy failed. Check the console for details.');
            } finally {
                copyBtn.disabled = false;
            }
        });
    }
})();
