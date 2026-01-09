(function(){
    const MDM = window.MDM = window.MDM || {};
    const module = MDM.modals = MDM.modals || {};
    const mdmApi = MDM.api;
    const mdmUi = MDM.ui;
    const mdmModalOpen = (on) => {
        if (mdmUi && typeof mdmUi.modalOpen === "function") {
            mdmUi.modalOpen(on);
            return;
        }
        document.documentElement.classList.toggle("modal-open", !!on);
    };

    module.init = () => {
        if (module._init) return;
        module._init = true;

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
    const footnoteSection = document.getElementById('linkModalFootnote');
    const youtubeSection = document.getElementById('linkModalYoutube');
    const picker = document.getElementById('linkPicker');
    const pickerFilter = document.getElementById('linkPickerFilter');
    const pickerFilterClear = document.getElementById('linkPickerFilterClear');
    const externalText = document.getElementById('externalLinkText');
    const externalUrl = document.getElementById('externalLinkUrl');
    const footnoteText = document.getElementById('footnoteLinkText');
    const footnoteUrl = document.getElementById('footnoteLinkUrl');
    const footnoteTitle = document.getElementById('footnoteLinkTitle');
    const youtubeInput = document.getElementById('youtubeLinkInput');

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
        mode = (next === 'external' || next === 'youtube' || next === 'footnote') ? next : 'internal';
        if (internalSection) internalSection.hidden = mode !== 'internal';
        if (externalSection) externalSection.hidden = mode !== 'external';
        if (footnoteSection) footnoteSection.hidden = mode !== 'footnote';
        if (youtubeSection) youtubeSection.hidden = mode !== 'youtube';
        validate();
        if (mode === 'external') {
            externalUrl?.focus();
        } else if (mode === 'footnote') {
            footnoteUrl?.focus();
        } else if (mode === 'youtube') {
            youtubeInput?.focus();
        } else {
            pickerFilter?.focus();
        }
    };

	    const open = () => {
	        if (typeof window.__mdwCloseImageModal === 'function') {
	            window.__mdwCloseImageModal();
	        }
        if (typeof window.__mdwCloseThemeModal === 'function') {
            window.__mdwCloseThemeModal({ force: true });
        }
	        overlay.hidden = false;
	        modal.hidden = false;
	        mdmModalOpen(true);

        if (pickerFilter) pickerFilter.value = '';
        if (pickerFilterClear) pickerFilterClear.style.display = 'none';

        const checked = modal.querySelector('input[name="linkMode"][value="internal"]');
        if (checked instanceof HTMLInputElement) checked.checked = true;
        setMode('internal');
    };

	    const close = () => {
	        overlay.hidden = true;
	        modal.hidden = true;
	        mdmModalOpen(false);

        selectedPath = null;
        selectedTitle = null;
        picker?.querySelectorAll('.link-pick-item.is-selected').forEach(el => el.classList.remove('is-selected'));
        if (pickerFilter) pickerFilter.value = '';
        if (pickerFilterClear) pickerFilterClear.style.display = 'none';
        if (externalText) externalText.value = '';
        if (externalUrl) externalUrl.value = '';
        if (footnoteText) footnoteText.value = '';
        if (footnoteUrl) footnoteUrl.value = '';
        if (footnoteTitle) footnoteTitle.value = '';
        if (youtubeInput) youtubeInput.value = '';
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

    const insertBlockAtSelection = (block) => {
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? 0;
        const before = editor.value.slice(0, start);
        const after = editor.value.slice(end);
        const needsLeading = before !== '' && !before.endsWith('\n');
        const needsTrailing = after !== '' && !after.startsWith('\n');
        const text = `${needsLeading ? '\n' : ''}${block}${needsTrailing ? '\n' : ''}`;
        insertAtSelection(text);
    };

    const validate = () => {
        if (mode === 'external') {
            const url = String(externalUrl?.value || '').trim();
            insertBtn.disabled = url === '';
            return;
        }
        if (mode === 'footnote') {
            const url = String(footnoteUrl?.value || '').trim();
            insertBtn.disabled = url === '';
            return;
        }
        if (mode === 'youtube') {
            const id = extractYoutubeId(youtubeInput?.value || '');
            insertBtn.disabled = !id;
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
    footnoteUrl?.addEventListener('input', validate);
    youtubeInput?.addEventListener('input', validate);

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

    const isPdfUrl = (url) => {
        const raw = String(url || '').trim();
        if (!raw) return false;
        const base = raw.split('#')[0].split('?')[0].toLowerCase();
        return base.endsWith('.pdf');
    };

    const extractYoutubeId = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;

        let input = raw;
        if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) {
            input = input.startsWith('//') ? ('https:' + input) : ('https://' + input);
        }

        let url;
        try {
            url = new URL(input);
        } catch {
            return '';
        }

        const host = String(url.hostname || '').toLowerCase();
        let id = '';
        if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
            id = url.pathname.split('/').filter(Boolean)[0] || '';
        } else if (host.includes('youtube.com')) {
            if (url.pathname.startsWith('/embed/')) {
                id = url.pathname.split('/')[2] || '';
            } else if (url.pathname.startsWith('/shorts/')) {
                id = url.pathname.split('/')[2] || '';
            } else {
                id = url.searchParams.get('v') || '';
            }
        }

        id = String(id || '').split('?')[0].split('&')[0].split('#')[0];
        id = id.replace(/[^A-Za-z0-9_-]/g, '');
        return id;
    };

    const extractFootnotes = (text) => {
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const body = [];
        const defs = [];
        let inCode = false;
        for (const line of lines) {
            if (/^\s*```/.test(line)) {
                inCode = !inCode;
                body.push(line);
                continue;
            }
            if (!inCode) {
                const m = line.match(/^\s*\[(\d+)\]:\s*(.+)$/);
                if (m) {
                    defs.push({ label: m[1], content: String(m[2] || '').trim() });
                    continue;
                }
            }
            body.push(line);
        }
        return { body: body.join('\n'), defs };
    };

    const findFootnoteMax = (text) => {
        const re = /\[(\d+)\]:|\[[^\]]+\]\[(\d+)\]/g;
        let max = 0;
        let match;
        while ((match = re.exec(text))) {
            const num = match[1] || match[2];
            if (!num) continue;
            const n = parseInt(num, 10);
            if (Number.isFinite(n) && n > max) max = n;
        }
        return max;
    };

    const renumberFootnotes = (text) => {
        const { body, defs } = extractFootnotes(text);
        const defMap = new Map();
        defs.forEach((d) => {
            if (d && !defMap.has(d.label)) defMap.set(d.label, d.content);
        });

        const refRe = /\[([^\]]+)\]\[(\d+)\]/g;
        const order = [];
        const mapping = new Map();
        let m;
        while ((m = refRe.exec(body))) {
            const oldLabel = m[2];
            if (!mapping.has(oldLabel)) {
                mapping.set(oldLabel, String(order.length + 1));
                order.push(oldLabel);
            }
        }

        const replaced = body.replace(refRe, (full, label, oldLabel) => {
            const next = mapping.get(oldLabel) || oldLabel;
            return `[${label}][${next}]`;
        });

        const used = new Set(mapping.keys());
        const newDefs = [];
        order.forEach((oldLabel) => {
            const def = defMap.get(oldLabel);
            if (!def) return;
            const next = mapping.get(oldLabel) || oldLabel;
            newDefs.push(`[${next}]: ${def}`);
        });
        const extraDefs = defs
            .filter((d) => d && !used.has(d.label))
            .map((d) => `[${d.label}]: ${d.content}`);

        const allDefs = newDefs.concat(extraDefs);
        if (!allDefs.length) return { text: replaced, mapping };

        const trimmed = replaced.replace(/\s*$/, '');
        const sep = trimmed.trim() ? '\n\n' : '';
        return { text: trimmed + sep + allDefs.join('\n') + '\n', mapping };
    };

    const appendFootnoteDefinition = (text, line) => {
        const trimmed = String(text || '').replace(/\s*$/, '');
        const sep = trimmed.trim() ? '\n\n' : '';
        return trimmed + sep + line + '\n';
    };

    const insertLink = () => {
        if (mode === 'external') {
            const url = String(externalUrl?.value || '').trim();
            if (!url) return;
            const selection = getEditorSelectionText();
            const text = selection || String(externalText?.value || '').trim() || url;
            const cls = isPdfUrl(url) ? 'pdflink externlink' : 'externlink';
            insertAtSelection(`[${text}](${url}) {: class="${cls}"}`);
            close();
            return;
        }
        if (mode === 'youtube') {
            const id = extractYoutubeId(youtubeInput?.value || '');
            if (!id) return;
            const embedUrl = `https://www.youtube.com/embed/${id}`;
            const block = [
                `<iframe src="${embedUrl}" frameborder="0"></iframe>`,
                '{: class="lazyload ytframe"}',
                '{: class="ytframe-wrapper"}',
            ].join('\n');
            insertBlockAtSelection(block);
            close();
            return;
        }
        if (mode === 'footnote') {
            const url = String(footnoteUrl?.value || '').trim();
            if (!url) return;
            const selection = getEditorSelectionText();
            const text = selection || String(footnoteText?.value || '').trim() || url;
            const titleRaw = String(footnoteTitle?.value || '').trim();
            const titleSafe = titleRaw.replace(/"/g, "'");
            const nextLabel = findFootnoteMax(editor.value) + 1;
            const ref = `[${text}][${nextLabel}]`;
            const def = `[${nextLabel}]: ${url}${titleSafe ? ` "${titleSafe}"` : ''}`;

            const start = editor.selectionStart ?? 0;
            const end = editor.selectionEnd ?? 0;
            const before = editor.value.slice(0, start);
            const after = editor.value.slice(end);
            let nextValue = before + ref + after;
            nextValue = appendFootnoteDefinition(nextValue, def);
            const renumbered = renumberFootnotes(nextValue);
            const newLabel = renumbered.mapping.get(String(nextLabel)) || String(nextLabel);
            const refFinal = `[${text}][${newLabel}]`;

            editor.value = renumbered.text;
            let caret = before.length + ref.length;
            const probeStart = Math.max(0, before.length - 64);
            const idx = editor.value.indexOf(refFinal, probeStart);
            if (idx !== -1) caret = idx + refFinal.length;
            editor.setSelectionRange(caret, caret);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            editor.focus();
            close();
            return;
        }

        if (!selectedPath) return;
        const selection = getEditorSelectionText();
        const text = selection || selectedTitle || selectedPath;
        const href = relativePath(window.CURRENT_FILE || '', selectedPath);
        insertAtSelection(`[${text}](${href}) {: class="link"}`);
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
    const pickBtn = document.getElementById('imagePickBtn');
    const pickLabel = document.getElementById('imagePickLabel');
    const altInput = document.getElementById('imageAltInput');
    const csrfInput = document.getElementById('imageCsrf');
    const listEl = document.getElementById('imageList');
    const filterEl = document.getElementById('imageFilter');
    const filterClear = document.getElementById('imageFilterClear');
    const statusEl = document.getElementById('imageStatus');
    const editor = document.getElementById('editor');
    if (!btn || !modal || !overlay || !uploadBtn || !listEl || !filterEl || !editor) return;

    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));
    const apiUrl = 'image_manager.php';
    let items = [];
    const CACHE_KEY = 'mdw_image_cache_v1';
    const CACHE_TTL_MS = 10 * 60 * 1000;
    const pickLabelDefault = pickLabel ? String(pickLabel.textContent || '') : '';

    const setStatus = (msg, kind = 'info') => {
        if (!statusEl) return;
        statusEl.textContent = String(msg || '');
        statusEl.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const setPickLabel = (value) => {
        if (!pickLabel) return;
        const next = String(value || '').trim();
        pickLabel.textContent = next || pickLabelDefault;
    };

    const normalizeImageErrorCode = (data) => {
        if (!data) return '';
        const code = String(data.error_code || data.error || '').trim();
        if (!code) return '';
        const legacy = {
            'Unknown action.': 'unknown_action',
            'POST required.': 'post_required',
            'Invalid session (CSRF). Reload and try again.': 'csrf',
            'Missing upload.': 'missing_upload',
            'Upload failed.': 'upload_failed',
            'Invalid upload.': 'invalid_upload',
            'Images directory is not writable.': 'images_dir_not_writable',
            'Could not detect file type.': 'type_detect_failed',
            'Unsupported image type.': 'type_unsupported',
            'Could not process image.': 'process_failed',
            'Failed to save image.': 'save_failed',
            'Failed to store image.': 'store_failed',
        };
        return legacy[code] || code;
    };

    const imageErrorMessage = (code, data) => {
        const dir = String((data && data.images_dir) || 'images');
        switch (code) {
            case 'csrf':
                return t('image_modal.error_csrf', 'Your session expired. Reload and try again.');
            case 'missing_upload':
                return t('image_modal.error_missing_upload', 'No image file was received. Try again.');
            case 'upload_failed':
                return t('image_modal.upload_failed', 'Upload failed.');
            case 'invalid_upload':
                return t('image_modal.error_invalid_upload', 'The upload did not look like a valid file.');
            case 'images_dir_not_writable':
                return t('image_modal.error_not_writable', 'We cannot write to the images folder ({dir}). Check permissions and try again.', { dir });
            case 'type_detect_failed':
                return t('image_modal.error_type_detect', 'We could not detect the file type.');
            case 'type_unsupported':
                return t('image_modal.error_type_unsupported', 'That image type is not supported.');
            case 'process_failed':
                return t('image_modal.error_process_failed', 'We could not process that image.');
            case 'save_failed':
                return t('image_modal.error_save_failed', 'We could not save the processed image.');
            case 'store_failed':
                return t('image_modal.error_store_failed', 'We could not store the uploaded image.');
            default:
                return '';
        }
    };

    const loadCache = () => {
        try {
            const raw = mdwStorageGet(CACHE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.items)) return false;
            const ts = Number(parsed.ts || 0);
            if (ts && (Date.now() - ts) > CACHE_TTL_MS) return false;
            items = parsed.items;
            return true;
        } catch {
            return false;
        }
    };

    const saveCache = () => {
        try {
            mdwStorageSet(CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
        } catch {}
    };

    const insertAtSelection = (text) => {
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? 0;
        editor.setRangeText(text, start, end, 'end');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.focus();
    };

    const imageTokenForFile = (file, path) => {
        let name = String(file || '').trim();
        if (!name) {
            const p = String(path || '').trim();
            if (p) {
                const parts = p.replace(/\\/g, '/').split('/');
                name = parts[parts.length - 1] || '';
            }
        }
        if (!name) return '';
        return `{{ ${name} }}`;
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
            listEl.innerHTML = `<div class="status-text" style="padding:0.5rem;">${t('image_modal.no_images', 'No images found.')}</div>`;
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
        if (!items.length) {
            listEl.innerHTML = `<div class="status-text" style="padding:0.5rem;">${t('image_modal.loading', 'Loading…')}</div>`;
        }
        try {
            if (!mdmApi || typeof mdmApi.get !== 'function') {
                throw new Error('network');
            }
            let data = null;
            try {
                data = await mdmApi.get(`${apiUrl}?action=list`);
            } catch (err) {
                data = err && typeof err === 'object' ? err.data : null;
                if (!data || typeof data !== 'object') throw err;
            }
            if (!data || data.ok !== true) {
                const code = normalizeImageErrorCode(data);
                const friendly = imageErrorMessage(code, data) || ((data && data.error) ? data.error : '');
                throw new Error(friendly || t('image_modal.load_failed', 'Failed to load images.'));
            }
            items = Array.isArray(data.images) ? data.images : [];
            saveCache();
            render();
        } catch (err) {
            if (items.length) {
                setStatus(err?.message || t('image_modal.load_failed', 'Failed to load images.'), 'error');
                return;
            }
            items = [];
            listEl.innerHTML = `<div class="status-text" style="padding:0.5rem;">${t('image_modal.load_failed', 'Failed to load images.')}</div>`;
            setStatus(err?.message || t('image_modal.load_failed', 'Failed to load images.'), 'error');
        }
    };

	    const open = () => {
	        if (typeof window.__mdwCloseLinkModal === 'function') {
	            window.__mdwCloseLinkModal();
	        }
        if (typeof window.__mdwCloseThemeModal === 'function') {
            window.__mdwCloseThemeModal({ force: true });
        }
        overlay.hidden = false;
        modal.hidden = false;
        mdmModalOpen(true);
        setStatus('');
        if (filterEl) filterEl.value = '';
        if (altInput) altInput.value = '';
        setPickLabel('');
        if (loadCache()) {
            render();
        }
        loadList();
        setTimeout(() => filterEl?.focus(), 0);
    };

	    const close = () => {
	        overlay.hidden = true;
	        modal.hidden = true;
	        mdmModalOpen(false);
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

    pickBtn?.addEventListener('click', () => {
        if (uploadInput instanceof HTMLInputElement) {
            uploadInput.click();
        }
    });

    uploadInput?.addEventListener('change', () => {
        if (!(uploadInput instanceof HTMLInputElement)) return;
        const file = uploadInput.files && uploadInput.files[0];
        setPickLabel(file ? file.name : '');
    });

    uploadBtn.addEventListener('click', async () => {
        if (!(uploadInput instanceof HTMLInputElement)) return;
        const file = uploadInput.files && uploadInput.files[0];
        if (!file) {
            setStatus(t('image_modal.choose_first', 'Choose an image first.'), 'error');
            uploadInput.focus();
            return;
        }
        const csrf = (csrfInput instanceof HTMLInputElement) ? csrfInput.value : '';
        if (!csrf) {
            setStatus(t('image_modal.missing_csrf', 'Missing CSRF token. Reload the page.'), 'error');
            return;
        }

        setStatus(t('image_modal.uploading', 'Uploading…'));
        if (mdmUi && typeof mdmUi.busy === 'function') {
            mdmUi.busy(uploadBtn, true, { label: t('image_modal.uploading', 'Uploading…') });
        } else {
            uploadBtn.disabled = true;
        }
        try {
            const fd = new FormData();
            fd.append('action', 'upload');
            fd.append('csrf', csrf);
            fd.append('image', file);
            if (!mdmApi || typeof mdmApi.form !== 'function') {
                throw new Error('network');
            }
            let data = null;
            try {
                data = await mdmApi.form(apiUrl, fd);
            } catch (err) {
                data = err && typeof err === 'object' ? err.data : null;
                if (!data || typeof data !== 'object') throw err;
            }
            if (!data || data.ok !== true) {
                const code = normalizeImageErrorCode(data);
                const friendly = imageErrorMessage(code, data) || ((data && data.error) ? data.error : '');
                throw new Error(friendly || t('image_modal.upload_failed', 'Upload failed.'));
            }

            const path = String(data.path || '');
            const uploadedFile = String(data.file || '');
            const alt = String(altInput?.value || '').trim() || String(data.alt || '') || guessAlt(path);
            const token = imageTokenForFile(uploadedFile, path);
            if (token) {
                insertAtSelection(`![${alt}](${token})`);
            }

            uploadInput.value = '';
            setPickLabel('');
            if (altInput instanceof HTMLInputElement) altInput.value = '';
            setStatus(t('image_modal.uploaded', 'Uploaded.'), 'ok');
            await loadList();
        } catch (err) {
            setStatus(err?.message || t('image_modal.upload_failed', 'Upload failed.'), 'error');
        } finally {
            if (mdmUi && typeof mdmUi.busy === 'function') {
                mdmUi.busy(uploadBtn, false);
            } else {
                uploadBtn.disabled = false;
            }
        }
    });

    listEl.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target.closest('button[data-path]') : null;
        if (!(target instanceof HTMLElement)) return;
        const path = target.getAttribute('data-path') || '';
        const file = target.getAttribute('data-file') || '';
        const suggestedAlt = target.getAttribute('data-alt') || '';
        const token = imageTokenForFile(file, path);
        if (!token) return;

        const alt = String(altInput?.value || '').trim() || suggestedAlt || guessAlt(file || path);
        insertAtSelection(`![${alt}](${token})`);
        close();
    });
})();

// Replace modal (edit.php)
(function(){
    const modal = document.getElementById('replaceModal');
    const overlay = document.getElementById('replaceModalOverlay');
    const closeBtn = document.getElementById('replaceModalClose');
    const replaceNextBtn = document.getElementById('replaceNextBtn');
    const replaceAllBtn = document.getElementById('replaceAllBtn');
    const findInput = document.getElementById('replaceFindInput');
    const replaceInput = document.getElementById('replaceWithInput');
    const statusEl = document.getElementById('replaceModalStatus');
    const editor = document.getElementById('editor');
    if (!modal || !overlay || !replaceNextBtn || !replaceAllBtn || !findInput || !replaceInput || !editor) return;

    const setStatus = (msg, kind = 'info') => {
        if (!statusEl) return;
        statusEl.textContent = String(msg || '');
        statusEl.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const updateButtons = () => {
        const needle = String(findInput.value || '');
        const hasNeedle = needle.trim() !== '';
        replaceNextBtn.disabled = !hasNeedle;
        replaceAllBtn.disabled = !hasNeedle;
    };

    const open = () => {
        if (typeof window.__mdwCloseLinkModal === 'function') {
            window.__mdwCloseLinkModal();
        }
        if (typeof window.__mdwCloseImageModal === 'function') {
            window.__mdwCloseImageModal();
        }
        if (typeof window.__mdwCloseThemeModal === 'function') {
            window.__mdwCloseThemeModal({ force: true });
        }
        overlay.hidden = false;
        modal.hidden = false;
        mdmModalOpen(true);
        setStatus('');

        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? 0;
        if (end > start) {
            const selected = editor.value.slice(start, end);
            if (selected) findInput.value = selected;
        }
        updateButtons();
        setTimeout(() => {
            findInput.focus();
            findInput.select();
        }, 0);
    };

    const close = () => {
        overlay.hidden = true;
        modal.hidden = true;
        mdmModalOpen(false);
        setStatus('');
        editor.focus();
    };

    window.__mdwOpenReplaceModal = open;
    window.__mdwCloseReplaceModal = close;

    const replaceRange = (start, end, replacement) => {
        const scrollTop = editor.scrollTop;
        editor.setRangeText(replacement, start, end, 'select');
        editor.scrollTop = scrollTop;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const findNextIndex = (needle) => {
        const hay = editor.value;
        const start = editor.selectionEnd ?? 0;
        let idx = hay.indexOf(needle, start);
        if (idx === -1 && start > 0) idx = hay.indexOf(needle, 0);
        return idx;
    };

    const replaceNext = () => {
        const needle = String(findInput.value || '');
        if (!needle) return;
        const replacement = String(replaceInput.value || '');
        const selStart = editor.selectionStart ?? 0;
        const selEnd = editor.selectionEnd ?? 0;
        if (selEnd > selStart && editor.value.slice(selStart, selEnd) === needle) {
            replaceRange(selStart, selEnd, replacement);
            setStatus('Replaced.', 'ok');
            return;
        }

        const idx = findNextIndex(needle);
        if (idx === -1) {
            setStatus('No matches found.', 'error');
            return;
        }
        replaceRange(idx, idx + needle.length, replacement);
        setStatus('Replaced.', 'ok');
    };

    const replaceAll = () => {
        const needle = String(findInput.value || '');
        if (!needle) return;
        const replacement = String(replaceInput.value || '');
        const hay = editor.value;
        let idx = hay.indexOf(needle);
        if (idx === -1) {
            setStatus('No matches found.', 'error');
            return;
        }

        let out = '';
        let start = 0;
        let count = 0;
        while (idx !== -1) {
            out += hay.slice(start, idx) + replacement;
            start = idx + needle.length;
            count++;
            idx = hay.indexOf(needle, start);
        }
        out += hay.slice(start);

        const scrollTop = editor.scrollTop;
        editor.value = out;
        editor.scrollTop = scrollTop;
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const lastIdx = out.lastIndexOf(replacement);
        if (lastIdx >= 0) editor.setSelectionRange(lastIdx, lastIdx + replacement.length);
        setStatus(`${count} replaced.`, 'ok');
    };

    overlay.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
    replaceNextBtn.addEventListener('click', replaceNext);
    replaceAllBtn.addEventListener('click', replaceAll);
    findInput.addEventListener('input', updateButtons);
    replaceInput.addEventListener('input', updateButtons);

    document.addEventListener('keydown', (e) => {
        if (modal.hidden) return;
        if (e.key !== 'Escape' && e.key !== 'Esc') return;
        e.preventDefault();
        close();
    });

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!replaceNextBtn.disabled) replaceNext();
        }
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            if (!replaceAllBtn.disabled) replaceAll();
        }
    });
})();

// Rename modal (edit.php, superuser only)
(function(){
    const btn = document.getElementById('renameFileBtn');
    const modal = document.getElementById('renameModal');
    const overlay = document.getElementById('renameModalOverlay');
    const closeBtn = document.getElementById('renameModalClose');
    const cancelBtn = document.getElementById('renameModalCancel');
    const form = document.getElementById('renameModalForm');
    const input = document.getElementById('renameModalSlug');
    const statusEl = document.getElementById('renameModalStatus');
    const authRoleInput = document.getElementById('renameAuthRole');
    const authTokenInput = document.getElementById('renameAuthToken');
    if (!btn || !modal || !overlay || !form || !input) return;

    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));
    const slugMin = Number(input.dataset.slugMin || 3);
    const slugMax = Number(input.dataset.slugMax || 80);

    const supportsUnicodeProps = (() => {
        try { new RegExp('\\p{L}', 'u'); return true; } catch { return false; }
    })();
    const invalidCharsRe = supportsUnicodeProps
        ? /[^\p{L}\p{N}._-]+/gu
        : /[^A-Za-z0-9._-]+/g;
    const emojiRe = supportsUnicodeProps ? /\p{So}/u : null;
    const whitespaceRe = /\s+/g;

    const setStatus = (msg, kind = 'info') => {
        if (!(statusEl instanceof HTMLElement)) return;
        statusEl.textContent = String(msg || '');
        statusEl.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
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

    const validate = () => {
        const raw = input.value || '';
        let slug = slugify(raw);
        if (!slug) {
            const msg = t('js.new_md.adjust_title', 'Please adjust the title so it contains letters/numbers (spaces become hyphens).');
            input.setCustomValidity(msg);
            setStatus(msg, 'error');
            return false;
        }
        if (slug.length > slugMax) {
            slug = slug.slice(0, Math.max(0, slugMax)).replace(/[-.]+$/g, '');
        }
        if (slug.length < slugMin) {
            const msg = t('js.new_md.slug_too_short', 'Slug is too short (min {min}).', { min: slugMin });
            input.setCustomValidity(msg);
            setStatus(msg, 'error');
            return false;
        }
        input.setCustomValidity('');
        input.value = slug;
        setStatus('');
        return true;
    };

    const open = () => {
        if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
            alert(t('auth.superuser_required', 'Superuser login required.'));
            return;
        }
        overlay.hidden = false;
        modal.hidden = false;
        mdmModalOpen(true);
        setStatus('');
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    };

    const close = () => {
        overlay.hidden = true;
        modal.hidden = true;
        mdmModalOpen(false);
        setStatus('');
    };

    btn.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    overlay.addEventListener('click', close);

    form.addEventListener('submit', (e) => {
        if (!validate()) {
            e.preventDefault();
            try { input.focus(); } catch {}
            return;
        }
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (authRoleInput instanceof HTMLInputElement) authRoleInput.value = String(auth?.role || '');
        if (authTokenInput instanceof HTMLInputElement) authTokenInput.value = String(auth?.token || '');
    });

    input.addEventListener('input', () => {
        validate();
    });

    document.addEventListener('keydown', (e) => {
        if (modal.hidden) return;
        if (e.key !== 'Escape' && e.key !== 'Esc') return;
        e.preventDefault();
        close();
    });
})();

// Error modal (edit.php)
(function(){
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));
    const modal = document.getElementById('errorModal');
    const overlay = document.getElementById('errorModalOverlay');
    const closeBtn = document.getElementById('errorModalClose');
    const okBtn = document.getElementById('errorModalOk');
    const msgEl = document.getElementById('errorModalMessage');
    const detailsWrap = document.getElementById('errorModalDetailsWrap');
    const detailsEl = document.getElementById('errorModalDetails');
    if (!modal || !overlay) return;

    const open = (message, details) => {
        const fallback = t('js.error_generic', 'Something went wrong.');
        if (msgEl) msgEl.textContent = String(message || fallback);
        const detailText = details ? String(details) : '';
        if (detailsEl) detailsEl.textContent = detailText;
        if (detailsWrap) detailsWrap.hidden = !detailText;
        overlay.hidden = false;
        modal.hidden = false;
        mdmModalOpen(true);
        setTimeout(() => {
            try { (okBtn || closeBtn)?.focus?.(); } catch {}
        }, 0);
    };

    const close = () => {
        overlay.hidden = true;
        modal.hidden = true;
        mdmModalOpen(false);
        if (msgEl) msgEl.textContent = '';
        if (detailsEl) detailsEl.textContent = '';
        if (detailsWrap) detailsWrap.hidden = true;
    };

    window.__mdwShowErrorModal = open;
    window.__mdwCloseErrorModal = close;

    closeBtn?.addEventListener('click', close);
    okBtn?.addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
        if (modal.hidden) return;
        if (e.key !== 'Escape' && e.key !== 'Esc') return;
        e.preventDefault();
        close();
    });
})();
    };
})();
