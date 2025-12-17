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

    let lastTop = scroller.scrollTop;
    let hidden = false;
    let ticking = false;

    const setHidden = (nextHidden) => {
        hidden = nextHidden;
        root.classList.toggle('header-hidden', hidden);
    };

    const onScroll = () => {
        const top = scroller.scrollTop;
        root.classList.toggle('header-scrolled', top > 2);

        if (root.classList.contains('nav-open')) {
            setHidden(false);
            lastTop = top;
            return;
        }

        if (top < 6) {
            setHidden(false);
            lastTop = top;
            return;
        }

        const delta = top - lastTop;
        lastTop = top;

        if (Math.abs(delta) < 8) return;

        if (delta > 0 && top > (headerHeight + 24)) {
            if (!hidden) setHidden(true);
        } else if (delta < 0) {
            if (hidden) setHidden(false);
        }
    };

    scroller.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            onScroll();
            ticking = false;
        });
    }, { passive: true });

    onScroll();
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

    if (!newMdToggle || !newMdPanel) return;

    const open = () => { newMdPanel.style.display = 'block'; };
    const close = () => { newMdPanel.style.display = 'none'; };
    const toggle = () => {
        const show = (newMdPanel.style.display === 'none' || newMdPanel.style.display === '');
        newMdPanel.style.display = show ? 'block' : 'none';
    };

    newMdToggle.addEventListener('click', toggle);
    newMdClose?.addEventListener('click', close);

    if (newMdPanel.style.display !== 'none' && newMdPanel.style.display !== '') {
        open();
    }
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
