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
    let fileDragTitle = '';
    let fileDragRow = null;
    let fileDragCanMove = false;

    document.addEventListener('dragstart', (e) => {
        const link = e.target instanceof Element ? e.target.closest('.note-link') : null;
        const row = link?.closest('.note-item[data-kind="md"]');
        if (!(row instanceof HTMLElement)) return;
        const file = getFilePathFromRow(row);
        if (!file) return;
        const canMove = canManageFolders();
        fileDragSrc = file;
        fileDragTitle = String(row.dataset.title || '').trim();
        fileDragRow = row;
        fileDragCanMove = canMove;
        row.classList.add('note-dragging');
        try {
            const linkHint = `edit.php?file=${encodeURIComponent(file)}`;
            e.dataTransfer?.setData('text/plain', file);
            e.dataTransfer?.setData('text/mdw-file', file);
            e.dataTransfer?.setData('text/uri-list', linkHint);
            if (fileDragTitle) e.dataTransfer?.setData('text/mdw-title', fileDragTitle);
            e.dataTransfer.effectAllowed = canMove ? 'copyMove' : 'copy';
        } catch {}
    });

    document.addEventListener('dragover', (e) => {
        if (!fileDragSrc || !fileDragCanMove) return;
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
        if (!fileDragSrc || !fileDragCanMove) return;
        const section = e.target instanceof Element ? e.target.closest('.nav-section[data-folder-section]') : null;
        const header = section?.querySelector('.note-group-title');
        const targetPath = header instanceof HTMLElement ? String(header.dataset.folderPath || '').trim() : '';
        e.preventDefault();
        clearDropTargets();
        fileDragRow?.classList.remove('note-dragging');
        if (targetPath) moveFile(fileDragSrc, targetPath);
        fileDragSrc = '';
        fileDragTitle = '';
        fileDragRow = null;
        fileDragCanMove = false;
    });

    document.addEventListener('dragend', () => {
        clearDropTargets();
        fileDragRow?.classList.remove('note-dragging');
        fileDragRow = null;
        fileDragSrc = '';
        fileDragTitle = '';
        fileDragCanMove = false;
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

// +MD modal toggle (index.php + edit.php)
(function(){
    const newMdToggle = document.getElementById('newMdToggle');
    const newMdOverlay = document.getElementById('newMdOverlay');
    const newMdPanel = document.getElementById('newMdPanel');
    const newMdClose = document.getElementById('newMdClose');
    const newMdPrefixDate = document.getElementById('newMdPrefixDate');
    const newMdTitle = document.getElementById('newMdTitle');
    const newMdSlug = document.getElementById('newMdFile');
    const newMdTitleHint = document.getElementById('newMdTitleHint');
    const newMdSlugHint = document.getElementById('newMdFileHint');
    const newMdPreview = document.getElementById('newMdFilePreview');
    const newMdPreviewValue = document.getElementById('newMdFilePreviewValue');
    const newMdForm = (newMdPanel instanceof HTMLFormElement)
        ? newMdPanel
        : (newMdSlug?.closest?.('form') || null);
    const newMdContent = newMdForm?.querySelector?.('textarea[name="new_content"]') || null;
    const newFolderBtn = document.getElementById('newFolderBtn');
    const newFolderForm = document.getElementById('newFolderForm');
    const newFolderName = document.getElementById('newFolderName');

    if (!newMdToggle) return;
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    if (!newMdPanel) {
        newMdToggle.addEventListener('click', () => {
            window.location.href = 'index.php?new=1';
        });
        return;
    }

    const newMdModalBinding = (typeof window.__mdwBindModal === 'function')
        ? window.__mdwBindModal({
            modal: newMdPanel,
            overlay: newMdOverlay,
            closeButtons: [newMdClose],
            closeOnOverlay: true,
            closeOnEsc: true,
        })
        : null;

    const isOpen = () => newMdModalBinding ? newMdModalBinding.isOpen() : !newMdPanel.hidden;
    const open = () => {
        if (newMdModalBinding) newMdModalBinding.open({ source: 'toggle' });
        else {
            if (newMdOverlay) newMdOverlay.hidden = false;
            newMdPanel.hidden = false;
        }
        setSlugReadonly();
        const focusTarget = (newMdTitle instanceof HTMLInputElement) ? newMdTitle : newMdSlug;
        if (focusTarget instanceof HTMLInputElement) {
            focusTarget.focus();
            if (focusTarget.value) focusTarget.setSelectionRange(focusTarget.value.length, focusTarget.value.length);
        }
    };
    const close = () => {
        if (newMdModalBinding) newMdModalBinding.close({ source: 'toggle' });
        else {
            newMdPanel.hidden = true;
            if (newMdOverlay) newMdOverlay.hidden = true;
        }
    };
    const toggle = () => {
        if (isOpen()) close();
        else open();
    };
    window.__mdwOpenNewMdModal = open;
    window.__mdwCloseNewMdModal = close;

    newMdToggle.addEventListener('click', toggle);
    if (!newMdModalBinding) {
        newMdClose?.addEventListener('click', close);
        newMdOverlay?.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (!isOpen()) return;
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                close();
            }
        });
    }

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
    const emojiRe = (() => {
        try {
            return /\p{Extended_Pictographic}/u;
        } catch {
            return null;
        }
    })();

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

    if (newMdPanel.dataset.initialOpen === '1') {
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

// Create new markdown shortcut (respects shortcut modifier setting)
(function(){
    const getShortcutMod = () => {
        try {
            const fn = window.__mdwReadShortcutMod;
            const v = (typeof fn === 'function') ? fn() : null;
            return (v === 'command' || v === 'option') ? v : 'option';
        } catch {
            return 'option';
        }
    };
    const isConfiguredShortcut = (e) => {
        if (!e.ctrlKey) return false;
        const mod = getShortcutMod();
        if (mod === 'command') return e.metaKey && !e.altKey;
        return e.altKey && !e.metaKey;
    };
    const isLegacyShortcut = (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey;

    document.addEventListener('keydown', (e) => {
        if (!(e.key === 'n' || e.key === 'N')) return;
        if (!isConfiguredShortcut(e) && !isLegacyShortcut(e)) return;

        if (typeof window.__mdwOpenNewMdModal === 'function') {
            e.preventDefault();
            window.__mdwOpenNewMdModal();
            return;
        }

        const url = 'index.php?new=1';
        window.location.href = url;
    });
})();

// Keyboard shortcuts (index.php + edit.php)
(function(){
    const overview = document.getElementById('links_md_overview');
    if (!overview) return;

    const isEditorPage = !!document.getElementById('editor');
    const isIndexPage = document.body.classList.contains('index-page');
    const isIndexSplitLayout = isIndexPage && document.body.classList.contains('index-split-layout');
    const isIndexOverviewMode = (() => {
        if (!isIndexPage) return false;
        const params = new URLSearchParams(window.location.search);
        return !params.get('file') || isIndexSplitLayout;
    })();
    const getNoteItems = () => Array.from(overview.querySelectorAll('a.kbd-item'))
        .filter((a) => a instanceof HTMLAnchorElement)
        .filter((a) => a.offsetParent !== null);
    const isFolderTreeLink = (el) => {
        if (!(el instanceof HTMLAnchorElement)) return false;
        if (!el.classList.contains('breadcrumb-link')) return false;
        return !!el.closest('.note-group-title');
    };
    const isFolderBackLink = (el) => {
        if (!(el instanceof HTMLAnchorElement)) return false;
        if (!el.classList.contains('folder-back')) return false;
        return !!el.closest('.note-group-title');
    };
    const getTreeItems = () => Array.from(overview.querySelectorAll('a.kbd-item, .note-group-title .folder-back, .note-group-title .breadcrumb-link'))
        .filter((a) => a instanceof HTMLAnchorElement)
        .filter((a) => a.offsetParent !== null);

    const getActiveKbdItem = (activeEl = document.activeElement) => {
        if (!(activeEl instanceof HTMLElement)) return null;
        if (activeEl instanceof HTMLAnchorElement && activeEl.classList.contains('kbd-item')) return activeEl;
        const candidate = activeEl.closest('a.kbd-item');
        return candidate instanceof HTMLAnchorElement ? candidate : null;
    };
    const getActiveTreeItem = (activeEl = document.activeElement) => {
        if (!(activeEl instanceof HTMLElement)) return null;
        if (activeEl instanceof HTMLAnchorElement && (activeEl.classList.contains('kbd-item') || isFolderTreeLink(activeEl) || isFolderBackLink(activeEl))) {
            return activeEl;
        }
        const candidate = activeEl.closest('a');
        if (!(candidate instanceof HTMLAnchorElement)) return null;
        if (candidate.classList.contains('kbd-item') || isFolderTreeLink(candidate) || isFolderBackLink(candidate)) return candidate;
        return null;
    };
    const getSectionForAnchor = (anchor) => {
        if (!(anchor instanceof HTMLAnchorElement)) return null;
        if (isFolderTreeLink(anchor)) {
            const section = anchor.closest('.nav-section[data-folder-section]');
            return section instanceof HTMLElement ? section : null;
        }
        const row = anchor.closest('.note-item[data-kind="md"]');
        const section = row?.closest('.nav-section[data-folder-section]');
        return section instanceof HTMLElement ? section : null;
    };
    const getFolderLinkForSection = (section) => {
        if (!(section instanceof HTMLElement)) return null;
        const link = section.querySelector(':scope > .note-group-title .breadcrumb-link');
        return link instanceof HTMLAnchorElement ? link : null;
    };
    const getBackLinkForSection = (section) => {
        if (!(section instanceof HTMLElement)) return null;
        const link = section.querySelector(':scope > .note-group-title .folder-back');
        return link instanceof HTMLAnchorElement && link.offsetParent !== null ? link : null;
    };
    const followBackLink = (link) => {
        if (!(link instanceof HTMLAnchorElement)) return false;
        const href = String(link.getAttribute('href') || '').trim();
        if (!href) return false;
        window.location.href = href;
        return true;
    };
    const getFolderToggleForSection = (section) => {
        if (!(section instanceof HTMLElement)) return null;
        const btn = section.querySelector(':scope > .note-group-title .folder-toggle');
        return btn instanceof HTMLButtonElement ? btn : null;
    };
    const getFolderChildrenForSection = (section) => {
        const btn = getFolderToggleForSection(section);
        const id = btn?.getAttribute('aria-controls') || '';
        if (!id) return null;
        const el = document.getElementById(id);
        return el instanceof HTMLElement ? el : null;
    };
    const isFolderOpen = (section) => {
        const btn = getFolderToggleForSection(section);
        if (btn instanceof HTMLButtonElement) {
            return btn.getAttribute('aria-expanded') === 'true';
        }
        const children = getFolderChildrenForSection(section);
        return children instanceof HTMLElement ? !children.hidden : true;
    };
    const setFolderOpen = (section, open) => {
        const btn = getFolderToggleForSection(section);
        if (!(btn instanceof HTMLButtonElement)) return false;
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        if (expanded === !!open) return true;
        btn.click();
        return true;
    };
    const toggleFolderOpen = (section) => {
        const expanded = isFolderOpen(section);
        return setFolderOpen(section, !expanded);
    };
    const openFolder = (section) => setFolderOpen(section, true);
    const closeFolder = (section) => setFolderOpen(section, false);
    const getVisibleChildrenItems = (section) => {
        const children = getFolderChildrenForSection(section);
        if (!(children instanceof HTMLElement)) return [];
        return Array.from(children.querySelectorAll('a.kbd-item, .note-group-title .breadcrumb-link'))
            .filter((el) => el instanceof HTMLAnchorElement)
            .filter((el) => el.offsetParent !== null);
    };
    const getFirstVisibleChildItem = (section) => {
        const items = getVisibleChildrenItems(section);
        return items.length ? items[0] : null;
    };
    const getParentFolderLink = (section) => {
        if (!(section instanceof HTMLElement)) return null;
        const parentSection = section.parentElement?.closest?.('.nav-section[data-folder-section]') || null;
        if (!(parentSection instanceof HTMLElement)) return null;
        return getFolderLinkForSection(parentSection);
    };
    const getBackLinkForAnchor = (anchor) => {
        const section = getSectionForAnchor(anchor);
        if (!(section instanceof HTMLElement)) return null;
        return getBackLinkForSection(section);
    };
    const focusFolderForAnchor = (anchor) => {
        const section = getSectionForAnchor(anchor);
        if (!(section instanceof HTMLElement)) return null;
        return getFolderLinkForSection(section);
    };
    const shouldFocusFolderOnArrowUp = (anchor) => {
        if (!(anchor instanceof HTMLAnchorElement)) return false;
        if (isFolderTreeLink(anchor)) return false;
        const section = getSectionForAnchor(anchor);
        if (!(section instanceof HTMLElement)) return false;
        const visibleChildren = getVisibleChildrenItems(section);
        if (visibleChildren.length === 0) return false;
        return visibleChildren[0] === anchor;
    };
    const clearWanderMarkers = () => {
        overview.querySelectorAll('.kbd-wander-current').forEach((el) => el.classList.remove('kbd-wander-current'));
        overview.querySelectorAll('.kbd-wander-folder-link').forEach((el) => el.classList.remove('kbd-wander-folder-link'));
        overview.querySelectorAll('.kbd-wander-back-link').forEach((el) => el.classList.remove('kbd-wander-back-link'));
        overview.querySelectorAll('.kbd-wander-folder').forEach((el) => el.classList.remove('kbd-wander-folder'));
        overview.querySelectorAll('.kbd-wander-parent').forEach((el) => el.classList.remove('kbd-wander-parent'));
    };
    const markWanderState = (anchor) => {
        clearWanderMarkers();
        if (!(anchor instanceof HTMLAnchorElement)) return;
        if (isFolderBackLink(anchor)) {
            anchor.classList.add('kbd-wander-back-link');
            const section = anchor.closest('.nav-section[data-folder-section]');
            if (section instanceof HTMLElement) {
                section.classList.add('kbd-wander-folder');
                section.classList.add('kbd-wander-parent');
            }
            return;
        }
        if (isFolderTreeLink(anchor)) {
            anchor.classList.add('kbd-wander-folder-link');
            const section = anchor.closest('.nav-section[data-folder-section]');
            if (section instanceof HTMLElement) {
                section.classList.add('kbd-wander-folder');
                const parentSection = section.parentElement?.closest?.('.nav-section[data-folder-section]') || null;
                if (parentSection instanceof HTMLElement) {
                    parentSection.classList.add('kbd-wander-parent');
                }
            }
            return;
        }

        const row = anchor.closest('.note-item[data-kind="md"]');
        if (row instanceof HTMLElement) {
            row.classList.add('kbd-wander-current');
            const section = row.closest('.nav-section[data-folder-section]');
            if (section instanceof HTMLElement) {
                section.classList.add('kbd-wander-folder');
                const parentSection = section.parentElement?.closest?.('.nav-section[data-folder-section]') || null;
                if (parentSection instanceof HTMLElement) {
                    parentSection.classList.add('kbd-wander-parent');
                }
            }
        }
    };

    let lastFocusedItem = null;
    let lastFocusedTreeItem = null;
    const scrollFocus = (el) => {
        try { el.focus({preventScroll: true}); } catch { el.focus(); }
        el.scrollIntoView({block: 'nearest', inline: 'nearest'});
        if (el.classList.contains('kbd-item')) {
            lastFocusedItem = el;
        }
        lastFocusedTreeItem = el;
        markWanderState(el);
    };

    const focusRelative = (delta) => {
        const items = getTreeItems();
        if (items.length === 0) return;
        const active = getActiveTreeItem(document.activeElement) || lastFocusedTreeItem;
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
        if (params.get('file') && !isIndexSplitLayout) return;
        const focusFile = params.get('focus') || (isIndexSplitLayout ? params.get('file') : '');
        if (!focusFile) return;
        const el = overview.querySelector(`[data-file="${CSS.escape(focusFile)}"] a.kbd-item`);
        if (el instanceof HTMLAnchorElement) {
            scrollFocus(el);
        }
    };

    focusFromQuery();
    overview.addEventListener('focusin', (e) => {
        const el = e.target;
        if (!(el instanceof HTMLElement)) return;
        const anchor = getActiveTreeItem(el);
        if (anchor instanceof HTMLAnchorElement) {
            markWanderState(anchor);
            lastFocusedTreeItem = anchor;
            if (anchor.classList.contains('kbd-item')) lastFocusedItem = anchor;
        }
    });
    document.addEventListener('click', (e) => {
        const anchor = e.target instanceof Element ? e.target.closest('#links_md_overview a.kbd-item, #links_md_overview .note-group-title .breadcrumb-link') : null;
        if (!(anchor instanceof HTMLAnchorElement)) return;
        markWanderState(anchor);
        lastFocusedTreeItem = anchor;
        if (anchor.classList.contains('kbd-item')) lastFocusedItem = anchor;
    });

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
            const items = getTreeItems();
            if (items.length === 0) return;
            if (!overview.contains(active) && isIndexOverviewMode) {
                // Let Enter keep default behavior outside overview on index page
                return;
            }
            e.preventDefault();
            const a = getActiveTreeItem(active);
            const toOpen = (a instanceof HTMLAnchorElement) ? a : (lastFocusedTreeItem || lastFocusedItem);
            if (toOpen instanceof HTMLAnchorElement) {
                if (isFolderBackLink(toOpen)) {
                    followBackLink(toOpen);
                } else if (isFolderTreeLink(toOpen)) {
                    const section = getSectionForAnchor(toOpen);
                    if (section instanceof HTMLElement) {
                        toggleFolderOpen(section);
                        markWanderState(toOpen);
                    }
                } else {
                    toOpen.click();
                }
            } else {
                scrollFocus(items[0]);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            if (isIndexOverviewMode && !overview.contains(active)) {
                e.preventDefault();
                const items = getTreeItems();
                if (items.length) scrollFocus(lastFocusedTreeItem || lastFocusedItem || items[0]);
                return;
            }
            e.preventDefault();
            focusRelative(1);
            return;
        }
        if (e.key === 'ArrowUp') {
            if (isIndexOverviewMode && !overview.contains(active)) {
                e.preventDefault();
                const items = getTreeItems();
                if (items.length) scrollFocus(lastFocusedTreeItem || lastFocusedItem || items[items.length - 1]);
                return;
            }
            const treeActive = getActiveTreeItem(active) || lastFocusedTreeItem || lastFocusedItem;
            if (isFolderBackLink(treeActive)) {
                e.preventDefault();
                const section = getSectionForAnchor(treeActive);
                const folderLink = getFolderLinkForSection(section);
                if (folderLink instanceof HTMLAnchorElement) {
                    scrollFocus(folderLink);
                } else {
                    focusRelative(-1);
                }
                return;
            }
            if (isFolderTreeLink(treeActive)) {
                const backLink = getBackLinkForAnchor(treeActive);
                if (backLink instanceof HTMLAnchorElement) {
                    e.preventDefault();
                    scrollFocus(backLink);
                    return;
                }
            }
            const activeItem = getActiveKbdItem(active) || lastFocusedItem;
            if (shouldFocusFolderOnArrowUp(activeItem)) {
                e.preventDefault();
                const folderLink = focusFolderForAnchor(activeItem);
                if (folderLink instanceof HTMLAnchorElement) {
                    scrollFocus(folderLink);
                    return;
                }
            }
            e.preventDefault();
            focusRelative(-1);
            return;
        }
        if (e.key === 'ArrowRight') {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (!overview.contains(active)) return;
            const activeItem = getActiveTreeItem(active) || lastFocusedTreeItem || lastFocusedItem;
            if (isFolderTreeLink(activeItem)) {
                e.preventDefault();
                const section = getSectionForAnchor(activeItem);
                if (!(section instanceof HTMLElement)) return;
                if (!isFolderOpen(section)) {
                    openFolder(section);
                    markWanderState(activeItem);
                    return;
                }
                const child = getFirstVisibleChildItem(section);
                if (child instanceof HTMLAnchorElement) {
                    scrollFocus(child);
                }
                return;
            }
            e.preventDefault();
            focusRelative(1);
            return;
        }
        if (e.key === 'ArrowLeft') {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (!overview.contains(active)) return;
            const activeItem = getActiveTreeItem(active) || lastFocusedTreeItem || lastFocusedItem;
            if (isFolderBackLink(activeItem)) {
                e.preventDefault();
                if (followBackLink(activeItem)) return;
            }
            if (isFolderTreeLink(activeItem)) {
                const backLink = getBackLinkForAnchor(activeItem);
                if (backLink instanceof HTMLAnchorElement) {
                    e.preventDefault();
                    scrollFocus(backLink);
                    return;
                }
                e.preventDefault();
                const section = getSectionForAnchor(activeItem);
                if (!(section instanceof HTMLElement)) return;
                if (isFolderOpen(section)) {
                    closeFolder(section);
                    markWanderState(activeItem);
                    return;
                }
                const parentLink = getParentFolderLink(section);
                if (parentLink instanceof HTMLAnchorElement) {
                    scrollFocus(parentLink);
                }
                return;
            }
            if (activeItem instanceof HTMLAnchorElement && activeItem.classList.contains('kbd-item')) {
                const folderLink = focusFolderForAnchor(activeItem);
                if (folderLink instanceof HTMLAnchorElement) {
                    e.preventDefault();
                    scrollFocus(folderLink);
                    return;
                }
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
    const overview = document.getElementById('links_md_overview');

    const folderParam = params.get('folder');
    const inferredFolder = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : 'root';
    const folder = folderParam || inferredFolder;
    const focus = params.get('focus') || file;
    const folderParamOut = folder === 'root' ? '' : folder;
    const buildIndexUrl = (targetFile, targetFocus) => {
        const next = new URLSearchParams();
        if (targetFile) next.set('file', targetFile);
        if (folderParamOut) next.set('folder', folderParamOut);
        if (targetFocus) next.set('focus', targetFocus);
        const query = next.toString();
        return query ? `index.php?${query}` : 'index.php';
    };
    const buildEditUrl = (targetFile) => {
        const next = new URLSearchParams();
        if (targetFile) next.set('file', targetFile);
        if (folderParamOut) next.set('folder', folderParamOut);
        const query = next.toString();
        return query ? `edit.php?${query}` : 'edit.php';
    };
    const nav = (window.MDW_VIEW_NAV && typeof window.MDW_VIEW_NAV === 'object') ? window.MDW_VIEW_NAV : null;

    document.addEventListener('keydown', (e) => {
        const t = e.target;
        if (t instanceof HTMLElement && t.matches('input, textarea, [contenteditable="true"]')) return;
        const activeEl = document.activeElement;
        const inExplorerTree = activeEl instanceof HTMLElement && !!activeEl.closest?.('#contentList');
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && inExplorerTree) {
            return;
        }

        if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (typeof window.__mdwCanDelete === 'function' && !window.__mdwCanDelete()) return;
            const form = document.querySelector(`form.deleteForm[data-file="${CSS.escape(file)}"]`)
                || document.querySelector('form.deleteForm');
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
            const url = buildIndexUrl('', focus);
            window.location.href = url;
            return;
        }

	        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
	            e.preventDefault();
	            const url = buildEditUrl(file);
	            window.location.href = url;
	        }

        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            const targetFile = (e.key === 'ArrowLeft') ? (nav?.prev || null) : (nav?.next || null);
            if (!targetFile) return;
            e.preventDefault();
            const url = buildIndexUrl(targetFile, targetFile);
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
        const url = buildIndexUrl(targetFile, targetFile);
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
    const focusParam = params.get('focus');
    const allowFocusWithFile = document.body.classList.contains('index-split-layout');
    const previewEditBtn = document.getElementById('previewEditBtn');
    const explorerEditBtn = document.getElementById('explorerEditBtn');
    const explorerDeleteForm = document.getElementById('explorerDeleteForm');
    const explorerDeleteFileInput = document.getElementById('explorerDeleteFileInput');
    const previewEditBaseHref = (() => {
        if (!(previewEditBtn instanceof HTMLAnchorElement)) return 'edit.php';
        const raw = String(previewEditBtn.dataset.baseHref || previewEditBtn.getAttribute('href') || 'edit.php').trim();
        return raw || 'edit.php';
    })();
    const explorerEditBaseHref = (() => {
        if (!(explorerEditBtn instanceof HTMLAnchorElement)) return 'edit.php';
        const raw = String(explorerEditBtn.dataset.baseHref || explorerEditBtn.getAttribute('href') || 'edit.php').trim();
        return raw || 'edit.php';
    })();
    const previewEditBasePath = String(previewEditBaseHref.split('?')[0] || 'edit.php').trim() || 'edit.php';
    const explorerEditBasePath = String(explorerEditBaseHref.split('?')[0] || 'edit.php').trim() || 'edit.php';
    const previewEditFolderFromFile = (filePath) => {
        const file = String(filePath || '').trim();
        if (!file) return 'root';
        const idx = file.lastIndexOf('/');
        return idx === -1 ? 'root' : file.slice(0, idx);
    };
    const previewEditHrefForFile = (filePath) => {
        const file = String(filePath || '').trim();
        if (!file) return previewEditBaseHref;
        const folder = previewEditFolderFromFile(file);
        return `${previewEditBasePath}?file=${encodeURIComponent(file)}&folder=${encodeURIComponent(folder || 'root')}`;
    };
    const explorerEditHrefForFile = (filePath) => {
        const file = String(filePath || '').trim();
        if (!file) return explorerEditBaseHref;
        const folder = previewEditFolderFromFile(file);
        return `${explorerEditBasePath}?file=${encodeURIComponent(file)}&folder=${encodeURIComponent(folder || 'root')}`;
    };
    const setPreviewEditTarget = (filePath) => {
        if (!(previewEditBtn instanceof HTMLAnchorElement)) return;
        const file = String(filePath || '').trim();
        if (!file) {
            previewEditBtn.href = previewEditBaseHref;
            previewEditBtn.classList.add('is-disabled');
            previewEditBtn.setAttribute('aria-disabled', 'true');
            previewEditBtn.setAttribute('tabindex', '-1');
            return;
        }
        previewEditBtn.href = previewEditHrefForFile(file);
        previewEditBtn.classList.remove('is-disabled');
        previewEditBtn.removeAttribute('aria-disabled');
        previewEditBtn.removeAttribute('tabindex');
    };
    const setExplorerTopActionTarget = (filePath) => {
        const file = String(filePath || '').trim();
        if (explorerEditBtn instanceof HTMLAnchorElement) {
            if (!file) {
                explorerEditBtn.href = explorerEditBaseHref;
                explorerEditBtn.classList.add('is-disabled');
                explorerEditBtn.setAttribute('aria-disabled', 'true');
                explorerEditBtn.setAttribute('tabindex', '-1');
            } else {
                explorerEditBtn.href = explorerEditHrefForFile(file);
                explorerEditBtn.classList.remove('is-disabled');
                explorerEditBtn.removeAttribute('aria-disabled');
                explorerEditBtn.removeAttribute('tabindex');
            }
        }
        if (explorerDeleteForm instanceof HTMLFormElement) {
            explorerDeleteForm.dataset.file = file;
            if (explorerDeleteFileInput instanceof HTMLInputElement) {
                explorerDeleteFileInput.value = file;
            }
            const deleteBtn = explorerDeleteForm.querySelector('button[type="submit"]');
            if (deleteBtn instanceof HTMLButtonElement) {
                deleteBtn.disabled = !file;
            }
        }
    };
    const getFocusedOverviewFile = () => {
        const active = document.activeElement;
        if (active instanceof HTMLElement) {
            const activeRow = active.closest('.note-item[data-kind="md"][data-file]');
            if (activeRow instanceof HTMLElement) {
                const fromActive = String(activeRow.dataset.file || '').trim();
                if (fromActive) return fromActive;
            }
        }
        const wanderRow = overview.querySelector('.note-item[data-kind="md"].kbd-wander-current[data-file]');
        if (wanderRow instanceof HTMLElement) {
            const fromWander = String(wanderRow.dataset.file || '').trim();
            if (fromWander) return fromWander;
        }
        const currentRow = overview.querySelector('.note-item[data-kind="md"].nav-item-current[data-file]');
        if (currentRow instanceof HTMLElement) {
            const fromCurrent = String(currentRow.dataset.file || '').trim();
            if (fromCurrent) return fromCurrent;
        }
        return '';
    };
    const syncPreviewEditTarget = (fallbackFile = '') => {
        const focused = getFocusedOverviewFile();
        const file = String(focused || fallbackFile || window.CURRENT_FILE || '').trim();
        setPreviewEditTarget(file);
        setExplorerTopActionTarget(file);
    };

    if (!filterInput) return;

    const navSortPlaceholder = (isEditorPage && navSortRow) ? document.createElement('div') : null;
    if (navSortRow && navSortPlaceholder && navSortRow.parentNode) {
        navSortPlaceholder.dataset.navSortPlaceholder = '1';
        navSortRow.parentNode.insertBefore(navSortPlaceholder, navSortRow);
    }
    if (previewEditBtn instanceof HTMLAnchorElement || explorerEditBtn instanceof HTMLAnchorElement || explorerDeleteForm instanceof HTMLFormElement) {
        const syncSoon = () => requestAnimationFrame(() => syncPreviewEditTarget());
        previewEditBtn?.addEventListener('click', (e) => {
            if (previewEditBtn.classList.contains('is-disabled') || previewEditBtn.getAttribute('aria-disabled') === 'true') {
                e.preventDefault();
            }
        });
        explorerEditBtn?.addEventListener('click', (e) => {
            if (explorerEditBtn.classList.contains('is-disabled') || explorerEditBtn.getAttribute('aria-disabled') === 'true') {
                e.preventDefault();
            }
        });
        overview.addEventListener('focusin', syncSoon);
        overview.addEventListener('click', syncSoon);
        overview.addEventListener('keydown', (e) => {
            const key = String(e.key || '');
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown' || key === 'Enter') {
                syncSoon();
            }
        });
        syncPreviewEditTarget();
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
    const findParentFolderSection = (section) => {
        if (!(section instanceof HTMLElement)) return null;
        let ancestor = section.parentElement;
        while (ancestor) {
            if (ancestor.hasAttribute('data-folder-section')) return ancestor;
            ancestor = ancestor.parentElement;
        }
        return null;
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

    let onFolderToggle = null;
    document.querySelectorAll('[data-folder-section]').forEach(section => {
        const btn = section.querySelector('button.folder-toggle');
        if (!(btn instanceof HTMLButtonElement)) return;
        btn.addEventListener('click', () => {
            const next = !getFolderOpen(section);
            section.setAttribute('data-user-open', next ? '1' : '0');
            setFolderOpen(section, next);
            if (typeof onFolderToggle === 'function') onFolderToggle(section, next);
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
    const folderHasEmoji = (() => {
        try {
            const re = /\p{Extended_Pictographic}/u;
            return (text) => re.test(String(text || ''));
        } catch {
            return () => false;
        }
    })();
    const folderHash = (value) => {
        const text = String(value || '');
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    };
    const toHsla = (h, s, l, a) => `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
    const applyFolderAccents = () => {
        if (!folderSections.length) return;
        for (const section of folderSections) {
            const folderPath = String(section.getAttribute('data-folder-section') || '').trim();
            if (!folderPath) continue;

            if (folderPath === 'root') {
                section.style.setProperty('--folder-accent', 'var(--text-muted)');
                section.style.setProperty('--folder-accent-border', 'var(--border-soft)');
                section.style.setProperty('--folder-accent-bg', 'transparent');
                continue;
            }

            const labelText = String(section.querySelector('.breadcrumb-link')?.textContent || folderPath).trim();
            const hash = folderHash(folderPath.toLowerCase());
            const hue = hash % 360;
            const emojiBoost = folderHasEmoji(labelText) ? 1 : 0;

            const sat = emojiBoost ? 78 : 64;
            const light = emojiBoost ? 48 : 44;
            const accent = toHsla(hue, sat, light, 1);
            const border = toHsla(hue, Math.max(42, sat - 8), Math.min(72, light + 20), 0.72);
            const bg = toHsla(hue, Math.max(36, sat - 24), Math.min(84, light + 36), emojiBoost ? 0.2 : 0.14);

            section.style.setProperty('--folder-accent', accent);
            section.style.setProperty('--folder-accent-border', border);
            section.style.setProperty('--folder-accent-bg', bg);
            if (emojiBoost) {
                section.setAttribute('data-folder-emoji', '1');
            } else {
                section.removeAttribute('data-folder-emoji');
            }
        }
    };
    applyFolderAccents();
    let docEntries = [];
    const refreshDocEntries = () => {
        docEntries = Array.from(overview.querySelectorAll('.doclink'))
            .filter(el => el instanceof HTMLElement)
            .map(el => {
                const text = String(el.textContent || '').toLowerCase();
                const section = el.closest?.('[data-folder-section]') || null;
                return { el, text, section };
            });
        return docEntries;
    };
    refreshDocEntries();

    const openFolderPath = (folderPath) => {
        const path = String(folderPath || '').trim();
        if (!path) return null;
        const section = overview.querySelector(`[data-folder-section="${CSS.escape(path)}"]`);
        if (!(section instanceof HTMLElement)) return null;
        let current = section;
        while (current instanceof HTMLElement) {
            current.setAttribute('data-user-open', '1');
            setFolderOpen(current, true);
            current = findParentFolderSection(current);
        }
        return section;
    };
    const openFromQuery = () => {
        const openParam = params.get('open') || '';
        if (!openParam) return;
        openFolderPath(openParam);
    };
    const focusFolderFromQuery = () => {
        const focusFolder = String(params.get('focus_folder') || '').trim();
        if (!focusFolder) return;
        const section = openFolderPath(focusFolder);
        if (!(section instanceof HTMLElement)) return;
        const link = section.querySelector(':scope > .note-group-title .breadcrumb-link');
        if (!(link instanceof HTMLAnchorElement)) return;
        requestAnimationFrame(() => {
            try { link.focus({ preventScroll: true }); } catch { link.focus(); }
            link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
    };
    openFromQuery();
    focusFolderFromQuery();

    const lazyRequested = contentList?.dataset.lazyNotes === '1';
    const lazyEndpoint = String(contentList?.dataset.lazyEndpoint || 'index.php?json=explorer_tree');
    const lazyCacheTtlMs = (() => {
        const raw = parseInt(String(contentList?.dataset.lazyCacheTtlMs || '300000'), 10);
        return Number.isFinite(raw) && raw >= 0 ? raw : 300000;
    })();
    const showNoteActions = contentList?.dataset.noteActions === '1';
    const csrfToken = String(window.MDW_CSRF || '');
    const lazyListsByFolder = new Map();
    if (lazyRequested) {
        overview.querySelectorAll('.notes-list[data-folder-notes]').forEach((listEl) => {
            if (!(listEl instanceof HTMLElement)) return;
            const folder = String(listEl.getAttribute('data-folder-notes') || '').trim() || 'root';
            lazyListsByFolder.set(folder, listEl);
        });
    }
    const lazyNotesMode = lazyRequested && lazyListsByFolder.size > 0;

    const normalizeSort = (value) => String(value || '').trim().toLowerCase();
    const isPublisherMode = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const settings = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        return !!(settings && settings.publisher_mode);
    };
    const stateRank = (stateRaw) => {
        const state = normalizeSort(stateRaw || '');
        if (state === 'concept') return 0;
        if (state === 'processing') return 1;
        if (state === 'published') return 2;
        return 3;
    };
    const compareNoteData = (a, b, mode) => {
        const dateA = String(a?.date_key || '');
        const dateB = String(b?.date_key || '');
        const titleA = normalizeSort(a?.title || '');
        const titleB = normalizeSort(b?.title || '');
        const slugA = normalizeSort(a?.basename || '');
        const slugB = normalizeSort(b?.basename || '');

        if (isPublisherMode()) {
            const rankA = stateRank(a?.publish_state || '');
            const rankB = stateRank(b?.publish_state || '');
            if (rankA !== rankB) return rankA - rankB;
        }

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

    const sortNoteItemsDom = (mode) => {
        const lists = Array.from(overview.querySelectorAll('.notes-list'));
        if (!lists.length) return;
        const compare = (a, b) => {
            const dateA = String(a.dataset.date || '');
            const dateB = String(b.dataset.date || '');
            const titleA = normalizeSort(a.dataset.title || '');
            const titleB = normalizeSort(b.dataset.title || '');
            const slugA = normalizeSort(a.dataset.slug || '');
            const slugB = normalizeSort(b.dataset.slug || '');
            if (isPublisherMode()) {
                const rankA = stateRank(a.dataset.publishState || '');
                const rankB = stateRank(b.dataset.publishState || '');
                if (rankA !== rankB) return rankA - rankB;
            }
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

    const lazyNotesByFolder = new Map();
    let lazyTotalItems = 0;
    let lazyDataReady = !lazyNotesMode;
    let currentSortMode = 'date';
    const lazyRenderState = new WeakMap();
    const lazyFolderPathForSection = (section) => String(section?.getAttribute?.('data-folder-section') || '').trim() || 'root';
    const lazyFolderFromNote = (note) => {
        const direct = String(note?.folder || '').trim();
        if (direct) return direct;
        const path = String(note?.path || '').trim();
        if (!path) return 'root';
        const idx = path.lastIndexOf('/');
        return idx === -1 ? 'root' : path.slice(0, idx);
    };
    const lazyPublishUi = (stateRaw) => {
        const state = normalizeSort(stateRaw || '');
        if (state === 'published') {
            return { cls: 'publish-published', icon: 'pi-checkedcertificate', label: t('edit.publish_state.published', 'Published') };
        }
        if (state === 'processing' || state === 'to publish' || state === 'topublish' || state === 'to-publish') {
            return { cls: 'publish-processing', icon: 'pi-certificate', label: t('edit.publish_state.processing', 'Processing') };
        }
        return { cls: 'publish-concept', icon: 'pi-lightbulb', label: t('edit.publish_state.concept', 'Concept') };
    };
    const lazyBuildHref = (note) => {
        const file = String(note?.path || '');
        if (!file) return 'index.php';
        const folder = lazyFolderFromNote(note);
        if (isEditorPage) {
            return `edit.php?file=${encodeURIComponent(file)}`;
        }
        const next = new URLSearchParams();
        next.set('file', file);
        next.set('folder', folder || 'root');
        next.set('focus', file);
        return `index.php?${next.toString()}`;
    };
    const lazyCreateRow = (note) => {
        const file = String(note?.path || '');
        const folder = lazyFolderFromNote(note);
        const title = String(note?.title || note?.basename || file || 'Untitled');
        const basename = String(note?.basename || '');
        const dateLabel = String(note?.date_label || '');
        const publishState = normalizeSort(note?.publish_state || '');
        const isSecret = !!note?.is_secret;
        const isCurrent = String(window.CURRENT_FILE || '') === file;

        const li = document.createElement('li');
        li.className = `note-item doclink note-row${isCurrent ? ' nav-item-current' : ''}`;
        li.dataset.kind = 'md';
        li.dataset.file = file;
        li.dataset.secret = isSecret ? 'true' : 'false';
        li.dataset.title = title;
        li.dataset.slug = basename;
        li.dataset.date = String(note?.date_key || '');
        li.dataset.publishState = publishState;

        const link = document.createElement('a');
        link.href = lazyBuildHref(note);
        link.className = `note-link note-link-main kbd-item${isCurrent ? ' active' : ''}`;
        link.draggable = true;

        const leading = document.createElement('span');
        leading.className = 'note-leading';
        const spacer = document.createElement('span');
        spacer.className = 'note-caret-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        const icon = document.createElement('span');
        icon.className = `note-icon pi ${isCurrent ? 'pi-documentlabel' : 'pi-document'}`;
        icon.setAttribute('aria-hidden', 'true');
        leading.appendChild(spacer);
        leading.appendChild(icon);

        const noteText = document.createElement('span');
        noteText.className = 'note-text';
        const noteTitle = document.createElement('span');
        noteTitle.className = 'note-title';
        const titleText = document.createElement('span');
        titleText.textContent = title;
        noteTitle.appendChild(titleText);
        const badges = document.createElement('span');
        badges.className = 'note-badges';
        if (isPublisherMode()) {
            const publish = lazyPublishUi(publishState);
            const publishBadge = document.createElement('span');
            publishBadge.className = `badge-publish ${publish.cls}`;
            if (publish.icon) {
                const publishIcon = document.createElement('span');
                publishIcon.className = `pi ${publish.icon}`;
                publishIcon.setAttribute('aria-hidden', 'true');
                publishBadge.appendChild(publishIcon);
            }
            const publishLabel = document.createElement('span');
            publishLabel.textContent = publish.label;
            publishBadge.appendChild(publishLabel);
            badges.appendChild(publishBadge);
        }
        if (isSecret) {
            const secretBadge = document.createElement('span');
            secretBadge.className = 'badge-secret';
            secretBadge.textContent = t('common.secret', 'secret');
            badges.appendChild(secretBadge);
        }
        noteTitle.appendChild(badges);
        noteText.appendChild(noteTitle);

        const pathWrap = document.createElement('span');
        pathWrap.className = 'nav-item-path';
        const slugEl = document.createElement('span');
        slugEl.className = 'nav-item-slug';
        slugEl.textContent = file;
        pathWrap.appendChild(slugEl);
        if (dateLabel) {
            const dateEl = document.createElement('span');
            dateEl.className = 'nav-item-date';
            dateEl.textContent = dateLabel;
            pathWrap.appendChild(dateEl);
        }
        noteText.appendChild(pathWrap);

        link.appendChild(leading);
        link.appendChild(noteText);
        li.appendChild(link);

        if (showNoteActions && csrfToken) {
            const actions = document.createElement('div');
            actions.className = 'note-actions';
            const editLink = document.createElement('a');
            editLink.href = `edit.php?file=${encodeURIComponent(file)}&folder=${encodeURIComponent(folder || 'root')}`;
            editLink.className = 'btn btn-ghost icon-button';
            editLink.title = t('common.edit', 'Edit');
            const editIcon = document.createElement('span');
            editIcon.className = 'pi pi-edit';
            editLink.appendChild(editIcon);
            actions.appendChild(editLink);

            const form = document.createElement('form');
            form.method = 'post';
            form.className = 'deleteForm';
            form.dataset.file = file;
            const hidden = (name, value) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                input.value = String(value || '');
                form.appendChild(input);
            };
            hidden('action', 'delete');
            hidden('file', file);
            hidden('csrf', csrfToken);
            const delBtn = document.createElement('button');
            delBtn.type = 'submit';
            delBtn.className = 'btn btn-ghost icon-button';
            delBtn.title = t('common.delete', 'Delete');
            const delIcon = document.createElement('span');
            delIcon.className = 'pi pi-bin';
            delBtn.appendChild(delIcon);
            form.appendChild(delBtn);
            actions.appendChild(form);
            li.appendChild(actions);
        }

        return li;
    };
    const lazyRenderList = (listEl, notes, signature) => {
        if (!(listEl instanceof HTMLElement)) return;
        const prev = lazyRenderState.get(listEl);
        if (prev && prev.signature === signature) return;
        if (prev && prev.token) prev.token.cancelled = true;

        listEl.innerHTML = '';
        const arr = Array.isArray(notes) ? notes : [];
        if (!arr.length) {
            const empty = document.createElement('li');
            empty.className = 'nav-empty';
            empty.textContent = t('nav.no_notes_yet', 'No notes yet.');
            listEl.appendChild(empty);
            lazyRenderState.set(listEl, { signature, token: null });
            refreshDocEntries();
            if (typeof window.__mdwApplyDeletePermissions === 'function') window.__mdwApplyDeletePermissions();
            return;
        }

        const token = { cancelled: false };
        lazyRenderState.set(listEl, { signature, token });
        const chunk = 120;
        let idx = 0;
        const push = () => {
            if (token.cancelled) return;
            const frag = document.createDocumentFragment();
            const end = Math.min(idx + chunk, arr.length);
            for (; idx < end; idx++) frag.appendChild(lazyCreateRow(arr[idx]));
            listEl.appendChild(frag);
            if (idx < arr.length) {
                requestAnimationFrame(push);
                return;
            }
            refreshDocEntries();
            if (typeof window.__mdwApplyDeletePermissions === 'function') window.__mdwApplyDeletePermissions();
        };
        push();
    };
    const lazySortAll = (mode) => {
        for (const [folder, list] of lazyNotesByFolder.entries()) {
            if (!Array.isArray(list)) continue;
            list.sort((a, b) => compareNoteData(a, b, mode));
            lazyNotesByFolder.set(folder, list);
        }
    };
    const lazyCacheKey = 'mdw_explorer_dataset_v1';
    const lazyReadCache = () => {
        try {
            const raw = mdwStorageGet(lazyCacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            if (String(parsed.endpoint || '') !== lazyEndpoint) return null;
            const savedAt = Number(parsed.saved_at || 0);
            if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
            if (lazyCacheTtlMs > 0 && (Date.now() - savedAt) > lazyCacheTtlMs) return null;
            return Array.isArray(parsed.notes) ? parsed.notes : null;
        } catch {
            return null;
        }
    };
    const lazyWriteCache = (notes) => {
        if (!Array.isArray(notes)) return;
        try {
            mdwStorageSet(lazyCacheKey, JSON.stringify({
                endpoint: lazyEndpoint,
                saved_at: Date.now(),
                notes,
            }));
        } catch {}
    };
    const lazyApplyNotes = (notes) => {
        lazyNotesByFolder.clear();
        for (const folder of lazyListsByFolder.keys()) {
            lazyNotesByFolder.set(folder, []);
        }
        let total = 0;
        if (Array.isArray(notes)) {
            for (const raw of notes) {
                const path = String(raw?.path || '').trim();
                if (!path) continue;
                const folder = lazyFolderFromNote(raw);
                if (!lazyNotesByFolder.has(folder)) continue;
                const row = {
                    path,
                    basename: String(raw?.basename || ''),
                    folder,
                    title: String(raw?.title || raw?.basename || path),
                    date_key: String(raw?.date_key || ''),
                    date_label: String(raw?.date_label || ''),
                    publish_state: normalizeSort(raw?.publish_state || ''),
                    is_secret: !!raw?.is_secret,
                };
                row.search = `${row.title}\n${row.basename}\n${row.path}`.toLowerCase();
                lazyNotesByFolder.get(folder)?.push(row);
                total++;
            }
        }
        lazyTotalItems = total;
        lazySortAll(currentSortMode);
        lazyDataReady = true;
    };
    const lazySig = (kind, mode, query, notes) => {
        const arr = Array.isArray(notes) ? notes : [];
        const first = arr[0]?.path || '';
        const last = arr[arr.length - 1]?.path || '';
        return `${kind}|${mode}|${query}|${arr.length}|${first}|${last}`;
    };
    const lazyRender = (query) => {
        const q = String(query || '').trim().toLowerCase();
        const filtering = q.length > 0;
        if (!lazyDataReady) {
            navCount.textContent = t('common.loading', 'Loading…');
            if (filterReset) filterReset.disabled = true;
            if (filterClear) filterClear.style.display = filtering ? '' : 'none';
            syncPreviewEditTarget();
            return;
        }

        let visible = 0;
        const visibleBySection = new Map();
        const bumpVisible = (section, amount) => {
            if (!(section instanceof HTMLElement) || amount <= 0) return;
            let current = section;
            while (current) {
                visibleBySection.set(current, (visibleBySection.get(current) || 0) + amount);
                current = findParentFolderSection(current);
            }
        };

        for (const section of folderSections) {
            const folder = lazyFolderPathForSection(section);
            const listEl = lazyListsByFolder.get(folder);
            if (!(listEl instanceof HTMLElement)) continue;
            const source = lazyNotesByFolder.get(folder) || [];

            if (filtering) {
                const matches = source.filter((note) => note.search.includes(q));
                visible += matches.length;
                bumpVisible(section, matches.length);
                lazyRenderList(listEl, matches, lazySig('f', currentSortMode, q, matches));
                continue;
            }

            if (getFolderOpen(section)) {
                lazyRenderList(listEl, source, lazySig('a', currentSortMode, '', source));
            }
        }

        navCount.textContent = filtering
            ? (visible === 1
                ? t('common.item_count_one', '{n} item', { n: visible })
                : t('common.item_count_other', '{n} items', { n: visible }))
            : t('common.total_items', '{n} total items', { n: lazyTotalItems });

        if (filterReset) filterReset.disabled = !filtering;
        if (filterClear) filterClear.style.display = filtering ? '' : 'none';

        for (const section of folderSections) {
            if (!filtering) {
                setFolderOpen(section, getFolderOpen(section));
                continue;
            }
            setFolderOpen(section, (visibleBySection.get(section) || 0) > 0);
        }
        syncPreviewEditTarget();
    };
    const sortNoteItems = (mode) => {
        const next = ['date', 'title', 'slug'].includes(mode) ? mode : 'date';
        currentSortMode = next;
        if (lazyNotesMode) {
            lazySortAll(next);
            return;
        }
        sortNoteItemsDom(next);
    };
    window.__mdwSortOverviewNotes = sortNoteItems;

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
        if (lazyNotesMode) lazyRender(String(filterInput.value || '').trim());
        navSortSelect.addEventListener('change', () => {
            const next = options.includes(navSortSelect.value) ? navSortSelect.value : 'date';
            try { mdwStorageSet(SORT_KEY, next); } catch {}
            sortNoteItems(next);
            if (lazyNotesMode) lazyRender(String(filterInput.value || '').trim());
        });
    })();

    const updateNavSortPlacement = () => {
        if (!isEditorPage || !navSortRow) return;
        if (navSortRow.closest('.nav-toolbar-row')) {
            navSortRow.classList.remove('nav-sort-inline');
            return;
        }
        if (!navFilterRow || !navSortPlaceholder) return;
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
        if (lazyNotesMode) {
            lazyRender(q);
            return;
        }
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
                let current = section;
                while (current) {
                    visibleBySection.set(current, (visibleBySection.get(current) || 0) + 1);
                    current = findParentFolderSection(current);
                }
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
        syncPreviewEditTarget();
    }

    // q parameter uit URL
    const qParam = params.get('q');
    if (qParam) {
        filterInput.value = qParam;
    }

    function focusRequestedRow() {
        if (!focusParam || (params.get('file') && !allowFocusWithFile)) return true;
        const el = overview.querySelector(`[data-file="${CSS.escape(focusParam)}"] a.kbd-item`);
        if (!(el instanceof HTMLAnchorElement)) return false;
        try { el.focus({ preventScroll: true }); } catch { el.focus(); }
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        syncPreviewEditTarget(focusParam);
        return true;
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

    onFolderToggle = () => {
        if (!lazyNotesMode) return;
        scheduleUpdate();
    };

    if (lazyNotesMode) {
        const cached = lazyReadCache();
        if (cached) {
            lazyApplyNotes(cached);
            update();
            focusRequestedRow();
        } else {
            navCount.textContent = t('common.loading', 'Loading…');
        }
        (async () => {
            try {
                if (!mdmApi || typeof mdmApi.get !== 'function') return;
                const data = await mdmApi.get(lazyEndpoint);
                if (!data || data.ok === false || !Array.isArray(data.notes)) return;
                lazyApplyNotes(data.notes);
                lazyWriteCache(data.notes);
                update();
                focusRequestedRow();
            } catch (err) {
                if (!cached) {
                    lazyDataReady = true;
                    lazyTotalItems = 0;
                    update();
                }
                if (typeof window.__mdwReportNetworkError === 'function') {
                    window.__mdwReportNetworkError(err);
                }
            }
        })();
    }

    // Editor: SPA-achtige navigatie (only markdown items)
    if (isEditorPage) {
        const setCurrentItem = (item) => {
            if (!(item instanceof HTMLElement)) return;
            document.querySelectorAll('.nav-item-current').forEach(el => {
                el.classList.remove('nav-item-current', 'dirty');
                const a = el.querySelector('a.kbd-item');
                if (a) a.classList.remove('active');
                const icon = el.querySelector('.note-icon');
                if (icon) {
                    icon.classList.remove('pi-documentlabel');
                    if (!icon.classList.contains('pi-document')) {
                        icon.classList.add('pi-document');
                    }
                }
            });
            item.classList.add('nav-item-current');
            const a = item.querySelector('a.kbd-item');
            if (a) a.classList.add('active');
            const icon = item.querySelector('.note-icon');
            if (icon) {
                icon.classList.remove('pi-document');
                icon.classList.add('pi-documentlabel');
            }
        };

        const focusCurrentInExplorer = () => {
            const a = overview.querySelector('.nav-item-current a.kbd-item');
            if (a instanceof HTMLAnchorElement) {
                a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        };

        const initialCurrent = overview.querySelector('.note-item.nav-item-current');
        if (initialCurrent instanceof HTMLElement) {
            setCurrentItem(initialCurrent);
        }
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
        const hadTreeFocus = document.activeElement instanceof HTMLElement
            ? overview.contains(document.activeElement)
            : false;
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
                    const next = new URLSearchParams();
                    next.set('file', data.file);
                    if (folder !== 'root') next.set('folder', folder);
                    next.set('focus', data.file);
                    pathSegment.href = `index.php?${next.toString()}`;
                }
            }
            const folderCrumbWrap = document.querySelector('.app-breadcrumb [data-crumb="folder-wrap"]');
            const folderCrumb = document.querySelector('.app-breadcrumb [data-crumb="folder"]');
            if (folderCrumb instanceof HTMLAnchorElement) {
                if (folder === 'root') {
                    folderCrumb.textContent = '';
                    folderCrumb.href = 'index.php#contentList';
                } else {
                    folderCrumb.textContent = folder;
                    folderCrumb.href = `index.php?folder=${encodeURIComponent(folder)}#contentList`;
                }
            }
            if (folderCrumbWrap instanceof HTMLElement) {
                folderCrumbWrap.hidden = (folder === 'root');
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
            const newFolderReturnFileInput = document.querySelector('#newFolderForm input[name="return_file"]');
            if (newFolderReturnFileInput instanceof HTMLInputElement) {
                newFolderReturnFileInput.value = data.file;
            }

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

            const activeAnchor = overview.querySelector(`[data-file="${CSS.escape(String(data.file || ''))}"] a.kbd-item`);
            if (activeAnchor instanceof HTMLAnchorElement) {
                if (hadTreeFocus) {
                    try { activeAnchor.focus({ preventScroll: true }); } catch { activeAnchor.focus(); }
                    activeAnchor.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                } else {
                    activeAnchor.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
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
    if (!focusRequestedRow() && lazyNotesMode) {
        let attempts = 0;
        const pollFocus = () => {
            if (focusRequestedRow()) return;
            attempts += 1;
            if (attempts > 80) return;
            requestAnimationFrame(pollFocus);
        };
        requestAnimationFrame(pollFocus);
    }
})();
    };
})();
