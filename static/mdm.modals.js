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
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const internalSection = document.getElementById('linkModalInternal');
    const externalSection = document.getElementById('linkModalExternal');
    const footnoteSection = document.getElementById('linkModalFootnote');
    const youtubeSection = document.getElementById('linkModalYoutube');
    const titleEl = document.getElementById('linkModalTitle');
    const picker = document.getElementById('linkPicker');
    const pickerFilter = document.getElementById('linkPickerFilter');
    const pickerFilterClear = document.getElementById('linkPickerFilterClear');
    const externalText = document.getElementById('externalLinkText');
    const externalUrl = document.getElementById('externalLinkUrl');
    const footnoteText = document.getElementById('footnoteLinkText');
    const footnoteUrl = document.getElementById('footnoteLinkUrl');
    const footnoteTitle = document.getElementById('footnoteLinkTitle');
    const footnoteStyleSelect = document.getElementById('footnoteStyleSelect');
    const footnoteNextLabel = document.getElementById('footnoteNextLabel');
    const footnoteStyleHint = document.getElementById('footnoteStyleHint');
    const youtubeInput = document.getElementById('youtubeLinkInput');

    const normalizePath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const dirname = (p) => {
        p = normalizePath(p);
        const idx = p.lastIndexOf('/');
        return idx === -1 ? '' : p.slice(0, idx);
    };
    const normalizeInternalLinkPrefixLocal = (value) => {
        let out = String(value || '').trim();
        if (!out) return '';
        if (!/[\/?#=&]$/.test(out)) out += '/';
        return out;
    };
    const readInternalLinkPrefixLocal = () => {
        if (typeof window.__mdwReadInternalLinkPrefix === 'function') {
            return normalizeInternalLinkPrefixLocal(window.__mdwReadInternalLinkPrefix());
        }
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const settings = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        const raw = settings && typeof settings.internal_link_prefix === 'string' ? settings.internal_link_prefix.trim() : '';
        return normalizeInternalLinkPrefixLocal(raw);
    };

    const buildInternalHref = (fromFile, path) => {
        const clean = normalizePath(path);
        if (!clean) return '';
        const configuredPrefix = readInternalLinkPrefixLocal();
        if (configuredPrefix) {
            if (/index\.php\?file=?$/i.test(configuredPrefix)) {
                return `${configuredPrefix}${encodeURIComponent(clean)}`;
            }
            return `${configuredPrefix}index.php?file=${encodeURIComponent(clean)}`;
        }
        const fromDir = dirname(fromFile);
        const depth = fromDir ? fromDir.split('/').filter(Boolean).length : 0;
        const prefix = depth > 0 ? '../'.repeat(depth) : '';
        return `${prefix}index.php?file=${encodeURIComponent(clean)}`;
    };

    const publicSiteOrigin = () => {
        const link = document.getElementById('wpmPublicPageLink');
        const raw = link instanceof HTMLElement ? String(link.dataset.wpmPublicBase || '').trim() : '';
        if (!raw) return '';
        try {
            return new URL(raw).origin;
        } catch {
            return '';
        }
    };

    const hrefFragment = (href) => {
        const raw = String(href || '').trim();
        const idx = raw.indexOf('#');
        return idx >= 0 ? raw.slice(idx) : '';
    };

    const markdownPathCandidatesFromHref = (href) => {
        const raw = String(href || '').trim();
        if (!raw) return [];
        if (raw.startsWith('#')) {
            const current = normalizePath(window.CURRENT_FILE || '');
            return current ? [current] : [];
        }
        if (/^(?:mailto|tel|javascript|data):/i.test(raw)) return [];
        const candidates = [];
        const add = (value) => {
            let path = normalizePath(String(value || '').trim());
            if (!path) return;
            path = path.replace(/[?#].*$/, '');
            path = path.replace(/\/(?:index)?$/i, '');
            path = path.replace(/\/+$/g, '');
            if (!path || /(?:^|\/)(?:index|edit)\.php$/i.test(path)) return;
            const ext = (path.match(/\.([A-Za-z0-9]+)$/)?.[1] || '').toLowerCase();
            if (ext === 'html' || ext === 'htm') path = path.replace(/\.(?:html|htm)$/i, '.md');
            else if (ext === 'md' || ext === 'markdown') path = path.replace(/\.markdown$/i, '.md');
            else if (ext === '') path += '.md';
            if (path && !candidates.includes(path)) candidates.push(path);
        };

        try {
            const url = new URL(raw, window.location.href);
            const publicOrigin = publicSiteOrigin();
            if (url.origin !== window.location.origin && (!publicOrigin || url.origin !== publicOrigin)) return [];
            const file = url.searchParams.get('file');
            if (file) add(decodeURIComponent(file));
            const appDir = window.location.pathname.replace(/\/[^/]*$/, '/');
            let path = url.pathname || '';
            if (appDir && path.startsWith(appDir)) path = path.slice(appDir.length);
            add(path);
        } catch {
            add(raw);
        }

        add(raw);
        return candidates;
    };

    const findPickerItemByPath = (href) => {
        if (!picker) return null;
        const candidates = markdownPathCandidatesFromHref(href);
        if (!candidates.length) return null;
        const byBase = new Map();
        const bySlug = new Map();
        let baseMatch = null;
        const items = Array.from(picker.querySelectorAll('.link-pick-item'))
            .filter((item) => item instanceof HTMLElement);
        const setUnique = (map, key, item) => {
            if (!key) return;
            if (map.has(key)) map.set(key, null);
            else map.set(key, item);
        };
        for (const item of items) {
            const path = normalizePath(item.getAttribute('data-path') || '');
            if (!path) continue;
            if (candidates.includes(path)) return item;
            const base = path.split('/').pop() || '';
            setUnique(byBase, base, item);
            setUnique(bySlug, base.replace(/\.md$/i, ''), item);
        }
        for (const candidate of candidates) {
            const base = candidate.split('/').pop() || '';
            const slug = base.replace(/\.md$/i, '');
            const item = base ? (byBase.get(base) || bySlug.get(slug)) : null;
            if (item instanceof HTMLElement) {
                if (baseMatch && baseMatch !== item) return null;
                baseMatch = item;
            }
        }
        return baseMatch;
    };

    const selectPickerItem = (item) => {
        if (!(item instanceof HTMLElement)) return false;
        picker?.querySelectorAll('.link-pick-item.is-selected').forEach(el => el.classList.remove('is-selected'));
        item.classList.add('is-selected');
        selectedPath = item.getAttribute('data-path');
        selectedTitle = item.getAttribute('data-title') || selectedPath || '';
        try { item.scrollIntoView({ block: 'nearest' }); } catch {}
        validate();
        return !!selectedPath;
    };

    const setLinkModalLabels = (editing) => {
        if (titleEl instanceof HTMLElement) {
            titleEl.textContent = editing
                ? t('link_modal.title_edit', 'Change link')
                : t('link_modal.title', 'Add link');
        }
        if (insertBtn instanceof HTMLButtonElement) {
            insertBtn.textContent = editing
                ? t('link_modal.update', 'Change')
                : t('link_modal.insert', 'Insert link');
        }
    };

    let mode = 'internal';
    let selectedPath = null;
    let selectedTitle = null;
    let editContext = null;
    const FOOTNOTE_STYLE_VALUES = ['decimal', 'roman-upper', 'roman-lower', 'alpha-lower', 'alpha-upper'];

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
            syncFootnoteModalState({ autodetectStyle: true });
            footnoteUrl?.focus();
        } else if (mode === 'youtube') {
            youtubeInput?.focus();
        } else {
            pickerFilter?.focus();
        }
    };

    const linkTextFromElement = (link) => {
        if (!(link instanceof HTMLAnchorElement)) return '';
        return String(link.textContent || '').trim();
    };

    const selectModeRadio = (next) => {
        const checked = modal.querySelector(`input[name="linkMode"][value="${next}"]`);
        if (checked instanceof HTMLInputElement) checked.checked = true;
    };

    const open = (options = {}) => {
	        if (typeof window.__mdwCloseImageModal === 'function') {
	            window.__mdwCloseImageModal();
	        }
        if (typeof window.__mdwCloseThemeModal === 'function') {
            window.__mdwCloseThemeModal({ force: true });
        }
	        overlay.hidden = false;
	        modal.hidden = false;
	        mdmModalOpen(true);

        editContext = null;
        setLinkModalLabels(false);
        if (pickerFilter) pickerFilter.value = '';
        if (pickerFilterClear) pickerFilterClear.style.display = 'none';
        if (typeof applyPickerFilter === 'function') applyPickerFilter();
        if (externalText) externalText.value = '';
        if (externalUrl) externalUrl.value = '';
        if (footnoteText) footnoteText.value = '';
        if (footnoteUrl) footnoteUrl.value = '';
        if (footnoteTitle) footnoteTitle.value = '';
        if (youtubeInput) youtubeInput.value = '';

        const linkEl = options && options.linkEl instanceof HTMLAnchorElement ? options.linkEl : null;
        if (linkEl) {
            const href = String(linkEl.getAttribute('href') || '').trim();
            const internalItem = findPickerItemByPath(href);
            editContext = {
                type: 'visual-link',
                linkEl,
                internal: internalItem instanceof HTMLElement,
                className: String(linkEl.getAttribute('class') || '').trim(),
                target: String(linkEl.getAttribute('target') || '').trim(),
                rel: String(linkEl.getAttribute('rel') || '').trim(),
                fragment: hrefFragment(href),
            };
            setLinkModalLabels(true);
            if (internalItem instanceof HTMLElement) {
                selectModeRadio('internal');
                setMode('internal');
                selectPickerItem(internalItem);
                return;
            }
            if (href.startsWith('#') && normalizePath(window.CURRENT_FILE || '')) {
                selectedPath = normalizePath(window.CURRENT_FILE || '');
                selectedTitle = selectedPath;
                selectModeRadio('internal');
                setMode('internal');
                validate();
                return;
            }
            if (externalText) externalText.value = linkTextFromElement(linkEl);
            if (externalUrl) externalUrl.value = href;
            selectModeRadio('external');
            setMode('external');
            validate();
            return;
        }

        selectModeRadio('internal');
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
        if (typeof applyPickerFilter === 'function') applyPickerFilter();
        if (externalText) externalText.value = '';
        if (externalUrl) externalUrl.value = '';
        if (footnoteText) footnoteText.value = '';
        if (footnoteUrl) footnoteUrl.value = '';
        if (footnoteTitle) footnoteTitle.value = '';
        if (footnoteNextLabel instanceof HTMLInputElement) footnoteNextLabel.value = '1';
        if (footnoteStyleHint instanceof HTMLElement) footnoteStyleHint.textContent = '';
        if (youtubeInput) youtubeInput.value = '';
        setLinkModalLabels(false);
        editContext = null;
        validate();
        btn.focus();
	    };

	    window.__mdwCloseLinkModal = close;
    window.__mdwOpenLinkModal = open;

	    const getEditorSelectionText = () => {
        if (typeof window.__mdwGetVisualSelectionText === 'function') {
            const visualText = window.__mdwGetVisualSelectionText();
            if (visualText) return visualText;
        }
	        const start = editor.selectionStart ?? 0;
	        const end = editor.selectionEnd ?? 0;
	        if (end > start) return editor.value.slice(start, end);
        return '';
    };

    const insertAtSelection = (text) => {
        if (typeof window.__mdwInsertMarkdownAtSelection === 'function' && window.__mdwInsertMarkdownAtSelection(text)) {
            return;
        }
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
        if (typeof window.__mdwInsertMarkdownAtSelection === 'function' && window.__mdwInsertMarkdownAtSelection(block)) {
            return;
        }
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
    footnoteStyleSelect?.addEventListener('change', () => {
        if (!(footnoteStyleSelect instanceof HTMLSelectElement)) return;
        if (mode !== 'footnote') return;
        const selected = isValidFootnoteStyle(footnoteStyleSelect.value) ? footnoteStyleSelect.value : 'decimal';
        applyFootnoteStyleToEditor(selected);
    });
    youtubeInput?.addEventListener('input', validate);

    picker?.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target.closest('.link-pick-item') : null;
        if (!(target instanceof HTMLElement)) return;
        selectPickerItem(target);
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

    const isValidFootnoteStyle = (style) => FOOTNOTE_STYLE_VALUES.includes(String(style || ''));
    const normalizeFootnoteLabel = (label) => String(label || '').trim();

    const indexToAlpha = (index, upper) => {
        let n = Number(index) || 1;
        if (n < 1) n = 1;
        let out = '';
        while (n > 0) {
            n -= 1;
            out = String.fromCharCode((upper ? 65 : 97) + (n % 26)) + out;
            n = Math.floor(n / 26);
        }
        return out;
    };

    const toRoman = (index) => {
        let n = Number(index) || 1;
        if (n < 1 || n > 3999) return String(index);
        const map = [
            [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
            [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
            [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
        ];
        let out = '';
        for (const [value, token] of map) {
            while (n >= value) {
                out += token;
                n -= value;
            }
        }
        return out;
    };

    const fromRoman = (raw) => {
        const v = String(raw || '').trim().toUpperCase();
        if (!v) return 0;
        const vals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let total = 0;
        for (let i = 0; i < v.length; i++) {
            const cur = vals[v[i]];
            const next = vals[v[i + 1]] || 0;
            if (!cur) return 0;
            total += cur < next ? -cur : cur;
        }
        return total > 0 && toRoman(total) === v ? total : 0;
    };

    const footnoteLabelForIndex = (index, style) => {
        let n = Number(index) || 1;
        if (n < 1) n = 1;
        switch (style) {
            case 'roman-upper':
                return toRoman(n).toUpperCase();
            case 'roman-lower':
                return toRoman(n).toLowerCase();
            case 'alpha-upper':
                return indexToAlpha(n, true);
            case 'alpha-lower':
                return indexToAlpha(n, false);
            case 'decimal':
            default:
                return String(n);
        }
    };

    const detectSingleLabelStyle = (label) => {
        const v = normalizeFootnoteLabel(label);
        if (!v) return 'decimal';
        if (/^\d+$/.test(v)) return 'decimal';
        if (/^[A-Z]+$/.test(v)) {
            if (fromRoman(v) > 0) return 'roman-upper';
            return 'alpha-upper';
        }
        if (/^[a-z]+$/.test(v)) {
            if (fromRoman(v) > 0) return 'roman-lower';
            return 'alpha-lower';
        }
        return 'decimal';
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
                const m = line.match(/^\s*\[([^\]]+)\]:\s*(.+)$/);
                if (m) {
                    const label = normalizeFootnoteLabel(m[1]);
                    if (label) {
                        defs.push({ label, content: String(m[2] || '').trim() });
                        continue;
                    }
                }
            }
            body.push(line);
        }
        return { body: body.join('\n'), defs };
    };

    const collectFootnoteRefOrder = (body) => {
        const order = [];
        const seen = new Set();
        const lines = String(body || '').split('\n');
        let inCode = false;
        for (const line of lines) {
            if (/^\s*```/.test(line)) {
                inCode = !inCode;
                continue;
            }
            if (inCode) continue;
            const refRe = /\[([^\]]+)\]\[([^\]]+)\]/g;
            let m;
            while ((m = refRe.exec(line))) {
                const label = normalizeFootnoteLabel(m[2]);
                if (!label || seen.has(label)) continue;
                seen.add(label);
                order.push(label);
            }
        }
        return order;
    };

    const collectFootnoteRefsWithPositions = (text) => {
        const refs = [];
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        let inCode = false;
        let offset = 0;
        for (const line of lines) {
            if (/^\s*```/.test(line)) {
                inCode = !inCode;
                offset += line.length + 1;
                continue;
            }
            if (!inCode) {
                const refRe = /\[([^\]]+)\]\[([^\]]+)\]/g;
                let m;
                while ((m = refRe.exec(line))) {
                    const label = normalizeFootnoteLabel(m[2]);
                    if (!label) continue;
                    refs.push({
                        label,
                        start: offset + m.index,
                    });
                }
            }
            offset += line.length + 1;
        }
        return refs;
    };

    const resolveFootnoteInsertionIndex = (text, cursorPos) => {
        const refs = collectFootnoteRefsWithPositions(text);
        if (!refs.length) return 1;

        const cursor = Math.max(0, Number(cursorPos) || 0);
        const seen = new Set();
        let uniqueBeforeCursor = 0;
        for (const ref of refs) {
            if (seen.has(ref.label)) continue;
            seen.add(ref.label);
            if (ref.start < cursor) uniqueBeforeCursor += 1;
        }
        return uniqueBeforeCursor + 1;
    };

    const makeTemporaryFootnoteLabel = (text) => {
        const src = String(text || '');
        let i = 1;
        let label = `mdw-new-footnote-${i}`;
        while (src.includes(`[${label}]`) || src.includes(`[${label}]:`)) {
            i += 1;
            label = `mdw-new-footnote-${i}`;
        }
        return label;
    };

    const detectFootnoteStyle = (labels) => {
        const clean = (Array.isArray(labels) ? labels : [])
            .map((label) => normalizeFootnoteLabel(label))
            .filter(Boolean);
        if (!clean.length) return 'decimal';

        let bestStyle = 'decimal';
        let bestScore = -1;
        for (const style of FOOTNOTE_STYLE_VALUES) {
            let score = 0;
            const max = Math.min(clean.length, 12);
            for (let i = 0; i < max; i++) {
                if (clean[i] === footnoteLabelForIndex(i + 1, style)) score += 2;
            }
            if (score > bestScore) {
                bestScore = score;
                bestStyle = style;
            }
        }
        if (bestScore > 0) return bestStyle;
        return detectSingleLabelStyle(clean[0]);
    };

    const inspectFootnotes = (text) => {
        const parsed = extractFootnotes(text);
        const refOrder = collectFootnoteRefOrder(parsed.body);
        const defOrder = parsed.defs.map((d) => normalizeFootnoteLabel(d.label)).filter(Boolean);
        const style = detectFootnoteStyle(refOrder.length ? refOrder : defOrder);
        const count = Math.max(refOrder.length, defOrder.length);
        return {
            body: parsed.body,
            defs: parsed.defs,
            refOrder,
            style,
            count,
            nextIndex: count + 1,
            nextLabel: footnoteLabelForIndex(count + 1, style),
        };
    };

    const renumberFootnotes = (text, style) => {
        const info = inspectFootnotes(text);
        const nextStyle = isValidFootnoteStyle(style) ? style : info.style;
        const mapping = new Map();
        info.refOrder.forEach((oldLabel, idx) => {
            mapping.set(oldLabel, footnoteLabelForIndex(idx + 1, nextStyle));
        });

        const lines = String(info.body || '').split('\n');
        const replacedLines = [];
        let inCode = false;
        for (const line of lines) {
            if (/^\s*```/.test(line)) {
                inCode = !inCode;
                replacedLines.push(line);
                continue;
            }
            if (inCode) {
                replacedLines.push(line);
                continue;
            }
            replacedLines.push(line.replace(/\[([^\]]+)\]\[([^\]]+)\]/g, (full, textLabel, oldRaw) => {
                const oldLabel = normalizeFootnoteLabel(oldRaw);
                if (!oldLabel) return full;
                const nextLabel = mapping.get(oldLabel) || oldLabel;
                return `[${textLabel}][${nextLabel}]`;
            }));
        }
        const replacedBody = replacedLines.join('\n');

        const defMap = new Map();
        info.defs.forEach((d) => {
            const label = normalizeFootnoteLabel(d?.label);
            if (!label || defMap.has(label)) return;
            defMap.set(label, String(d?.content || '').trim());
        });

        const used = new Set(mapping.keys());
        const newDefs = [];
        info.refOrder.forEach((oldLabel) => {
            const content = defMap.get(oldLabel);
            if (!content) return;
            const nextLabel = mapping.get(oldLabel) || oldLabel;
            newDefs.push(`[${nextLabel}]: ${content}`);
        });
        const extraDefs = info.defs
            .filter((d) => {
                const label = normalizeFootnoteLabel(d?.label);
                return !!label && !used.has(label);
            })
            .map((d) => `[${normalizeFootnoteLabel(d.label)}]: ${String(d.content || '').trim()}`);

        const allDefs = newDefs.concat(extraDefs);
        if (!allDefs.length) {
            return { text: replacedBody, mapping, style: nextStyle, count: info.count };
        }

        const trimmed = replacedBody.replace(/\s*$/, '');
        const sep = trimmed.trim() ? '\n\n' : '';
        return {
            text: trimmed + sep + allDefs.join('\n') + '\n',
            mapping,
            style: nextStyle,
            count: info.count,
        };
    };

    const appendFootnoteDefinition = (text, line) => {
        const trimmed = String(text || '').replace(/\s*$/, '');
        const sep = trimmed.trim() ? '\n\n' : '';
        return trimmed + sep + line + '\n';
    };

    const footnoteStyleLabel = (style) => {
        switch (style) {
            case 'roman-upper': return 'I, II, III';
            case 'roman-lower': return 'i, ii, iii';
            case 'alpha-upper': return 'A, B, C';
            case 'alpha-lower': return 'a, b, c';
            case 'decimal':
            default: return '1, 2, 3';
        }
    };

    const setFootnoteStyleHint = (msg) => {
        if (!(footnoteStyleHint instanceof HTMLElement)) return;
        footnoteStyleHint.textContent = String(msg || '');
    };

    const syncFootnoteModalState = ({ autodetectStyle = false } = {}) => {
        const source = editor.value || '';
        const info = inspectFootnotes(source);
        const insertionIndex = resolveFootnoteInsertionIndex(source, editor.selectionStart ?? 0);
        let style = info.style;
        if (footnoteStyleSelect instanceof HTMLSelectElement) {
            if (autodetectStyle || !isValidFootnoteStyle(footnoteStyleSelect.value)) {
                footnoteStyleSelect.value = style;
            }
            style = isValidFootnoteStyle(footnoteStyleSelect.value) ? footnoteStyleSelect.value : style;
        }
        const nextLabel = footnoteLabelForIndex(insertionIndex, style);
        if (footnoteNextLabel instanceof HTMLInputElement) {
            footnoteNextLabel.value = nextLabel;
        }
        if (info.count > 0) {
            setFootnoteStyleHint(t(
                'link_modal.footnote_style_detected',
                'Detected style: {style}. Existing footnotes: {count}.',
                { style: footnoteStyleLabel(style), count: info.count }
            ));
        } else {
            setFootnoteStyleHint(t(
                'link_modal.footnote_style_empty',
                'No footnotes found yet. Next label: {label}.',
                { label: nextLabel }
            ));
        }
        return { ...info, style, nextLabel, nextIndex: insertionIndex };
    };

    const applyFootnoteStyleToEditor = (style) => {
        const chosenStyle = isValidFootnoteStyle(style) ? style : 'decimal';
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? 0;
        const scrollTop = editor.scrollTop;
        const renumbered = renumberFootnotes(editor.value || '', chosenStyle);
        if (renumbered.text !== editor.value) {
            editor.value = renumbered.text;
            const maxPos = editor.value.length;
            editor.setSelectionRange(Math.min(start, maxPos), Math.min(end, maxPos));
            editor.scrollTop = scrollTop;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return syncFootnoteModalState({ autodetectStyle: false });
    };

    const insertLink = () => {
        if (mode === 'external') {
            let url = String(externalUrl?.value || '').trim();
            if (!url) return;
            if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//')) {
                url = 'https://' + url;
            }
            const selection = getEditorSelectionText();
            const modalText = String(externalText?.value || '').trim();
            const text = modalText || selection || url;
            if (editContext?.type === 'visual-link' && editContext.linkEl instanceof HTMLAnchorElement) {
                const link = editContext.linkEl;
                link.setAttribute('href', url);
                link.textContent = text;
                if (editContext.className) link.setAttribute('class', editContext.className);
                else link.removeAttribute('class');
                if (editContext.target) link.setAttribute('target', editContext.target);
                if (editContext.rel) link.setAttribute('rel', editContext.rel);
                if (typeof window.__mdwSyncVisualPreviewToTextarea === 'function') {
                    window.__mdwSyncVisualPreviewToTextarea();
                }
                close();
                return;
            }
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
            const modalState = syncFootnoteModalState({ autodetectStyle: false });
            const style = isValidFootnoteStyle(modalState.style) ? modalState.style : 'decimal';
            const selection = getEditorSelectionText();
            const text = selection || String(footnoteText?.value || '').trim() || url;
            const titleRaw = String(footnoteTitle?.value || '').trim();
            const titleSafe = titleRaw.replace(/"/g, "'");
            const start = editor.selectionStart ?? 0;
            const end = editor.selectionEnd ?? 0;
            const before = editor.value.slice(0, start);
            const after = editor.value.slice(end);
            const tempLabel = makeTemporaryFootnoteLabel(editor.value || '');
            const ref = `[${text}][${tempLabel}]`;
            const def = `[${tempLabel}]: ${url}${titleSafe ? ` "${titleSafe}"` : ''}`;
            let nextValue = before + ref + after;
            nextValue = appendFootnoteDefinition(nextValue, def);
            const renumbered = renumberFootnotes(nextValue, style);
            const newLabel = renumbered.mapping.get(normalizeFootnoteLabel(tempLabel))
                || modalState.nextLabel
                || footnoteLabelForIndex(modalState.nextIndex || 1, style);
            const refFinal = `[${text}][${newLabel}]`;

            editor.value = renumbered.text;
            let caret = before.length + ref.length;
            const probeStart = Math.max(0, before.length - 64);
            const idx = editor.value.indexOf(refFinal, probeStart);
            if (idx !== -1) caret = idx + refFinal.length;
            editor.setSelectionRange(caret, caret);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            editor.focus();
            syncFootnoteModalState({ autodetectStyle: false });
            close();
            return;
        }

        if (!selectedPath) return;
        const selection = getEditorSelectionText();
        const text = selection || selectedTitle || selectedPath;
        let href = buildInternalHref(window.CURRENT_FILE || '', selectedPath);
        if (editContext?.type === 'visual-link' && editContext.fragment) {
            href += editContext.fragment;
        }
        if (editContext?.type === 'visual-link' && editContext.linkEl instanceof HTMLAnchorElement) {
            const link = editContext.linkEl;
            link.setAttribute('href', href);
            if (editContext.className) link.setAttribute('class', editContext.className);
            else link.setAttribute('class', 'link');
            if (editContext.target) link.setAttribute('target', editContext.target);
            else link.removeAttribute('target');
            if (editContext.rel) link.setAttribute('rel', editContext.rel);
            else link.removeAttribute('rel');
            if (typeof window.__mdwSyncVisualPreviewToTextarea === 'function') {
                window.__mdwSyncVisualPreviewToTextarea();
            }
            close();
            return;
        }
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
        if (typeof window.__mdwInsertMarkdownAtSelection === 'function' && window.__mdwInsertMarkdownAtSelection(text)) {
            return;
        }
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
        return name;
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
    const fileInput = document.getElementById('renameModalFile');
    const input = document.getElementById('renameModalSlug');
    const fieldLabel = document.getElementById('renameModalFieldLabel');
    const prefixHintWrap = document.getElementById('renameModalPrefixHintWrap');
    const prefixValue = document.getElementById('renameModalPrefixValue');
    const keepDateWrap = document.getElementById('renameModalKeepDateWrap');
    const keepDateToggle = document.getElementById('renameModalKeepDatePrefix');
    const keepDateValue = document.getElementById('renameModalKeepDateValue');
    const statusEl = document.getElementById('renameModalStatus');
    const authRoleInput = document.getElementById('renameAuthRole');
    const authTokenInput = document.getElementById('renameAuthToken');
    const overview = document.getElementById('links_md_overview');
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
    const whitespaceRe = /\s+/g;

    const isPublisherMode = () => {
        const cfg = (window && typeof window === 'object') ? window.MDW_META_CONFIG : null;
        const settings = (cfg && typeof cfg === 'object') ? cfg._settings : null;
        return !!(settings && settings.publisher_mode);
    };

    const setStatus = (msg, kind = 'info') => {
        if (!(statusEl instanceof HTMLElement)) return;
        statusEl.textContent = String(msg || '');
        statusEl.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const splitFileName = (filePath) => {
        const file = String(filePath || '').trim().split('/').pop() || '';
        const stem = file.replace(/\.md$/i, '');
        const m = stem.match(/^(\d{2}-\d{2}-\d{2}-)(.+)$/);
        if (m) {
            return {
                prefix: String(m[1] || ''),
                name: String(m[2] || ''),
            };
        }
        return {
            prefix: '',
            name: stem,
        };
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
        if (overview instanceof HTMLElement) {
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
        }
        return '';
    };

    const syncFieldCopy = () => {
        const useSlug = isPublisherMode();
        const labelSlug = String(input.dataset.labelSlug || t('rename_modal.slug_label', 'New slug')).trim();
        const labelFilename = String(input.dataset.labelFilename || t('rename_modal.filename_label', 'New filename')).trim();
        const placeholderSlug = String(input.dataset.placeholderSlug || t('rename_modal.slug_placeholder', 'new-title')).trim();
        const placeholderFilename = String(input.dataset.placeholderFilename || t('rename_modal.filename_placeholder', 'new-filename')).trim();
        if (fieldLabel instanceof HTMLElement) {
            fieldLabel.textContent = useSlug ? labelSlug : labelFilename;
        }
        input.placeholder = useSlug ? placeholderSlug : placeholderFilename;
    };

    const syncTargetFile = (fallbackFile = '') => {
        const focused = getFocusedOverviewFile();
        const file = String(focused || fallbackFile || window.CURRENT_FILE || '').trim();

        if (fileInput instanceof HTMLInputElement) {
            fileInput.value = file;
        }
        if (btn instanceof HTMLButtonElement) {
            btn.disabled = !file;
        }

        const parts = splitFileName(file);
        const hasPrefix = parts.prefix !== '';
        const useSlug = isPublisherMode();
        input.dataset.prefix = parts.prefix;
        input.value = parts.name;

        if (useSlug) {
            if (prefixValue instanceof HTMLElement) {
                prefixValue.textContent = parts.prefix;
            }
            if (prefixHintWrap instanceof HTMLElement) {
                prefixHintWrap.hidden = !hasPrefix;
            }
            if (keepDateWrap instanceof HTMLElement) {
                keepDateWrap.hidden = true;
            }
        } else {
            if (keepDateValue instanceof HTMLElement) {
                keepDateValue.textContent = parts.prefix;
            }
            if (keepDateWrap instanceof HTMLElement) {
                keepDateWrap.hidden = !hasPrefix;
            }
            if (keepDateToggle instanceof HTMLInputElement) {
                keepDateToggle.disabled = !hasPrefix;
                keepDateToggle.checked = hasPrefix;
            }
            if (prefixHintWrap instanceof HTMLElement) {
                prefixHintWrap.hidden = true;
            }
        }

        return file;
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
            const msg = t('rename_modal.value_too_short', 'Value is too short (min {min}).', { min: slugMin });
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
        syncFieldCopy();
        const targetFile = syncTargetFile();
        if (!targetFile) {
            setStatus(t('rename_modal.no_file_selected', 'No markdown file selected.'), 'error');
            return;
        }
        overlay.hidden = false;
        modal.hidden = false;
        mdmModalOpen(true);
        setStatus('');
        validate();
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
        const targetFile = String((fileInput instanceof HTMLInputElement) ? fileInput.value : '').trim();
        if (!targetFile) {
            e.preventDefault();
            setStatus(t('rename_modal.no_file_selected', 'No markdown file selected.'), 'error');
            return;
        }
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

    if (overview instanceof HTMLElement) {
        const syncSoon = () => requestAnimationFrame(() => syncTargetFile());
        overview.addEventListener('focusin', syncSoon);
        overview.addEventListener('click', syncSoon);
        overview.addEventListener('keydown', (e) => {
            const key = String(e.key || '');
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown' || key === 'Enter') {
                syncSoon();
            }
        });
    }
    syncFieldCopy();
    syncTargetFile();

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
