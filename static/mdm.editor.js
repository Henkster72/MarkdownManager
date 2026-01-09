(function(){
    const MDM = window.MDM = window.MDM || {};
    const module = MDM.editor = MDM.editor || {};
    const mdmApi = MDM.api;
    const mdmUi = MDM.ui;
    const mdm$ = MDM.$ || ((sel, root = document) => root.querySelector(sel));
    const mdm$$ = MDM.$$ || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

    module.init = () => {
        if (module._init) return;
        module._init = true;

(function(){
    const editor = document.getElementById('editor');
    const form = document.getElementById('editor-form');
    if (!(editor instanceof HTMLTextAreaElement) || !(form instanceof HTMLFormElement)) return;

    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const parseMetaLine = (line) => {
        const normalized = String(line ?? '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\u200B\uFEFF]/g, '');
        let m = normalized.match(/^\s*\{+\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*\}+\s*$/u);
        if (!m) {
            m = normalized.match(/^\s*_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*$/u);
        }
        if (!m) return null;
        const key = String(m[1] || '').trim().toLowerCase();
        if (!key) return null;
        return { key, value: String(m[2] || '').trim() };
    };

    const getBaseCfg = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const fields = cfg && cfg.fields && typeof cfg.fields === 'object' ? cfg.fields : {};
        return fields || {};
    };
    const getPublisherCfg = () => {
        const cfg = (window.MDW_META_PUBLISHER_CONFIG && typeof window.MDW_META_PUBLISHER_CONFIG === 'object') ? window.MDW_META_PUBLISHER_CONFIG : null;
        const fields = cfg && cfg.fields && typeof cfg.fields === 'object' ? cfg.fields : {};
        return fields || {};
    };
    const isPublisherMode = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const settings = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        return !!(settings && settings.publisher_mode);
    };
    const getAppTitle = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const settings = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        const raw = settings && typeof settings.app_title === 'string' ? settings.app_title.trim() : '';
        return raw || 'Markdown Manager';
    };

    const publisherOrder = [
        'extends',
        'page_title',
        'page_subtitle',
        'post_date',
        'page_picture',
        'active_page',
        'cta',
        'blurmenu',
        'sociallinks',
        'blog',
        'author',
        'creationdate',
        'changedate',
        'published_date',
        'publishstate',
    ];

    const isMarkdownVisible = (f) => {
        if (!f || typeof f !== 'object') return true;
        if (!Object.prototype.hasOwnProperty.call(f, 'markdown_visible')) return true;
        const v = f.markdown_visible;
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            if (s === 'false' || s === '0' || s === 'no') return false;
            if (s === 'true' || s === '1' || s === 'yes') return true;
        }
        return !!v;
    };

    const stripHiddenMeta = (raw) => {
        const baseCfg = getBaseCfg();
        const pubCfg = getPublisherCfg();
        const publisherMode = isPublisherMode();
        const { meta, body } = extractMetaAndBody(raw);
        const { order } = getKnownKeysAndOrder();
        const includeKeys = order.filter((k) => {
            const fBase = baseCfg[k];
            const fPub = pubCfg[k];
            const f = fBase || fPub || {};
            const inPublisherCfg = !!fPub && !fBase;
            if (inPublisherCfg && !publisherMode) return false;
            return isMarkdownVisible(f);
        });
        const block = buildMetaBlock(meta, includeKeys);
        const cleanedBody = String(body).replace(/^\n+/, '');
        return block ? (block + '\n\n' + cleanedBody) : cleanedBody;
    };

    const getKnownKeysAndOrder = () => {
        const base = getBaseCfg();
        const pub = getPublisherCfg();
        const known = new Set([
            ...Object.keys(base || {}).map(k => String(k).toLowerCase()),
            ...Object.keys(pub || {}).map(k => String(k).toLowerCase()),
        ]);
        const order = [];
        const add = (k) => {
            const kk = String(k || '').trim().toLowerCase();
            if (!kk || !known.has(kk)) return;
            if (!order.includes(kk)) order.push(kk);
        };
        // Base keys first (keeps date at top).
        Object.keys(base || {}).forEach(add);
        // Publisher keys in stable order.
        publisherOrder.forEach(add);
        // Any remaining known keys.
        known.forEach(add);
        return { known, order };
    };

    const extractMetaAndBody = (raw) => {
        const lines = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n');
        const meta = {};
        const bodyLines = [];
        const { known } = getKnownKeysAndOrder();
        const bufferedLeading = [];
        let inMeta = true;
        let seenMeta = false;
        for (const line of lines) {
            const normalized = String(line ?? '')
                .replace(/\u00a0/g, ' ')
                .replace(/[\u200B\uFEFF]/g, '');
            if (inMeta) {
            const parsed = parseMetaLine(line);
            if (parsed) {
                if (known.has(parsed.key)) {
                    meta[parsed.key] = parsed.value;
                    seenMeta = true;
                    continue;
                }
            }
                if (!seenMeta && normalized.trim() === '') {
                    bufferedLeading.push(line);
                    continue;
                }
                inMeta = false;
                if (bufferedLeading.length) {
                    bodyLines.push(...bufferedLeading);
                    bufferedLeading.length = 0;
                }
            }
            bodyLines.push(line);
        }
        if (inMeta && bufferedLeading.length) {
            bodyLines.push(...bufferedLeading);
        }
        return { meta, body: bodyLines.join('\n') };
    };

    const buildMetaBlock = (meta, includeKeys) => {
        const { order } = getKnownKeysAndOrder();
        const out = [];
        for (const k of order) {
            if (!includeKeys.includes(k)) continue;
            const v = String(meta?.[k] ?? '').trim();
            if (!v) continue;
            out.push(`{${k}: ${v}}`);
        }
        return out.join('\n');
    };

    let metaStore = extractMetaAndBody(editor.value).meta;
    const liveStatus = document.getElementById('liveStatus');
    let metaWarnTimer = null;
    let applyTimer = null;
    let isApplying = false;
    let hasAppliedOnce = false;
    const warnHiddenMeta = (keys) => {
        if (!keys.length || !(liveStatus instanceof HTMLElement)) return;
        liveStatus.textContent = `Hidden metadata removed: ${keys.join(', ')}.`;
        liveStatus.style.color = 'var(--danger)';
        if (metaWarnTimer) clearTimeout(metaWarnTimer);
        metaWarnTimer = setTimeout(() => {
            liveStatus.textContent = '';
            liveStatus.style.color = '';
        }, 4000);
    };

    const applyMetaVisibility = () => {
        const baseCfg = getBaseCfg();
        const pubCfg = getPublisherCfg();
        const publisherMode = isPublisherMode();
        const { meta, body } = extractMetaAndBody(editor.value);
        const hiddenKeys = new Set();
        Object.entries(baseCfg || {}).forEach(([k, f]) => {
            if (!f || typeof f !== 'object') return;
            if (!isMarkdownVisible(f)) hiddenKeys.add(String(k).toLowerCase());
        });
        if (publisherMode) {
            Object.entries(pubCfg || {}).forEach(([k, f]) => {
                if (!f || typeof f !== 'object') return;
                if (!isMarkdownVisible(f)) hiddenKeys.add(String(k).toLowerCase());
            });
        }

        const filteredMeta = {};
        const blockedKeys = [];
        Object.entries(meta || {}).forEach(([k, v]) => {
            const key = String(k).toLowerCase();
            const isHidden = hiddenKeys.has(key);
            if (isHidden) {
                if (hasAppliedOnce) blockedKeys.push(key);
                return;
            }
            filteredMeta[key] = v;
        });
        if (blockedKeys.length) warnHiddenMeta(blockedKeys);
        metaStore = { ...metaStore, ...filteredMeta };

        const { order } = getKnownKeysAndOrder();
        const includeKeys = order.filter((k) => {
            const fBase = baseCfg[k];
            const fPub = pubCfg[k];
            const f = fBase || fPub || {};
            const inPublisherCfg = !!fPub && !fBase;
            if (inPublisherCfg && !publisherMode) return false;
            return isMarkdownVisible(f);
        });

        const block = buildMetaBlock(metaStore, includeKeys);
        const cleanedBody = String(body).replace(/^\n+/, '');
        const next = block ? (block + '\n\n' + cleanedBody) : cleanedBody;

        if (editor.value !== next) {
            const pos = editor.selectionStart;
            isApplying = true;
            editor.value = next;
            try { editor.selectionStart = editor.selectionEnd = Math.min(pos, editor.value.length); } catch {}
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            isApplying = false;
        }
        hasAppliedOnce = true;
    };

    window.__mdwApplyMetaVisibility = applyMetaVisibility;
    window.__mdwStripHiddenMetaForDirty = stripHiddenMeta;
    window.__mdwSetMetaValue = (key, value) => {
        const kk = String(key || '').trim().toLowerCase();
        if (!kk) return;
        const { known } = getKnownKeysAndOrder();
        if (!known.has(kk)) return;
        const v = String(value ?? '').trim();
        if (v === '') {
            if (Object.prototype.hasOwnProperty.call(metaStore, kk)) {
                delete metaStore[kk];
            }
        } else {
            metaStore[kk] = v;
        }
        applyMetaVisibility();
    };
    window.__mdwResetMetaStore = () => {
        metaStore = extractMetaAndBody(editor.value).meta;
        hasAppliedOnce = false;
        applyMetaVisibility();
    };
    applyMetaVisibility();

    const scheduleApply = () => {
        if (isApplying) return;
        if (applyTimer) clearTimeout(applyTimer);
        applyTimer = setTimeout(() => {
            applyTimer = null;
            applyMetaVisibility();
        }, 120);
    };

    editor.addEventListener('input', () => {
        if (isApplying) return;
        scheduleApply();
    });

    form.addEventListener('submit', (event) => {
        const { meta, body } = extractMetaAndBody(editor.value);
        const mergedMeta = { ...metaStore, ...meta };
        if (isPublisherMode()) {
            const pageTitle = String(mergedMeta.page_title || '').trim();
            if (!pageTitle) {
                alert(t('flash.publisher_requires_page_title', 'WPM requires a page_title metadata line.', { app: getAppTitle() }));
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            const pagePicture = String(mergedMeta.page_picture || '').trim();
            if (!pagePicture) {
                alert(t('flash.publisher_requires_page_picture', 'WPM requires a page_picture metadata line.', { app: getAppTitle() }));
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }
        metaStore = mergedMeta;
        const { order } = getKnownKeysAndOrder();
        const block = buildMetaBlock(metaStore, order.slice());
        const cleanedBody = String(body).replace(/^\n+/, '');
        editor.value = block ? (block + '\n\n' + cleanedBody) : cleanedBody;
    }, true);
})();
(function(){
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));
    const indicator = document.getElementById('offlineIndicator');
    if (!indicator) return;

    const STORAGE_KEY = 'mdw_offline_delay_min';
    const DELAY_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60];
    const normalizeDelay = (value) => {
        const n = parseInt(String(value || ''), 10);
        if (!Number.isFinite(n)) return 30;
        let best = DELAY_OPTIONS[0];
        let bestDiff = Math.abs(n - best);
        for (const opt of DELAY_OPTIONS) {
            const diff = Math.abs(n - opt);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = opt;
            }
        }
        return best;
    };
    const readDelay = () => {
        try {
            return normalizeDelay(mdwStorageGet(STORAGE_KEY));
        } catch {
            return 30;
        }
    };
    const writeDelay = (value) => {
        const v = normalizeDelay(value);
        try { mdwStorageSet(STORAGE_KEY, String(v)); } catch {}
        return v;
    };

    const FAIL_WINDOW_MS = 90 * 1000;
    let offlineDelayMin = readDelay();
    let offlineDelayMs = offlineDelayMin * 60 * 1000;
    let offlineCandidateAt = 0;
    let lastSuccessAt = Date.now();
    let failCount = 0;
    let firstFailAt = 0;
    let verifiedOffline = false;
    let offlineTimer = null;

    const scheduleTimer = () => {
        if (offlineTimer) {
            clearTimeout(offlineTimer);
            offlineTimer = null;
        }
        if (!offlineCandidateAt) return;
        const now = Date.now();
        const wait = Math.max(0, offlineCandidateAt + offlineDelayMs - now);
        offlineTimer = setTimeout(() => {
            offlineTimer = null;
            update();
        }, wait);
    };

    const update = () => {
        const now = Date.now();
        const offlineByCandidate = offlineCandidateAt
            && (now - offlineCandidateAt >= offlineDelayMs)
            && lastSuccessAt < offlineCandidateAt;
        const offline = !!(offlineByCandidate && verifiedOffline);
        indicator.hidden = !offline;
        if (offline) {
            indicator.textContent = t('common.offline', 'Offline');
            const hint = t('common.offline_hint', 'Offline: saves may fail until you are back online.');
            indicator.title = hint;
            indicator.setAttribute('aria-label', hint);
        } else {
            indicator.title = '';
            indicator.removeAttribute('aria-label');
        }
        if (offlineByCandidate && !verifiedOffline) {
            probeConnectivity();
        }
        if (!offline && offlineCandidateAt) scheduleTimer();
    };

    const markCandidate = () => {
        if (!offlineCandidateAt) {
            offlineCandidateAt = Date.now();
        }
        verifiedOffline = false;
        scheduleTimer();
        update();
    };

    const clearCandidate = () => {
        offlineCandidateAt = 0;
        lastSuccessAt = Date.now();
        failCount = 0;
        firstFailAt = 0;
        verifiedOffline = false;
        if (offlineTimer) {
            clearTimeout(offlineTimer);
            offlineTimer = null;
        }
        update();
    };

    const isNetworkError = (err) => {
        if (!err) return false;
        const name = String(err.name || '');
        const msg = String(err.message || '');
        if (name === 'AbortError') return false;
        if (name === 'TypeError') return true;
        return /NetworkError|Failed to fetch/i.test(msg);
    };

    const noteFailure = (err) => {
        if (!isNetworkError(err)) return;
        const now = Date.now();
        if (!firstFailAt || (now - firstFailAt > FAIL_WINDOW_MS)) {
            firstFailAt = now;
            failCount = 0;
        }
        failCount += 1;
        if (!navigator.onLine) {
            markCandidate();
            return;
        }
        if (failCount >= 3) {
            markCandidate();
        }
    };

    let probeInFlight = false;
    let lastProbeAt = 0;
    const PROBE_COOLDOWN_MS = 30 * 1000;
    const probeConnectivity = async () => {
        const now = Date.now();
        if (probeInFlight) return;
        if (lastProbeAt && (now - lastProbeAt) < PROBE_COOLDOWN_MS) return;
        probeInFlight = true;
        lastProbeAt = now;
        try {
            const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
            if (res) {
                clearCandidate();
                return;
            }
            verifiedOffline = true;
            update();
        } catch {
            verifiedOffline = true;
            update();
        } finally {
            probeInFlight = false;
        }
    };

    window.__mdwSetOffline = (state) => {
        if (state) {
            markCandidate();
        } else {
            clearCandidate();
        }
    };
    window.__mdwMarkOnline = () => {
        clearCandidate();
    };
    window.__mdwReportNetworkError = (err) => {
        noteFailure(err);
    };
    window.__mdwReadOfflineDelay = () => offlineDelayMin;
    window.__mdwWriteOfflineDelay = (value) => {
        offlineDelayMin = writeDelay(value);
        offlineDelayMs = offlineDelayMin * 60 * 1000;
        scheduleTimer();
        update();
        return offlineDelayMin;
    };

    window.addEventListener('online', () => {
        clearCandidate();
    });
    if (navigator.onLine) {
        clearCandidate();
    }
    update();
})();
(function(){
    const normalizeNewlines = (s) => String(s ?? '').replace(/\r\n?/g, '\n');

    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const ta = document.getElementById('editor');
    const ln = document.getElementById('lineNumbers');
    const prev = document.getElementById('preview');
    const status = document.getElementById('liveStatus');
    const btnRevert = document.getElementById('btnRevert');
    const editorForm = document.getElementById('editor-form');
    const deleteForm = document.getElementById('deleteForm');
    const dirtyStar = document.getElementById('dirtyStar');

    if (!ta || !ln || !prev) return;

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const showPreviewError = (message, details) => {
        const msg = message || t('js.preview_failed', 'Preview failed.');
        if (status) status.textContent = msg;
        const detailHtml = details ? `<div class="status-text" style="margin-top:0.35rem;">${escapeHtml(details)}</div>` : '';
        prev.innerHTML = `<div class="status-text" style="padding:0.75rem;">${escapeHtml(msg)}${detailHtml}</div>`;
    };

    const WRAP_MARK = '↩';
    const getTabSize = () => {
        try {
            const v = getComputedStyle(ta).tabSize;
            const n = parseInt(String(v || ''), 10);
            return Number.isFinite(n) && n > 0 ? n : 2;
        } catch {
            return 2;
        }
    };
    const expandTabsLen = (line, tabSize) => {
        if (!line.includes('\t')) return line.length;
        let col = 0;
        for (const ch of line) {
            if (ch === '\t') {
                const next = tabSize - (col % tabSize);
                col += next;
            } else {
                col += 1;
            }
        }
        return col;
    };

    let measureEl = null;
    let measuredFontKey = '';
    let measuredCharWidth = 8;
    const measureCharWidth = () => {
        const cs = getComputedStyle(ta);
        const fontKey = `${cs.fontStyle}|${cs.fontVariant}|${cs.fontWeight}|${cs.fontSize}|${cs.fontFamily}|${cs.letterSpacing}`;
        if (fontKey === measuredFontKey && measuredCharWidth > 0) return measuredCharWidth;

        if (!measureEl) {
            measureEl = document.createElement('span');
            measureEl.style.position = 'absolute';
            measureEl.style.left = '-99999px';
            measureEl.style.top = '-99999px';
            measureEl.style.whiteSpace = 'pre';
            document.body.appendChild(measureEl);
        }
        measureEl.style.fontFamily = cs.fontFamily;
        measureEl.style.fontSize = cs.fontSize;
        measureEl.style.fontWeight = cs.fontWeight;
        measureEl.style.fontStyle = cs.fontStyle;
        measureEl.style.letterSpacing = cs.letterSpacing;
        measureEl.textContent = '00000000000000000000';

        const rect = measureEl.getBoundingClientRect();
        const w = rect.width / 20;
        if (Number.isFinite(w) && w > 0) {
            measuredFontKey = fontKey;
            measuredCharWidth = w;
        }
        return measuredCharWidth;
    };

    const getCols = () => {
        const cs = getComputedStyle(ta);
        const padL = parseFloat(cs.paddingLeft || '0') || 0;
        const padR = parseFloat(cs.paddingRight || '0') || 0;
        const contentW = Math.max(0, ta.clientWidth - padL - padR);
        const cw = measureCharWidth();
        const cols = cw > 0 ? Math.floor(contentW / cw) : 0;
        return Math.max(1, cols);
    };

    const isWrapOn = () => document.documentElement.classList.contains('mdw-wrap-on');
    const isLinesOn = () => !document.documentElement.classList.contains('mdw-lines-off');

    const saveChip = document.getElementById('saveStatusChip');
    const saveErrorPanel = document.getElementById('saveErrorPanel');
    const saveErrorMessage = document.getElementById('saveErrorMessage');
    const saveErrorDetailsWrap = document.getElementById('saveErrorDetailsWrap');
    const saveErrorDetails = document.getElementById('saveErrorDetails');
    let saveChipTimer = null;
    const showSaveChip = () => {
        if (!saveChip) return;
        saveChip.style.display = '';
        if (saveChipTimer) clearTimeout(saveChipTimer);
        saveChipTimer = setTimeout(() => {
            saveChip.style.display = 'none';
        }, 1800);
    };
    const showSaveError = (message, details) => {
        if (saveErrorMessage) saveErrorMessage.textContent = message || t('js.save_failed', 'Save failed.');
        if (saveErrorDetails) saveErrorDetails.textContent = details || '';
        if (saveErrorDetailsWrap) saveErrorDetailsWrap.hidden = !details;
        if (saveErrorPanel) saveErrorPanel.hidden = false;
    };
    const showErrorModal = (message, details) => {
        if (typeof window.__mdwShowErrorModal === 'function') {
            window.__mdwShowErrorModal(message, details);
        }
    };
    const clearSaveError = () => {
        if (saveErrorPanel) saveErrorPanel.hidden = true;
        if (saveErrorMessage) saveErrorMessage.textContent = '';
        if (saveErrorDetails) saveErrorDetails.textContent = '';
        if (saveErrorDetailsWrap) saveErrorDetailsWrap.hidden = true;
    };

    const publishBtn = document.getElementById('publishBtn');
    const publishStateSelect = document.getElementById('publishStateSelect');
    const publishStateOverride = document.getElementById('publishStateOverride');
    const normalizePublishState = (raw) => {
        const s = String(raw || '').trim().toLowerCase();
        if (!s) return '';
        if (s === 'published') return 'Published';
        if (s === 'processing' || s === 'to publish' || s === 'topublish' || s === 'to-publish') return 'Processing';
        return 'Concept';
    };
    const publishStateLabel = (state) => {
        const s = String(state || '').trim().toLowerCase();
        if (s === 'published') return t('edit.publish_state.published', 'Published');
        if (s === 'processing') return t('edit.publish_state.processing', 'Processing');
        return t('edit.publish_state.concept', 'Concept');
    };
    const publishStateClass = (state) => {
        const s = String(state || '').trim().toLowerCase();
        if (s === 'published') return 'publish-published';
        if (s === 'processing') return 'publish-processing';
        return 'publish-concept';
    };
    const updatePublishBadge = (state) => {
        const row = mdm$('.note-item.nav-item-current');
        if (!(row instanceof HTMLElement)) return;
        const badge = row.querySelector('.badge-publish');
        if (!(badge instanceof HTMLElement)) return;
        badge.textContent = publishStateLabel(state);
        badge.classList.remove('publish-concept', 'publish-processing', 'publish-published');
        badge.classList.add(publishStateClass(state));
    };
    const applyPublishStateUi = (stateRaw) => {
        const state = normalizePublishState(stateRaw);
        if (!state) return;
        if (publishStateSelect instanceof HTMLSelectElement) {
            publishStateSelect.value = state;
        }
        const hasFile = !!String(window.CURRENT_FILE || '').trim()
            || !!String((editorForm instanceof HTMLFormElement ? editorForm.querySelector('input[name="file"]') : null)?.value || '').trim();
        if (publishBtn instanceof HTMLButtonElement || publishBtn instanceof HTMLInputElement) {
            publishBtn.disabled = !hasFile || state.toLowerCase() !== 'concept';
        }
        updatePublishBadge(state);
    };
    window.__mdwApplyPublishStateUi = applyPublishStateUi;

    publishStateSelect?.addEventListener('change', () => {
        if (!(publishStateSelect instanceof HTMLSelectElement)) return;
        const state = normalizePublishState(publishStateSelect.value);
        if (!state) return;
        if (publishStateOverride instanceof HTMLInputElement) {
            publishStateOverride.value = '1';
        }
        if (typeof window.__mdwSetMetaValue === 'function') {
            window.__mdwSetMetaValue('publishstate', state);
            if (state === 'Published') {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                window.__mdwSetMetaValue('published_date', `${yyyy}-${mm}-${dd}`);
            }
        }
        applyPublishStateUi(state);
    });

    let ignoreBeforeUnload = false;
    const setIgnoreBeforeUnload = () => { ignoreBeforeUnload = true; };
    const clearIgnoreBeforeUnload = () => { ignoreBeforeUnload = false; };

    editorForm?.addEventListener('submit', setIgnoreBeforeUnload);
    deleteForm?.addEventListener('submit', setIgnoreBeforeUnload);

    const ajaxSave = async () => {
        if (!(editorForm instanceof HTMLFormElement)) return;
        if (!(ta instanceof HTMLTextAreaElement)) return;
        const action = editorForm.getAttribute('action') || window.location.pathname + window.location.search;
        const fd = new FormData(editorForm);
        if (!fd.has('content')) fd.set('content', ta.value);
        if (!fd.has('action')) fd.set('action', 'save');
        const fileVal = String(fd.get('file') || '').trim();
        if (!fileVal) {
            const fromState = String(window.CURRENT_FILE || '').trim();
            if (fromState) {
                fd.set('file', fromState);
            } else {
                const qsFile = new URLSearchParams(window.location.search).get('file');
                if (qsFile) fd.set('file', qsFile);
            }
        }

        if (status) status.textContent = t('js.save_saving', 'Saving…');
        clearSaveError();
        try {
            if (!mdmApi || typeof mdmApi.form !== 'function') {
                throw new Error('network');
            }
            let data = null;
            try {
                data = await mdmApi.form(action, fd, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            } catch (err) {
                data = err && typeof err === 'object' ? err.data : null;
                if (!data || typeof data !== 'object') throw err;
            }
            if (!data || data.ok !== true) {
                const msg = (data && data.error) ? String(data.error) : t('js.save_failed', 'Save failed.');
                const details = (data && data.details) ? String(data.details) : '';
                if (status) status.textContent = msg;
                showSaveError(msg, details);
                showErrorModal(msg, details);
                clearIgnoreBeforeUnload();
                return;
            }
            if (typeof window.__mdwMarkOnline === 'function') {
                window.__mdwMarkOnline();
            }
            if (typeof window.__mdwResetMetaStore === 'function') {
                window.__mdwResetMetaStore();
            } else if (typeof window.__mdwApplyMetaVisibility === 'function') {
                window.__mdwApplyMetaVisibility();
            }
            if (data && typeof data === 'object' && data.publish_state) {
                if (typeof window.__mdwSetMetaValue === 'function') {
                    window.__mdwSetMetaValue('publishstate', data.publish_state);
                }
            }
            if (typeof window.__mdwResetDirty === 'function') {
                window.__mdwResetDirty();
            }
            if (data && typeof data === 'object' && data.publish_state) {
                applyPublishStateUi(data.publish_state);
            }
            if (publishStateOverride instanceof HTMLInputElement) {
                publishStateOverride.value = '0';
            }
            if (status) status.textContent = t('common.saved', 'Saved');
            showSaveChip();
            clearSaveError();
        } catch (err) {
            if (typeof window.__mdwReportNetworkError === 'function') {
                window.__mdwReportNetworkError(err);
            }
            if (status) status.textContent = t('js.save_failed', 'Save failed.');
            const detail = err && err.message ? String(err.message) : '';
            showSaveError(t('js.save_failed', 'Save failed.'), detail);
            showErrorModal(t('js.save_failed', 'Save failed.'), detail);
        } finally {
            clearIgnoreBeforeUnload();
        }
    };

    editorForm?.addEventListener('submit', (e) => {
        if (!(editorForm instanceof HTMLFormElement)) return;
        const submitter = e.submitter;
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const isPublish = (
            (submitter instanceof HTMLElement && submitter.getAttribute('name') === 'publish_action') ||
            (active && active.getAttribute('name') === 'publish_action')
        );
        if (isPublish) return;
        e.preventDefault();
        ajaxSave();
    });

    function setDirty(isDirty) {
        window.__mdDirty = !!isDirty;
        if (dirtyStar) dirtyStar.style.display = isDirty ? '' : 'none';
        const currentNavItem = document.querySelector('.nav-item-current');
        if (currentNavItem) currentNavItem.classList.toggle('dirty', isDirty);
        document.title = isDirty
            ? document.title.replace(/\s*\*$/, '') + ' *'
            : document.title.replace(/\s*\*$/, '');
    }

    function normalizeForDirty(value) {
        let next = normalizeNewlines(value);
        if (typeof window.__mdwStripHiddenMetaForDirty === 'function') {
            try { next = window.__mdwStripHiddenMetaForDirty(next); } catch {}
        }
        return normalizeNewlines(next);
    }

    function recomputeDirty() {
        if (!window.CURRENT_FILE) return;
        setDirty(
            normalizeForDirty(ta.value) !== normalizeForDirty(window.initialContent || '')
        );
    }

    window.__mdwResetDirty = () => {
        window.initialContent = normalizeNewlines(ta.value);
        setDirty(false);
    };

    window.addEventListener('beforeunload', (e) => {
        if (ignoreBeforeUnload) return;
        if (!window.__mdDirty) return;
        e.preventDefault();
        e.returnValue = '';
    });

    function updateLineNumbers() {
        if (!isLinesOn()) {
            ln.textContent = '';
            return;
        }

        const rawLines = ta.value.split('\n');
        const wrap = isWrapOn();
        const tabSize = getTabSize();
        const cols = wrap ? getCols() : 0;

        let out = '';
        for (let i = 0; i < rawLines.length; i++) {
            out += (i + 1) + '\n';
            if (!wrap) continue;

            const len = expandTabsLen(rawLines[i], tabSize);
            const rows = Math.max(1, Math.ceil(Math.max(0, len) / cols));
            for (let r = 1; r < rows; r++) {
                out += WRAP_MARK + '\n';
            }
        }
        ln.textContent = out;
    }

    let previewTimer = null;
    function schedulePreview() {
        if (!window.CURRENT_FILE) return;
        clearTimeout(previewTimer);
        previewTimer = setTimeout(sendPreview, 350);
        if (status) status.textContent = t('js.preview_updating', 'Updating preview…');
    }

    const applyTocHotKeyword = (previewEl, rawText) => {
        if (!(previewEl instanceof HTMLElement)) return;
        const text = String(rawText || '');
        if (!/(^|\\n)\\s*\\{TOC\\}\\s*(\\n|$)/i.test(text)) return;
        if (previewEl.querySelector('[data-mdw-toc="1"]')) return;

        const placeholder = (() => {
            const walker = document.createTreeWalker(previewEl, NodeFilter.SHOW_ELEMENT, {
                acceptNode(node) {
                    if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
                    if (node.closest('pre, code')) return NodeFilter.FILTER_SKIP;
                    const txt = (node.textContent || '').trim();
                    if (txt === '{TOC}') return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_SKIP;
                }
            });
            return walker.nextNode();
        })();
        if (!placeholder) return;

        const isAfter = (el, ref) => {
            const pos = ref.compareDocumentPosition(el);
            return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        };

        const headings = Array.from(previewEl.querySelectorAll('h3'))
            .filter((el) => !(el.closest('pre, code')))
            .filter((el) => isAfter(el, placeholder));
        if (!headings.length) {
            placeholder.remove();
            return;
        }

        const used = new Set();
        let nextId = 1;
        const items = headings.map((el) => {
            let id = String(el.getAttribute('id') || '').trim();
            if (id.startsWith('#')) id = id.slice(1);
            if (!id || used.has(id)) {
                while (used.has(String(nextId))) nextId++;
                id = String(nextId);
                el.setAttribute('id', id);
                nextId += 1;
            }
            used.add(id);
            return { id, label: (el.textContent || '').trim() };
        });

        const wrap = document.createElement('div');
        wrap.className = 'md-toc-wrap';
        wrap.dataset.mdwToc = '1';

        wrap.appendChild(document.createComment(' Table of contents '));
        const list = document.createElement('ul');
        list.className = 'md-list md-toc';
        items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'md-li md-toc-item';
            const a = document.createElement('a');
            a.href = `#${item.id}`;
            a.textContent = item.label || item.id;
            li.appendChild(a);
            list.appendChild(li);
        });
        wrap.appendChild(list);

        placeholder.replaceWith(wrap);
    };
    window.__mdwApplyTocHotKeyword = applyTocHotKeyword;

    const initTocSideMenus = (root = document) => {
        const base = (root instanceof Element || root instanceof Document) ? root : document;
        const layouts = Array.from(base.querySelectorAll('.md-toc-layout'));
        if (base instanceof Element && base.classList.contains('md-toc-layout')) {
            layouts.unshift(base);
        }
        const getHrefId = (link) => {
            if (!(link instanceof HTMLAnchorElement)) return '';
            const href = String(link.getAttribute('href') || '');
            return href.startsWith('#') ? href.slice(1) : '';
        };
        layouts.forEach((layout) => {
            const menu = layout.querySelector('.md-toc-side');
            if (!(menu instanceof HTMLElement)) return;
            const links = Array.from(menu.querySelectorAll('a[href^="#"]'))
                .filter((link) => link instanceof HTMLAnchorElement);
            if (!links.length) return;
            const idToLink = new Map();
            links.forEach((link) => {
                const id = getHrefId(link);
                if (id) idToLink.set(id, link);
            });
            const headings = Array.from(layout.querySelectorAll('h3[id]'))
                .filter((heading) => heading instanceof HTMLElement && idToLink.has(heading.id));
            if (!headings.length) return;

            if (layout.__mdwTocObserver) {
                try { layout.__mdwTocObserver.disconnect(); } catch {}
                layout.__mdwTocObserver = null;
            }

            const setActive = (id) => {
                if (!id) return;
                if (layout.dataset.mdwTocActive === id) return;
                layout.dataset.mdwTocActive = id;
                links.forEach((link) => {
                    const linkId = getHrefId(link);
                    link.classList.toggle('is-active', linkId === id);
                });
            };

            const rootEl = layout.closest('.pane-body');
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const target = entry.target;
                    if (!(target instanceof HTMLElement)) return;
                    setActive(target.id);
                });
            }, {
                root: rootEl instanceof HTMLElement ? rootEl : null,
                rootMargin: '-45% 0px -45% 0px',
                threshold: 0,
            });

            headings.forEach((heading) => observer.observe(heading));
            layout.__mdwTocObserver = observer;

            const center = (() => {
                if (rootEl instanceof HTMLElement) {
                    const rect = rootEl.getBoundingClientRect();
                    return rect.top + (rootEl.clientHeight / 2);
                }
                return window.innerHeight / 2;
            })();

            let closestId = '';
            let closestDist = Number.POSITIVE_INFINITY;
            headings.forEach((heading) => {
                const rect = heading.getBoundingClientRect();
                const dist = Math.abs(rect.top - center);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestId = heading.id;
                }
            });
            if (closestId) setActive(closestId);
        });
    };
    window.__mdwInitTocSideMenus = initTocSideMenus;
    if (document.readyState === 'complete') {
        initTocSideMenus();
    } else {
        window.addEventListener('load', () => initTocSideMenus(), { once: true });
    }

    async function sendPreview() {
        try {
            if (!mdmApi || typeof mdmApi.form !== 'function') {
                throw new Error('network');
            }
            const fd = new FormData();
            fd.set('content', ta.value);
            const html = await mdmApi.form('edit.php?file=' + encodeURIComponent(window.CURRENT_FILE) + '&preview=1', fd);
            if (typeof window.__mdwMarkOnline === 'function') {
                window.__mdwMarkOnline();
            }
            prev.innerHTML = html;
            applyTocHotKeyword(prev, ta.value);
            if (typeof window.__mdwInitTocSideMenus === 'function') {
                window.__mdwInitTocSideMenus(prev);
            }
            if (window.MathJax?.typesetPromise) {
                window.MathJax.typesetPromise([prev]).catch((err) => {
                    if (status) status.textContent = t('js.preview_render_errors', 'Preview updated with render errors.');
                    console.warn('MathJax render failed', err);
                });
            }
            if (typeof window.__mdwRenderMermaid === 'function') {
                window.__mdwRenderMermaid(prev).catch((err) => {
                    if (status) status.textContent = t('js.preview_render_errors', 'Preview updated with render errors.');
                    console.warn('Mermaid render failed', err);
                });
            }
            if (typeof window.__mdwInitCodeCopyButtons === 'function') {
                window.__mdwInitCodeCopyButtons();
            }
            if (status) status.textContent = t('js.preview_up_to_date', 'Preview up to date');
        } catch (err) {
            const detail = err && err.message ? String(err.message) : '';
            if (typeof window.__mdwReportNetworkError === 'function') {
                window.__mdwReportNetworkError(err);
            }
            showPreviewError(t('js.preview_failed', 'Preview failed.'), detail);
        }
    }

    ta.addEventListener('input', function(){
        updateLineNumbers();
        recomputeDirty();
        schedulePreview();
    });
    ta.addEventListener('scroll', function(){
        ln.scrollTop = ta.scrollTop;
    });

    // Recompute wraps when panes are resized (affects visual line wrapping).
    let resizeTicking = false;
    const onResize = () => {
        if (resizeTicking) return;
        resizeTicking = true;
        requestAnimationFrame(() => {
            resizeTicking = false;
            updateLineNumbers();
            ln.scrollTop = ta.scrollTop;
        });
    };
    try {
        const ro = new ResizeObserver(onResize);
        ro.observe(ta);
    } catch {
        window.addEventListener('resize', onResize, { passive: true });
    }

    document.getElementById('wrapToggle')?.addEventListener('click', () => setTimeout(onResize, 0));
    document.getElementById('lineNumbersToggle')?.addEventListener('click', () => setTimeout(onResize, 0));

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

// Editor: Markdown keyboard shortcuts (edit.php)
(function(){
    const ta = document.getElementById('editor');
    if (!(ta instanceof HTMLTextAreaElement)) return;
    const editorForm = document.getElementById('editor-form');
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const wrapToggle = document.getElementById('wrapToggle');
    const lineNumbersToggle = document.getElementById('lineNumbersToggle');
    const WRAP_KEY = 'mdw_editor_wrap';
    const LINES_KEY = 'mdw_editor_lines';

    const MAX_UNDO_STEPS = 25;
    const MAX_SNAPSHOTS = MAX_UNDO_STEPS + 1;
    const undoStack = [];
    const redoStack = [];
    let isRestoring = false;
    let lastRecordAt = 0;

    const getShortcutMod = () => {
        try {
            const fn = window.__mdwReadShortcutMod;
            const v = (typeof fn === 'function') ? fn() : null;
            return (v === 'command' || v === 'option') ? v : 'option';
        } catch {
            return 'option';
        }
    };
    const isModKey = (e) => {
        if (!e.ctrlKey) return false;
        const mod = getShortcutMod();
        if (mod === 'command') return e.metaKey && !e.altKey;
        return e.altKey && !e.metaKey;
    };

    const supportsUnicodeProps = (() => {
        try { new RegExp('\\p{L}', 'u'); return true; } catch { return false; }
    })();
    const wordCharRe = supportsUnicodeProps ? /[\p{L}\p{N}_]/u : /[A-Za-z0-9_]/;
    const isWordChar = (ch) => !!ch && wordCharRe.test(ch);

    const dispatchInput = () => {
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const isWrapOn = () => document.documentElement.classList.contains('mdw-wrap-on');
    const isLinesOn = () => !document.documentElement.classList.contains('mdw-lines-off');
    const applyWrapUi = () => {
        if (!(wrapToggle instanceof HTMLButtonElement)) return;
        const on = isWrapOn();
        wrapToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    const applyLinesUi = () => {
        if (!(lineNumbersToggle instanceof HTMLButtonElement)) return;
        const on = isLinesOn();
        lineNumbersToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    };

    applyWrapUi();
    applyLinesUi();
    wrapToggle?.addEventListener('click', () => {
        const on = !isWrapOn();
        document.documentElement.classList.toggle('mdw-wrap-on', on);
        try { mdwStorageSet(WRAP_KEY, on ? '1' : '0'); } catch {}
        applyWrapUi();
        ta.focus();
    });
    lineNumbersToggle?.addEventListener('click', () => {
        const on = !isLinesOn();
        document.documentElement.classList.toggle('mdw-lines-off', !on);
        try { mdwStorageSet(LINES_KEY, on ? '1' : '0'); } catch {}
        applyLinesUi();
        ta.focus();
    });

    const snapshot = () => ({
        value: ta.value,
        start: ta.selectionStart ?? 0,
        end: ta.selectionEnd ?? 0,
        scrollTop: ta.scrollTop ?? 0,
    });

    const sameSnapshot = (a, b) =>
        !!a && !!b && a.value === b.value && a.start === b.start && a.end === b.end;

    const pushUndoSnapshot = (snap, { merge } = {}) => {
        const prev = undoStack[undoStack.length - 1];
        if (sameSnapshot(prev, snap)) return;

        if (merge && prev) {
            undoStack[undoStack.length - 1] = snap;
        } else {
            undoStack.push(snap);
            if (undoStack.length > MAX_SNAPSHOTS) undoStack.shift();
        }
    };

    const applySnapshot = (snap) => {
        if (!snap) return;
        isRestoring = true;
        try {
            ta.value = snap.value;
            ta.scrollTop = snap.scrollTop ?? ta.scrollTop;
            setSelection(snap.start ?? 0, snap.end ?? 0);
            dispatchInput();
        } finally {
            isRestoring = false;
        }
    };

    // Seed initial state so shortcuts + programmatic edits are undoable.
    pushUndoSnapshot(snapshot(), { merge: false });

    ta.addEventListener('input', (e) => {
        if (isRestoring) return;

        const now = Date.now();
        const inputType = (e instanceof InputEvent) ? String(e.inputType || '') : '';
        const mergeTyping = (now - lastRecordAt) < 1000 && (
            inputType === 'insertText' ||
            inputType === 'insertCompositionText' ||
            inputType === 'deleteContentBackward' ||
            inputType === 'deleteContentForward'
        );

        pushUndoSnapshot(snapshot(), { merge: mergeTyping });
        lastRecordAt = now;
        redoStack.length = 0;
    });

    ta.addEventListener('keydown', (e) => {
        // Custom undo/redo so our formatting shortcuts are always undoable.
        const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
        if (!mod) return;

        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (e.shiftKey) {
                const next = redoStack.pop();
                if (!next) return;
                pushUndoSnapshot(next, { merge: false });
                applySnapshot(next);
                return;
            }

            if (undoStack.length <= 1) return;
            const current = undoStack.pop();
            if (current) redoStack.push(current);
            const prev = undoStack[undoStack.length - 1];
            applySnapshot(prev);
            return;
        }

        // Also support Ctrl+Y as redo (common on Windows/Linux).
        if (!e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            const next = redoStack.pop();
            if (!next) return;
            pushUndoSnapshot(next, { merge: false });
            applySnapshot(next);
        }
    });

    const getSelection = () => {
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        return { start, end, text: ta.value.slice(start, end) };
    };

    const setSelection = (start, end) => {
        ta.setSelectionRange(Math.max(0, start), Math.max(0, end));
    };

    const replaceRange = (start, end, replacement) => {
        const scrollTop = ta.scrollTop;
        ta.setRangeText(replacement, start, end, 'preserve');
        ta.scrollTop = scrollTop;
        dispatchInput();
    };

    let lastFormatAction = null;
    const runFormatAction = (fn) => {
        if (typeof fn !== 'function') return;
        lastFormatAction = fn;
        fn();
    };

    const parseHtmlTabToken = (token) => {
        const m = String(token || '').match(/^([A-Za-z][A-Za-z0-9_-]*)(.*)$/);
        if (!m) return null;
        const tag = m[1];
        let rest = m[2] || '';
        let id = '';
        const classes = [];
        while (rest) {
            const prefix = rest[0];
            if (prefix !== '.' && prefix !== '#') return null;
            rest = rest.slice(1);
            const nameMatch = rest.match(/^([A-Za-z0-9_-]+)(.*)$/);
            if (!nameMatch) return null;
            const name = nameMatch[1];
            rest = nameMatch[2] || '';
            if (prefix === '#') {
                if (id) return null;
                id = name;
            } else {
                classes.push(name);
            }
        }
        return { tag, id, classes };
    };

    const findHtmlTabToken = () => {
        const pos = ta.selectionStart ?? 0;
        const value = ta.value;
        const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
        const before = value.slice(lineStart, pos);
        if (!before) return null;
        const m = before.match(/([A-Za-z][A-Za-z0-9_-]*(?:[.#][A-Za-z0-9_-]+)*)$/);
        if (!m) return null;
        const token = m[1];
        const start = pos - token.length;
        const prev = start > 0 ? value[start - 1] : '';
        if (prev && !/[\s>({\[]/.test(prev)) return null;
        return { token, start, end: pos };
    };

    const buildHtmlSnippet = (info) => {
        if (!info || !info.tag) return null;
        const attrs = [];
        if (info.id) attrs.push(`id="${info.id}"`);
        if (Array.isArray(info.classes) && info.classes.length) {
            attrs.push(`class="${info.classes.join(' ')}"`);
        }
        const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
        const open = `<${info.tag}${attrText}>`;
        const close = `</${info.tag}>`;
        return { text: open + close, caretOffset: open.length };
    };

    const wrapOrUnwrap = (left, right, { singleCharSafe } = {}) => {
        const { start, end, text } = getSelection();
        const v = ta.value;

        const leftLen = left.length;
        const rightLen = right.length;

        const selectionStartsWith = text.startsWith(left) && text.endsWith(right) && text.length >= leftLen + rightLen;
        if (selectionStartsWith) {
            const inner = text.slice(leftLen, text.length - rightLen);
            replaceRange(start, end, inner);
            setSelection(start, start + inner.length);
            return;
        }

        const before = v.slice(Math.max(0, start - leftLen), start);
        const after = v.slice(end, Math.min(v.length, end + rightLen));

        let hasAround = before === left && after === right;
        if (hasAround && singleCharSafe) {
            hasAround = singleCharSafe({ value: v, start, end, left, right });
        }

        if (hasAround) {
            const beforeStart = start - leftLen;
            const afterEnd = end + rightLen;
            replaceRange(beforeStart, afterEnd, text);
            setSelection(beforeStart, beforeStart + text.length);
            return;
        }

        const wrapped = left + text + right;
        replaceRange(start, end, wrapped);
        if (start === end) {
            const caret = start + leftLen;
            setSelection(caret, caret);
        } else {
            setSelection(start + leftLen, end + leftLen);
        }
    };

    const selectWordAtCaret = () => {
        const pos = ta.selectionStart ?? 0;
        const v = ta.value;
        let start = pos;
        let end = pos;
        while (start > 0 && isWordChar(v[start - 1])) start--;
        while (end < v.length && isWordChar(v[end])) end++;
        if (start === end) return null;
        return { start, end, text: v.slice(start, end) };
    };

    const transformSelectionOrWord = (fn) => {
        const { start, end, text } = getSelection();
        if (end > start) {
            const next = fn(text);
            replaceRange(start, end, next);
            setSelection(start, start + next.length);
            return;
        }
        const w = selectWordAtCaret();
        if (!w) return;
        const next = fn(w.text);
        replaceRange(w.start, w.end, next);
        setSelection(w.start, w.start + next.length);
    };

    const adjustHeadingLevel = (delta) => {
        const value = ta.value;
        const selStart = ta.selectionStart ?? 0;
        const selEnd = ta.selectionEnd ?? 0;

        const blockStart = value.lastIndexOf('\n', selStart - 1) + 1;
        let blockEnd = value.indexOf('\n', selEnd);
        if (blockEnd === -1) blockEnd = value.length;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split('\n');

        let offset = 0;
        const deltas = [];
        const newLines = lines.map((line) => {
            const absStart = blockStart + offset;
            offset += line.length + 1;

            const m = line.match(/^(\s*)(#{1,6})\s*(.*)$/);
            if (!m) {
                if (delta > 0) {
                    const out = '# ' + line;
                    deltas.push({ absStart, delta: out.length - line.length });
                    return out;
                }
                deltas.push({ absStart, delta: 0 });
                return line;
            }

            const indent = m[1] || '';
            const hashes = m[2] || '';
            const rest = m[3] || '';
            const level = hashes.length;
            const nextLevel = Math.max(0, Math.min(6, level + delta));

            if (nextLevel <= 0) {
                const out = indent + rest.replace(/^\s+/, '');
                deltas.push({ absStart, delta: out.length - line.length });
                return out;
            }

            const out = indent + '#'.repeat(nextLevel) + (rest !== '' ? ' ' : '') + rest.replace(/^\s+/, '');
            deltas.push({ absStart, delta: out.length - line.length });
            return out;
        });

        const replacement = newLines.join('\n');
        replaceRange(blockStart, blockEnd, replacement);

        const shiftPos = (pos) => {
            let out = pos;
            for (const d of deltas) {
                if (pos > d.absStart) out += d.delta;
            }
            return out;
        };

        setSelection(shiftPos(selStart), shiftPos(selEnd));
    };

    const setHeadingLevel = (targetLevel) => {
        const level = Math.max(1, Math.min(6, Number(targetLevel) || 1));
        const value = ta.value;
        const selStart = ta.selectionStart ?? 0;
        const selEnd = ta.selectionEnd ?? 0;

        const blockStart = value.lastIndexOf('\n', selStart - 1) + 1;
        let blockEnd = value.indexOf('\n', selEnd);
        if (blockEnd === -1) blockEnd = value.length;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split('\n');

        let offset = 0;
        const deltas = [];
        const newLines = lines.map((line) => {
            const absStart = blockStart + offset;
            offset += line.length + 1;

            const m = line.match(/^(\s*)(#{1,6})\s*(.*)$/);
            const indent = m ? (m[1] || '') : (line.match(/^(\s*)/)?.[1] || '');
            const restRaw = m ? (m[3] || '') : line.slice(indent.length);
            const rest = restRaw.replace(/^\s+/, '');
            const out = indent + '#'.repeat(level) + ' ' + rest;
            deltas.push({ absStart, delta: out.length - line.length });
            return out;
        });

        const replacement = newLines.join('\n');
        replaceRange(blockStart, blockEnd, replacement);

        const shiftPos = (pos) => {
            let out = pos;
            for (const d of deltas) {
                if (pos > d.absStart) out += d.delta;
            }
            return out;
        };

        setSelection(shiftPos(selStart), shiftPos(selEnd));
    };

    const toggleLinePrefix = (kind) => {
        const value = ta.value;
        const selStart = ta.selectionStart ?? 0;
        const selEnd = ta.selectionEnd ?? 0;

        const blockStart = value.lastIndexOf('\n', selStart - 1) + 1;
        let blockEnd = value.indexOf('\n', selEnd);
        if (blockEnd === -1) blockEnd = value.length;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split('\n');

        const getIndent = (line) => line.match(/^(\s*)/)?.[1] || '';
        const hasPrefix = (line) => {
            const indent = getIndent(line);
            const rest = line.slice(indent.length);
            if (kind === 'quote') return rest.startsWith('>') && (rest.length === 1 || rest[1] === ' ' || rest[1] === '\t');
            return rest.startsWith('-') && (rest.length === 1 || rest[1] === ' ' || rest[1] === '\t');
        };

        const shouldRemove = lines.every((line) => line.trim() === '' || hasPrefix(line));

        let offset = 0;
        const deltas = [];
        const newLines = lines.map((line) => {
            const absStart = blockStart + offset;
            offset += line.length + 1;

            if (line.trim() === '') {
                deltas.push({ absStart, delta: 0 });
                return line;
            }

            const indent = getIndent(line);
            const rest = line.slice(indent.length);
            if (shouldRemove) {
                if (kind === 'quote') {
                    const out = indent + rest.replace(/^>\s?/, '');
                    deltas.push({ absStart, delta: out.length - line.length });
                    return out;
                }
                const out = indent + rest.replace(/^-+\s?/, '').replace(/^\s+/, '');
                deltas.push({ absStart, delta: out.length - line.length });
                return out;
            }

            const prefix = kind === 'quote' ? '> ' : '- ';
            const out = indent + prefix + rest;
            deltas.push({ absStart, delta: out.length - line.length });
            return out;
        });

        const replacement = newLines.join('\n');
        replaceRange(blockStart, blockEnd, replacement);

        const shiftPos = (pos) => {
            let out = pos;
            for (const d of deltas) {
                if (pos > d.absStart) out += d.delta;
            }
            return out;
        };

        setSelection(shiftPos(selStart), shiftPos(selEnd));
    };

    const toggleOrderedList = () => {
        const value = ta.value;
        const selStart = ta.selectionStart ?? 0;
        const selEnd = ta.selectionEnd ?? 0;

        const blockStart = value.lastIndexOf('\n', selStart - 1) + 1;
        let blockEnd = value.indexOf('\n', selEnd);
        if (blockEnd === -1) blockEnd = value.length;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split('\n');

        const getIndent = (line) => line.match(/^(\s*)/)?.[1] || '';
        const hasPrefix = (line) => {
            const indent = getIndent(line);
            const rest = line.slice(indent.length);
            return /^\d+\.\s+/.test(rest);
        };

        const shouldRemove = lines.every((line) => line.trim() === '' || hasPrefix(line));

        let offset = 0;
        let count = 1;
        const deltas = [];
        const newLines = lines.map((line) => {
            const absStart = blockStart + offset;
            offset += line.length + 1;

            if (line.trim() === '') {
                deltas.push({ absStart, delta: 0 });
                return line;
            }

            const indent = getIndent(line);
            const rest = line.slice(indent.length);

            if (shouldRemove) {
                const out = indent + rest.replace(/^\d+\.\s+/, '');
                deltas.push({ absStart, delta: out.length - line.length });
                return out;
            }

            const cleaned = rest.replace(/^\d+\.\s+/, '').replace(/^\s+/, '');
            const out = indent + count + '. ' + cleaned;
            count += 1;
            deltas.push({ absStart, delta: out.length - line.length });
            return out;
        });

        const replacement = newLines.join('\n');
        replaceRange(blockStart, blockEnd, replacement);

        const shiftPos = (pos) => {
            let out = pos;
            for (const d of deltas) {
                if (pos > d.absStart) out += d.delta;
            }
            return out;
        };

        setSelection(shiftPos(selStart), shiftPos(selEnd));
    };

    const isAttrListLine = (line) => /^\s*\{\s*:\s*[^}]*\}\s*$/.test(line);
    const updateAttrLineClass = (line, updateClasses) => {
        const m = line.match(/^\s*\{\s*:\s*([^}]*)\}\s*$/);
        if (!m) return null;
        let body = (m[1] || '').trim();
        const clsMatch = body.match(/\bclass\s*=\s*(\"([^\"]*)\"|'([^']*)'|([^\s\"']+))/i);
        let classes = [];
        if (clsMatch) {
            classes = String(clsMatch[2] || clsMatch[3] || clsMatch[4] || '')
                .split(/\s+/)
                .filter(Boolean);
        }
        classes = Array.isArray(updateClasses) ? updateClasses : updateClasses(classes);
        classes = Array.from(new Set(classes.filter(Boolean)));

        if (clsMatch) {
            if (classes.length) {
                const replacement = `class="${classes.join(' ')}"`;
                body = body.replace(clsMatch[0], replacement).trim();
            } else {
                body = body.replace(clsMatch[0], '').trim();
            }
        } else if (classes.length) {
            body = body ? `${body} class="${classes.join(' ')}"` : `class="${classes.join(' ')}"`;
        }

        body = body.trim();
        if (!body) return '';
        return `{: ${body} }`;
    };

    const applyAlignment = (align) => {
        const value = ta.value;
        const selStart = ta.selectionStart ?? 0;
        const selEnd = ta.selectionEnd ?? 0;
        const alignClass = (align === 'center' || align === 'right') ? align : 'left';

        const blockStart = value.lastIndexOf('\n', selStart - 1) + 1;
        let blockEnd = value.indexOf('\n', selEnd);
        if (blockEnd === -1) blockEnd = value.length;

        const nextLineStart = blockEnd < value.length ? blockEnd + 1 : value.length;
        let nextLineEnd = nextLineStart < value.length ? value.indexOf('\n', nextLineStart) : -1;
        if (nextLineEnd === -1) nextLineEnd = value.length;
        const nextLine = nextLineStart < value.length ? value.slice(nextLineStart, nextLineEnd) : '';

        const updateClasses = (classes) => {
            const strip = new Set(['left', 'center', 'right', 'align-left', 'align-center', 'align-right']);
            const next = classes.filter((cls) => !strip.has(cls));
            if (alignClass !== 'left') next.push(alignClass);
            return next;
        };

        if (nextLine && isAttrListLine(nextLine)) {
            const updated = updateAttrLineClass(nextLine, updateClasses);
            if (updated === '') {
                const removeEnd = nextLineEnd < value.length ? nextLineEnd + 1 : nextLineEnd;
                replaceRange(nextLineStart, removeEnd, '');
            } else if (updated && updated !== nextLine) {
                replaceRange(nextLineStart, nextLineEnd, updated);
            }
            setSelection(selStart, selEnd);
            return;
        }

        if (alignClass !== 'left') {
            const insert = `\n{: class="${alignClass}" }`;
            replaceRange(blockEnd, blockEnd, insert);
            setSelection(selStart, selEnd);
        }
    };

    const insertTable = () => {
        const { start, end } = getSelection();
        const block = [
            '|   |   |',
            '| --- | --- |',
            '|   |   |',
            '|   |   |'
        ].join('\n');
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        const needsPrefix = before && !before.endsWith('\n');
        const needsSuffix = after && !after.startsWith('\n');
        const insert = `${needsPrefix ? '\n' : ''}${block}${needsSuffix ? '\n' : ''}`;
        replaceRange(start, end, insert);
        const caret = start + (needsPrefix ? 1 : 0) + 2;
        setSelection(caret, caret);
    };

    const CUSTOM_CSS_CURSOR = '__MDW_CUSTOM_CSS_CURSOR__';
    let customCssSnippetMap = new Map();
    let lastCustomCssValue = null;

    const readCustomCssSetting = () => {
        const fn = window.__mdwReadCustomCssSetting;
        if (typeof fn === 'function') {
            return String(fn() || '').trim();
        }
        return '';
    };

    const splitSelectorList = (value) => {
        const out = [];
        let buf = '';
        let depth = 0;
        let bracket = 0;
        let quote = '';
        for (let i = 0; i < value.length; i++) {
            const ch = value[i];
            if (quote) {
                buf += ch;
                if (ch === quote && value[i - 1] !== '\\') quote = '';
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch;
                buf += ch;
                continue;
            }
            if (ch === '(') {
                depth += 1;
                buf += ch;
                continue;
            }
            if (ch === ')') {
                depth = Math.max(0, depth - 1);
                buf += ch;
                continue;
            }
            if (ch === '[') {
                bracket += 1;
                buf += ch;
                continue;
            }
            if (ch === ']') {
                bracket = Math.max(0, bracket - 1);
                buf += ch;
                continue;
            }
            if (ch === ',' && depth === 0 && bracket === 0) {
                const trimmed = buf.trim();
                if (trimmed) out.push(trimmed);
                buf = '';
                continue;
            }
            buf += ch;
        }
        const trimmed = buf.trim();
        if (trimmed) out.push(trimmed);
        return out;
    };

    const isIdentChar = (ch) => /[A-Za-z0-9_-]/.test(ch);

    const readIdent = (value, start) => {
        const len = value.length;
        let i = start;
        if (i >= len) return { name: '', end: i };
        if (value[i] === '*') return { name: '*', end: i + 1 };
        while (i < len && isIdentChar(value[i])) i++;
        return { name: value.slice(start, i), end: i };
    };

    const skipPseudo = (value, start) => {
        const len = value.length;
        let i = start;
        if (value[i] !== ':') return i;
        i += 1;
        if (value[i] === ':') i += 1;
        while (i < len && isIdentChar(value[i])) i++;
        if (value[i] === '(') {
            let depth = 0;
            while (i < len) {
                const ch = value[i];
                if (ch === '(') depth += 1;
                if (ch === ')') {
                    depth -= 1;
                    if (depth === 0) {
                        i += 1;
                        break;
                    }
                }
                i += 1;
            }
        }
        return i;
    };

    const readAttr = (value, start) => {
        const len = value.length;
        let i = start + 1;
        let quote = '';
        while (i < len) {
            const ch = value[i];
            if (quote) {
                if (ch === quote) quote = '';
                i += 1;
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch;
                i += 1;
                continue;
            }
            if (ch === ']') break;
            i += 1;
        }
        const raw = value.slice(start + 1, i).trim();
        let name = '';
        let attrValue = null;
        if (raw) {
            const match = raw.match(/^([^\s~|^$*=\]]+)\s*(?:([~|^$*]?=)\s*(.+))?$/);
            if (match) {
                name = match[1] || '';
                if (match[2]) {
                    let v = String(match[3] || '').trim();
                    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                        v = v.slice(1, -1);
                    }
                    attrValue = v;
                }
            }
        }
        const attr = name ? { name, value: attrValue } : null;
        const end = i < len ? i + 1 : len;
        return { attr, end };
    };

    const parseSelectorParts = (selector) => {
        const parts = [];
        const makePart = () => ({ tag: '', id: '', classes: [], attrs: [] });
        let current = makePart();
        const pushCurrent = () => {
            if (current.tag || current.id || current.classes.length || current.attrs.length) {
                parts.push(current);
            }
            current = makePart();
        };
        let i = 0;
        const len = selector.length;
        while (i < len) {
            const ch = selector[i];
            if (/\s/.test(ch)) {
                while (i < len && /\s/.test(selector[i])) i++;
                pushCurrent();
                continue;
            }
            if (ch === '>' || ch === '+' || ch === '~') {
                i += 1;
                pushCurrent();
                continue;
            }
            if (ch === ',') {
                i += 1;
                pushCurrent();
                continue;
            }
            if (ch === ':') {
                i = skipPseudo(selector, i);
                continue;
            }
            if (ch === '[') {
                const res = readAttr(selector, i);
                if (res.attr) current.attrs.push(res.attr);
                i = res.end;
                continue;
            }
            if (ch === '.') {
                const res = readIdent(selector, i + 1);
                if (res.name) current.classes.push(res.name);
                i = res.end;
                continue;
            }
            if (ch === '#') {
                const res = readIdent(selector, i + 1);
                if (res.name && !current.id) current.id = res.name;
                i = res.end;
                continue;
            }
            if (ch === '*') {
                const res = readIdent(selector, i);
                i = res.end;
                continue;
            }
            if (!current.tag) {
                const res = readIdent(selector, i);
                if (res.name) {
                    current.tag = res.name.toLowerCase();
                    i = res.end;
                    continue;
                }
            }
            i += 1;
        }
        pushCurrent();
        return parts;
    };

    const cleanupSelectorParts = (parts) => {
        const cleaned = parts.map((part) => {
            const next = {
                tag: part.tag || '',
                id: part.id || '',
                classes: Array.isArray(part.classes) ? part.classes.filter(Boolean) : [],
                attrs: Array.isArray(part.attrs) ? part.attrs.filter((attr) => attr && attr.name) : [],
            };
            next.classes = next.classes.filter((cls) => cls !== 'preview-content');
            return next;
        }).filter((part) => part.tag || part.id || part.classes.length || part.attrs.length);

        if (cleaned.length > 1 && (cleaned[0].tag === 'html' || cleaned[0].tag === 'body')) {
            cleaned.shift();
        }
        return cleaned;
    };

    const resolvePartTag = (part, index, parts) => {
        if (part.tag) return part.tag;
        const next = parts[index + 1];
        if (next && next.tag === 'li') return 'ul';
        return 'div';
    };

    const shouldDropTrailingLi = (parts) => {
        if (parts.length < 2) return false;
        const last = parts[parts.length - 1];
        if (last.tag !== 'li') return false;
        if (last.id || last.classes.length || last.attrs.length) return false;
        const prev = parts[parts.length - 2];
        if (!(prev.tag === 'ul' || prev.tag === 'ol')) return false;
        if (prev.id || prev.classes.length || prev.attrs.length) return false;
        return true;
    };

    const buildLabelFromParts = (parts) => {
        const labelParts = shouldDropTrailingLi(parts) ? parts.slice(0, -1) : parts;
        const tokens = [];
        labelParts.forEach((part) => {
            if (part.tag) tokens.push(part.tag);
            if (part.id) tokens.push(part.id);
            if (part.classes.length) tokens.push(...part.classes);
            if (part.attrs.length) tokens.push(...part.attrs.map((attr) => attr.name).filter(Boolean));
        });
        return tokens.join(' ').replace(/\s+/g, ' ').trim();
    };

    const isInsertableParts = (parts) => {
        if (!parts.length) return false;
        if (parts.length === 1 && (parts[0].tag === 'html' || parts[0].tag === 'body')) return false;
        return true;
    };

    const buildSnippetFromParts = (parts) => {
        if (!parts.length) return '';
        if (parts.length === 1) {
            const part = parts[0];
            const tag = part.tag || '';
            const classes = Array.isArray(part.classes) ? part.classes.filter(Boolean) : [];
            const hasAttrs = Array.isArray(part.attrs) && part.attrs.length > 0;
            if (!tag && !part.id && !hasAttrs && classes.length === 1) {
                return `{: class="${classes[0]}" }${CUSTOM_CSS_CURSOR}`;
            }
        }
        const normalized = parts.map((part) => ({
            tag: part.tag || '',
            id: part.id || '',
            classes: Array.isArray(part.classes) ? [...part.classes] : [],
            attrs: Array.isArray(part.attrs) ? part.attrs.map((attr) => ({ name: attr.name, value: attr.value })) : [],
        }));
        normalized.forEach((part, index) => {
            part.tag = resolvePartTag(part, index, normalized);
        });
        if (normalized.length && normalized[0].tag === 'li') {
            normalized.unshift({ tag: 'ul', id: '', classes: [], attrs: [] });
        }
        const last = normalized[normalized.length - 1];
        if (last && (last.tag === 'ul' || last.tag === 'ol')) {
            normalized.push({ tag: 'li', id: '', classes: [], attrs: [] });
        }

        const escapeAttr = (value) => String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const buildAttrs = (part) => {
            const attrs = [];
            if (part.id) attrs.push(`id="${escapeAttr(part.id)}"`);
            if (part.classes.length) attrs.push(`class="${escapeAttr(part.classes.join(' '))}"`);
            part.attrs.forEach((attr) => {
                if (!attr || !attr.name) return;
                if (attr.value == null || attr.value === '') {
                    attrs.push(attr.name);
                } else {
                    attrs.push(`${attr.name}="${escapeAttr(attr.value)}"`);
                }
            });
            return attrs.length ? ` ${attrs.join(' ')}` : '';
        };
        const indentLines = (text, indent) => text
            .split('\n')
            .map((line) => (line ? indent + line : indent))
            .join('\n');

        let content = CUSTOM_CSS_CURSOR;
        for (let i = normalized.length - 1; i >= 0; i--) {
            const part = normalized[i];
            const tag = part.tag || 'div';
            const attrs = buildAttrs(part);
            const inner = indentLines(content, '  ');
            content = `<${tag}${attrs}>\n${inner}\n</${tag}>`;
        }
        return content;
    };

    const buildCustomCssEntries = (css) => {
        const entries = [];
        const seen = new Set();
        const raw = String(css || '').trim();
        if (!raw) return entries;
        const styleEl = document.createElement('style');
        styleEl.media = 'not all';
        styleEl.textContent = raw;
        document.head.appendChild(styleEl);
        const processRules = (rules) => {
            if (!rules) return;
            Array.from(rules).forEach((rule) => {
                if (!rule) return;
                if (rule.type === CSSRule.STYLE_RULE) {
                    const selectorText = String(rule.selectorText || '').trim();
                    if (!selectorText) return;
                    splitSelectorList(selectorText).forEach((selector) => {
                        const parts = cleanupSelectorParts(parseSelectorParts(selector));
                        if (!isInsertableParts(parts)) return;
                        const label = buildLabelFromParts(parts);
                        if (!label) return;
                        const snippet = buildSnippetFromParts(parts);
                        if (!snippet) return;
                        const key = `${label}|${snippet}`;
                        if (seen.has(key)) return;
                        seen.add(key);
                        entries.push({ label, snippet });
                    });
                    return;
                }
                if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
                    processRules(rule.cssRules);
                }
            });
        };
        try {
            processRules(styleEl.sheet?.cssRules || []);
        } catch {}
        styleEl.remove();
        return entries;
    };

    const insertCustomCssSnippet = (snippet) => {
        const raw = String(snippet || '');
        if (!raw) return;
        const cursorIndex = raw.indexOf(CUSTOM_CSS_CURSOR);
        const markerIndex = cursorIndex === -1 ? raw.length : cursorIndex;
        const block = raw.replace(CUSTOM_CSS_CURSOR, '');
        const { start, end } = getSelection();
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        const needsPrefix = before && !before.endsWith('\n');
        const needsSuffix = after && !after.startsWith('\n');
        const insert = `${needsPrefix ? '\n' : ''}${block}${needsSuffix ? '\n' : ''}`;
        replaceRange(start, end, insert);
        const caret = start + (needsPrefix ? 1 : 0) + markerIndex;
        setSelection(caret, caret);
        try {
            pushUndoSnapshot(snapshot(), { merge: false });
            redoStack.length = 0;
        } catch {}
        ta.focus();
    };

    const refreshCustomCssSelect = (force = false) => {
        if (!(customCssSelect instanceof HTMLSelectElement)) return;
        const css = readCustomCssSetting();
        if (!force && css === lastCustomCssValue) return;
        lastCustomCssValue = css;
        const entries = buildCustomCssEntries(css);
        const hasCss = !!String(css || '').trim();
        customCssSnippetMap = new Map();
        customCssSelect.textContent = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('edit.toolbar.custom_css', 'Custom CSS');
        placeholder.selected = true;
        customCssSelect.appendChild(placeholder);
        entries.forEach((entry, index) => {
            const key = `custom-css-${index}`;
            customCssSnippetMap.set(key, entry.snippet);
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = entry.label;
            customCssSelect.appendChild(opt);
        });
        const hasEntries = entries.length > 0;
        customCssSelect.hidden = !hasCss;
        customCssSelect.disabled = !hasEntries;
        if (!hasEntries) customCssSelect.value = '';
    };

    window.__mdwRefreshCustomCssSelect = refreshCustomCssSelect;

    const clickById = (id) => {
        const el = document.getElementById(id);
        if (el instanceof HTMLElement) el.click();
    };

    const headingSelect = document.getElementById('headingSelect');
    const alignSelect = document.getElementById('alignSelect');
    const boldBtn = document.getElementById('formatBoldBtn');
    const italicBtn = document.getElementById('formatItalicBtn');
    const underlineBtn = document.getElementById('formatUnderlineBtn');
    const blockquoteBtn = document.getElementById('formatBlockquoteBtn');
    const orderedListBtn = document.getElementById('formatOrderedListBtn');
    const unorderedListBtn = document.getElementById('formatUnorderedListBtn');
    const insertTableBtn = document.getElementById('insertTableBtn');
    const customCssSelect = document.getElementById('customCssSelect');

    headingSelect?.addEventListener('change', () => {
        if (!(headingSelect instanceof HTMLSelectElement)) return;
        const value = String(headingSelect.value || '').trim();
        if (!value) return;
        const level = value;
        runFormatAction(() => setHeadingLevel(level));
        headingSelect.value = '';
        ta.focus();
    });

    alignSelect?.addEventListener('change', () => {
        if (!(alignSelect instanceof HTMLSelectElement)) return;
        const value = String(alignSelect.value || '').trim();
        if (!value) return;
        const align = value;
        runFormatAction(() => applyAlignment(align));
        alignSelect.value = 'left';
        ta.focus();
    });

    boldBtn?.addEventListener('click', () => {
        runFormatAction(() => wrapOrUnwrap('**', '**'));
        ta.focus();
    });
    italicBtn?.addEventListener('click', () => {
        runFormatAction(() => wrapOrUnwrap('*', '*', {
            singleCharSafe: ({ value, start, end }) => {
                const prev = value[start - 2] || '';
                const next = value[end + 1] || '';
                return prev !== '*' && next !== '*';
            }
        }));
        ta.focus();
    });
    underlineBtn?.addEventListener('click', () => {
        runFormatAction(() => wrapOrUnwrap('<u>', '</u>'));
        ta.focus();
    });
    blockquoteBtn?.addEventListener('click', () => {
        runFormatAction(() => toggleLinePrefix('quote'));
        ta.focus();
    });
    orderedListBtn?.addEventListener('click', () => {
        runFormatAction(() => toggleOrderedList());
        ta.focus();
    });
    unorderedListBtn?.addEventListener('click', () => {
        runFormatAction(() => toggleLinePrefix('bullet'));
        ta.focus();
    });
    insertTableBtn?.addEventListener('click', () => {
        runFormatAction(() => insertTable());
        ta.focus();
    });

    customCssSelect?.addEventListener('change', () => {
        if (!(customCssSelect instanceof HTMLSelectElement)) return;
        const key = String(customCssSelect.value || '').trim();
        if (!key) return;
        const snippet = customCssSnippetMap.get(key);
        if (snippet) insertCustomCssSnippet(snippet);
        customCssSelect.value = '';
    });

    refreshCustomCssSelect(true);

    ta.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
        if (ta.selectionStart == null || ta.selectionEnd == null) return;
        if (ta.selectionStart !== ta.selectionEnd) return;
        const tokenInfo = findHtmlTabToken();
        if (!tokenInfo) return;
        const info = parseHtmlTabToken(tokenInfo.token);
        if (!info) return;
        const snippet = buildHtmlSnippet(info);
        if (!snippet) return;
        e.preventDefault();
        replaceRange(tokenInfo.start, tokenInfo.end, snippet.text);
        const caret = tokenInfo.start + snippet.caretOffset;
        setSelection(caret, caret);
        ta.focus();
    });

    ta.addEventListener('keydown', (e) => {
        if (!isModKey(e)) return;

        // Save: Ctrl+Alt+S
        if (!e.shiftKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            if (editorForm instanceof HTMLFormElement) {
                if (typeof editorForm.requestSubmit === 'function') {
                    editorForm.requestSubmit();
                } else {
                    editorForm.submit();
                }
            }
            return;
        }

        // Replace modal: Ctrl+Alt+H
        if (!e.shiftKey && (e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            if (typeof window.__mdwOpenReplaceModal === 'function') {
                window.__mdwOpenReplaceModal();
            }
            return;
        }

        // Repeat last formatting: Ctrl+Alt+R
        if (!e.shiftKey && (e.key === 'r' || e.key === 'R')) {
            if (typeof lastFormatAction === 'function') {
                e.preventDefault();
                lastFormatAction();
            }
            return;
        }

        // Bold: Ctrl+Alt+B
        if (!e.shiftKey && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            runFormatAction(() => wrapOrUnwrap('**', '**'));
            return;
        }

        // Italic: Ctrl+Alt+I
        if (!e.shiftKey && (e.key === 'i' || e.key === 'I')) {
            e.preventDefault();
            runFormatAction(() => wrapOrUnwrap('*', '*', {
                singleCharSafe: ({ value, start, end }) => {
                    const prev = value[start - 2] || '';
                    const next = value[end + 1] || '';
                    return prev !== '*' && next !== '*';
                }
            }));
            return;
        }

        // Strikethrough: Ctrl+Alt+X
        if (!e.shiftKey && (e.key === 'x' || e.key === 'X')) {
            e.preventDefault();
            runFormatAction(() => wrapOrUnwrap('~~', '~~'));
            return;
        }

        // Inline code: Ctrl+Alt+` (backquote key)
        if (!e.shiftKey && (e.code === 'Backquote' || e.key === '`')) {
            e.preventDefault();
            runFormatAction(() => wrapOrUnwrap('`', '`'));
            return;
        }

        // Link modal: Ctrl+Alt+L
        if (!e.shiftKey && (e.key === 'l' || e.key === 'L')) {
            e.preventDefault();
            clickById('addLinkBtn');
            return;
        }

        // Link modal (common in editors): Ctrl+Alt+K
        if (!e.shiftKey && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            clickById('addLinkBtn');
            return;
        }

        // Image modal: Ctrl+Alt+M
        if (!e.shiftKey && (e.key === 'm' || e.key === 'M')) {
            e.preventDefault();
            clickById('addImageBtn');
            return;
        }

        // Blockquote toggle: Ctrl+Alt+Q
        if (!e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
            e.preventDefault();
            runFormatAction(() => toggleLinePrefix('quote'));
            return;
        }

        // Bullet list toggle: Ctrl+Alt+U
        if (!e.shiftKey && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            runFormatAction(() => toggleLinePrefix('bullet'));
            return;
        }

        // Fenced code block: Ctrl+Alt+O
        if (!e.shiftKey && (e.key === 'o' || e.key === 'O')) {
            e.preventDefault();
            runFormatAction(() => wrapOrUnwrap('```\n', '\n```'));
            return;
        }

        // Comment: Ctrl+Alt+/
        if (e.code === 'Slash') {
            e.preventDefault();
            runFormatAction(() => wrapOrUnwrap('<!-- ', ' -->'));
            return;
        }

        // Uppercase: Ctrl+Alt+PageUp (Shift also allowed to avoid OS conflicts)
        if (e.key === 'PageUp') {
            e.preventDefault();
            transformSelectionOrWord((s) => s.toUpperCase());
            return;
        }

        // Lowercase: Ctrl+Alt+PageDown (Shift also allowed to avoid OS conflicts)
        if (e.key === 'PageDown') {
            e.preventDefault();
            transformSelectionOrWord((s) => s.toLowerCase());
            return;
        }

        // Increase/decrease heading level: Ctrl+Alt+ + / -
        const isPlus = e.code === 'NumpadAdd' || e.key === '+' || (e.key === '=' && e.shiftKey);
        const isMinus = e.code === 'NumpadSubtract' || e.key === '-';
        if (isPlus) {
            e.preventDefault();
            runFormatAction(() => adjustHeadingLevel(1));
            return;
        }
        if (isMinus) {
            e.preventDefault();
            runFormatAction(() => adjustHeadingLevel(-1));
            return;
        }

        // Set heading level directly: Ctrl+Alt+1..6
        if (!e.shiftKey && /^[1-6]$/.test(String(e.key || ''))) {
            e.preventDefault();
            const level = Number(e.key);
            runFormatAction(() => setHeadingLevel(level));
        }
    });
})();

// RESIZABLE COLUMNS + MOBILE ROWS
(function () {
    const grid = document.getElementById('editorGrid');
    if (!grid) return;

    const root = document.documentElement;
    const STORAGE_KEY = 'mdw_editor_col_widths';
    const ROW_STORAGE_KEY = 'mdw_editor_row_heights';
    const mobileQuery = window.matchMedia('(max-width: 960px)');
    const touchMoveOpts = { passive: false };

    function applyWidths(left, mid, right, save) {
        const root = document.documentElement;
        root.style.setProperty('--col-left', left);
        root.style.setProperty('--col-mid',  mid);
        root.style.setProperty('--col-right', right);

        if (save) {
            mdwStorageSet(STORAGE_KEY, JSON.stringify({
                left, mid, right
            }));
        }
    }

    function applyRows(top, bottom, save) {
        root.style.setProperty('--row-top', top);
        root.style.setProperty('--row-bottom', bottom);
        if (save) {
            mdwStorageSet(ROW_STORAGE_KEY, JSON.stringify({
                top, bottom
            }));
        }
    }

    // laad opgeslagen waarden
    try {
        const saved = JSON.parse(mdwStorageGet(STORAGE_KEY) || 'null');
        if (saved && saved.left && saved.mid && saved.right) {
            applyWidths(saved.left, saved.mid, saved.right, false);
        }
    } catch (e) {
        console.warn('width state broken, ignoring', e);
    }

    const loadSavedRows = () => {
        try {
            const saved = JSON.parse(mdwStorageGet(ROW_STORAGE_KEY) || 'null');
            if (saved && saved.top && saved.bottom) {
                applyRows(saved.top, saved.bottom, false);
                return true;
            }
        } catch (e) {
            console.warn('row state broken, ignoring', e);
        }
        return false;
    };

    const initRows = () => {
        if (!mobileQuery.matches) return;
        if (!loadSavedRows()) {
            applyRows('50vh', '50vh', true);
        }
    };

    initRows();

    let syncRaf = null;
    const parseRowSize = (val, viewHeight) => {
        const raw = String(val || '').trim();
        if (!raw) return null;
        if (raw.endsWith('px')) {
            const n = parseFloat(raw);
            return Number.isFinite(n) ? n : null;
        }
        if (raw.endsWith('vh')) {
            const n = parseFloat(raw);
            if (!Number.isFinite(n)) return null;
            return (viewHeight * n) / 100;
        }
        return null;
    };

    const syncMobileRows = () => {
        if (!mobileQuery.matches) return;
        if (root.classList.contains('mdw-pane-focus-md') || root.classList.contains('mdw-pane-focus-preview')) return;
        const main = document.querySelector('.app-main');
        if (!(main instanceof HTMLElement)) return;
        const mainStyles = getComputedStyle(main);
        const padTop = parseFloat(mainStyles.paddingTop) || 0;
        const padBottom = parseFloat(mainStyles.paddingBottom) || 0;
        const innerHeight = Math.max(0, main.clientHeight - padTop - padBottom);
        if (!innerHeight) return;
        const resizer = document.querySelector('.col-resizer[data-resizer="right"]');
        const resizerHeight = resizer instanceof HTMLElement ? resizer.getBoundingClientRect().height : 12;
        const total = innerHeight - resizerHeight;
        if (total <= 0) return;
        const rootStyles = getComputedStyle(root);
        const viewHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
        const topPx = parseRowSize(rootStyles.getPropertyValue('--row-top'), viewHeight);
        const bottomPx = parseRowSize(rootStyles.getPropertyValue('--row-bottom'), viewHeight);
        if (!(topPx > 0) || !(bottomPx > 0)) return;
        const ratio = topPx / (topPx + bottomPx);
        const minSize = 240;
        let newTop = Math.round(total * ratio);
        let newBottom = Math.round(total - newTop);
        if (newTop < minSize) {
            newTop = minSize;
            newBottom = Math.max(minSize, total - newTop);
        } else if (newBottom < minSize) {
            newBottom = minSize;
            newTop = Math.max(minSize, total - newBottom);
        }
        applyRows(`${newTop}px`, `${newBottom}px`, false);
    };

    const scheduleSyncRows = () => {
        if (syncRaf) return;
        syncRaf = requestAnimationFrame(() => {
            syncRaf = null;
            syncMobileRows();
        });
    };
    scheduleSyncRows();
    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', (ev) => {
            if (ev.matches) {
                initRows();
                scheduleSyncRows();
            }
        });
    } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener((ev) => {
            if (ev.matches) {
                initRows();
                scheduleSyncRows();
            }
        });
    }
    window.addEventListener('resize', scheduleSyncRows, { passive: true });
    if (typeof MutationObserver === 'function') {
        const mo = new MutationObserver(() => {
            scheduleSyncRows();
        });
        mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    let active = null;

    function startDrag(ev, which) {
        if (ev.cancelable) ev.preventDefault();
        if (mobileQuery.matches) {
            if (which !== 'right') return;
            const scroller = document.querySelector('.app-main');
            const prevOverflow = scroller instanceof HTMLElement ? scroller.style.overflow : '';
            const prevTouch = scroller instanceof HTMLElement ? scroller.style.touchAction : '';
            const prevOverscroll = scroller instanceof HTMLElement ? scroller.style.overscrollBehavior : '';
            if (scroller instanceof HTMLElement) {
                scroller.style.overflow = 'hidden';
                scroller.style.touchAction = 'none';
                scroller.style.overscrollBehavior = 'none';
            }
            document.documentElement.classList.add('mdw-resizing');
            active = {
                mode: 'row',
                resizer: (ev.currentTarget instanceof HTMLElement) ? ev.currentTarget : null,
                scroller,
                prevOverflow,
                prevTouch,
                prevOverscroll
            };
            document.body.style.cursor = 'row-resize';
        } else {
            active = { which, mode: 'col' };
            document.body.style.cursor = 'col-resize';
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onMove, touchMoveOpts);
        document.addEventListener('touchend', stopDrag);
        document.addEventListener('touchcancel', stopDrag);
    }

    function stopDrag() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onMove, touchMoveOpts);
        document.removeEventListener('touchend', stopDrag);
        document.removeEventListener('touchcancel', stopDrag);
        if (active && active.mode === 'row') {
            if (active.scroller instanceof HTMLElement) {
                active.scroller.style.overflow = active.prevOverflow || '';
                active.scroller.style.touchAction = active.prevTouch || '';
                active.scroller.style.overscrollBehavior = active.prevOverscroll || '';
            }
            document.documentElement.classList.remove('mdw-resizing');
        }
        document.body.style.cursor = '';
        active = null;
    }

    const getClientPoint = (ev) => {
        if (ev && ev.touches && ev.touches.length) {
            return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        }
        if (ev && ev.changedTouches && ev.changedTouches.length) {
            return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
        }
        return { x: ev.clientX, y: ev.clientY };
    };

    function onMove(ev) {
        if (!active) return;
        if (ev.cancelable) ev.preventDefault();

        const rect = grid.getBoundingClientRect();
        const total = active.mode === 'row' ? rect.height : rect.width;
        const point = getClientPoint(ev);

        // huidige percentages zonder '%' → float
        const rootStyles = getComputedStyle(document.documentElement);
        let leftPct  = parseFloat(rootStyles.getPropertyValue('--col-left'));
        let midPct   = parseFloat(rootStyles.getPropertyValue('--col-mid'));
        let rightPct = parseFloat(rootStyles.getPropertyValue('--col-right'));

        // clamp helper
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        if (active.mode === 'row') {
            const y = point.y - rect.top;
            const resizerHeight = active.resizer instanceof HTMLElement
                ? active.resizer.getBoundingClientRect().height
                : 8;
            const minSize = 240;
            const usable = total - resizerHeight;
            if (usable <= minSize * 2) return;
            const maxTop = total - minSize - resizerHeight;
            const newTop = clamp(y, minSize, maxTop);
            const newBottom = Math.max(minSize, total - newTop - resizerHeight);
            applyRows(`${newTop.toFixed(0)}px`, `${newBottom.toFixed(0)}px`, true);
            return;
        }

        if (active.which === 'left') {
            const x = point.x - rect.left;
            const newLeftPct = clamp((x / total) * 100, 10, 80);
            const delta = leftPct - newLeftPct;
            midPct += delta;
            leftPct = newLeftPct; // update left

        } else if (active.which === 'right') {
            const xFromRight = rect.right - point.x;
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
        r.addEventListener('touchstart', ev => startDrag(ev, which), { passive: false });
    });
})();
(function(){
    const exportBtn = document.getElementById('exportHtmlBtn');
    const copyHtmlBtn = document.getElementById('copyHtmlBtn');
    const copyMdBtn = document.getElementById('copyMdBtn');
    const preview = document.getElementById('preview');
    if (!exportBtn && !copyHtmlBtn && !copyMdBtn) return;
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const editor = document.getElementById('editor');

    const readCopyIncludeMetaSetting = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        if (!s || typeof s !== 'object') return true;
        return !Object.prototype.hasOwnProperty.call(s, 'copy_include_meta') ? true : !!s.copy_include_meta;
    };
    const readCopyHtmlModeSetting = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        const v = s && typeof s.copy_html_mode === 'string' ? s.copy_html_mode.trim() : '';
        return (v === 'wet' || v === 'dry' || v === 'medium') ? v : 'dry';
    };
    const normalizeCustomCss = (value) => {
        let css = String(value || '');
        css = css.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        css = css.replace(/<\/?style[^>]*>/gi, '');
        return css.trim();
    };
    const readCustomCssSetting = () => {
        if (typeof window.__mdwReadCustomCssSetting === 'function') {
            return window.__mdwReadCustomCssSetting();
        }
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        const raw = s && typeof s.custom_css === 'string' ? s.custom_css : '';
        return normalizeCustomCss(raw);
    };

    const getBasename = (p) => {
        const s = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const parts = s.split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : 'export.md';
    };

    const escapeHtml = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const buildThemeFontLinks = (htmlMode) => {
        if (htmlMode !== 'wet') return '';
        const links = Array.from(document.querySelectorAll('link[data-mdw-theme-font]'))
            .filter((el) => el instanceof HTMLLinkElement);
        if (!links.length) return '';
        const out = [];
        links.forEach((link) => {
            const rel = String(link.getAttribute('rel') || '').trim();
            const href = String(link.getAttribute('href') || '').trim();
            if (!rel || !href) return;
            const crossorigin = String(link.getAttribute('crossorigin') || '').trim();
            const attrs = [
                `rel="${escapeHtml(rel)}"`,
                `href="${escapeHtml(href)}"`,
            ];
            if (crossorigin) attrs.push(`crossorigin="${escapeHtml(crossorigin)}"`);
            out.push(`  <link ${attrs.join(' ')}>\n`);
        });
        return out.length ? out.join('') : '';
    };

    const collectAllowedMetaKeys = () => {
        const keys = new Set();
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const fields = cfg && cfg.fields && typeof cfg.fields === 'object' ? cfg.fields : {};
        Object.keys(fields || {}).forEach((k) => {
            const key = String(k || '').trim().toLowerCase();
            if (key) keys.add(key);
        });
        const pubCfg = (window.MDW_META_PUBLISHER_CONFIG && typeof window.MDW_META_PUBLISHER_CONFIG === 'object')
            ? window.MDW_META_PUBLISHER_CONFIG
            : null;
        const pubFields = pubCfg && pubCfg.fields && typeof pubCfg.fields === 'object' ? pubCfg.fields : {};
        Object.keys(pubFields || {}).forEach((k) => {
            const key = String(k || '').trim().toLowerCase();
            if (key) keys.add(key);
        });
        if (!keys.size) keys.add('date');
        return keys;
    };

    const stripHiddenMeta = (raw) => {
        const parseMetaLine = (line) => {
            const normalized = String(line ?? '')
                .replace(/\u00a0/g, ' ')
                .replace(/[\u200B\uFEFF]/g, '');
            let m = normalized.match(/^\s*\{+\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*\}+\s*$/u);
            if (!m) {
                m = normalized.match(/^\s*_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*$/u);
            }
            if (!m) return null;
            const key = String(m[1] || '').trim().toLowerCase();
            if (!key) return null;
            return { key, value: String(m[2] || '').trim() };
        };
        const allowed = collectAllowedMetaKeys();
        const lines = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n');
        if (!lines.length) return '';
        if (lines[0]) lines[0] = lines[0].replace(/^\uFEFF/, '');
        const out = [];
        const bufferedLeading = [];
        let inMeta = true;
        let seenMeta = false;
        for (const line of lines) {
            if (inMeta) {
                const parsed = parseMetaLine(line);
                if (parsed && allowed.has(parsed.key)) {
                    seenMeta = true;
                    continue;
                }
                if (!seenMeta && String(line ?? '').trim() === '') {
                    bufferedLeading.push(line);
                    continue;
                }
                inMeta = false;
                if (bufferedLeading.length) {
                    out.push(...bufferedLeading);
                    bufferedLeading.length = 0;
                }
            }
            out.push(line);
        }
        if (inMeta && bufferedLeading.length) {
            out.push(...bufferedLeading);
        }
        return out.join('\n');
    };

    const getMarkdownSource = () => {
        if (editor instanceof HTMLTextAreaElement) return editor.value || '';
        if (typeof window.MDW_CURRENT_MD === 'string') return window.MDW_CURRENT_MD;
        return null;
    };

    const stripMetaHtml = (rootEl) => {
        if (!rootEl || !(rootEl instanceof HTMLElement)) return;
        rootEl.querySelectorAll('.md-meta').forEach(el => el.remove());
    };

    const stripCssAttributes = (rootEl) => {
        if (!(rootEl instanceof Element)) return;
        const strip = (el) => {
            el.removeAttribute('class');
            el.removeAttribute('style');
        };
        strip(rootEl);
        rootEl.querySelectorAll('[class], [style]').forEach((el) => strip(el));
    };

    const stripInlineStyles = (rootEl) => {
        if (!(rootEl instanceof Element)) return;
        rootEl.removeAttribute('style');
        rootEl.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
    };

    const filterClassesByAllowlist = (rootEl, allowed) => {
        if (!(rootEl instanceof Element)) return;
        const allow = (allowed && allowed.size) ? allowed : null;
        const filterClasses = (el) => {
            const raw = el.getAttribute('class');
            if (!raw) return;
            if (!allow) {
                el.removeAttribute('class');
                return;
            }
            const keep = raw
                .split(/\s+/)
                .map((c) => String(c || '').trim())
                .filter((c) => c && allow.has(c));
            if (keep.length) {
                el.setAttribute('class', keep.join(' '));
            } else {
                el.removeAttribute('class');
            }
        };
        filterClasses(rootEl);
        rootEl.querySelectorAll('[class]').forEach((el) => filterClasses(el));
    };

    const collectElements = (rootEl) => {
        if (!(rootEl instanceof Element)) return [];
        return [rootEl, ...Array.from(rootEl.querySelectorAll('*'))];
    };

    const inlineComputedStyles = (sourceRoot, targetRoot) => {
        if (!(sourceRoot instanceof Element) || !(targetRoot instanceof Element)) return;
        const srcEls = collectElements(sourceRoot);
        const dstEls = collectElements(targetRoot);
        const len = Math.min(srcEls.length, dstEls.length);
        for (let i = 0; i < len; i++) {
            const srcEl = srcEls[i];
            const dstEl = dstEls[i];
            if (!(dstEl instanceof Element)) continue;
            const computed = window.getComputedStyle(srcEl);
            let style = '';
            for (let j = 0; j < computed.length; j++) {
                const prop = computed[j];
                const val = computed.getPropertyValue(prop);
                if (!val) continue;
                style += `${prop}:${val};`;
            }
            if (style) dstEl.setAttribute('style', style.trim());
        }
    };

    const applyHtmlMode = (targetRoot, htmlMode, allowedClasses) => {
        if (!(targetRoot instanceof Element)) return;
        if (htmlMode === 'dry') {
            stripCssAttributes(targetRoot);
            return;
        }
        if (htmlMode === 'medium') {
            stripInlineStyles(targetRoot);
            filterClassesByAllowlist(targetRoot, allowedClasses);
            return;
        }
        if (htmlMode === 'wet') {
            filterClassesByAllowlist(targetRoot, allowedClasses);
            return;
        }
        if (htmlMode !== 'wet') return;
    };

    const normalizeTocLayoutForExport = (targetRoot, htmlMode) => {
        if (!(targetRoot instanceof Element)) return;
        if (htmlMode === 'wet') return;
        const layouts = Array.from(targetRoot.querySelectorAll('.md-toc-layout'));
        layouts.forEach((layout) => {
            const body = layout.querySelector('.md-toc-body');
            if (!(body instanceof HTMLElement)) return;
            const tocWrap = layout.querySelector('.md-toc-side .md-toc-wrap');
            if (tocWrap instanceof HTMLElement && !body.querySelector('.md-toc-wrap')) {
                body.insertBefore(tocWrap.cloneNode(true), body.firstChild);
            }
            const frag = document.createDocumentFragment();
            Array.from(body.childNodes).forEach((node) => frag.appendChild(node));
            layout.replaceWith(frag);
        });
    };

    const getPreviewSnapshot = (stripMeta, htmlMode, allowedClasses) => {
        if (!(preview instanceof HTMLElement)) return null;
        const clone = preview.cloneNode(true);
        if (clone instanceof HTMLElement) clone.removeAttribute('id');
        if (stripMeta) stripMetaHtml(clone);
        normalizeTocLayoutForExport(clone, htmlMode);
        applyHtmlMode(clone, htmlMode, allowedClasses);
        return clone instanceof HTMLElement ? clone.outerHTML : null;
    };

    const initCodeCopyButtons = () => {
        if (!(preview instanceof HTMLElement)) return;
        const blocks = Array.from(preview.querySelectorAll('pre'));
        if (!blocks.length) return;
        blocks.forEach((pre) => {
            if (!(pre instanceof HTMLElement)) return;
            if (pre.querySelector('.code-copy-btn')) return;
            const btn = document.createElement('button');
            const title = t('js.copy_code', 'Copy code');
            btn.type = 'button';
            btn.className = 'btn btn-ghost copy-btn icon-button code-copy-btn';
            btn.title = title;
            btn.setAttribute('aria-label', title);
            btn.innerHTML = '<span class="btn-icon-stack"><span class="pi pi-copy copy-icon"></span><span class="pi pi-checkmark copy-check"></span></span>';
            btn.addEventListener('click', async () => {
                const codeEl = pre.querySelector('code');
                const text = codeEl ? codeEl.textContent : pre.textContent;
                btn.disabled = true;
                try {
                    const ok = await copyTextToClipboard(String(text || ''));
                    if (!ok) throw new Error('Copy failed');
                    flashCopyFeedback(btn, '', 1200);
                } catch (e) {
                    console.error('Copy failed', e);
                    alert(t('js.copy_failed', 'Copy failed. Check the console for details.'));
                } finally {
                    btn.disabled = false;
                }
            });
            pre.appendChild(btn);
        });
    };
    window.__mdwInitCodeCopyButtons = initCodeCopyButtons;

    const buildPreviewWrapper = (html, stripMeta, htmlMode, allowedClasses) => {
        const wrapper = document.createElement(preview instanceof HTMLElement ? preview.tagName : 'div');
        if (preview instanceof HTMLElement && preview.className) {
            wrapper.className = preview.className;
        } else {
            wrapper.className = 'preview-content';
        }
        wrapper.innerHTML = html || '';
        if (stripMeta) stripMetaHtml(wrapper);
        applyHtmlMode(wrapper, htmlMode, allowedClasses);
        return wrapper.outerHTML;
    };
 
    const collectAttrListClasses = (markdown) => {
        const text = String(markdown || '');
        const set = new Set();
        const attrRe = /\{:\s*[^}]+\}/g;
        let match = null;
        while ((match = attrRe.exec(text))) {
            const chunk = match[0] || '';
            const classRe = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]+))/gi;
            let cm = null;
            while ((cm = classRe.exec(chunk))) {
                const raw = String(cm[1] || cm[2] || cm[3] || '');
                const cleaned = raw.replace(/[^A-Za-z0-9_\-\s]+/g, ' ').trim();
                if (!cleaned) continue;
                cleaned.split(/\s+/).forEach((c) => {
                    if (c) set.add(c);
                });
            }
        }
        return set;
    };

    const readCssFromLink = async (linkEl) => {
        if (!(linkEl instanceof HTMLLinkElement)) return '';
        const href = String(linkEl.getAttribute('href') || '').trim();
        if (!href) return '';
        try {
            if (!mdmApi || typeof mdmApi.get !== 'function') {
                const res = await fetch(href);
                if (!res.ok) return '';
                return await res.text();
            }
            return await mdmApi.get(href);
        } catch {
            return '';
        }
    };

    const findBasePreviewStylesheet = () => {
        const links = mdm$$('link[rel="stylesheet"]');
        for (const link of links) {
            if (!(link instanceof HTMLLinkElement)) continue;
            const href = String(link.getAttribute('href') || '').trim();
            if (!href) continue;
            if (!/htmlpreview\.css(\?|#|$)/i.test(href)) continue;
            if (/_htmlpreview\.css(\?|#|$)/i.test(href)) continue;
            return link;
        }
        return null;
    };

    const sanitizeCssForStyleTag = (css) => String(css || '').replace(/<\/style/gi, '<\\/style');

    const sanitizeExportSelector = (selector, allowedClasses) => {
        let s = String(selector || '').trim();
        if (!s) return null;
        s = s.replace(/\.preview-content\b/g, ' ').replace(/\s+/g, ' ');
        s = s.replace(/^\s*[>+~]\s*/, '').trim();
        if (!s) s = 'body';
        if (s.includes('.md-') && !/\.md-toc\b|\.md-toc-/.test(s)) return null;
        if (allowedClasses instanceof Set) {
            const classMatches = s.match(/\.([A-Za-z0-9_-]+)/g) || [];
            for (const match of classMatches) {
                const cls = match.slice(1);
                if (!allowedClasses.has(cls)) return null;
            }
        }
        return s;
    };

    const sanitizeExportCss = (css, allowedClasses) => {
        const raw = String(css || '').trim();
        if (!raw) return '';
        const styleEl = document.createElement('style');
        styleEl.textContent = raw;
        document.head.appendChild(styleEl);
        const sheet = styleEl.sheet;
        const output = [];
        const processRules = (rules, indent) => {
            const lines = [];
            if (!rules) return lines;
            for (const rule of Array.from(rules)) {
                if (!rule) continue;
                if (rule.type === CSSRule.STYLE_RULE) {
                    const selectors = String(rule.selectorText || '')
                        .split(',')
                        .map((sel) => sanitizeExportSelector(sel, allowedClasses))
                        .filter((sel) => sel);
                    if (!selectors.length) continue;
                    const body = String(rule.style?.cssText || '').trim();
                    if (!body) continue;
                    lines.push(`${indent}${selectors.join(', ')} { ${body} }`);
                    continue;
                }
                if (rule.type === CSSRule.MEDIA_RULE) {
                    const inner = processRules(rule.cssRules, indent + '  ');
                    if (!inner.length) continue;
                    lines.push(`${indent}@media ${rule.conditionText} {`);
                    lines.push(inner.join('\n'));
                    lines.push(`${indent}}`);
                    continue;
                }
                if (rule.type === CSSRule.SUPPORTS_RULE) {
                    const inner = processRules(rule.cssRules, indent + '  ');
                    if (!inner.length) continue;
                    lines.push(`${indent}@supports ${rule.conditionText} {`);
                    lines.push(inner.join('\n'));
                    lines.push(`${indent}}`);
                    continue;
                }
                const text = String(rule.cssText || '').trim();
                if (text) lines.push(`${indent}${text}`);
            }
            return lines;
        };
        try {
            const lines = processRules(sheet?.cssRules || [], '');
            output.push(...lines);
        } finally {
            styleEl.remove();
        }
        return output.join('\n').trim();
    };

    const collectExportCss = async (htmlMode, allowedClasses) => {
        const chunks = [];
        if (htmlMode === 'wet') {
            const baseCss = await readCssFromLink(findBasePreviewStylesheet());
            if (baseCss) chunks.push(baseCss);
            const themeLink = document.getElementById('mdwThemeHtmlpreviewCss');
            if (themeLink instanceof HTMLLinkElement && !themeLink.disabled) {
                const themeCss = await readCssFromLink(themeLink);
                if (themeCss) chunks.push(themeCss);
            }
            const overridesStyle = document.getElementById('mdwThemeStyle');
            const overridesCss = overridesStyle instanceof HTMLStyleElement ? String(overridesStyle.textContent || '') : '';
            if (overridesCss.trim()) chunks.push(overridesCss);
        } else if (htmlMode === 'medium') {
            const customCss = readCustomCssSetting();
            if (customCss) chunks.push(customCss);
        }
        const combined = chunks.filter((c) => String(c || '').trim() !== '').join('\n\n');
        const sanitized = sanitizeExportCss(combined, allowedClasses);
        return sanitizeCssForStyleTag(sanitized);
    };

    const getServerRenderedHtml = async (markdownOverride) => {
        if (!window.CURRENT_FILE) return preview?.innerHTML || '';
        const content = (typeof markdownOverride === 'string')
            ? markdownOverride
            : (editor instanceof HTMLTextAreaElement ? editor.value : null);
        if (content === null) return preview?.innerHTML || '';
        const fd = new FormData();
        fd.set('content', content);
        if (mdmApi && typeof mdmApi.form === 'function') {
            return await mdmApi.form('edit.php?file=' + encodeURIComponent(window.CURRENT_FILE) + '&preview=1', fd);
        }
        const res = await fetch('edit.php?file=' + encodeURIComponent(window.CURRENT_FILE) + '&preview=1', {
            method: 'POST',
            body: fd,
        });
        if (!res.ok) throw new Error('Preview request failed');
        return await res.text();
    };

    const buildExportHtml = async (opts = {}) => {
        const includeMeta = opts.includeMeta !== false;
        const stripMeta = !includeMeta;
        const htmlMode = (opts.htmlMode === 'wet' || opts.htmlMode === 'dry' || opts.htmlMode === 'medium') ? opts.htmlMode : 'dry';
        const title = (document.querySelector('.app-title')?.textContent || '').trim() || 'Markdown export';
        const src = getBasename(window.CURRENT_FILE || 'export.md').replace(/\.md$/i, '');
        const filename = `${src || 'export'}.html`;
        const markdownSource = getMarkdownSource();
        const allowedClasses = htmlMode !== 'dry' ? collectAttrListClasses(markdownSource) : null;
        if (htmlMode === 'wet' && allowedClasses instanceof Set) {
            [
                'md-toc-layout',
                'md-toc-left',
                'md-toc-right',
                'md-toc-side',
                'md-toc-body',
                'md-toc-wrap',
                'md-toc',
                'md-toc-item',
                'is-active',
            ].forEach((cls) => allowedClasses.add(cls));
        }
        let bodyHtml = getPreviewSnapshot(stripMeta, htmlMode, allowedClasses);
        const exportCss = await collectExportCss(htmlMode, allowedClasses);
        const fontLinks = buildThemeFontLinks(htmlMode);
        if (!bodyHtml) {
            const rendered = (typeof markdownSource === 'string')
                ? await getServerRenderedHtml(markdownSource)
                : await getServerRenderedHtml();
            bodyHtml = buildPreviewWrapper(rendered, stripMeta, htmlMode, allowedClasses);
        }

        const cssBlock = exportCss ? `\n  <style data-mdw-export-css>\n${exportCss}\n  </style>\n` : '';
        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
${fontLinks}${cssBlock}</head>
<body>
${bodyHtml}
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

    const flashCopyFeedback = (buttonEl, nextLabel, ms) => {
        if (!(buttonEl instanceof HTMLElement)) return;
        const labelEl = buttonEl.querySelector('.btn-label');
        const old = labelEl ? labelEl.textContent : '';
        if (labelEl && nextLabel) labelEl.textContent = nextLabel;
        buttonEl.classList.add('is-copied');
        if (buttonEl.__copyTimer) clearTimeout(buttonEl.__copyTimer);
        buttonEl.__copyTimer = window.setTimeout(() => {
            if (labelEl) labelEl.textContent = old;
            buttonEl.classList.remove('is-copied');
        }, ms || 1200);
    };

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            if (!window.CURRENT_FILE) return;
            if (mdmUi && typeof mdmUi.busy === 'function') {
                mdmUi.busy(exportBtn, true, { label: t('js.exporting', 'Exporting…') });
            } else {
                exportBtn.disabled = true;
            }
            try {
                const includeMeta = readCopyIncludeMetaSetting();
                const htmlMode = readCopyHtmlModeSetting();
                const { filename, html } = await buildExportHtml({ includeMeta, htmlMode });
                downloadTextFile(filename, html, 'text/html;charset=utf-8');
            } catch (e) {
                console.error('Export failed', e);
                alert(t('js.export_failed', 'Export failed. Check the console for details.'));
            } finally {
                if (mdmUi && typeof mdmUi.busy === 'function') {
                    mdmUi.busy(exportBtn, false);
                } else {
                    exportBtn.disabled = false;
                }
            }
        });
    }

    if (copyHtmlBtn) {
        copyHtmlBtn.addEventListener('click', async () => {
            if (!window.CURRENT_FILE) return;
            if (mdmUi && typeof mdmUi.busy === 'function') {
                mdmUi.busy(copyHtmlBtn, true, { label: t('js.copying', 'Copying…') });
            } else {
                copyHtmlBtn.disabled = true;
            }
            try {
                const includeMeta = readCopyIncludeMetaSetting();
                const htmlMode = readCopyHtmlModeSetting();
                const { html } = await buildExportHtml({ includeMeta, htmlMode });
                const ok = await copyTextToClipboard(html);
                if (!ok) throw new Error('Copy failed');
                flashCopyFeedback(copyHtmlBtn, t('js.copied', 'Copied'), 1200);
            } catch (e) {
                console.error('Copy failed', e);
                alert(t('js.copy_failed', 'Copy failed. Check the console for details.'));
            } finally {
                if (mdmUi && typeof mdmUi.busy === 'function') {
                    mdmUi.busy(copyHtmlBtn, false);
                } else {
                    copyHtmlBtn.disabled = false;
                }
            }
        });
    }

    if (copyMdBtn) {
        copyMdBtn.addEventListener('click', async () => {
            if (!window.CURRENT_FILE) return;
            copyMdBtn.disabled = true;
            try {
                const includeMeta = readCopyIncludeMetaSetting();
                let markdown = getMarkdownSource();
                if (typeof markdown !== 'string') markdown = '';
                if (!includeMeta) {
                    markdown = stripHiddenMeta(markdown).replace(/^\n+/, '');
                }
                const ok = await copyTextToClipboard(markdown);
                if (!ok) throw new Error('Copy failed');
                flashCopyFeedback(copyMdBtn, t('js.copied', 'Copied'), 1200);
            } catch (e) {
                console.error('Copy failed', e);
                alert(t('js.copy_failed', 'Copy failed. Check the console for details.'));
            } finally {
                copyMdBtn.disabled = false;
            }
        });
    }

    initCodeCopyButtons();
})();
    };
})();
