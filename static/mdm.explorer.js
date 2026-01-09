(function(){
    const MDM = window.MDM = window.MDM || {};
    const module = MDM.explorer = MDM.explorer || {};
    const mdmApi = MDM.api;
    const mdmDelegate = MDM.delegate || ((root, event, selector, fn) => {
        if (!root) return null;
        const handler = (e) => {
            const target = e.target instanceof Element ? e.target.closest(selector) : null;
            if (!target || !root.contains(target)) return;
            fn(e, target);
        };
        root.addEventListener(event, handler);
        return handler;
    });

    module.init = () => {
        if (module._init) return;
        module._init = true;

(function(){
    const editor = document.getElementById('editor');
    if (!editor) return;
    const breadcrumb = document.querySelector('.app-breadcrumb');
    if (!(breadcrumb instanceof HTMLElement)) return;
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    breadcrumb.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target.closest('a.breadcrumb-link') : null;
        if (!(target instanceof HTMLAnchorElement)) return;
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!window.__mdDirty) return;
        if (!confirm(t('js.unsaved_confirm', 'You have unsaved changes. Discard them and continue?'))) {
            e.preventDefault();
            return;
        }
        window.__mdDirty = false;
    });
})();

// Delete confirm (shared: index.php + edit.php)
(function(){
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));
    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.classList.contains('deleteForm')) return;
        const file = form.dataset.file || form.querySelector('input[name="file"]')?.value || t('js.this_file', 'this file');
        const msg = t('js.confirm_delete', `Delete \"${file}\"?`, { file });
        if (!confirm(msg)) {
            e.preventDefault();
        }
    }, true);
})();

// Folder rename/delete (index.php)
(function(){
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));
    const canManageFolders = () => {
        const meta = (window.MDW_AUTH_META && typeof window.MDW_AUTH_META === 'object')
            ? window.MDW_AUTH_META
            : { has_user: false, has_superuser: false };
        const hasAuth = !!(meta.has_user || meta.has_superuser);
        if (!hasAuth) return true;
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        return !!(auth && auth.role === 'superuser' && auth.token);
    };

    const ensureInput = (form, name, value) => {
        let input = form.querySelector(`input[name="${name}"]`);
        if (!(input instanceof HTMLInputElement)) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
        }
        input.value = String(value || '');
    };
    const ensureAuthInputs = (form) => {
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (!auth || !auth.role || !auth.token) return;
        ensureInput(form, 'auth_role', auth.role);
        ensureInput(form, 'auth_token', auth.token);
    };
    const submitForm = (form) => {
        if (!(form instanceof HTMLFormElement)) return;
        if (typeof form.requestSubmit === 'function') {
            try {
                form.requestSubmit();
                return;
            } catch {}
        }
        form.submit();
    };

    const readFolderFilter = () => {
        try {
            const params = new URLSearchParams(window.location.search);
            return String(params.get('folder') || '');
        } catch {
            return '';
        }
    };

    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.classList.contains('deleteFolderForm')) return;
        if (!canManageFolders()) {
            e.preventDefault();
            if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
            return;
        }
        const folder = String(form.dataset.folder || form.querySelector('input[name="folder"]')?.value || '').trim();
        if (!folder) return;
        const msg = t('js.confirm_delete_folder', 'Delete folder "{folder}" and its notes?', { folder });
        if (!confirm(msg)) {
            e.preventDefault();
            return;
        }
        const filter = readFolderFilter();
        if (filter) ensureInput(form, 'return_filter', filter);
    }, true);

    const startInlineRename = (section, form) => {
        if (!(section instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;
        if (!canManageFolders()) {
            if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
            return;
        }
        const header = section.querySelector('.note-group-title');
        const label = header?.querySelector('.breadcrumb-link');
        if (!(header instanceof HTMLElement) || !(label instanceof HTMLElement)) return;
        if (header.classList.contains('folder-rename-active')) return;
        const folder = String(form.dataset.folder || form.querySelector('input[name="folder"]')?.value || '').trim();
        if (!folder) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input folder-rename-input';
        input.value = folder;
        input.setAttribute('aria-label', t('common.rename', 'Rename'));
        header.classList.add('folder-rename-active');
        header.appendChild(input);
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);

        const cancel = () => {
            header.classList.remove('folder-rename-active');
            input.remove();
        };
        const submit = () => {
            const value = String(input.value || '').trim();
            if (!value || value === folder) {
                cancel();
                return;
            }
            ensureInput(form, 'new_folder', value);
            const filter = readFolderFilter();
            if (filter) ensureInput(form, 'return_filter', filter);
            ensureAuthInputs(form);
            submitForm(form);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submit();
            } else if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                cancel();
            }
        });
        input.addEventListener('blur', () => {
            cancel();
        });
    };

    document.addEventListener('click', (e) => {
        const target = e.target;
        const btn = target instanceof Element ? target.closest('.folder-rename-btn') : null;
        if (!(btn instanceof HTMLButtonElement)) return;
        const form = btn.closest('form.renameFolderForm');
        if (!(form instanceof HTMLFormElement)) return;
        const section = btn.closest('.nav-section[data-folder-section]');
        startInlineRename(section, form);
    });

    const normalizePath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const basename = (p) => {
        const parts = normalizePath(p).split('/');
        return parts[parts.length - 1] || '';
    };
    const isDescendant = (src, target) => {
        if (!src || !target) return false;
        return target === src || target.startsWith(src + '/');
    };
    const moveFolder = (srcPath, targetPath) => {
        const src = normalizePath(srcPath);
        const target = normalizePath(targetPath);
        if (!src || !target) return;
        if (target !== 'root' && isDescendant(src, target)) return;
        const leaf = basename(src);
        if (!leaf) return;
        const dest = (target === 'root') ? leaf : `${target}/${leaf}`;
        if (dest === src) return;
        let section = null;
        document.querySelectorAll('.nav-section[data-folder-section]').forEach((el) => {
            if (section) return;
            if (String(el.getAttribute('data-folder-section') || '') === src) section = el;
        });
        const form = section?.querySelector('form.renameFolderForm');
        if (!(form instanceof HTMLFormElement)) return;
        ensureInput(form, 'new_folder', dest);
        const filter = readFolderFilter();
        if (filter) ensureInput(form, 'return_filter', filter);
        ensureAuthInputs(form);
        submitForm(form);
    };

    const clearDropTargets = () => {
        document.querySelectorAll('.folder-drop-target').forEach((el) => {
            el.classList.remove('folder-drop-target');
        });
    };

    document.querySelectorAll('.nav-section[data-folder-section]').forEach((section) => {
        const header = section.querySelector('.note-group-title');
        if (!(header instanceof HTMLElement)) return;
        const path = String(section.dataset.folderSection || '');
        if (path && path !== 'root') {
            header.setAttribute('draggable', 'true');
        }
        header.dataset.folderPath = path;
    });

    let dragSrcPath = '';
    let dragSrcSection = null;

    document.addEventListener('dragstart', (e) => {
        const header = e.target instanceof Element ? e.target.closest('.note-group-title') : null;
        if (!(header instanceof HTMLElement)) return;
        const path = String(header.dataset.folderPath || '').trim();
        if (!path || path === 'root') return;
        if (!canManageFolders()) {
            e.preventDefault();
            return;
        }
        dragSrcPath = path;
        dragSrcSection = header.closest('.nav-section[data-folder-section]');
        dragSrcSection?.classList.add('folder-dragging');
        try {
            e.dataTransfer?.setData('text/plain', path);
            e.dataTransfer.effectAllowed = 'move';
        } catch {}
    });

    document.addEventListener('dragover', (e) => {
        if (!dragSrcPath) return;
        const section = e.target instanceof Element ? e.target.closest('.nav-section[data-folder-section]') : null;
        const header = section?.querySelector('.note-group-title');
        if (!(header instanceof HTMLElement)) return;
        const targetPath = String(header.dataset.folderPath || '').trim();
        if (!targetPath || targetPath === dragSrcPath || targetPath.startsWith(dragSrcPath + '/')) return;
        e.preventDefault();
        clearDropTargets();
        header.classList.add('folder-drop-target');
    });

    document.addEventListener('drop', (e) => {
        if (!dragSrcPath) return;
        const section = e.target instanceof Element ? e.target.closest('.nav-section[data-folder-section]') : null;
        const header = section?.querySelector('.note-group-title');
        const targetPath = header instanceof HTMLElement ? String(header.dataset.folderPath || '').trim() : '';
        e.preventDefault();
        clearDropTargets();
        dragSrcSection?.classList.remove('folder-dragging');
        if (targetPath) moveFolder(dragSrcPath, targetPath);
        dragSrcPath = '';
        dragSrcSection = null;
    });

    document.addEventListener('dragend', () => {
        clearDropTargets();
        dragSrcSection?.classList.remove('folder-dragging');
        dragSrcSection = null;
        dragSrcPath = '';
    });

    let touchDrag = null;
    document.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch') return;
        const header = e.target instanceof Element ? e.target.closest('.note-group-title') : null;
        if (!(header instanceof HTMLElement)) return;
        const path = String(header.dataset.folderPath || '').trim();
        if (!path || path === 'root') return;
        if (!canManageFolders()) return;
        touchDrag = {
            path,
            header,
            startX: e.clientX,
            startY: e.clientY,
            dragging: false,
        };
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
        if (!touchDrag || e.pointerType !== 'touch') return;
        const dx = e.clientX - touchDrag.startX;
        const dy = e.clientY - touchDrag.startY;
        if (!touchDrag.dragging) {
            if (Math.hypot(dx, dy) < 8) return;
            touchDrag.dragging = true;
            touchDrag.header?.classList.add('folder-dragging');
        }
        if (touchDrag.dragging) {
            e.preventDefault();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const targetSection = el instanceof Element ? el.closest('.nav-section[data-folder-section]') : null;
            const targetHeader = targetSection?.querySelector('.note-group-title');
            clearDropTargets();
            if (targetHeader instanceof HTMLElement) {
                const targetPath = String(targetHeader.dataset.folderPath || '').trim();
                if (targetPath && targetPath !== touchDrag.path && !targetPath.startsWith(touchDrag.path + '/')) {
                    targetHeader.classList.add('folder-drop-target');
                }
            }
        }
    }, { passive: false });

    document.addEventListener('pointerup', (e) => {
        if (!touchDrag || e.pointerType !== 'touch') return;
        if (touchDrag.dragging) {
            e.preventDefault();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const targetSection = el instanceof Element ? el.closest('.nav-section[data-folder-section]') : null;
            const targetHeader = targetSection?.querySelector('.note-group-title');
            const targetPath = targetHeader instanceof HTMLElement ? String(targetHeader.dataset.folderPath || '').trim() : '';
            if (targetPath) moveFolder(touchDrag.path, targetPath);
        }
        touchDrag?.header?.classList.remove('folder-dragging');
        clearDropTargets();
        touchDrag = null;
    }, { passive: false });

    const folderFromFile = (p) => {
        const clean = normalizePath(p);
        const idx = clean.lastIndexOf('/');
        return idx === -1 ? 'root' : clean.slice(0, idx);
    };
    const normalizeFolder = (p) => {
        const clean = normalizePath(p);
        return clean === '' ? 'root' : clean;
    };
    const getFilePathFromRow = (row) => {
        if (!(row instanceof HTMLElement)) return '';
        return String(row.dataset.file || row.getAttribute('data-file') || '').trim();
    };
    const moveFile = (filePath, targetFolder) => {
        if (!filePath) return;
        const target = normalizeFolder(targetFolder);
        const currentFolder = folderFromFile(filePath);
        if (!target || target === currentFolder) return;
        if (!canManageFolders()) {
            if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
            return;
        }
        const csrf = String(window.MDW_CSRF || '');
        if (!csrf) {
            alert(t('flash.csrf_invalid', 'Invalid session (CSRF). Reload the page.'));
            return;
        }
        let form = document.getElementById('moveFileForm');
        if (!(form instanceof HTMLFormElement)) {
            form = document.createElement('form');
            form.id = 'moveFileForm';
            form.method = 'post';
            form.action = 'index.php';
            form.style.display = 'none';
            document.body.appendChild(form);
        }
        ensureInput(form, 'action', 'move_file');
        ensureInput(form, 'file', filePath);
        ensureInput(form, 'target_folder', target);
        ensureInput(form, 'csrf', csrf);
        const filter = readFolderFilter();
        if (filter) ensureInput(form, 'return_filter', filter);
        ensureAuthInputs(form);
        submitForm(form);
    };

    let fileDragSrc = '';
    let fileDragRow = null;

    document.addEventListener('dragstart', (e) => {
        const link = e.target instanceof Element ? e.target.closest('.note-link') : null;
        const row = link?.closest('.note-item[data-kind="md"]');
        if (!(row instanceof HTMLElement)) return;
        const file = getFilePathFromRow(row);
        if (!file) return;
        if (!canManageFolders()) {
            e.preventDefault();
            if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
            return;
        }
        fileDragSrc = file;
        fileDragRow = row;
        row.classList.add('note-dragging');
        try {
            e.dataTransfer?.setData('text/plain', file);
            e.dataTransfer?.setData('text/mdw-file', file);
            e.dataTransfer.effectAllowed = 'move';
        } catch {}
    });

    document.addEventListener('dragover', (e) => {
        if (!fileDragSrc) return;
        const section = e.target instanceof Element ? e.target.closest('.nav-section[data-folder-section]') : null;
        const header = section?.querySelector('.note-group-title');
        if (!(header instanceof HTMLElement)) return;
        const targetPath = normalizeFolder(header.dataset.folderPath || section?.dataset.folderSection || '');
        if (!targetPath) return;
        const currentFolder = folderFromFile(fileDragSrc);
        if (targetPath === currentFolder) return;
        e.preventDefault();
        clearDropTargets();
        header.classList.add('folder-drop-target');
    });

    document.addEventListener('drop', (e) => {
        if (!fileDragSrc) return;
        const section = e.target instanceof Element ? e.target.closest('.nav-section[data-folder-section]') : null;
        const header = section?.querySelector('.note-group-title');
        const targetPath = header instanceof HTMLElement ? String(header.dataset.folderPath || '').trim() : '';
        e.preventDefault();
        clearDropTargets();
        fileDragRow?.classList.remove('note-dragging');
        if (targetPath) moveFile(fileDragSrc, targetPath);
        fileDragSrc = '';
        fileDragRow = null;
    });

    document.addEventListener('dragend', () => {
        clearDropTargets();
        fileDragRow?.classList.remove('note-dragging');
        fileDragRow = null;
        fileDragSrc = '';
    });

    let fileTouchDrag = null;
    document.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch') return;
        const link = e.target instanceof Element ? e.target.closest('.note-link') : null;
        const row = link?.closest('.note-item[data-kind="md"]');
        if (!(row instanceof HTMLElement)) return;
        const file = getFilePathFromRow(row);
        if (!file) return;
        if (!canManageFolders()) return;
        fileTouchDrag = {
            file,
            row,
            startX: e.clientX,
            startY: e.clientY,
            dragging: false,
        };
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
        if (!fileTouchDrag || e.pointerType !== 'touch') return;
        const dx = e.clientX - fileTouchDrag.startX;
        const dy = e.clientY - fileTouchDrag.startY;
        if (!fileTouchDrag.dragging) {
            if (Math.hypot(dx, dy) < 8) return;
            fileTouchDrag.dragging = true;
            fileTouchDrag.row?.classList.add('note-dragging');
        }
        if (fileTouchDrag.dragging) {
            e.preventDefault();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const targetSection = el instanceof Element ? el.closest('.nav-section[data-folder-section]') : null;
            const targetHeader = targetSection?.querySelector('.note-group-title');
            clearDropTargets();
            if (targetHeader instanceof HTMLElement) {
                const targetPath = normalizeFolder(targetHeader.dataset.folderPath || '');
                const currentFolder = folderFromFile(fileTouchDrag.file);
                if (targetPath && targetPath !== currentFolder) {
                    targetHeader.classList.add('folder-drop-target');
                }
            }
        }
    }, { passive: false });

    document.addEventListener('pointerup', (e) => {
        if (!fileTouchDrag || e.pointerType !== 'touch') return;
        if (fileTouchDrag.dragging) {
            e.preventDefault();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const targetSection = el instanceof Element ? el.closest('.nav-section[data-folder-section]') : null;
            const targetHeader = targetSection?.querySelector('.note-group-title');
            const targetPath = targetHeader instanceof HTMLElement ? String(targetHeader.dataset.folderPath || '').trim() : '';
            if (targetPath) moveFile(fileTouchDrag.file, targetPath);
        }
        fileTouchDrag?.row?.classList.remove('note-dragging');
        clearDropTargets();
        fileTouchDrag = null;
    }, { passive: false });
})();

// +MD panel toggle (index.php + edit.php)
(function(){
    const newMdToggle = document.getElementById('newMdToggle');
    const newMdPanel = document.getElementById('newMdPanel');
    const newMdClose = document.getElementById('newMdClose');
    const newMdPrefixDate = document.getElementById('newMdPrefixDate');
    const newMdTitle = document.getElementById('newMdTitle');
    const newMdSlug = document.getElementById('newMdFile');
    const newMdTitleHint = document.getElementById('newMdTitleHint');
    const newMdSlugHint = document.getElementById('newMdFileHint');
    const newMdPreview = document.getElementById('newMdFilePreview');
    const newMdPreviewValue = document.getElementById('newMdFilePreviewValue');
    const newMdForm = newMdSlug?.closest?.('form');
    const newMdContent = newMdForm?.querySelector?.('textarea[name="new_content"]') || null;
    const newFolderBtn = document.getElementById('newFolderBtn');
    const newFolderForm = document.getElementById('newFolderForm');
    const newFolderName = document.getElementById('newFolderName');

    if (!newMdToggle) return;
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

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

    const redirectToIndex = () => {
        const folder = inferFolderFromUrl();
        const url = folder ? `index.php?new=1&folder=${encodeURIComponent(folder)}` : 'index.php?new=1';
        window.location.href = url;
    };

    if (!newMdPanel) {
        newMdToggle.addEventListener('click', redirectToIndex);
        return;
    }

    const open = () => {
        newMdPanel.style.display = 'block';
        setSlugReadonly();
        const focusTarget = (newMdTitle instanceof HTMLInputElement) ? newMdTitle : newMdSlug;
        if (focusTarget instanceof HTMLInputElement) {
            focusTarget.focus();
            if (focusTarget.value) focusTarget.setSelectionRange(focusTarget.value.length, focusTarget.value.length);
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

    const supportsUnicodeProps = (() => {
        try { new RegExp('\\p{L}', 'u'); return true; } catch { return false; }
    })();
    const invalidCharsRe = supportsUnicodeProps
        ? /[^\p{L}\p{N}._-]+/gu
        : /[^A-Za-z0-9._-]+/g;
    const whitespaceRe = /\s+/g;
    const titleMin = Number(newMdTitle?.dataset?.titleMin || 3);
    const titleMax = Number(newMdTitle?.dataset?.titleMax || 80);
    const slugMin = Number(newMdSlug?.dataset?.slugMin || 3);
    const slugMax = Number(newMdSlug?.dataset?.slugMax || 80);

    const isSuperuser = () => (typeof window.__mdwIsSuperuser === 'function') ? window.__mdwIsSuperuser() : false;
    const isPublisherMode = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const settings = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        return !!(settings && settings.publisher_mode);
    };

    const setHint = (el, msg, variant) => {
        if (!(el instanceof HTMLElement)) return;
        if (!msg) {
            el.textContent = '';
            el.style.color = '';
            el.style.display = 'none';
            return;
        }
        el.textContent = msg;
        el.style.display = 'block';
        el.style.color = variant === 'danger' ? 'var(--danger)' : 'var(--text-muted)';
    };

    const getTitleValue = () => (newMdTitle?.value || '').toString().trim().replace(whitespaceRe, ' ');

    const setSlugReadonly = () => {
        if (!(newMdSlug instanceof HTMLInputElement)) return;
        const hasTitle = !!getTitleValue();
        const allowEdit = isSuperuser() && hasTitle;
        newMdSlug.readOnly = !allowEdit;
    };

    const slugify = (raw) => {
        let v = (raw || '').toString().trim();
        if (!v) return '';
        v = v.replace(/\\.md$/i, '');
        v = v.replace(/[\\\\/]+/g, ' ');
        v = v.replace(whitespaceRe, '-');
        v = v.replace(invalidCharsRe, '');
        v = v.replace(/-+/g, '-');
        v = v.replace(/^[-.]+|[-.]+$/g, '');
        return v;
    };

    const buildFilenamePreview = () => {
        if (!(newMdPreviewValue instanceof HTMLElement)) return;
        const slug = slugify(newMdSlug?.value || '');
        if (!slug) {
            newMdPreviewValue.textContent = '';
            if (newMdPreview instanceof HTMLElement) newMdPreview.style.display = 'none';
            return;
        }
        if (newMdPreview instanceof HTMLElement) newMdPreview.style.display = '';
        const prefix = (newMdPrefixDate instanceof HTMLInputElement) ? String(newMdPrefixDate.dataset.datePrefix || '') : '';
        const usePrefix = !!(newMdPrefixDate instanceof HTMLInputElement && newMdPrefixDate.checked && prefix);
        const withPrefix = usePrefix && !slug.startsWith(prefix) ? `${prefix}${slug}` : slug;
        newMdPreviewValue.textContent = `${withPrefix}.md`;
    };

    const validateTitle = ({ showHint } = { showHint: false }) => {
        if (!(newMdTitle instanceof HTMLInputElement)) return true;
        const title = getTitleValue();
        const len = title.length;
        if (!title) {
            const msg = t('js.new_md.enter_title', 'Please enter a title for the filename.');
            newMdTitle.setCustomValidity(msg);
            if (showHint) setHint(newMdTitleHint, msg, 'danger');
            return false;
        }
        if (len < titleMin) {
            const msg = t('js.new_md.title_too_short', 'Title is too short (min {min}).', { min: titleMin });
            newMdTitle.setCustomValidity(msg);
            if (showHint) setHint(newMdTitleHint, msg, 'danger');
            return false;
        }
        if (len > titleMax) {
            const msg = t('js.new_md.title_too_long', 'Title is too long (max {max}).', { max: titleMax });
            newMdTitle.setCustomValidity(msg);
            if (showHint) setHint(newMdTitleHint, msg, 'danger');
            return false;
        }
        newMdTitle.setCustomValidity('');
        if (showHint) setHint(newMdTitleHint, '', 'info');
        return true;
    };

    const applySlugLimits = (slug, maxLen) => {
        if (slug.length <= maxLen) return { value: slug, changed: false };
        let trimmed = slug.slice(0, Math.max(0, maxLen));
        trimmed = trimmed.replace(/[-.]+$/g, '');
        return { value: trimmed, changed: true };
    };

    const validateSlug = ({ showHint, allowAdjust } = { showHint: false, allowAdjust: true }) => {
        if (!(newMdSlug instanceof HTMLInputElement)) return true;
        const titleLen = getTitleValue().length;
        const maxLen = Math.min(slugMax, titleLen || slugMax);
        const raw = newMdSlug.value || '';
        let slug = slugify(raw);
        let changed = slug !== raw;
        if (titleLen > 0 && titleLen < titleMin) {
            newMdSlug.setCustomValidity('');
            if (showHint) setHint(newMdSlugHint, '', 'info');
            return true;
        }
        if (titleLen === 0 && slug === '') {
            newMdSlug.setCustomValidity('');
            if (showHint) setHint(newMdSlugHint, '', 'info');
            return true;
        }
        if (!slug) {
            const msg = t('js.new_md.adjust_title', 'Please adjust the title so it contains letters/numbers (spaces become hyphens).');
            newMdSlug.setCustomValidity(msg);
            if (showHint) setHint(newMdSlugHint, msg, 'danger');
            return false;
        }
        const capped = applySlugLimits(slug, maxLen);
        if (capped.changed) {
            slug = capped.value;
            changed = true;
        }
        if (slug.length < slugMin) {
            const msg = t('js.new_md.slug_too_short', 'Slug is too short (min {min}).', { min: slugMin });
            newMdSlug.setCustomValidity(msg);
            if (showHint) setHint(newMdSlugHint, msg, 'danger');
            return false;
        }
        if (slug.length > maxLen) {
            const msg = t('js.new_md.slug_too_long', 'Slug is too long (max {max}).', { max: maxLen });
            newMdSlug.setCustomValidity(msg);
            if (showHint) setHint(newMdSlugHint, msg, 'danger');
            return false;
        }
        newMdSlug.setCustomValidity('');
        if (allowAdjust && changed) {
            newMdSlug.value = slug;
            if (showHint) setHint(newMdSlugHint, t('js.new_md.adjusted_hint', 'Adjusted slug: spaces → hyphens; unsupported characters removed.'), 'info');
        } else if (showHint) {
            setHint(newMdSlugHint, '', 'info');
        }
        return true;
    };


    const syncSlugFromTitle = ({ showHint } = { showHint: false }) => {
        if (!(newMdSlug instanceof HTMLInputElement)) return;
        const title = getTitleValue();
        if (!title) {
            newMdSlug.value = '';
            setHint(newMdSlugHint, '', 'info');
            return;
        }
        const maxLen = Math.min(slugMax, title.length);
        let slug = slugify(title);
        if (slug.length > maxLen) {
            slug = slug.slice(0, Math.max(0, maxLen)).replace(/[-.]+$/g, '');
        }
        if (!slug) {
            newMdSlug.value = '';
            return;
        }
        newMdSlug.value = slug;
        validateSlug({ showHint, allowAdjust: true });
    };

    newMdPrefixDate?.addEventListener('change', () => {
        buildFilenamePreview();
    });

    newMdTitle?.addEventListener('input', () => {
        validateTitle({ showHint: true });
        setSlugReadonly();
        syncSlugFromTitle({ showHint: true });
        validateSlug({ showHint: true, allowAdjust: true });
        buildFilenamePreview();
    });

    newMdSlug?.addEventListener('input', () => {
        validateSlug({ showHint: true, allowAdjust: true });
        buildFilenamePreview();
    });
    newMdSlug?.addEventListener('blur', () => {
        validateSlug({ showHint: true, allowAdjust: true });
        buildFilenamePreview();
    });

    if (newMdForm instanceof HTMLFormElement) {
        newMdForm.addEventListener('submit', (e) => {
            const okTitle = validateTitle({ showHint: true });
            const okSlug = validateSlug({ showHint: true, allowAdjust: true });
            buildFilenamePreview();
            if (!okTitle || !okSlug) {
                e.preventDefault();
                try { (okTitle ? newMdSlug : newMdTitle)?.focus?.(); } catch {}
                try { (okTitle ? newMdSlug : newMdTitle)?.reportValidity?.(); } catch {}
                return;
            }
            const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
            if (auth && auth.role && auth.token) {
                const ensureInput = (name, value) => {
                    let input = newMdForm.querySelector(`input[name="${name}"]`);
                    if (!(input instanceof HTMLInputElement)) {
                        input = document.createElement('input');
                        input.type = 'hidden';
                        input.name = name;
                        newMdForm.appendChild(input);
                    }
                    input.value = String(value || '');
                };
                ensureInput('auth_role', auth.role);
                ensureInput('auth_token', auth.token);
            }
        });
    }

    if (newMdPanel.style.display !== 'none' && newMdPanel.style.display !== '') {
        open();
    }
    setSlugReadonly();
    validateTitle({ showHint: false });
    syncSlugFromTitle({ showHint: false });
    validateSlug({ showHint: false, allowAdjust: true });
    buildFilenamePreview();
    setHint(newMdSlugHint, '', 'info');
    setHint(newMdTitleHint, '', 'info');

    newFolderBtn?.addEventListener('click', () => {
        if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
            alert(t('auth.superuser_required', 'Superuser login required.'));
            return;
        }
        if (!(newFolderForm instanceof HTMLFormElement)) return;
        if (!(newFolderName instanceof HTMLInputElement)) return;
        const name = window.prompt(t('js.prompt_new_folder', 'New folder name (use / for a subfolder):'), '');
        if (name === null) return;
        const raw = name.trim();
        if (!raw) return;
        if (raw.includes('\\') || raw.includes('..')) {
            alert(t('js.invalid_folder_alert', 'Invalid folder name.'));
            return;
        }
        const parts = raw.split('/');
        if (parts.length > 2 || parts.some(p => p === '' || p === '.' || p === '..')) {
            alert(t('js.invalid_folder_alert', 'Invalid folder name.'));
            return;
        }
        if (isPublisherMode()) {
            if (parts.length > 1) {
                alert(t('flash.nested_folder_not_allowed', 'Nested folders are disabled in WPM mode.'));
                return;
            }
            if (emojiRe && emojiRe.test(raw)) {
                alert(t('flash.folder_emoji_not_allowed', 'Emoji are not allowed in folder names when WPM is enabled.'));
                return;
            }
        }
        const folder = parts.join('/');
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (auth && auth.role && auth.token) {
            const ensureInput = (name, value) => {
                let input = newFolderForm.querySelector(`input[name="${name}"]`);
                if (!(input instanceof HTMLInputElement)) {
                    input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = name;
                    newFolderForm.appendChild(input);
                }
                input.value = String(value || '');
            };
            ensureInput('auth_role', auth.role);
            ensureInput('auth_token', auth.token);
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
        const newMdTitle = document.getElementById('newMdTitle');
        const newMdFile = document.getElementById('newMdFile');
        const focusTarget = (newMdTitle instanceof HTMLInputElement) ? newMdTitle : newMdFile;
        if (newMdPanel && focusTarget instanceof HTMLInputElement) {
            e.preventDefault();
            newMdPanel.style.display = 'block';
            focusTarget.focus();
            if (focusTarget.value) focusTarget.setSelectionRange(focusTarget.value.length, focusTarget.value.length);
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
        if (typeof window.__mdwCanDelete === 'function' && !window.__mdwCanDelete()) return;
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
    const nav = (window.MDW_VIEW_NAV && typeof window.MDW_VIEW_NAV === 'object') ? window.MDW_VIEW_NAV : null;

    document.addEventListener('keydown', (e) => {
        const t = e.target;
        if (t instanceof HTMLElement && t.matches('input, textarea, [contenteditable="true"]')) return;

        if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (typeof window.__mdwCanDelete === 'function' && !window.__mdwCanDelete()) return;
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

        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            const targetFile = (e.key === 'ArrowLeft') ? (nav?.prev || null) : (nav?.next || null);
            if (!targetFile) return;
            e.preventDefault();
            const url = `index.php?file=${encodeURIComponent(targetFile)}&folder=${encodeURIComponent(folder)}&focus=${encodeURIComponent(targetFile)}`;
            window.location.href = url;
        }
    });

    let touchStartX = null;
    let touchStartY = null;
    let touchStartTime = 0;
    const SWIPE_MIN_X = 60;
    const SWIPE_MAX_Y = 45;
    const SWIPE_MAX_MS = 900;

    const shouldIgnoreSwipe = (target) => {
        if (!(target instanceof HTMLElement)) return false;
        if (target.closest('input, textarea, [contenteditable="true"]')) return true;
        if (target.closest('pre, code')) return true;
        return false;
    };

    document.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        if (shouldIgnoreSwipe(e.target)) return;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (touchStartX === null || touchStartY === null) return;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const dt = Date.now() - touchStartTime;
        touchStartX = null;
        touchStartY = null;
        touchStartTime = 0;

        if (Math.abs(dx) < SWIPE_MIN_X) return;
        if (Math.abs(dy) > SWIPE_MAX_Y) return;
        if (dt > SWIPE_MAX_MS) return;

        const targetFile = dx < 0 ? (nav?.next || null) : (nav?.prev || null);
        if (!targetFile) return;
        const url = `index.php?file=${encodeURIComponent(targetFile)}&folder=${encodeURIComponent(folder)}&focus=${encodeURIComponent(targetFile)}`;
        window.location.href = url;
    }, { passive: true });
})();

// NAVIGATIE, FILTER & DOCUMENT LADEN
(function(){
    const normalizeNewlines = (s) => String(s ?? '').replace(/\r\n?/g, '\n');
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const overview = document.getElementById('links_md_overview');
    if (!overview) return;

    const isEditorPage = !!document.getElementById('editor');

    const filterInput = document.getElementById('filterInput');
    const editorForm = document.querySelector('.editor-form');
    const navOverlay = document.getElementById('navOverlay');
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    const mobileNavClose  = document.getElementById('mobileNavClose');
    const navSortSelect = document.getElementById('navSortSelect');
    const navSortRow = overview.querySelector('.nav-sort-row');
    const navFilterRow = overview.querySelector('.nav-filter-row');
    const contentList = overview.querySelector('#contentList');
    const navBackHref = contentList?.dataset.backHref || '';
    const filterReset = document.getElementById('filterReset');
    const filterClear = document.getElementById('filterClear');
    const explorerCollapseToggle = document.getElementById('explorerCollapseToggle');
    const params = new URLSearchParams(window.location.search);

    if (!filterInput) return;

    const navSortPlaceholder = (isEditorPage && navSortRow) ? document.createElement('div') : null;
    if (navSortRow && navSortPlaceholder && navSortRow.parentNode) {
        navSortPlaceholder.dataset.navSortPlaceholder = '1';
        navSortRow.parentNode.insertBefore(navSortPlaceholder, navSortRow);
    }

    // Explorer collapse/expand (edit.php, desktop)
    (function(){
        if (!isEditorPage) return;
        if (!(explorerCollapseToggle instanceof HTMLButtonElement)) return;

        const KEY = 'mdw_editor_explorer_collapsed';
        const root = document.documentElement;
        const mql = window.matchMedia('(max-width: 960px)');

        const isCollapsed = () => root.classList.contains('mdw-explorer-collapsed');
        const apply = (collapsed, save) => {
            const allow = !mql.matches;
            const next = allow && !!collapsed;
            root.classList.toggle('mdw-explorer-collapsed', next);
            const icon = explorerCollapseToggle.querySelector('.pi');
            if (icon) {
                icon.classList.toggle('pi-leftcaret', !next);
                icon.classList.toggle('pi-rightcaret', next);
            }
            const label = next
                ? t('edit.nav.expand_overview', 'Expand overview')
                : t('edit.nav.collapse_overview', 'Collapse overview');
            explorerCollapseToggle.title = label;
            explorerCollapseToggle.setAttribute('aria-label', label);
            if (save) {
                try { mdwStorageSet(KEY, next ? '1' : '0'); } catch {}
            }
        };

        const initial = (() => {
            try { return mdwStorageGet(KEY) === '1'; } catch { return false; }
        })();
        apply(initial, false);

        explorerCollapseToggle.addEventListener('click', () => apply(!isCollapsed(), true));
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', () => apply(isCollapsed(), false));
        } else if (typeof mql.addListener === 'function') {
            mql.addListener(() => apply(isCollapsed(), false));
        }
    })();

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
        btn.title = open
            ? t('nav.collapse_folder', 'Collapse folder')
            : t('nav.expand_folder', 'Expand folder');

        const caret = btn.querySelector('.folder-caret');
        const folderIcon = btn.querySelector('.folder-icon');
        if (caret) {
            caret.classList.toggle('pi-downcaret', open);
            caret.classList.toggle('pi-rightcaret', !open);
        }
        if (folderIcon) {
            folderIcon.classList.toggle('pi-openfolder', open);
            folderIcon.classList.toggle('pi-folder', !open);
        }
        if (!caret && !folderIcon) {
            const icon = btn.querySelector('.pi');
            if (icon) {
                icon.classList.toggle('pi-openfolder', open);
                icon.classList.toggle('pi-folder', !open);
            }
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

    const navMql = window.matchMedia('(max-width: 960px)');
    const closeNav = () => {
        document.documentElement.classList.remove('nav-open');
    };
    const openNav = () => {
        document.documentElement.classList.add('nav-open');
    };

    const updateMobileNavClose = () => {
        if (!(mobileNavClose instanceof HTMLButtonElement)) return;
        const useBack = !!(navBackHref && isEditorPage && navMql.matches);
        const icon = mobileNavClose.querySelector('.pi');
        if (icon) {
            icon.classList.toggle('pi-leftcaret', useBack);
            icon.classList.toggle('pi-cross', !useBack);
        }
        const label = useBack
            ? t('common.back', 'Back')
            : t('common.close', 'Close');
        mobileNavClose.title = label;
        mobileNavClose.setAttribute('aria-label', label);
        if (useBack) {
            mobileNavClose.dataset.backHref = navBackHref;
        } else {
            delete mobileNavClose.dataset.backHref;
        }
    };

    mobileNavToggle?.addEventListener('click', openNav);
    mobileNavClose?.addEventListener('click', () => {
        if (navBackHref && isEditorPage && navMql.matches) {
            window.location.href = navBackHref;
            return;
        }
        closeNav();
    });
    navOverlay?.addEventListener('click', closeNav);
    updateMobileNavClose();
    if (typeof navMql.addEventListener === 'function') {
        navMql.addEventListener('change', updateMobileNavClose);
    } else if (typeof navMql.addListener === 'function') {
        navMql.addListener(updateMobileNavClose);
    }

    const folderSections = Array.from(document.querySelectorAll('[data-folder-section]'))
        .filter(el => el instanceof HTMLElement);
    const docEntries = Array.from(overview.querySelectorAll('.doclink'))
        .filter(el => el instanceof HTMLElement)
        .map(el => {
            const text = String(el.textContent || '').toLowerCase();
            const section = el.closest?.('[data-folder-section]') || null;
            return { el, text, section };
        });

    const openFromQuery = () => {
        const openParam = params.get('open') || '';
        if (!openParam) return;
        const section = overview.querySelector(`[data-folder-section="${CSS.escape(openParam)}"]`);
        if (section instanceof HTMLElement) {
            section.setAttribute('data-user-open', '1');
            setFolderOpen(section, true);
        }
    };
    openFromQuery();

    const normalizeSort = (value) => String(value || '').trim().toLowerCase();
    const sortNoteItems = (mode) => {
        const lists = Array.from(overview.querySelectorAll('.notes-list'));
        if (!lists.length) return;

        const compare = (a, b) => {
            const dateA = String(a.dataset.date || '');
            const dateB = String(b.dataset.date || '');
            const titleA = normalizeSort(a.dataset.title || '');
            const titleB = normalizeSort(b.dataset.title || '');
            const slugA = normalizeSort(a.dataset.slug || '');
            const slugB = normalizeSort(b.dataset.slug || '');

            if (mode === 'title') {
                if (titleA !== titleB) return titleA.localeCompare(titleB);
                return slugA.localeCompare(slugB);
            }
            if (mode === 'slug') {
                if (slugA !== slugB) return slugA.localeCompare(slugB);
                return titleA.localeCompare(titleB);
            }

            if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            if (titleA !== titleB) return titleA.localeCompare(titleB);
            return slugA.localeCompare(slugB);
        };

        for (const list of lists) {
            const items = Array.from(list.querySelectorAll('li.note-item'));
            if (items.length < 2) continue;
            const empty = list.querySelector('.nav-empty');
            items.sort(compare);
            for (const item of items) list.appendChild(item);
            if (empty) list.appendChild(empty);
        }
    };

    (function(){
        if (!(navSortSelect instanceof HTMLSelectElement)) return;
        const SORT_KEY = 'mdw_nav_sort';
        const options = Array.from(navSortSelect.options).map(o => o.value);
        const stored = (() => {
            try { return mdwStorageGet(SORT_KEY) || ''; } catch { return ''; }
        })();
        const initial = options.includes(stored) ? stored : (navSortSelect.value || 'date');
        navSortSelect.value = initial;
        sortNoteItems(initial);
        navSortSelect.addEventListener('change', () => {
            const next = options.includes(navSortSelect.value) ? navSortSelect.value : 'date';
            try { mdwStorageSet(SORT_KEY, next); } catch {}
            sortNoteItems(next);
        });
    })();

    const updateNavSortPlacement = () => {
        if (!isEditorPage || !navSortRow || !navFilterRow || !navSortPlaceholder) return;
        if (navMql.matches) {
            navSortRow.classList.add('nav-sort-inline');
            navFilterRow.appendChild(navSortRow);
        } else {
            navSortRow.classList.remove('nav-sort-inline');
            if (navSortPlaceholder.parentNode) {
                navSortPlaceholder.parentNode.insertBefore(navSortRow, navSortPlaceholder);
            }
        }
    };
    updateNavSortPlacement();
    if (typeof navMql.addEventListener === 'function') {
        navMql.addEventListener('change', updateNavSortPlacement);
    } else if (typeof navMql.addListener === 'function') {
        navMql.addListener(updateNavSortPlacement);
    }

    function update() {
        const q = String(filterInput.value || '').trim().toLowerCase();
        const filtering = q.length > 0;

        let visible = 0;
        const visibleBySection = new Map();

        for (const { el, text, section } of docEntries) {
            const match = !filtering || text.includes(q);
            const nextDisplay = match ? '' : 'none';
            if (el.style.display !== nextDisplay) el.style.display = nextDisplay;
            if (!match) continue;
            visible++;
            if (section instanceof HTMLElement) {
                visibleBySection.set(section, (visibleBySection.get(section) || 0) + 1);
            }
        }

        navCount.textContent = filtering
            ? (visible === 1
                ? t('common.item_count_one', '{n} item', { n: visible })
                : t('common.item_count_other', '{n} items', { n: visible }))
            : t('common.total_items', '{n} total items', { n: docEntries.length });

        if (filterReset) filterReset.disabled = !filtering;
        if (filterClear) filterClear.style.display = filtering ? '' : 'none';

        for (const section of folderSections) {
            if (!filtering) {
                setFolderOpen(section, getFolderOpen(section));
                continue;
            }
            setFolderOpen(section, (visibleBySection.get(section) || 0) > 0);
        }
    }

    // q parameter uit URL
    const qParam = params.get('q');
    if (qParam) {
        filterInput.value = qParam;
    }

    let filterTimer = null;
    const scheduleUpdate = () => {
        if (filterTimer) window.clearTimeout(filterTimer);
        filterTimer = window.setTimeout(() => {
            filterTimer = null;
            update();
        }, 60);
    };
    filterInput.addEventListener('input', scheduleUpdate);
    const clearFilter = () => {
        filterInput.value = '';
        update();
        filterInput.focus();
    };
    filterReset?.addEventListener('click', clearFilter);
    filterClear?.addEventListener('click', clearFilter);

    // Editor: SPA-achtige navigatie (only markdown items)
    if (isEditorPage) {
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
        mdmDelegate(overview, 'click', 'a.kbd-item', (e, link) => {
            if (!(link instanceof HTMLAnchorElement)) return;
            const item = link.closest('.doclink[data-kind=\"md\"]');
            if (!(item instanceof HTMLElement)) return;
            if (e.defaultPrevented) return;
            if (e.button !== 0) return; // left click only
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            const url = new URL(link.href, window.location.href);
            const file = url.searchParams.get('file');
            if (!file) return;
            e.preventDefault();

            const isSecret = item.dataset.secret === 'true';

            if (file === window.CURRENT_FILE) {
                closeNav();
                return;
            }

            if (window.__mdDirty) {
                if (!confirm(t('js.unsaved_confirm', 'You have unsaved changes. Discard them and continue?'))) {
                    return;
                }
            }

            if (isSecret && !window.IS_SECRET_AUTHENTICATED) {
                window.location.href = link.href.replace('edit.php', 'index.php');
                return;
            }

            setCurrentItem(item);
            loadDocument(file);
            closeNav();
        });
    }

    async function loadDocument(file) {
        try {
            if (!mdmApi || typeof mdmApi.get !== 'function') {
                throw new Error('load_failed');
            }
            let data = null;
            try {
                data = await mdmApi.get(`edit.php?file=${encodeURIComponent(file)}&json=1`);
            } catch (err) {
                if (err && typeof err === 'object' && err.status === 403) {
                    window.location.href = `index.php?file=${encodeURIComponent(file)}`;
                    return;
                }
                data = err && typeof err === 'object' ? err.data : null;
                if (!data || typeof data !== 'object') throw err;
            }
            if (!data || data.ok === false || data.error) {
                const errCode = data && data.error ? String(data.error) : '';
                const msg = data && data.message ? String(data.message) : '';
                if (errCode === 'not_found') {
                    throw new Error(t('js.load_not_found', 'File not found.'));
                }
                if (errCode === 'forbidden') {
                    throw new Error(t('js.load_forbidden', 'Access denied.'));
                }
                throw new Error(msg || errCode || t('js.load_failed', 'Failed to load file.'));
            }
            if (typeof window.__mdwMarkOnline === 'function') {
                window.__mdwMarkOnline();
            }

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
            const folder = (() => {
                const filePath = String(data.file || '');
                if (!filePath) return 'root';
                const idx = filePath.lastIndexOf('/');
                return idx === -1 ? 'root' : filePath.slice(0, idx);
            })();
            const pathSegment = document.querySelector('.app-path-segment');
            if (pathSegment) {
                pathSegment.textContent = data.file;
                if (pathSegment instanceof HTMLAnchorElement) {
                    pathSegment.href = `index.php?file=${encodeURIComponent(data.file)}&folder=${encodeURIComponent(folder)}&focus=${encodeURIComponent(data.file)}`;
                }
            }
            const folderCrumb = document.querySelector('.app-breadcrumb [data-crumb="folder"]');
            if (folderCrumb instanceof HTMLAnchorElement) {
                folderCrumb.textContent = folder;
                folderCrumb.href = `index.php?folder=${encodeURIComponent(folder)}#contentList`;
            }

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
            if (typeof window.__mdwApplyTocHotKeyword === 'function') {
                window.__mdwApplyTocHotKeyword(preview, data.content);
            }
            if (typeof window.__mdwInitTocSideMenus === 'function') {
                window.__mdwInitTocSideMenus(preview);
            }
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
            if (typeof window.__mdwRenderMermaid === 'function') {
                try { await window.__mdwRenderMermaid(preview); } catch {}
            }

            // Update browser history
            history.pushState({file: data.file}, '', `?file=${encodeURIComponent(data.file)}`);
            
            // Trigger line number update en andere afhankelijke functies
            if (typeof window.__mdwResetMetaStore === 'function') {
                window.__mdwResetMetaStore();
            }
            editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof window.__mdwResetDirty === 'function') {
                window.__mdwResetDirty();
            }
            if (data && data.publish_state && typeof window.__mdwApplyPublishStateUi === 'function') {
                window.__mdwApplyPublishStateUi(data.publish_state);
            }
            const publishOverride = document.getElementById('publishStateOverride');
            if (publishOverride instanceof HTMLInputElement) {
                publishOverride.value = '0';
            }

        } catch (error) {
            console.error('Failed to load document:', error);
            const statusEl = document.getElementById('liveStatus');
            const msg = (error && error.message) ? String(error.message) : t('js.load_failed', 'Error loading file.');
            if (statusEl) statusEl.textContent = msg;
            if (typeof window.__mdwShowErrorModal === 'function') {
                window.__mdwShowErrorModal(msg, '');
            }
            if (typeof window.__mdwReportNetworkError === 'function') {
                window.__mdwReportNetworkError(error);
            }
        }
    }

    update();

    const focusParam = params.get('focus');
    if (focusParam && !params.get('file')) {
        const el = overview.querySelector(`[data-file="${CSS.escape(focusParam)}"] a.kbd-item`);
        if (el instanceof HTMLAnchorElement) {
            try { el.focus({ preventScroll: true }); } catch { el.focus(); }
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }
})();
    };
})();
