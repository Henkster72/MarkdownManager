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

        if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
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

    const filterInput = document.getElementById('filterInput');
    const navCount   = document.getElementById('navCount');
    const navItems   = document.querySelectorAll('.nav-item.doclink');
    const editorForm = document.querySelector('.editor-form');
    const navOverlay = document.getElementById('navOverlay');
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    const mobileNavClose  = document.getElementById('mobileNavClose');
    const filterReset = document.getElementById('filterReset');
    const filterClear = document.getElementById('filterClear');

    if (!filterInput || !navCount) return;

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
        let visible = 0;
        navItems.forEach(el => {
            const text = el.innerText.toLowerCase();
            const match = text.includes(q);
            el.style.display = match ? '' : 'none'; // Gebruik class voor betere controle
            if (match) visible++;
        });
        navCount.textContent = visible + ' item' + (visible === 1 ? '' : 's');
        if (filterReset) {
            filterReset.disabled = q.length === 0;
        }
        if (filterClear) {
            filterClear.style.display = q.length === 0 ? 'none' : '';
        }
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

    // SPA-achtige navigatie
    navItems.forEach(item => {
        const link = item.querySelector('a');
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const url = new URL(this.href);
            const file = url.searchParams.get('file'); // of this.dataset.file
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

            // Als het een geheim bestand is en de gebruiker niet is ingelogd,
            // stuur door naar de indexpagina om in te loggen.
            if (isSecret && !window.IS_SECRET_AUTHENTICATED) {
                window.location.href = this.href.replace('edit.php', 'index.php');
                return;
            }

            // Visuele update
            document.querySelector('.nav-item.nav-item-current')?.classList.remove('nav-item-current');
            item.classList.add('nav-item-current');

            // Laad nieuwe content
            loadDocument(file);
            closeNav();
        });
    });

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
        const currentNavItem = document.querySelector('.nav-item.nav-item-current');
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
