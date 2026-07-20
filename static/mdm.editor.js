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
    const parseMetaEntries = (line) => {
        const normalized = String(line ?? '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\u200B\uFEFF]/g, '');
        const entries = [];
        let rest = normalized;
        while (true) {
            const m = rest.match(/^\s*\{+\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*([^}]*)\}+/u);
            if (!m) break;
            const key = String(m[1] || '').trim().toLowerCase();
            if (key) {
                entries.push({ key, value: String(m[2] || '').trim() });
            }
            rest = rest.slice(m[0].length);
        }
        if (entries.length) {
            if (rest.trim() !== '') return null;
            return entries;
        }
        const m = normalized.match(/^\s*_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*$/u);
        if (!m) return null;
        const key = String(m[1] || '').trim().toLowerCase();
        if (!key) return null;
        return [{ key, value: String(m[2] || '').trim() }];
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
        const bufferedLeading = [];
        let inMeta = true;
        let seenMeta = false;
        for (const line of lines) {
            const normalized = String(line ?? '')
                .replace(/\u00a0/g, ' ')
                .replace(/[\u200B\uFEFF]/g, '');
            if (inMeta) {
            const parsedEntries = parseMetaEntries(line);
            if (parsedEntries) {
                parsedEntries.forEach(({ key, value }) => {
                    meta[key] = value;
                });
                seenMeta = true;
                continue;
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
    window.__mdwExtractMetaAndBody = extractMetaAndBody;

    const normalizeFileTitle = (filePath) => {
        let base = String(filePath || '').trim();
        if (!base) return '';
        base = base.replace(/\\/g, '/');
        base = base.split('/').pop() || '';
        base = base.replace(/\.md$/i, '');
        base = base.replace(/[_-]+/g, ' ');
        base = base.replace(/\s+/g, ' ').trim();
        return base;
    };

    const cleanMetaTitleValue = (value) => {
        let out = String(value || '').trim();
        if (!out) return '';
        const idx = out.indexOf('}{');
        if (idx !== -1) {
            const tail = out.slice(idx + 2).trim();
            if (/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(tail)) {
                out = out.slice(0, idx).trim();
            }
        }
        return out;
    };

    const getCurrentFilePath = () => {
        const formFile = form.querySelector('input[name="file"]');
        const fromForm = formFile instanceof HTMLInputElement ? String(formFile.value || '').trim() : '';
        if (fromForm) return fromForm;
        const fromState = String(window.CURRENT_FILE || '').trim();
        if (fromState) return fromState;
        const fromQuery = new URLSearchParams(window.location.search).get('file');
        return fromQuery ? String(fromQuery).trim() : '';
    };

    const updateAppTitleFromEditor = () => {
        if (!isPublisherMode()) return;
        const { meta } = extractMetaAndBody(editor.value);
        const pageTitle = cleanMetaTitleValue(meta.page_title || '');
        const fileTitle = normalizeFileTitle(getCurrentFilePath());
        const nextTitle = pageTitle || fileTitle;
        if (!nextTitle) return;
        const appTitleEl = document.querySelector('.app-title');
        if (appTitleEl) appTitleEl.textContent = nextTitle;
        const dirty = !!window.__mdDirty;
        document.title = `${nextTitle} • md edit${dirty ? ' *' : ''}`;
    };

    const buildMetaBlock = (meta, includeKeys) => {
        const keys = [];
        const add = (key) => {
            const normalized = String(key || '').trim().toLowerCase();
            if (normalized && !keys.includes(normalized)) keys.push(normalized);
        };
        (Array.isArray(includeKeys) ? includeKeys : []).forEach(add);
        Object.keys(meta || {}).forEach(add);
        const out = [];
        for (const k of keys) {
            const v = String(meta?.[k] ?? '').trim();
            if (!v) continue;
            out.push(`{${k}: ${v}}`);
        }
        return out.join('\n');
    };

    let metaStore = extractMetaAndBody(editor.value).meta;
    let applyTimer = null;
    let isApplying = false;

    const applyMetaVisibility = () => {
        const baseCfg = getBaseCfg();
        const pubCfg = getPublisherCfg();
        const publisherMode = isPublisherMode();
        const { meta, body } = extractMetaAndBody(editor.value);
        const filteredMeta = {};
        Object.entries(meta || {}).forEach(([k, v]) => {
            const key = String(k).toLowerCase();
            filteredMeta[key] = v;
        });

        const { order } = getKnownKeysAndOrder();
        const includeKeys = order.filter((k) => {
            const fBase = baseCfg[k];
            const fPub = pubCfg[k];
            const f = fBase || fPub || {};
            const inPublisherCfg = !!fPub && !fBase;
            if (inPublisherCfg && !publisherMode) return false;
            return isMarkdownVisible(f);
        });
        includeKeys.forEach((k) => {
            if (!Object.prototype.hasOwnProperty.call(filteredMeta, k)
                && Object.prototype.hasOwnProperty.call(metaStore, k)) {
                delete metaStore[k];
            }
        });
        metaStore = { ...metaStore, ...filteredMeta };

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
        updateAppTitleFromEditor();
    };

    const setupPublishControlsPlacement = () => {
        const publishBtn = document.getElementById('publishBtn');
        const publishStateSelect = document.getElementById('publishStateSelect');
        const submitForProcessingBtn = document.getElementById('submitForProcessingBtn');
        if (!(publishBtn instanceof HTMLElement) || !(publishStateSelect instanceof HTMLElement)) return;
        if (document.body?.classList.contains('hide-markdown-editor')) return;
        const headerActions = document.querySelector('#paneMarkdown .pane-header-actions');
        const toolbarLeft = document.querySelector('#paneMarkdown .editor-toolbar-left');
        const revertBtn = document.getElementById('btnRevert');
        if (!(headerActions instanceof HTMLElement) || !(toolbarLeft instanceof HTMLElement) || !(revertBtn instanceof HTMLElement)) return;

        const moveToToolbar = () => {
            if (publishBtn.parentElement === toolbarLeft) return;
            if (submitForProcessingBtn instanceof HTMLElement) {
                revertBtn.insertAdjacentElement('afterend', submitForProcessingBtn);
            }
            revertBtn.insertAdjacentElement('afterend', publishBtn);
            publishBtn.insertAdjacentElement('afterend', publishStateSelect);
        };
        const moveToHeader = () => {
            if (publishBtn.parentElement === headerActions) return;
            headerActions.appendChild(publishBtn);
            headerActions.appendChild(publishStateSelect);
        };

        const mq = window.matchMedia ? window.matchMedia('(max-width: 960px)') : null;
        const update = () => {
            if (mq && mq.matches) {
                moveToToolbar();
            } else {
                moveToHeader();
            }
        };
        update();
        if (mq && typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', update);
        } else if (mq && typeof mq.addListener === 'function') {
            mq.addListener(update);
        } else {
            window.addEventListener('resize', update);
        }
    };

    const setupMarkdownSourceToggle = () => {
        const btn = document.getElementById('markdownSourceToggle');
        if (!(btn instanceof HTMLButtonElement)) return;
        const icon = btn.querySelector('.pi');
        const showTitle = t('edit.toolbar.show_markdown_title', 'Show markdown source');
        const hideTitle = t('edit.toolbar.hide_markdown_title', 'Show visual editor');
        const sync = () => {
            const shown = !!document.body?.classList.contains('mdw-show-markdown-source');
            const preview = document.getElementById('preview');
            btn.setAttribute('aria-pressed', shown ? 'true' : 'false');
            btn.setAttribute('title', shown ? hideTitle : showTitle);
            btn.setAttribute('aria-label', shown ? hideTitle : showTitle);
            if (icon instanceof HTMLElement) {
                icon.classList.toggle('pi-code', !shown);
                icon.classList.toggle('pi-eye', shown);
            }
            if (preview instanceof HTMLElement && document.body?.classList.contains('hide-markdown-editor')) {
                if (shown) {
                    preview.setAttribute('contenteditable', 'false');
                } else {
                    preview.setAttribute('contenteditable', 'true');
                }
            }
        };
        btn.addEventListener('click', () => {
            if (!document.body?.classList.contains('hide-markdown-editor')) return;
            if (!document.body.classList.contains('mdw-show-markdown-source') && typeof syncVisualPreviewToTextarea === 'function') {
                syncVisualPreviewToTextarea();
            }
            document.body.classList.toggle('mdw-show-markdown-source');
            sync();
            if (document.body.classList.contains('mdw-show-markdown-source')) {
                editor.focus();
            }
        });
        sync();
    };

    const setupArticleMetaModal = () => {
        const btn = document.getElementById('articleMetaBtn');
        const modal = document.getElementById('articleMetaModal');
        const overlay = document.getElementById('articleMetaModalOverlay');
        const closeBtn = document.getElementById('articleMetaModalClose');
        const cancelBtn = document.getElementById('articleMetaCancel');
        const formEl = document.getElementById('articleMetaForm');
        const fieldsEl = document.getElementById('articleMetaFields');
        const emptyEl = document.getElementById('articleMetaEmpty');
        const titleEl = document.getElementById('articleMetaModalTitle');
        if (!(btn instanceof HTMLButtonElement)
            || !(modal instanceof HTMLElement)
            || !(formEl instanceof HTMLFormElement)
            || !(fieldsEl instanceof HTMLElement)) return;
        if (!isPublisherMode()) return;
        const baseTitle = titleEl instanceof HTMLElement ? String(titleEl.textContent || '').trim() : '';

        const syncButtonState = () => {
            const fileInput = document.querySelector('#editor-form input[name="file"]');
            const file = fileInput instanceof HTMLInputElement ? fileInput.value : getCurrentFilePath();
            btn.disabled = !String(file || '').trim();
        };

        const modalBinding = (typeof window.__mdwBindModal === 'function')
            ? window.__mdwBindModal({
                modal,
                overlay,
                closeButtons: [closeBtn, cancelBtn],
                closeOnOverlay: true,
                closeOnEsc: true,
            })
            : null;

        const getFieldConfig = (key) => {
            const baseCfg = getBaseCfg();
            const pubCfg = getPublisherCfg();
            return pubCfg[key] || baseCfg[key] || {};
        };
        const fieldLabel = (key, cfg) => {
            const friendly = {
                page_title: 'Pagina titel',
                slug: 'Slug',
                page_subtitle: 'Pagina ondertitel',
                page_picture: 'Kop plaatje',
                author: 'Auteur',
                post_date: 'Datum',
                published_date: 'Publicatiedatum',
                creationdate: 'Aanmaakdatum',
                changedate: 'Wijzigingsdatum',
            };
            if (friendly[key]) return friendly[key];
            const raw = cfg && typeof cfg.label === 'string' ? cfg.label.trim() : '';
            return raw || key.replace(/_/g, ' ');
        };
        const visibleFields = () => {
            const { order } = getKnownKeysAndOrder();
            const visible = order.filter((key) => isMarkdownVisible(getFieldConfig(key)));
            const preferred = ['page_title', 'page_subtitle', 'page_picture', 'author', 'post_date'];
            const out = [];
            preferred.forEach((key) => {
                if (visible.includes(key) && !out.includes(key)) out.push(key);
            });
            visible.forEach((key) => {
                if (!out.includes(key)) out.push(key);
            });
            return out;
        };
        const currentSlug = () => {
            const filePath = getCurrentFilePath();
            let base = String(filePath || '').replace(/\\/g, '/').split('/').pop() || '';
            base = base.replace(/\.md$/i, '').trim();
            return base;
        };
        const updateArticleMetaTitle = () => {
            if (!(titleEl instanceof HTMLElement)) return;
            titleEl.textContent = baseTitle || 'Article metadata';
            const slug = currentSlug().toLowerCase();
            if (!slug) return;
            const span = document.createElement('span');
            span.className = 'status-text article-meta-title-slug';
            span.style.marginLeft = '0.45rem';
            span.style.fontSize = '0.78rem';
            span.style.fontWeight = '500';
            span.textContent = slug;
            titleEl.appendChild(span);
        };
        const publisherDefaultAuthor = () => {
            const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
            const settings = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
            return settings && typeof settings.publisher_default_author === 'string' ? settings.publisher_default_author.trim() : '';
        };
        const formatDateForArticleMeta = (date) => {
            try {
                return new Intl.DateTimeFormat('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                }).format(date);
            } catch {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${dd}-${mm}-${yyyy}`;
            }
        };
        const articleMetaValue = (key, meta, cfg) => {
            const current = String(meta[key] ?? metaStore[key] ?? '').trim();
            if (current) return current;
            const fallback = String(cfg?.default_value ?? '').trim();
            if (fallback) return fallback;
            if (key === 'author') return publisherDefaultAuthor();
            if (key === 'post_date') return formatDateForArticleMeta(new Date());
            return '';
        };
        let articleMetaImages = null;
        let articleMetaImagesPromise = null;
        const imageTokenForFile = (file, path) => {
            let name = String(file || '').trim();
            if (!name) {
                const parts = String(path || '').replace(/\\/g, '/').split('/');
                name = parts[parts.length - 1] || '';
            }
            return name;
        };
        const renderArticleMetaImages = (listEl, filterEl, input) => {
            if (!(listEl instanceof HTMLElement) || !(input instanceof HTMLInputElement)) return;
            const q = String(filterEl?.value || '').trim().toLowerCase();
            const images = Array.isArray(articleMetaImages) ? articleMetaImages : [];
            const filtered = q
                ? images.filter((it) => `${it.file || ''} ${it.alt || ''} ${it.path || ''}`.toLowerCase().includes(q))
                : images;
            listEl.textContent = '';
            if (!filtered.length) {
                const empty = document.createElement('div');
                empty.className = 'status-text';
                empty.style.padding = '0.45rem';
                empty.textContent = t('image_modal.no_images', 'No images found.');
                listEl.appendChild(empty);
                return;
            }
            filtered.forEach((it) => {
                const path = String(it.path || '');
                const file = String(it.file || '');
                const token = imageTokenForFile(file, path);
                if (!token) return;
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'btn btn-ghost';
                row.style.width = '100%';
                row.style.justifyContent = 'flex-start';
                row.style.gap = '0.55rem';
                row.style.marginTop = '0.35rem';

                const img = document.createElement('img');
                img.src = path;
                img.alt = '';
                img.loading = 'lazy';
                img.decoding = 'async';
                img.style.width = '42px';
                img.style.height = '42px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '0.5rem';
                img.style.border = '1px solid var(--border-soft)';

                const text = document.createElement('span');
                text.style.display = 'flex';
                text.style.flexDirection = 'column';
                text.style.alignItems = 'flex-start';
                text.style.minWidth = '0';
                const name = document.createElement('span');
                name.style.fontSize = '0.8rem';
                name.style.fontWeight = '600';
                name.style.maxWidth = '32ch';
                name.style.overflow = 'hidden';
                name.style.textOverflow = 'ellipsis';
                name.style.whiteSpace = 'nowrap';
                name.textContent = String(it.alt || file || path);
                const meta = document.createElement('span');
                meta.className = 'status-text';
                meta.style.maxWidth = '38ch';
                meta.style.overflow = 'hidden';
                meta.style.textOverflow = 'ellipsis';
                meta.style.whiteSpace = 'nowrap';
                meta.textContent = path;
                text.append(name, meta);

                row.append(img, text);
                row.addEventListener('click', () => {
                    input.value = token;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.focus();
                });
                listEl.appendChild(row);
            });
        };
        const loadArticleMetaImages = async (statusEl) => {
            if (Array.isArray(articleMetaImages)) return articleMetaImages;
            if (articleMetaImagesPromise) return articleMetaImagesPromise;
            if (statusEl instanceof HTMLElement) statusEl.textContent = t('image_modal.loading', 'Loading…');
            articleMetaImagesPromise = (async () => {
                if (!mdmApi || typeof mdmApi.get !== 'function') throw new Error('network');
                const data = await mdmApi.get('image_manager.php?action=list');
                if (!data || data.ok !== true) throw new Error(t('image_modal.load_failed', 'Failed to load images.'));
                articleMetaImages = Array.isArray(data.images) ? data.images : [];
                return articleMetaImages;
            })();
            try {
                return await articleMetaImagesPromise;
            } catch (e) {
                articleMetaImagesPromise = null;
                throw e;
            }
        };
        const attachPagePicturePicker = (wrap, input) => {
            const tools = document.createElement('div');
            tools.style.display = 'flex';
            tools.style.gap = '0.5rem';
            tools.style.marginTop = '0.45rem';
            tools.style.alignItems = 'center';

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'btn btn-ghost btn-small';
            toggle.textContent = t('image_modal.title', 'Insert image');

            const status = document.createElement('span');
            status.className = 'status-text';
            tools.append(toggle, status);

            const panel = document.createElement('div');
            panel.hidden = true;
            panel.style.marginTop = '0.55rem';
            panel.style.border = '1px solid var(--border-soft)';
            panel.style.borderRadius = '0.75rem';
            panel.style.padding = '0.55rem';

            const filter = document.createElement('input');
            filter.type = 'text';
            filter.className = 'input';
            filter.placeholder = t('image_modal.search_images', 'Search images...');

            const list = document.createElement('div');
            list.style.maxHeight = '28vh';
            list.style.overflow = 'auto';
            list.style.marginTop = '0.3rem';

            panel.append(filter, list);
            wrap.append(tools, panel);

            filter.addEventListener('input', () => renderArticleMetaImages(list, filter, input));
            toggle.addEventListener('click', async () => {
                panel.hidden = !panel.hidden;
                if (panel.hidden) return;
                status.textContent = '';
                try {
                    await loadArticleMetaImages(status);
                    status.textContent = '';
                    renderArticleMetaImages(list, filter, input);
                    filter.focus();
                } catch (e) {
                    status.textContent = e?.message || t('image_modal.load_failed', 'Failed to load images.');
                }
            });
        };
        const appendArticleMetaField = ({ key, labelText, value, readonly = false, metaKey = '' }) => {
            const wrap = document.createElement('div');
            wrap.className = 'modal-field article-meta-field';

            const label = document.createElement('label');
            label.className = 'modal-label';
            label.setAttribute('for', `articleMeta_${key}`);
            label.textContent = labelText;

            const input = document.createElement('input');
            input.id = `articleMeta_${key}`;
            input.className = 'input';
            input.type = 'text';
            input.name = metaKey || key;
            input.value = String(value ?? '');
            if (metaKey) input.dataset.metaKey = metaKey;
            if (readonly) {
                input.readOnly = true;
                input.setAttribute('aria-readonly', 'true');
            }

            wrap.append(label, input);
            if (key === 'page_picture') {
                attachPagePicturePicker(wrap, input);
            }
            fieldsEl.appendChild(wrap);
        };
        const openModal = () => {
            const fields = visibleFields();
            const { meta } = extractMetaAndBody(editor.value);
            fieldsEl.textContent = '';
            if (emptyEl instanceof HTMLElement) emptyEl.hidden = true;
            updateArticleMetaTitle();

            fields.forEach((key) => {
                const cfg = getFieldConfig(key);
                appendArticleMetaField({
                    key,
                    labelText: fieldLabel(key, cfg),
                    value: articleMetaValue(key, meta, cfg),
                    metaKey: key,
                });
            });

            if (modalBinding) modalBinding.open({ source: 'article-meta' });
            else {
                if (overlay instanceof HTMLElement) overlay.hidden = false;
                modal.hidden = false;
            }
            const first = fieldsEl.querySelector('input');
            if (first instanceof HTMLInputElement) first.focus();
        };
        const closeModal = () => {
            if (modalBinding) modalBinding.close({ source: 'article-meta' });
            else {
                modal.hidden = true;
                if (overlay instanceof HTMLElement) overlay.hidden = true;
            }
        };
        const applyValues = () => {
            const { meta, body } = extractMetaAndBody(editor.value);
            const nextMeta = { ...metaStore, ...meta };
            fieldsEl.querySelectorAll('input[data-meta-key]').forEach((input) => {
                if (!(input instanceof HTMLInputElement)) return;
                const key = String(input.dataset.metaKey || '').trim().toLowerCase();
                if (!key) return;
                const value = String(input.value || '').trim();
                if (value === '') delete nextMeta[key];
                else nextMeta[key] = value;
            });
            metaStore = nextMeta;
            const includeKeys = visibleFields();
            const block = buildMetaBlock(metaStore, includeKeys);
            const cleanedBody = String(body).replace(/^\n+/, '');
            const next = block ? (block + '\n\n' + cleanedBody) : cleanedBody;
            editor.value = next;
            applyMetaVisibility();
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            updateAppTitleFromEditor();
            closeModal();
        };

        btn.addEventListener('click', openModal);
        syncButtonState();
        formEl.addEventListener('submit', (event) => {
            event.preventDefault();
            applyValues();
        });
    };

    window.__mdwApplyMetaVisibility = applyMetaVisibility;
    window.__mdwStripHiddenMetaForDirty = stripHiddenMeta;
    window.__mdwBuildPreviewContent = () => {
        const { meta, body } = extractMetaAndBody(editor.value);
        const mergedMeta = { ...metaStore, ...meta };
        const { order } = getKnownKeysAndOrder();
        const block = buildMetaBlock(mergedMeta, order.slice());
        const cleanedBody = String(body).replace(/^\n+/, '');
        return block ? (block + '\n\n' + cleanedBody) : cleanedBody;
    };
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
        applyMetaVisibility();
    };
    applyMetaVisibility();
    setupPublishControlsPlacement();
    setupMarkdownSourceToggle();
    setupArticleMetaModal();

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
        updateAppTitleFromEditor();
    });

    form.addEventListener('submit', (event) => {
        const { meta, body } = extractMetaAndBody(editor.value);
        const mergedMeta = { ...metaStore, ...meta };
        const submitter = event.submitter;
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        let isPublish = (
            (submitter instanceof HTMLElement && submitter.getAttribute('name') === 'publish_action') ||
            (active && active.getAttribute('name') === 'publish_action')
        );
        if (!isPublish) {
            const overrideEl = document.getElementById('publishStateOverride');
            const selectEl = document.getElementById('publishStateSelect');
            const overrideVal = overrideEl instanceof HTMLInputElement ? String(overrideEl.value || '').trim().toLowerCase() : '';
            const overrideOn = (overrideVal === '1' || overrideVal === 'true');
            if (overrideOn && selectEl instanceof HTMLSelectElement) {
                const state = String(selectEl.value || '').trim().toLowerCase();
                if (state && state !== 'concept') isPublish = true;
            }
        }
        if (isPublisherMode() && isPublish) {
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

    const overlayState = {
        wrap: null,
        overlay: null,
        content: null,
        lastKey: null,
        lastText: null,
    };
    let selectionOverlayActive = false;

    const initEditorOverlay = () => {
        if (overlayState.overlay || !ta.parentNode) return;
        const wrap = document.createElement('div');
        wrap.className = 'editor-textarea-wrap';
        ta.parentNode.insertBefore(wrap, ta);
        wrap.appendChild(ta);

        const overlay = document.createElement('div');
        overlay.className = 'editor-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        const content = document.createElement('div');
        content.className = 'editor-overlay-content';
        overlay.appendChild(content);
        wrap.insertBefore(overlay, ta);

        overlayState.wrap = wrap;
        overlayState.overlay = overlay;
        overlayState.content = content;
    };

    initEditorOverlay();

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const normalizePath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const dirname = (p) => {
        const clean = normalizePath(p);
        const idx = clean.lastIndexOf('/');
        return idx === -1 ? '' : clean.slice(0, idx);
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
    const normalizeFileTitleLocal = (filePath) => {
        let base = String(filePath || '').trim();
        if (!base) return '';
        base = base.replace(/\\/g, '/');
        base = base.split('/').pop() || '';
        base = base.replace(/\.md$/i, '');
        base = base.replace(/[_-]+/g, ' ');
        base = base.replace(/\s+/g, ' ').trim();
        return base;
    };
    const getCurrentFilePathLocal = () => {
        const formFile = editorForm?.querySelector?.('input[name="file"]');
        const fromForm = formFile instanceof HTMLInputElement ? String(formFile.value || '').trim() : '';
        if (fromForm) return fromForm;
        const fromState = String(window.CURRENT_FILE || '').trim();
        if (fromState) return fromState;
        const fromQuery = new URLSearchParams(window.location.search).get('file');
        return fromQuery ? String(fromQuery).trim() : '';
    };

    const insertAtSelection = (text) => {
        if (typeof window.__mdwInsertMarkdownAtSelection === 'function' && window.__mdwInsertMarkdownAtSelection(text)) {
            return;
        }
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        ta.value = before + text + after;
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
    };

    const linkSuggestState = {
        open: false,
        start: -1,
        caret: -1,
        query: '',
        items: [],
        activeIndex: 0,
    };
    let linkSuggestEl = null;
    let linkSuggestList = null;
    let linkSuggestMirror = null;
    let linkSuggestItems = null;
    let linkSuggestTicking = false;

    const ensureLinkSuggestElements = () => {
        if (linkSuggestEl) return;
        linkSuggestEl = document.createElement('div');
        linkSuggestEl.className = 'mdw-link-suggest';
        linkSuggestEl.hidden = true;
        linkSuggestEl.innerHTML = '<div class="mdw-link-suggest-list"></div>';
        linkSuggestList = linkSuggestEl.querySelector('.mdw-link-suggest-list');
        document.body.appendChild(linkSuggestEl);

        linkSuggestEl.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        linkSuggestEl.addEventListener('click', (e) => {
            const target = e.target instanceof Element ? e.target.closest('.mdw-link-suggest-item') : null;
            if (!(target instanceof HTMLElement)) return;
            const idx = parseInt(target.getAttribute('data-index') || '', 10);
            if (!Number.isFinite(idx)) return;
            insertLinkSuggestItem(idx);
        });

        document.addEventListener('mousedown', (e) => {
            if (!linkSuggestState.open) return;
            const target = e.target;
            if (target instanceof Element) {
                if (linkSuggestEl.contains(target) || target === ta) return;
            }
            hideLinkSuggest();
        });
    };

    const ensureLinkSuggestMirror = () => {
        if (linkSuggestMirror) return;
        linkSuggestMirror = document.createElement('div');
        linkSuggestMirror.className = 'mdw-link-suggest-mirror';
        linkSuggestMirror.setAttribute('aria-hidden', 'true');
        linkSuggestMirror.style.position = 'fixed';
        linkSuggestMirror.style.visibility = 'hidden';
        linkSuggestMirror.style.whiteSpace = 'pre-wrap';
        linkSuggestMirror.style.wordBreak = 'break-word';
        linkSuggestMirror.style.wordWrap = 'break-word';
        linkSuggestMirror.style.overflow = 'auto';
        linkSuggestMirror.style.pointerEvents = 'none';
        document.body.appendChild(linkSuggestMirror);
    };

    const normalizeSuggestText = (value) => String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const getLinkSuggestItems = () => {
        if (Array.isArray(linkSuggestItems)) return linkSuggestItems;
        const out = [];
        const seen = new Set();
        const picker = document.getElementById('linkPicker');
        if (picker) {
            const nodes = Array.from(picker.querySelectorAll('.link-pick-item[data-path]'));
            nodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                const path = normalizePath(node.getAttribute('data-path') || '');
                if (!path || seen.has(path)) return;
                seen.add(path);
                let title = String(node.getAttribute('data-title') || '').trim();
                if (!title) {
                    title = String(node.textContent || '').trim();
                }
                if (!title) title = normalizeFileTitleLocal(path);
                out.push({
                    path,
                    title: title || path,
                    norm: normalizeSuggestText(title || path),
                    pathNorm: normalizeSuggestText(path),
                });
            });
        }
        if (!out.length) {
            const nodes = Array.from(document.querySelectorAll('.note-item[data-file]'));
            nodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                const path = normalizePath(node.dataset.file || '');
                if (!path || seen.has(path)) return;
                seen.add(path);
                const title = String(node.dataset.title || '').trim() || normalizeFileTitleLocal(path);
                out.push({
                    path,
                    title: title || path,
                    norm: normalizeSuggestText(title || path),
                    pathNorm: normalizeSuggestText(path),
                });
            });
        }
        linkSuggestItems = out;
        return out;
    };

    const getLinkSuggestContext = () => {
        if (ta.selectionStart == null || ta.selectionEnd == null) return null;
        if (ta.selectionStart !== ta.selectionEnd) return null;
        const caret = ta.selectionStart;
        const value = ta.value;
        const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
        const start = value.lastIndexOf('[', caret - 1);
        if (start < lineStart) return null;
        if (start > 0 && value[start - 1] === '!') return null;
        if (value[start - 1] === '\\') return null;
        const between = value.slice(start + 1, caret);
        if (between.includes(']')) return null;
        return { start, caret, query: between };
    };

    const renderLinkSuggestList = () => {
        if (!linkSuggestList) return;
        linkSuggestList.innerHTML = '';
        linkSuggestState.items.forEach((item, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mdw-link-suggest-item';
            btn.setAttribute('data-index', String(idx));
            if (idx === linkSuggestState.activeIndex) btn.classList.add('is-active');

            const title = document.createElement('div');
            title.className = 'mdw-link-suggest-title';
            title.textContent = item.title;

            const path = document.createElement('div');
            path.className = 'mdw-link-suggest-path';
            path.textContent = item.path;

            btn.appendChild(title);
            btn.appendChild(path);
            linkSuggestList.appendChild(btn);
        });
    };

    const syncLinkSuggestMirrorStyle = () => {
        ensureLinkSuggestMirror();
        if (!linkSuggestMirror) return;
        const rect = ta.getBoundingClientRect();
        const st = window.getComputedStyle(ta);
        const props = [
            'boxSizing',
            'width',
            'height',
            'paddingTop',
            'paddingRight',
            'paddingBottom',
            'paddingLeft',
            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',
            'fontFamily',
            'fontSize',
            'fontWeight',
            'fontStyle',
            'letterSpacing',
            'textTransform',
            'textAlign',
            'lineHeight',
            'tabSize',
            'wordBreak',
        ];
        props.forEach((prop) => {
            linkSuggestMirror.style[prop] = st[prop];
        });
        linkSuggestMirror.style.left = `${rect.left}px`;
        linkSuggestMirror.style.top = `${rect.top}px`;
        linkSuggestMirror.style.width = `${rect.width}px`;
        linkSuggestMirror.style.height = `${rect.height}px`;
    };

    const getCaretRect = (pos) => {
        syncLinkSuggestMirrorStyle();
        if (!linkSuggestMirror) return ta.getBoundingClientRect();
        const before = ta.value.slice(0, pos);
        const after = ta.value.slice(pos);
        linkSuggestMirror.textContent = before;
        const span = document.createElement('span');
        span.textContent = after || '\u200b';
        linkSuggestMirror.appendChild(span);
        linkSuggestMirror.scrollTop = ta.scrollTop;
        linkSuggestMirror.scrollLeft = ta.scrollLeft;
        const rect = span.getBoundingClientRect();
        linkSuggestMirror.textContent = '';
        return rect;
    };

    const positionLinkSuggest = () => {
        if (!linkSuggestState.open || !linkSuggestEl) return;
        const rect = getCaretRect(linkSuggestState.caret);
        const margin = 6;
        let left = rect.left;
        let top = rect.bottom + margin;
        linkSuggestEl.style.left = `${Math.round(left)}px`;
        linkSuggestEl.style.top = `${Math.round(top)}px`;

        const box = linkSuggestEl.getBoundingClientRect();
        const maxLeft = Math.max(8, window.innerWidth - box.width - 8);
        if (box.right > window.innerWidth - 8) left = maxLeft;
        if (box.left < 8) left = 8;
        if (box.bottom > window.innerHeight - 8) {
            top = Math.max(8, rect.top - box.height - margin);
        }
        linkSuggestEl.style.left = `${Math.round(left)}px`;
        linkSuggestEl.style.top = `${Math.round(top)}px`;
    };

    const showLinkSuggest = () => {
        ensureLinkSuggestElements();
        if (!linkSuggestEl) return;
        linkSuggestEl.hidden = false;
        linkSuggestState.open = true;
        renderLinkSuggestList();
        positionLinkSuggest();
    };

    const hideLinkSuggest = () => {
        if (!linkSuggestState.open) return;
        linkSuggestState.open = false;
        linkSuggestState.items = [];
        if (linkSuggestEl) linkSuggestEl.hidden = true;
    };

    const updateLinkSuggest = () => {
        if (document.activeElement !== ta) {
            if (!linkSuggestState.open) return;
        }
        const ctx = getLinkSuggestContext();
        if (!ctx) {
            hideLinkSuggest();
            return;
        }
        const queryNorm = normalizeSuggestText(ctx.query);
        const items = getLinkSuggestItems();
        let matches = items;
        if (queryNorm) {
            matches = items.filter((item) => item.norm.startsWith(queryNorm) || item.pathNorm.startsWith(queryNorm));
        }
        matches = matches.slice(0, 8);
        if (!matches.length) {
            hideLinkSuggest();
            return;
        }
        linkSuggestState.start = ctx.start;
        linkSuggestState.caret = ctx.caret;
        linkSuggestState.query = ctx.query;
        linkSuggestState.items = matches;
        linkSuggestState.activeIndex = 0;
        showLinkSuggest();
    };

    const scheduleLinkSuggest = () => {
        if (linkSuggestTicking) return;
        linkSuggestTicking = true;
        requestAnimationFrame(() => {
            linkSuggestTicking = false;
            updateLinkSuggest();
        });
    };

    const insertLinkSuggestItem = (idx) => {
        const item = linkSuggestState.items[idx];
        if (!item) return;
        const text = item.title || item.path;
        const href = buildInternalHref(getCurrentFilePathLocal(), item.path) || item.path;
        const snippet = `[${text}](${href}) {: class="link"}`;
        const start = linkSuggestState.start;
        const end = linkSuggestState.caret;
        if (start < 0 || end < start) return;
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        ta.value = before + snippet + after;
        const caret = start + snippet.length;
        ta.setSelectionRange(caret, caret);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
        hideLinkSuggest();
    };

    const findNoteRowByPath = (path) => {
        const clean = normalizePath(path);
        if (!clean) return null;
        const items = Array.from(document.querySelectorAll('.note-item[data-kind="md"]'));
        let baseMatch = null;
        const base = clean.split('/').pop() || '';
        for (const item of items) {
            if (!(item instanceof HTMLElement)) continue;
            const itemPath = normalizePath(item.dataset.file || '');
            if (!itemPath) continue;
            if (itemPath === clean) return item;
            if (base && (itemPath.split('/').pop() || '') === base) {
                if (baseMatch) return null;
                baseMatch = item;
            }
        }
        return baseMatch;
    };

    const extractFileFromUrl = (raw) => {
        if (!raw) return '';
        try {
            const url = new URL(raw, window.location.href);
            const fileParam = url.searchParams.get('file');
            if (!fileParam) return '';
            return decodeURIComponent(fileParam);
        } catch {
            return '';
        }
    };

    const extractFileFromText = (raw) => {
        const trimmed = String(raw || '').trim();
        if (!trimmed) return '';
        const fromUrl = extractFileFromUrl(trimmed);
        if (fromUrl) return fromUrl;
        const first = trimmed.split(/\s+/)[0] || '';
        const clean = first.replace(/[?#].*$/, '');
        if (/\.md$/i.test(clean)) return clean;
        const match = trimmed.match(/([A-Za-z0-9._\\/-]+\\.md)\\b/i);
        return match ? match[1] : '';
    };

    const getDropNoteInfo = (dt) => {
        if (!dt) return null;
        let file = String(dt.getData('text/mdw-file') || '').trim();
        let title = String(dt.getData('text/mdw-title') || '').trim();
        if (!file) {
            const uri = String(dt.getData('text/uri-list') || '').split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')) || '';
            const plain = String(dt.getData('text/plain') || '').trim();
            file = extractFileFromUrl(uri) || extractFileFromText(plain);
        }
        if (!file) return null;
        const row = findNoteRowByPath(file);
        if (row) {
            file = String(row.dataset.file || '').trim() || file;
            if (!title) title = String(row.dataset.title || '').trim();
        }
        file = normalizePath(file);
        if (!file) return null;
        return { file, title };
    };

    const BRACKET_PAIRS = {
        '(': ')',
        '[': ']',
        '{': '}',
    };
    const BRACKET_CLOSE = {
        ')': '(',
        ']': '[',
        '}': '{',
    };
    const BRACKET_CLASS = {
        '(': 'editor-bracket-paren',
        ')': 'editor-bracket-paren',
        '[': 'editor-bracket-bracket',
        ']': 'editor-bracket-bracket',
        '{': 'editor-bracket-brace',
        '}': 'editor-bracket-brace',
    };

    const isBracket = (ch) => BRACKET_PAIRS[ch] || BRACKET_CLOSE[ch];

    const findBracketMatch = (text, idx) => {
        const ch = text[idx];
        if (BRACKET_PAIRS[ch]) {
            const close = BRACKET_PAIRS[ch];
            let depth = 0;
            for (let i = idx + 1; i < text.length; i++) {
                const cur = text[i];
                if (cur === ch) {
                    depth++;
                } else if (cur === close) {
                    if (depth === 0) return { open: idx, close: i, type: ch };
                    depth--;
                }
            }
            return null;
        }
        if (BRACKET_CLOSE[ch]) {
            const open = BRACKET_CLOSE[ch];
            let depth = 0;
            for (let i = idx - 1; i >= 0; i--) {
                const cur = text[i];
                if (cur === ch) {
                    depth++;
                } else if (cur === open) {
                    if (depth === 0) return { open: i, close: idx, type: open };
                    depth--;
                }
            }
        }
        return null;
    };

    const syncOverlayScroll = () => {
        if (!overlayState.content) return;
        const x = ta.scrollLeft || 0;
        const y = ta.scrollTop || 0;
        overlayState.content.style.transform = `translate(${-x}px, ${-y}px)`;
    };

    let overlayStyleKey = '';
    const syncOverlayMetrics = () => {
        if (!overlayState.content) return;
        const cs = getComputedStyle(ta);
        const w = ta.clientWidth || 0;
        const h = ta.scrollHeight || 0;
        const key = [
            cs.fontFamily,
            cs.fontSize,
            cs.fontWeight,
            cs.fontStyle,
            cs.lineHeight,
            cs.letterSpacing,
            cs.paddingTop,
            cs.paddingRight,
            cs.paddingBottom,
            cs.paddingLeft,
            cs.whiteSpace,
            cs.tabSize,
            cs.wordBreak,
            cs.overflowWrap,
            w,
            h,
        ].join('|');
        if (key === overlayStyleKey) return;
        overlayStyleKey = key;
        const st = overlayState.content.style;
        st.fontFamily = cs.fontFamily;
        st.fontSize = cs.fontSize;
        st.fontWeight = cs.fontWeight;
        st.fontStyle = cs.fontStyle;
        st.lineHeight = cs.lineHeight;
        st.letterSpacing = cs.letterSpacing;
        st.paddingTop = cs.paddingTop;
        st.paddingRight = cs.paddingRight;
        st.paddingBottom = cs.paddingBottom;
        st.paddingLeft = cs.paddingLeft;
        st.whiteSpace = cs.whiteSpace;
        st.tabSize = cs.tabSize;
        st.wordBreak = cs.wordBreak;
        st.overflowWrap = cs.overflowWrap;
        if (w > 0) st.width = `${w}px`;
        if (h > 0) st.minHeight = `${h}px`;
    };

    const clearOverlay = () => {
        if (!overlayState.content) return;
        if (overlayState.lastKey === null && overlayState.content.innerHTML === '') return;
        overlayState.content.innerHTML = '';
        overlayState.lastKey = null;
        overlayState.lastText = null;
    };

    const renderSelectionOverlay = (text, selStart, selEnd) => {
        if (!overlayState.content) return;
        syncOverlayMetrics();
        const start = Math.max(0, Math.min(selStart, text.length));
        const end = Math.max(start, Math.min(selEnd, text.length));
        const before = escapeHtml(text.slice(0, start));
        const middle = escapeHtml(text.slice(start, end)) || '&nbsp;';
        const after = escapeHtml(text.slice(end));
        overlayState.content.innerHTML = before + `<span class="editor-selection">${middle}</span>` + after;
        overlayState.lastKey = `sel:${start}:${end}`;
        overlayState.lastText = text;
        selectionOverlayActive = true;
        syncOverlayScroll();
    };

    const clearSelectionOverlay = () => {
        if (!selectionOverlayActive) return;
        selectionOverlayActive = false;
        clearOverlay();
        scheduleBracketOverlay();
    };

    const renderOverlay = (text, openIdx, closeIdx, typeChar) => {
        if (!overlayState.content) return;
        const cls = BRACKET_CLASS[typeChar] || 'editor-bracket-paren';
        const openChar = escapeHtml(text[openIdx] || '');
        const closeChar = escapeHtml(text[closeIdx] || '');
        const before = escapeHtml(text.slice(0, openIdx));
        const between = escapeHtml(text.slice(openIdx + 1, closeIdx));
        const after = escapeHtml(text.slice(closeIdx + 1));
        const openSpan = `<span class="editor-bracket-match ${cls} editor-bracket-open">${openChar}</span>`;
        const closeSpan = `<span class="editor-bracket-match ${cls} editor-bracket-close">${closeChar}</span>`;
        overlayState.content.innerHTML = before + openSpan + between + closeSpan + after;
    };

    let overlayTicking = false;
    const updateBracketOverlay = () => {
        overlayTicking = false;
        if (!overlayState.content) return;
        syncOverlayMetrics();
        const text = ta.value || '';
        const selStart = ta.selectionStart ?? 0;
        const selEnd = ta.selectionEnd ?? 0;
        if (selStart !== selEnd) {
            clearOverlay();
            return;
        }
        let idx = -1;
        if (selStart > 0 && isBracket(text[selStart - 1])) {
            idx = selStart - 1;
        } else if (selStart < text.length && isBracket(text[selStart])) {
            idx = selStart;
        }
        if (idx < 0) {
            clearOverlay();
            return;
        }
        const match = findBracketMatch(text, idx);
        if (!match) {
            clearOverlay();
            return;
        }
        const key = `${match.open}:${match.close}:${match.type}`;
        if (overlayState.lastKey !== key || overlayState.lastText !== text) {
            overlayState.lastKey = key;
            overlayState.lastText = text;
            renderOverlay(text, match.open, match.close, match.type);
        }
        syncOverlayScroll();
    };

    const scheduleBracketOverlay = () => {
        if (selectionOverlayActive) return;
        if (overlayTicking) return;
        overlayTicking = true;
        requestAnimationFrame(updateBracketOverlay);
    };

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
    let saveWarnTimer = null;
    const warningHoldMs = 10000;
    const getStatusHold = () => {
        if (window.__mdwStatusHold && typeof window.__mdwStatusHold.isHeld === 'function') {
            return window.__mdwStatusHold;
        }
        const state = { until: 0 };
        const api = {
            hold(ms) {
                const next = Date.now() + Math.max(0, ms || 0);
                if (next > state.until) state.until = next;
                return state.until;
            },
            isHeld() {
                return Date.now() < state.until;
            },
        };
        window.__mdwStatusHold = api;
        return api;
    };
    const statusHold = getStatusHold();
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
    const showSaveWarning = (message) => {
        if (!status || !message) return;
        if (saveWarnTimer) clearTimeout(saveWarnTimer);
        status.textContent = message;
        status.style.color = 'var(--warning)';
        statusHold.hold(warningHoldMs);
        saveWarnTimer = setTimeout(() => {
            if (!status) return;
            status.textContent = '';
            status.style.color = '';
        }, warningHoldMs);
    };
    const clearSaveError = () => {
        if (saveErrorPanel) saveErrorPanel.hidden = true;
        if (saveErrorMessage) saveErrorMessage.textContent = '';
        if (saveErrorDetails) saveErrorDetails.textContent = '';
        if (saveErrorDetailsWrap) saveErrorDetailsWrap.hidden = true;
    };

    const publishBtn = document.getElementById('publishBtn');
    const submitForProcessingBtn = document.getElementById('submitForProcessingBtn');
    const publishStateSelect = document.getElementById('publishStateSelect');
    const publishStateOverride = document.getElementById('publishStateOverride');
    let currentPublishState = '';
    const isProcessingLikeState = (raw) => {
        const s = String(raw || '').trim().toLowerCase();
        return s === 'processing'
            || s === 'to publish' || s === 'topublish' || s === 'to-publish'
            || s === 'to delete' || s === 'todelete' || s === 'to-delete';
    };
    const normalizePublishState = (raw) => {
        const s = String(raw || '').trim().toLowerCase();
        if (!s) return '';
        if (s === 'published') return 'Published';
        if (isProcessingLikeState(s)) return 'Processing';
        return 'Concept';
    };
    currentPublishState = normalizePublishState(
        publishStateSelect instanceof HTMLSelectElement ? publishStateSelect.value : ''
    );
    const publishStateLabel = (state) => {
        const s = String(state || '').trim().toLowerCase();
        if (s === 'published') return t('edit.publish_state.published', 'Published');
        if (isProcessingLikeState(s)) return t('edit.publish_state.processing', 'Processing');
        return t('edit.publish_state.concept', 'Concept');
    };
    const publishStateIcon = (state) => {
        const s = String(state || '').trim().toLowerCase();
        if (s === 'published') return 'pi-checkedcertificate';
        if (isProcessingLikeState(s)) return 'pi-certificate';
        return 'pi-lightbulb';
    };
    const publishStateClass = (state) => {
        const s = String(state || '').trim().toLowerCase();
        if (s === 'published') return 'publish-published';
        if (isProcessingLikeState(s)) return 'publish-processing';
        return 'publish-concept';
    };
    const updatePublishBadge = (state) => {
        const row = mdm$('.note-item.nav-item-current');
        if (!(row instanceof HTMLElement)) return;
        row.dataset.publishState = String(state || '').trim().toLowerCase();
        const badge = row.querySelector('.badge-publish');
        if (!(badge instanceof HTMLElement)) return;
        const iconClass = publishStateIcon(state);
        const label = publishStateLabel(state);
        badge.textContent = '';
        if (iconClass) {
            const icon = document.createElement('span');
            icon.className = `pi ${iconClass}`;
            icon.setAttribute('aria-hidden', 'true');
            badge.appendChild(icon);
        }
        const text = document.createElement('span');
        text.textContent = label;
        badge.appendChild(text);
        badge.classList.remove('publish-concept', 'publish-processing', 'publish-published');
        badge.classList.add(publishStateClass(state));
        if (typeof window.__mdwSortOverviewNotes === 'function') {
            const mode = (document.getElementById('navSortSelect') instanceof HTMLSelectElement)
                ? String(document.getElementById('navSortSelect').value || 'date')
                : 'date';
            window.__mdwSortOverviewNotes(mode);
        }
    };
    const applyPublishStateUi = (stateRaw) => {
        const state = normalizePublishState(stateRaw);
        if (!state) return;
        currentPublishState = state;
        if (publishStateSelect instanceof HTMLSelectElement) {
            publishStateSelect.value = state;
        }
        const hasFile = !!String(window.CURRENT_FILE || '').trim()
            || !!String((editorForm instanceof HTMLFormElement ? editorForm.querySelector('input[name="file"]') : null)?.value || '').trim();
        if (publishBtn instanceof HTMLButtonElement || publishBtn instanceof HTMLInputElement) {
            publishBtn.disabled = !hasFile || state.toLowerCase() !== 'concept';
        }
        if (submitForProcessingBtn instanceof HTMLButtonElement || submitForProcessingBtn instanceof HTMLInputElement) {
            submitForProcessingBtn.disabled = !hasFile || state.toLowerCase() !== 'concept';
        }
        updatePublishBadge(state);
        if (typeof window.__mdwUpdateWpmPublicPageLink === 'function') {
            window.__mdwUpdateWpmPublicPageLink(window.CURRENT_FILE || '', state);
        }
    };
    window.__mdwApplyPublishStateUi = applyPublishStateUi;

    publishStateSelect?.addEventListener('change', () => {
        if (!(publishStateSelect instanceof HTMLSelectElement)) return;
        const state = normalizePublishState(publishStateSelect.value);
        if (!state) return;
        const previousState = normalizePublishState(currentPublishState || '');
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
        (async () => {
            const ok = await ajaxSave();
            if (ok) return;
            if (publishStateOverride instanceof HTMLInputElement) {
                publishStateOverride.value = '0';
            }
            if (previousState) {
                if (typeof window.__mdwSetMetaValue === 'function') {
                    window.__mdwSetMetaValue('publishstate', previousState);
                }
                applyPublishStateUi(previousState);
            }
        })();
    });

    let ignoreBeforeUnload = false;
    const setIgnoreBeforeUnload = () => { ignoreBeforeUnload = true; };
    const clearIgnoreBeforeUnload = () => { ignoreBeforeUnload = false; };

    editorForm?.addEventListener('submit', setIgnoreBeforeUnload);
    deleteForm?.addEventListener('submit', setIgnoreBeforeUnload);

    const ensureEditorFormAuthFields = () => {
        if (!(editorForm instanceof HTMLFormElement)) return;
        const ensureInput = (name, value) => {
            let input = editorForm.querySelector(`input[name="${name}"]`);
            if (!(input instanceof HTMLInputElement)) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                editorForm.appendChild(input);
            }
            input.value = String(value || '');
        };
        let role = '';
        let token = '';
        if (typeof window.__mdwAuthState === 'function') {
            const auth = window.__mdwAuthState();
            role = String(auth?.role || '').trim();
            token = String(auth?.token || '').trim();
        }
        if ((!role || !token) && typeof window.__mdwStorageGet === 'function') {
            role = role || String(window.__mdwStorageGet('mdw_auth_role') || '').trim();
            token = token || String(window.__mdwStorageGet('mdw_auth_token') || '').trim();
        }
        if (!role || !token) return;
        ensureInput('auth_role', role);
        ensureInput('auth_token', token);
    };

    const ajaxSave = async () => {
        if (!(editorForm instanceof HTMLFormElement)) return;
        if (!(ta instanceof HTMLTextAreaElement)) return;
        ensureEditorFormAuthFields();
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
                return false;
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
            const warnings = (data && typeof data === 'object' && Array.isArray(data.warnings))
                ? data.warnings.map((w) => String(w || '').trim()).filter(Boolean)
                : [];
            if (warnings.length) {
                const savedLabel = t('common.saved', 'Saved');
                showSaveWarning(savedLabel + ': ' + warnings.join(' '));
            } else if (status) {
                status.textContent = t('common.saved', 'Saved');
            }
            showSaveChip();
            clearSaveError();
            return true;
        } catch (err) {
            if (typeof window.__mdwReportNetworkError === 'function') {
                window.__mdwReportNetworkError(err);
            }
            if (status) status.textContent = t('js.save_failed', 'Save failed.');
            const detail = err && err.message ? String(err.message) : '';
            showSaveError(t('js.save_failed', 'Save failed.'), detail);
            showErrorModal(t('js.save_failed', 'Save failed.'), detail);
            return false;
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
        const publishAction = String((submitter instanceof HTMLElement ? submitter.getAttribute('value') : '')
            || (active ? active.getAttribute('value') : '') || '');
        if (publishAction === 'submit_for_processing') {
            e.preventDefault();
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'publish_action';
            actionInput.value = publishAction;
            editorForm.appendChild(actionInput);
            ajaxSave().finally(() => actionInput.remove());
            return;
        }
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
    let previewGeneration = 0;
    let visualPreviewInputActive = false;
    const cancelScheduledPreview = () => {
        previewGeneration += 1;
        if (!previewTimer) return;
        clearTimeout(previewTimer);
        previewTimer = null;
    };
    function schedulePreview() {
        if (!window.CURRENT_FILE) return;
        cancelScheduledPreview();
        previewTimer = setTimeout(sendPreview, 350);
        if (status && !statusHold.isHeld()) {
            status.textContent = t('js.preview_updating', 'Updating preview…');
        }
    }
    window.__mdwCancelScheduledPreview = cancelScheduledPreview;
    window.__mdwSyncEditorUiAfterExternalLoad = (previewSource = null) => {
        cancelScheduledPreview();
        updateLineNumbers();
        ln.scrollTop = ta.scrollTop;
        syncOverlayMetrics();
        syncOverlayScroll();
        scheduleBracketOverlay();
        scheduleLinkSuggest();
        if (typeof window.__mdwResetSelectionSync === 'function') {
            const source = (typeof previewSource === 'string')
                ? previewSource
                : ((typeof window.__mdwBuildPreviewContent === 'function') ? window.__mdwBuildPreviewContent() : ta.value);
            window.__mdwResetSelectionSync(source);
        }
    };

    const applyTocHotKeyword = (previewEl, rawText) => {
        if (!(previewEl instanceof HTMLElement)) return;
        const text = String(rawText || '');
        if (!/(^|\\n)\\s*\\{\\s*TOC\\s*\\}\\s*(\\n|$)/i.test(text)) return;
        if (previewEl.querySelector('[data-mdw-toc="1"]')) return;
        const readTocMenuSetting = () => {
            const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
            const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
            const raw = s && typeof s.toc_menu === 'string' ? s.toc_menu.trim().toLowerCase() : '';
            return (raw === 'left' || raw === 'right' || raw === 'inline') ? raw : 'inline';
        };

        const placeholder = (() => {
            const walker = document.createTreeWalker(previewEl, NodeFilter.SHOW_ELEMENT, {
                acceptNode(node) {
                    if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
                    if (node.closest('pre, code')) return NodeFilter.FILTER_SKIP;
                    const txt = (node.textContent || '').trim();
                    if (/^\{\s*TOC\s*\}$/i.test(txt)) return NodeFilter.FILTER_ACCEPT;
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

        const tocWrap = document.createElement('div');
        tocWrap.className = 'md-toc-wrap';
        tocWrap.dataset.mdwToc = '1';

        tocWrap.appendChild(document.createComment(' Table of contents '));
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
        tocWrap.appendChild(list);

        const tocMenu = readTocMenuSetting();
        const layoutMode = (tocMenu === 'left' || tocMenu === 'right') ? tocMenu : 'inline';
        const layout = document.createElement('div');
        layout.className = layoutMode === 'inline'
            ? 'md-toc-layout md-toc-inline'
            : `md-toc-layout md-toc-${layoutMode}`;
        layout.dataset.mdwTocLayout = layoutMode === 'inline' ? 'inline' : layoutMode;

        const nav = document.createElement('nav');
        nav.className = 'md-toc-side';
        nav.setAttribute('aria-label', 'Table of contents');
        nav.appendChild(tocWrap);

        const body = document.createElement('div');
        body.className = 'md-toc-body';

        layout.appendChild(nav);
        layout.appendChild(body);

        let node = placeholder.nextSibling;
        while (node) {
            const next = node.nextSibling;
            body.appendChild(node);
            node = next;
        }
        placeholder.replaceWith(layout);
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
        const generation = ++previewGeneration;
        try {
            if (!mdmApi || typeof mdmApi.form !== 'function') {
                throw new Error('network');
            }
            const fd = new FormData();
            const previewContent = (typeof window.__mdwBuildPreviewContent === 'function')
                ? window.__mdwBuildPreviewContent()
                : ta.value;
            fd.set('content', previewContent);
            const html = await mdmApi.form('edit.php?file=' + encodeURIComponent(window.CURRENT_FILE) + '&preview=1', fd);
            if (generation !== previewGeneration) return;
            if (typeof window.__mdwMarkOnline === 'function') {
                window.__mdwMarkOnline();
            }
            prev.innerHTML = html;
            if (typeof markPreviewGeneratedContent === 'function' && isVisualEditorMode()) {
                markPreviewGeneratedContent();
            }
            if (typeof window.__mdwResetSelectionSync === 'function') {
                window.__mdwResetSelectionSync(previewContent);
            }
            applyTocHotKeyword(prev, previewContent);
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
            if (status && !statusHold.isHeld()) {
                status.textContent = t('js.preview_up_to_date', 'Preview up to date');
            }
        } catch (err) {
            const detail = err && err.message ? String(err.message) : '';
            if (typeof window.__mdwReportNetworkError === 'function') {
                window.__mdwReportNetworkError(err);
            }
            showPreviewError(t('js.preview_failed', 'Preview failed.'), detail);
        }
    }
    window.__mdwSendPreview = sendPreview;

    const isVisualEditorMode = () => document.body?.classList.contains('hide-markdown-editor')
        && !document.body.classList.contains('mdw-show-markdown-source');
    const escapeMd = (value) => String(value || '').replace(/\u00a0/g, ' ').trim();
    const cleanHeadingText = (value) => {
        let text = String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        let prev = '';
        while (text && text !== prev) {
            prev = text;
            text = text
                .replace(/^\s*(?:\*\*|__)\s*(.*?)\s*(?:\*\*|__)\s*$/s, '$1')
                .replace(/^\s*(?:\*|_)\s*(.*?)\s*(?:\*|_)\s*$/s, '$1')
                .trim();
        }
        return text
            .replace(/(\*\*|__)([^*_].*?)\1/g, '$2')
            .replace(/(^|[\s([{])([*_])([^*_]+)\2(?=$|[\s)\]},.!?:;])/g, '$1$3')
            .replace(/\s+/g, ' ')
            .trim();
    };
    const cleanMarkdownHeadingLine = (line) => {
        const m = String(line || '').match(/^(\s*#{1,6})(\s+)(.*)$/);
        if (!m) return String(line || '');
        return `${m[1]}${m[2]}${cleanHeadingText(m[3])}`;
    };
    const inlineMarkdown = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return String(node.nodeValue || '').replace(/\s+/g, ' ');
        if (!(node instanceof Element)) return '';
        const tag = node.tagName.toLowerCase();
        const text = Array.from(node.childNodes).map(inlineMarkdown).join('');
        if (tag === 'br') return '<br>';
        if (tag === 'strong' || tag === 'b') return text.trim() ? `**${text.trim()}**` : '';
        if (tag === 'em' || tag === 'i') return text.trim() ? `*${text.trim()}*` : '';
        if (tag === 'u') return text.trim() ? `<u>${text.trim()}</u>` : '';
        if (tag === 'code') return text.trim() ? '`' + text.trim().replace(/`/g, '\\`') + '`' : '';
        if (tag === 'a') {
            const href = node.getAttribute('href') || '';
            return href ? `[${text.trim() || href}](${href})` : text;
        }
        if (tag === 'img') {
            const src = node.getAttribute('data-mdw-markdown-src') || node.getAttribute('src') || '';
            const alt = node.getAttribute('alt') || '';
            return src ? `![${alt}](${src})` : '';
        }
        return text;
    };
    const blockMarkdown = (node, depth = 0, orderedIndex = 1) => {
        if (node.nodeType === Node.TEXT_NODE) return escapeMd(node.nodeValue);
        if (!(node instanceof Element)) return '';
        if (node.hasAttribute('data-mdw-auto-section')) return '';
        const sectionInclude = node.getAttribute('data-mdw-section-include');
        if (sectionInclude) return `{% include "${sectionInclude}" %}`;
        const macroSource = node.getAttribute('data-mdw-macro-source');
        if (macroSource) {
            try { return atob(macroSource); } catch { return ''; }
        }
        if (node.matches('.md-meta, [data-mdw-generated]')) return '';
        if (node.matches('.md-toc-side, .md-toc-wrap[data-mdw-toc="1"]')) return '';
        if (node.matches('.md-toc-layout')) {
            const body = node.querySelector(':scope > .md-toc-body');
            const bodyBlocks = body instanceof Element
                ? Array.from(body.childNodes)
                    .map((child) => blockMarkdown(child, depth))
                    .map((s) => String(s || '').trim())
                    .filter(Boolean)
                : [];
            return ['{TOC}', ...bodyBlocks].join('\n\n');
        }
        if (node.matches('.md-toc-body')) {
            return Array.from(node.childNodes)
                .map((child) => blockMarkdown(child, depth))
                .map((s) => String(s || '').trim())
                .filter(Boolean)
                .join('\n\n');
        }
        const tag = node.tagName.toLowerCase();
        const alignClassFor = (el) => {
            if (!(el instanceof HTMLElement)) return '';
            if (el.classList.contains('right') || el.classList.contains('align-right')) return 'right';
            if (el.classList.contains('center') || el.classList.contains('align-center')) return 'center';
            const inlineAlign = String(el.style?.textAlign || '').trim().toLowerCase();
            if (inlineAlign === 'right' || inlineAlign === 'center') return inlineAlign;
            let computedAlign = '';
            try { computedAlign = String(window.getComputedStyle(el).textAlign || '').trim().toLowerCase(); } catch {}
            return (computedAlign === 'right' || computedAlign === 'center') ? computedAlign : '';
        };
        const withAlignAttr = (markdown, el) => {
            const align = alignClassFor(el);
            return align ? `${markdown}\n{: class="${align}" }` : markdown;
        };
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
            const level = Math.max(1, Math.min(6, Number(tag.slice(1)) || 1));
            return `${'#'.repeat(level)} ${escapeMd(inlineMarkdown(node))}`;
        }
        if (tag === 'div' || tag === 'section' || tag === 'article') {
            const containsGeneratedTemplate = !!node.querySelector('[data-mdw-section-include], [data-mdw-macro-source]');
            if (containsGeneratedTemplate) {
                const blocks = Array.from(node.childNodes)
                    .map((child) => blockMarkdown(child, depth))
                    .map((value) => String(value || '').trim())
                    .filter(Boolean);
                const content = blocks.join('\n\n');
                const className = String(node.getAttribute('class') || '')
                    .replace(/[^A-Za-z0-9_:\-\/\[\].%\s]+/g, '')
                    .trim()
                    .replace(/\s+/g, ' ');
                return className && content
                    ? `::: {class="${className}"}\n${content}\n:::`
                    : content;
            }
        }
        if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
            return withAlignAttr(escapeMd(inlineMarkdown(node)), node);
        }
        if (tag === 'blockquote') {
            return Array.from(node.childNodes)
                .map((child) => blockMarkdown(child, depth))
                .join('\n')
                .split('\n')
                .map((line) => line.trim() ? `> ${line}` : '>')
                .join('\n');
        }
        if (tag === 'pre') {
            const code = node.textContent || '';
            return '```\n' + code.replace(/\n+$/g, '') + '\n```';
        }
        if (tag === 'ul' || tag === 'ol') {
            let index = 1;
            return Array.from(node.children)
                .filter((child) => child instanceof HTMLElement && child.tagName.toLowerCase() === 'li')
                .map((child) => blockMarkdown(child, depth, index++))
                .join('\n');
        }
        if (tag === 'table') {
            const rows = Array.from(node.querySelectorAll('tr'))
                .map((row) => Array.from(row.children)
                    .filter((cell) => cell instanceof HTMLElement && ['td', 'th'].includes(cell.tagName.toLowerCase()))
                    .map((cell) => escapeMd(inlineMarkdown(cell)).replace(/\|/g, '\\|')));
            const usableRows = rows.filter((row) => row.length);
            if (!usableRows.length) return '';
            const colCount = Math.max(...usableRows.map((row) => row.length));
            const normalizeRow = (row) => Array.from({ length: colCount }, (_, idx) => row[idx] || ' ');
            const header = normalizeRow(usableRows[0]);
            const body = usableRows.slice(1).map(normalizeRow);
            const sep = Array.from({ length: colCount }, () => '---');
            return [header, sep, ...body]
                .map((row) => `| ${row.join(' | ')} |`)
                .join('\n');
        }
        if (tag === 'li') {
            const marker = node.parentElement?.tagName.toLowerCase() === 'ol' ? `${orderedIndex}.` : '-';
            const prefix = '  '.repeat(depth) + marker + ' ';
            const own = [];
            const nested = [];
            Array.from(node.childNodes).forEach((child) => {
                if (child instanceof Element && ['ul', 'ol'].includes(child.tagName.toLowerCase())) nested.push(blockMarkdown(child, depth + 1));
                else own.push(inlineMarkdown(child));
            });
            const head = prefix + escapeMd(own.join(''));
            return [head, ...nested.filter(Boolean)].filter(Boolean).join('\n');
        }
        if (tag === 'hr') return '---';
        return escapeMd(inlineMarkdown(node));
    };
    const previewHtmlToMarkdown = () => {
        const blocks = Array.from(prev.childNodes)
            .map((node) => blockMarkdown(node))
            .map((s) => String(s || '').trim())
            .filter(Boolean);
        return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    };
    const markPreviewGeneratedContent = () => {
        prev.querySelectorAll('.md-meta, [data-mdw-generated]').forEach((node) => {
            if (node instanceof HTMLElement) node.setAttribute('contenteditable', 'false');
        });
        prev.querySelectorAll('.md-toc-layout').forEach((node) => {
            if (node instanceof HTMLElement) node.setAttribute('contenteditable', 'false');
        });
        prev.querySelectorAll('.md-toc-body').forEach((node) => {
            if (node instanceof HTMLElement) node.setAttribute('contenteditable', 'true');
        });
        prev.querySelectorAll('.md-toc-side, .md-toc-wrap[data-mdw-toc="1"]').forEach((node) => {
            if (node instanceof HTMLElement) node.setAttribute('contenteditable', 'false');
        });
        prev.querySelectorAll('[data-mdw-section-include]').forEach((node) => {
            if (node instanceof HTMLElement) node.setAttribute('contenteditable', 'false');
        });
        prev.querySelectorAll('[data-mdw-macro-source]').forEach((node) => {
            if (node instanceof HTMLElement) node.setAttribute('contenteditable', 'false');
        });
    };
    let visualSelectionRange = null;
    const isRangeInPreview = (range) => {
        if (!range) return false;
        return prev.contains(range.startContainer) && prev.contains(range.endContainer);
    };
    const saveVisualSelection = () => {
        if (!isVisualEditorMode()) return;
        const sel = window.getSelection?.();
        if (!sel || sel.rangeCount < 1) return;
        const range = sel.getRangeAt(0);
        if (!isRangeInPreview(range)) return;
        visualSelectionRange = range.cloneRange();
    };
    const restoreVisualSelection = () => {
        if (!isVisualEditorMode()) return false;
        if (!visualSelectionRange || !isRangeInPreview(visualSelectionRange)) return false;
        const sel = window.getSelection?.();
        if (!sel) return false;
        sel.removeAllRanges();
        sel.addRange(visualSelectionRange);
        return true;
    };
    const syncVisualPreviewToTextarea = () => {
        const next = previewHtmlToMarkdown();
        if (ta.value === next) return;
        cancelScheduledPreview();
        visualPreviewInputActive = true;
        try {
            ta.value = next;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        } finally {
            visualPreviewInputActive = false;
        }
    };
    const runVisualCommand = (command, value = null) => {
        if (!isVisualEditorMode()) return false;
        restoreVisualSelection();
        prev.focus();
        const ok = document.execCommand(command, false, value);
        saveVisualSelection();
        syncVisualPreviewToTextarea();
        return ok;
    };
    const isVisualSelectionInHeading = () => {
        if (!isVisualEditorMode()) return false;
        restoreVisualSelection();
        const sel = window.getSelection?.();
        if (!sel || !sel.rangeCount) return false;
        const range = sel.getRangeAt(0);
        const node = range.commonAncestorContainer;
        const el = node instanceof Element ? node : node?.parentElement;
        if (el instanceof Element && el.closest('h1, h2, h3, h4, h5, h6')) return true;
        const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
        const focus = sel.focusNode instanceof Element ? sel.focusNode : sel.focusNode?.parentElement;
        return !!(
            (anchor instanceof Element && anchor.closest('h1, h2, h3, h4, h5, h6')) ||
            (focus instanceof Element && focus.closest('h1, h2, h3, h4, h5, h6'))
        );
    };
    const runVisualCommandWithSelection = (fn) => {
        if (!isVisualEditorMode() || typeof fn !== 'function') return false;
        restoreVisualSelection();
        prev.focus();
        const ok = fn();
        saveVisualSelection();
        syncVisualPreviewToTextarea();
        return ok !== false;
    };
    const getVisualSelectedText = () => {
        restoreVisualSelection();
        const sel = window.getSelection?.();
        if (!sel || sel.rangeCount < 1) return '';
        const range = sel.getRangeAt(0);
        if (!isRangeInPreview(range)) return '';
        return String(sel.toString() || '');
    };
    const getVisualInsertionRange = () => {
        restoreVisualSelection();
        const sel = window.getSelection?.();
        if (!sel || sel.rangeCount < 1) return null;
        const range = sel.getRangeAt(0);
        if (!isRangeInPreview(range)) return null;
        const node = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
        const block = node instanceof Element ? node.closest('h1,h2,h3,h4,h5,h6,p,li,blockquote') : null;
        const text = String(block?.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return null;

        const source = String(ta.value || '');
        const plainMarkdown = (value) => String(value || '')
            .replace(/!\[([^\]]*)\]\([^\n)]*(?:\([^\n)]*\)[^\n)]*)*\)/g, '$1')
            .replace(/\[([^\]]+)\]\([^\n)]*(?:\([^\n)]*\)[^\n)]*)*\)/g, '$1')
            .replace(/\{:\s*[^}]*\}/g, '')
            .replace(/<br\s*\/?>/gi, '')
            .replace(/^\s*(?:#{1,6}\s+|[-+*]\s+|>\s?|\d+[.)]\s+)/gm, '')
            .replace(/[*_`~]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const candidates = [];
        let offset = 0;
        source.split(/\n{2,}/).forEach((rawBlock) => {
            const start = source.indexOf(rawBlock, offset);
            offset = start + rawBlock.length;
            const plain = plainMarkdown(rawBlock);
            if (!plain || (plain !== text && !plain.includes(text))) return;
            candidates.push(start + rawBlock.length);
        });
        if (!candidates.length) return null;
        const current = Number(ta.selectionStart || 0);
        const end = candidates.reduce((best, candidate) => (
            Math.abs(candidate - current) < Math.abs(best - current) ? candidate : best
        ), candidates[0]);
        return { start: end, end };
    };
    const markdownImageSrc = (src) => {
        const raw = String(src || '').trim();
        const imageBase = String(window.MDW_IMAGES_URL || 'images').replace(/\\/g, '/').replace(/\/$/, '');
        const token = raw.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
        if (token) return `${imageBase}/${encodeURIComponent(token[1].trim())}`;
        return raw;
    };
    let selectedVisualImage = null;
    const clearSelectedVisualImage = () => {
        if (selectedVisualImage instanceof HTMLElement) selectedVisualImage.classList.remove('is-selected');
        selectedVisualImage = null;
    };
    const selectVisualImage = (img) => {
        if (!(img instanceof HTMLImageElement) || !prev.contains(img)) return false;
        clearSelectedVisualImage();
        selectedVisualImage = img;
        img.classList.add('is-selected');
        const range = document.createRange();
        range.selectNode(img);
        visualSelectionRange = range.cloneRange();
        const sel = window.getSelection?.();
        if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
        return true;
    };
    const deleteSelectedVisualImage = () => {
        if (!(selectedVisualImage instanceof HTMLImageElement) || !prev.contains(selectedVisualImage)) return false;
        const img = selectedVisualImage;
        clearSelectedVisualImage();
        img.remove();
        visualSelectionRange = null;
        syncVisualPreviewToTextarea();
        return true;
    };
    const buildBasicTableHtml = (rows = 2, cols = 2) => {
        const safeRows = Math.max(1, Math.min(12, Number(rows) || 2));
        const safeCols = Math.max(1, Math.min(8, Number(cols) || 2));
        const head = '<tr>' + Array.from({ length: safeCols }, (_, idx) => `<th>Kolom ${idx + 1}</th>`).join('') + '</tr>';
        const body = Array.from({ length: safeRows }, (_, rowIdx) => (
            '<tr>' + Array.from({ length: safeCols }, (_, colIdx) => `<td>Cel ${rowIdx + 1}.${colIdx + 1}</td>`).join('') + '</tr>'
        )).join('');
        return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
    };
    const isMarkdownTable = (text) => {
        const lines = String(text || '').trim().split('\n').map((line) => line.trim()).filter(Boolean);
        return lines.length >= 2 && lines[0].startsWith('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[1]);
    };
    const insertVisualTable = () => insertVisualHtml(buildBasicTableHtml(2, 2));
    const toggleVisualBlockquote = () => runVisualCommandWithSelection(() => {
        const sel = window.getSelection?.();
        const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        const node = range ? (range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement) : null;
        const quote = node instanceof Element ? node.closest('blockquote') : null;
        if (quote instanceof HTMLElement && prev.contains(quote)) {
            const parent = quote.parentNode;
            if (!parent) return false;
            const frag = document.createDocumentFragment();
            while (quote.firstChild) frag.appendChild(quote.firstChild);
            parent.insertBefore(frag, quote);
            quote.remove();
            return true;
        }
        return document.execCommand('formatBlock', false, 'blockquote');
    });
    const insertVisualHtml = (html) => {
        if (!isVisualEditorMode()) return false;
        restoreVisualSelection();
        prev.focus();
        document.execCommand('insertHTML', false, html);
        saveVisualSelection();
        syncVisualPreviewToTextarea();
        return true;
    };
    const insertVisualMarkdown = (markdown) => {
        const text = String(markdown || '');
        if (!isVisualEditorMode()) return false;
        if (isMarkdownTable(text)) {
            return insertVisualTable();
        }
        const imageMatch = text.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
        if (imageMatch) {
            const alt = escapeHtml(imageMatch[1] || '');
            const markdownSrc = imageMatch[2] || '';
            const src = escapeHtml(markdownImageSrc(markdownSrc));
            return insertVisualHtml(`<img src="${src}" alt="${alt}" data-mdw-markdown-src="${escapeHtml(markdownSrc)}">`);
        }
        const linkMatch = text.match(/^\[([^\]]*)\]\(([^)]+)\)/);
        if (linkMatch) {
            const label = linkMatch[1] || linkMatch[2] || '';
            const href = linkMatch[2] || '';
            restoreVisualSelection();
            const selectedText = getVisualSelectedText();
            if (selectedText && selectedText.trim() === String(label || '').trim()) {
                const ok = runVisualCommand('createLink', href);
                const sel = window.getSelection?.();
                const node = sel && sel.anchorNode ? (sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement) : null;
                const link = node instanceof Element ? node.closest('a') : null;
                if (link instanceof HTMLAnchorElement) link.classList.add('link');
                return ok;
            }
            return insertVisualHtml(`<a href="${escapeHtml(href)}" class="link">${escapeHtml(label)}</a>`);
        }
        restoreVisualSelection();
        prev.focus();
        document.execCommand('insertText', false, text);
        saveVisualSelection();
        syncVisualPreviewToTextarea();
        return true;
    };
    window.__mdwVisualEditorMode = isVisualEditorMode;
    window.__mdwSaveVisualSelection = saveVisualSelection;
    window.__mdwGetVisualSelectionText = getVisualSelectedText;
    window.__mdwGetVisualInsertionRange = getVisualInsertionRange;
    window.__mdwInsertMarkdownAtSelection = insertVisualMarkdown;
    window.__mdwInsertVisualTable = insertVisualTable;
    window.__mdwToggleVisualBlockquote = toggleVisualBlockquote;
    window.__mdwRunVisualCommand = runVisualCommand;
    window.__mdwRunVisualCommandWithSelection = runVisualCommandWithSelection;
    window.__mdwIsVisualSelectionInHeading = isVisualSelectionInHeading;
    window.__mdwSyncVisualPreviewToTextarea = syncVisualPreviewToTextarea;
    const enableVisualPreviewEditing = () => {
        if (!isVisualEditorMode()) return;
        prev.setAttribute('contenteditable', 'true');
        prev.setAttribute('role', 'textbox');
        prev.setAttribute('aria-multiline', 'true');
        markPreviewGeneratedContent();
        prev.addEventListener('keyup', saveVisualSelection);
        prev.addEventListener('mouseup', saveVisualSelection);
        prev.addEventListener('focus', saveVisualSelection);
        prev.addEventListener('blur', saveVisualSelection);
        prev.addEventListener('click', (e) => {
            const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
            if (link instanceof HTMLAnchorElement && prev.contains(link)) {
                const href = String(link.getAttribute('href') || '').trim();
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (href) window.open(link.href, '_blank', 'noopener');
                    return;
                }
                e.preventDefault();
                clearSelectedVisualImage();
                const range = document.createRange();
                range.selectNodeContents(link);
                visualSelectionRange = range.cloneRange();
                const sel = window.getSelection?.();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                if (typeof window.__mdwOpenLinkModal === 'function') {
                    window.__mdwOpenLinkModal({ linkEl: link });
                }
                return;
            }

            const target = e.target instanceof Element ? e.target.closest('img') : null;
            if (target instanceof HTMLImageElement && prev.contains(target)) {
                e.preventDefault();
                selectVisualImage(target);
            } else {
                clearSelectedVisualImage();
            }
        });
        document.addEventListener('selectionchange', saveVisualSelection);
        prev.addEventListener('keydown', (e) => {
            if ((e.key === 'Backspace' || e.key === 'Delete') && deleteSelectedVisualImage()) {
                e.preventDefault();
                return;
            }
            const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
            if (!mod) return;
            if (e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                runVisualCommand(e.shiftKey ? 'redo' : 'undo');
                return;
            }
            if (!e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                runVisualCommand('redo');
                return;
            }
            if (!e.shiftKey && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                if (isVisualSelectionInHeading()) {
                    syncVisualPreviewToTextarea();
                    return;
                }
                runVisualCommand('bold');
                return;
            }
            if (!e.shiftKey && (e.key === 'i' || e.key === 'I')) {
                e.preventDefault();
                runVisualCommand('italic');
                return;
            }
            if (!e.shiftKey && (e.key === 'u' || e.key === 'U')) {
                e.preventDefault();
                runVisualCommand('underline');
            }
        });
        prev.addEventListener('input', () => {
            saveVisualSelection();
            syncVisualPreviewToTextarea();
        });
    };
    enableVisualPreviewEditing();

    ta.addEventListener('input', function(){
        updateLineNumbers();
        recomputeDirty();
        if (!visualPreviewInputActive) schedulePreview();
        scheduleBracketOverlay();
        scheduleLinkSuggest();
    });
    const canHandleDrop = (dt) => {
        if (!dt) return false;
        try {
            const types = Array.from(dt.types || []);
            if (types.includes('text/mdw-file')) return true;
        } catch {}
        try {
            return !!getDropNoteInfo(dt);
        } catch {
            return false;
        }
    };
    ta.addEventListener('dragover', (e) => {
        if (!canHandleDrop(e.dataTransfer)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    ta.addEventListener('drop', (e) => {
        const info = getDropNoteInfo(e.dataTransfer);
        if (!info) return;
        e.preventDefault();
        e.stopPropagation();
        const file = info.file;
        const title = info.title;
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        const selection = start !== end ? ta.value.slice(start, end) : '';
        const base = file.split('/').pop() || file;
        const fallback = base.replace(/\.md$/i, '');
        const text = selection || title || fallback || file;
        const href = buildInternalHref(window.CURRENT_FILE || '', file) || file;
        insertAtSelection(`[${text}](${href}) {: class="link"}`);
    });
    ta.addEventListener('scroll', function(){
        ln.scrollTop = ta.scrollTop;
        syncOverlayScroll();
        positionLinkSuggest();
    });
    ta.addEventListener('keyup', () => {
        scheduleBracketOverlay();
        scheduleLinkSuggest();
    });
    ta.addEventListener('keydown', (e) => {
        if (!linkSuggestState.open) return;
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            hideLinkSuggest();
        }
    });
    ta.addEventListener('mouseup', () => {
        scheduleBracketOverlay();
        scheduleLinkSuggest();
    });
    ta.addEventListener('focus', () => {
        scheduleBracketOverlay();
        scheduleLinkSuggest();
    });
    document.addEventListener('selectionchange', () => {
        if (document.activeElement === ta) {
            scheduleBracketOverlay();
            scheduleLinkSuggest();
        }
    });
    window.addEventListener('resize', positionLinkSuggest);

    const selectionSync = (() => {
        let mapCache = new WeakMap();
        let previewSource = null;
        let syncing = false;
        let scheduled = false;
        let previewHighlights = [];
        const debug = (...args) => {
            if (!window.MDW_SELECTION_DEBUG) return;
            console.info('[mdw-selection]', ...args);
        };

        const clearPreviewHighlights = () => {
            if (!previewHighlights.length) return;
            previewHighlights.forEach((span) => {
                const parent = span.parentNode;
                if (!parent) return;
                while (span.firstChild) parent.insertBefore(span.firstChild, span);
                parent.removeChild(span);
                parent.normalize();
            });
            previewHighlights = [];
        };

        const reset = (source) => {
            previewSource = String(source ?? '');
            mapCache = new WeakMap();
            clearPreviewHighlights();
            clearSelectionOverlay();
            const count = prev instanceof HTMLElement
                ? prev.querySelectorAll('[data-mdw-src-start]').length
                : 0;
            debug('reset', { length: previewSource.length, blocks: count });
        };

        const getSource = () => {
            if (previewSource !== null) return previewSource;
            return (typeof window.__mdwBuildPreviewContent === 'function') ? window.__mdwBuildPreviewContent() : ta.value;
        };

        const normalizeText = (value) => String(value ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');

        const isTableSeparatorLine = (line) => {
            const trimmed = String(line || '').trim();
            if (!trimmed) return false;
            if (!trimmed.includes('|')) return false;
            return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(trimmed);
        };

        const findMatchingParen = (text, start) => {
            let depth = 0;
            for (let i = start; i < text.length; i++) {
                const ch = text[i];
                if (ch === '(') {
                    depth += 1;
                } else if (ch === ')') {
                    depth -= 1;
                    if (depth === 0) return i;
                }
            }
            return -1;
        };

        const parseInlineInto = (segment, base, emit, opts) => {
            let i = 0;
            const len = segment.length;
            while (i < len) {
                const ch = segment[i];
                if (opts.table && ch === '|') {
                    emit(' ', base + i);
                    i += 1;
                    continue;
                }
                if (ch === '\\' && i + 1 < len) {
                    emit(segment[i + 1], base + i + 1);
                    i += 2;
                    continue;
                }
                if (ch === '`') {
                    const end = segment.indexOf('`', i + 1);
                    if (end !== -1) {
                        for (let k = i + 1; k < end; k++) {
                            emit(segment[k], base + k);
                        }
                        i = end + 1;
                        continue;
                    }
                }
                if (ch === '!' && segment[i + 1] === '[') {
                    const close = segment.indexOf(']', i + 2);
                    if (close !== -1 && segment[close + 1] === '(') {
                        const endParen = findMatchingParen(segment, close + 1);
                        if (endParen !== -1) {
                            i = endParen + 1;
                            continue;
                        }
                    }
                }
                if (ch === '[' && segment[i + 1] === '^') {
                    const close = segment.indexOf(']', i + 2);
                    if (close !== -1) {
                        for (let k = i + 2; k < close; k++) {
                            emit(segment[k], base + k);
                        }
                        i = close + 1;
                        continue;
                    }
                }
                if (ch === '[') {
                    const close = segment.indexOf(']', i + 1);
                    if (close !== -1) {
                        const next = segment[close + 1];
                        if (next === '(') {
                            const endParen = findMatchingParen(segment, close + 1);
                            if (endParen !== -1) {
                                const inner = segment.slice(i + 1, close);
                                parseInlineInto(inner, base + i + 1, emit, opts);
                                i = endParen + 1;
                                continue;
                            }
                        } else if (next === '[') {
                            const close2 = segment.indexOf(']', close + 2);
                            if (close2 !== -1) {
                                const ref = segment.slice(close + 2, close2);
                                if (/^\d+$/.test(ref)) {
                                    for (let k = 0; k < ref.length; k++) {
                                        emit(ref[k], base + close + 2 + k);
                                    }
                                } else {
                                    const inner = segment.slice(i + 1, close);
                                    parseInlineInto(inner, base + i + 1, emit, opts);
                                }
                                i = close2 + 1;
                                continue;
                            }
                        }
                    }
                }
                if (ch === '~' && segment[i + 1] === '~') {
                    const end = segment.indexOf('~~', i + 2);
                    if (end !== -1) {
                        const inner = segment.slice(i + 2, end);
                        parseInlineInto(inner, base + i + 2, emit, opts);
                        i = end + 2;
                        continue;
                    }
                }
                if (ch === '*' && segment[i + 1] === '*') {
                    const end = segment.indexOf('**', i + 2);
                    if (end !== -1) {
                        const inner = segment.slice(i + 2, end);
                        parseInlineInto(inner, base + i + 2, emit, opts);
                        i = end + 2;
                        continue;
                    }
                }
                if (ch === '*') {
                    const end = segment.indexOf('*', i + 1);
                    if (end !== -1) {
                        const inner = segment.slice(i + 1, end);
                        parseInlineInto(inner, base + i + 1, emit, opts);
                        i = end + 1;
                        continue;
                    }
                }
                if (ch === '<') {
                    const gt = segment.indexOf('>', i + 1);
                    if (gt !== -1) {
                        const tag = segment.slice(i + 1, gt).trim();
                        const name = tag.replace(/^\//, '').split(/\s+/)[0].replace(/\/$/, '').toLowerCase();
                        if (name === 'br' || name === 'hr') {
                            emit('\n', base + i);
                        }
                        i = gt + 1;
                        continue;
                    }
                }
                emit(ch, base + i);
                i += 1;
            }
        };

        const buildPlainTextMap = (raw, baseOffset, opts) => {
            const textOut = [];
            const mapOut = [];
            const emit = (ch, idx) => {
                textOut.push(ch);
                mapOut.push(idx);
            };
            const lines = String(raw || '').split('\n');
            let offset = 0;
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                let line = lines[lineIdx];
                let lineBase = baseOffset + offset;

                const isFirst = lineIdx === 0;
                const isLast = lineIdx === lines.length - 1;

                if (opts.stripFence && ((isFirst || isLast) && /^\s*```/.test(line))) {
                    offset += line.length + 1;
                    if (!isLast) emit('\n', baseOffset + offset - 1);
                    continue;
                }

                if (opts.blockquote) {
                    const m = line.match(/^(\s*>\s?)/);
                    if (m) {
                        line = line.slice(m[1].length);
                        lineBase += m[1].length;
                    }
                }

                if (opts.stripHeading && isFirst) {
                    const m = line.match(/^(\s*#{1,6}\s+)/);
                    if (m) {
                        line = line.slice(m[1].length);
                        lineBase += m[1].length;
                    }
                }

                if (opts.stripList && isFirst) {
                    const m = line.match(/^(\s*(?:[-*]|\d+\.)\s+)/);
                    if (m) {
                        line = line.slice(m[1].length);
                        lineBase += m[1].length;
                    }
                }

                if (opts.table && isTableSeparatorLine(line)) {
                    offset += line.length + 1;
                    if (!isLast) emit('\n', baseOffset + offset - 1);
                    continue;
                }

                if (opts.code) {
                    for (let k = 0; k < line.length; k++) {
                        emit(line[k], lineBase + k);
                    }
                } else {
                    parseInlineInto(line, lineBase, emit, opts);
                }

                offset += line.length + 1;
                if (!isLast) emit('\n', baseOffset + offset - 1);
            }
            return { text: textOut.join(''), map: mapOut };
        };

        const getBlockOptions = (el) => {
            const tag = (el.tagName || '').toLowerCase();
            const opts = { table: false, code: false, stripFence: false, stripList: false, stripHeading: false, blockquote: false };
            if (tag === 'li') opts.stripList = true;
            if (tag === 'pre') {
                opts.code = true;
                opts.stripFence = true;
            }
            if (tag === 'table') opts.table = true;
            if (tag === 'blockquote') opts.blockquote = true;
            if (tag.length === 2 && tag[0] === 'h') opts.stripHeading = true;
            if (el.classList && el.classList.contains('md-math-block')) opts.code = true;
            return opts;
        };

        const buildDisplayToSource = (sourceText, sourceMap, displayText) => {
            if (!sourceMap || !sourceMap.length) return [];
            if (sourceText === displayText) return sourceMap.slice();
            const displayToSource = new Array(displayText.length);
            let srcIdx = 0;
            let matched = 0;
            for (let i = 0; i < displayText.length; i++) {
                const ch = displayText[i];
                while (srcIdx < sourceText.length && sourceText[srcIdx] !== ch) srcIdx += 1;
                if (srcIdx < sourceText.length) {
                    displayToSource[i] = sourceMap[srcIdx];
                    srcIdx += 1;
                    matched += 1;
                } else {
                    displayToSource[i] = sourceMap[sourceMap.length - 1] ?? 0;
                }
            }
            if (displayText.length && (matched / displayText.length) < 0.6) {
                const max = sourceMap.length - 1;
                return displayText.split('').map((_, i) => {
                    const ratio = displayText.length > 1 ? i / (displayText.length - 1) : 0;
                    return sourceMap[Math.round(ratio * max)];
                });
            }
            return displayToSource;
        };

        const buildSourcePoints = (displayToSource) => {
            const points = [];
            for (let i = 0; i < displayToSource.length; i++) {
                const src = displayToSource[i];
                if (Number.isFinite(src)) points.push({ src, display: i });
            }
            points.sort((a, b) => (a.src - b.src) || (a.display - b.display));
            return points;
        };

        const getBodyStart = (raw) => {
            const fn = window.__mdwExtractMetaAndBody;
            if (typeof fn === 'function') {
                const body = fn(raw)?.body ?? '';
                const rawStr = String(raw ?? '');
                return Math.max(0, rawStr.length - String(body).length);
            }
            const str = String(raw ?? '');
            const lines = str.replace(/\r\n?/g, '\n').split('\n');
            let idx = 0;
            let inMeta = true;
            let seenMeta = false;
            for (const line of lines) {
                const normalized = String(line ?? '')
                    .replace(/\u00a0/g, ' ')
                    .replace(/[\u200B\uFEFF]/g, '');
                if (inMeta) {
                    if (/^\s*\{+\s*[A-Za-z][A-Za-z0-9_-]*\s*:\s*.*?\s*\}+\s*$/.test(line)) {
                        seenMeta = true;
                    } else if (/^\s*_+[A-Za-z][A-Za-z0-9_-]*\s*:\s*.*?\s*_+\s*$/.test(line)) {
                        seenMeta = true;
                    } else if (!seenMeta && normalized.trim() === '') {
                        // keep leading blanks
                    } else {
                        inMeta = false;
                    }
                }
                if (!inMeta) break;
                idx += line.length + 1;
            }
            return idx;
        };

        const getOffsetMap = () => {
            const preview = getSource();
            const editor = ta.value;
            if (preview === editor) {
                return { preview, editor, delta: 0, previewBodyStart: 0, editorBodyStart: 0 };
            }
            const previewBodyStart = getBodyStart(preview);
            const editorBodyStart = getBodyStart(editor);
            const delta = previewBodyStart - editorBodyStart;
            return { preview, editor, delta, previewBodyStart, editorBodyStart };
        };

        const editorToPreviewOffset = (offset, map) => {
            if (!map || map.delta === 0) return offset;
            if (offset < map.editorBodyStart) return null;
            return offset + map.delta;
        };

        const previewToEditorOffset = (offset, map) => {
            if (!map || map.delta === 0) return offset;
            if (offset < map.previewBodyStart) return null;
            const next = offset - map.delta;
            return Math.max(map.editorBodyStart, next);
        };

        const getMapForElement = (el) => {
            if (!(el instanceof HTMLElement)) return null;
            const cached = mapCache.get(el);
            if (cached) return cached;
            const start = Number(el.dataset.mdwSrcStart);
            const end = Number(el.dataset.mdwSrcEnd);
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
            const source = getSource();
            const raw = source.slice(start, end);
            const opts = getBlockOptions(el);
            const built = buildPlainTextMap(raw, start, opts);
            const sourceText = normalizeText(built.text);
            const displayText = normalizeText(el.textContent || '');
            const displayToSource = buildDisplayToSource(sourceText, built.map, displayText);
            const info = {
                start,
                end,
                sourceText,
                displayText,
                displayToSource,
                sourcePoints: buildSourcePoints(displayToSource),
            };
            mapCache.set(el, info);
            return info;
        };

        const getBlockFromNode = (node) => {
            let el = node instanceof HTMLElement ? node : (node && node.parentElement ? node.parentElement : null);
            while (el && el !== prev) {
                if (el.dataset && el.dataset.mdwSrcStart) return el;
                el = el.parentElement;
            }
            return null;
        };

        const findBlockForOffset = (offset) => {
            const nodes = prev.querySelectorAll('[data-mdw-src-start]');
            let best = null;
            let bestSize = Infinity;
            nodes.forEach((el) => {
                const start = Number(el.dataset.mdwSrcStart);
                const end = Number(el.dataset.mdwSrcEnd);
                if (!Number.isFinite(start) || !Number.isFinite(end)) return;
                if (offset < start || offset > end) return;
                const size = end - start;
                if (size < bestSize) {
                    best = el;
                    bestSize = size;
                }
            });
            return best;
        };

        const getDisplayIndex = (el, container, offset) => {
            try {
                const range = document.createRange();
                range.setStart(el, 0);
                range.setEnd(container, offset);
                return range.toString().length;
            } catch {
                return 0;
            }
        };

        const findNodeAtIndex = (el, index) => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let remaining = Math.max(0, index);
            let last = null;
            while (walker.nextNode()) {
                const node = walker.currentNode;
                last = node;
                const len = node.nodeValue ? node.nodeValue.length : 0;
                if (remaining <= len) return { node, offset: remaining };
                remaining -= len;
            }
            if (last) return { node: last, offset: last.nodeValue ? last.nodeValue.length : 0 };
            return null;
        };

        const displayIndexToSource = (info, index, preferEnd) => {
            if (!info || !info.displayToSource || !info.displayToSource.length) return info ? info.start : 0;
            const max = info.displayToSource.length - 1;
            let idx = Math.max(0, Math.min(index, max));
            let src = info.displayToSource[idx];
            if (!Number.isFinite(src)) {
                let left = idx - 1;
                let right = idx + 1;
                while (left >= 0 || right <= max) {
                    if (left >= 0 && Number.isFinite(info.displayToSource[left])) {
                        src = info.displayToSource[left];
                        break;
                    }
                    if (right <= max && Number.isFinite(info.displayToSource[right])) {
                        src = info.displayToSource[right];
                        break;
                    }
                    left -= 1;
                    right += 1;
                }
            }
            if (!Number.isFinite(src)) src = info.start;
            if (preferEnd) src += 1;
            if (src < info.start) src = info.start;
            if (src > info.end) src = info.end;
            return src;
        };

        const sourceOffsetToDisplay = (info, offset) => {
            if (!info || !info.sourcePoints || !info.sourcePoints.length) return 0;
            const points = info.sourcePoints;
            let lo = 0;
            let hi = points.length - 1;
            let best = points.length - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (points[mid].src >= offset) {
                    best = mid;
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            }
            return points[best] ? points[best].display : 0;
        };

        const selectPreviewRange = (startEl, startIndex, endEl, endIndex) => {
            const startPos = findNodeAtIndex(startEl, startIndex);
            const endPos = findNodeAtIndex(endEl, endIndex);
            if (!startPos || !endPos) return;
            const sel = document.getSelection();
            if (!sel) return;
            const range = document.createRange();
            range.setStart(startPos.node, startPos.offset);
            range.setEnd(endPos.node, endPos.offset);
            sel.removeAllRanges();
            sel.addRange(range);
        };

        const highlightTextRange = (el, startIndex, endIndex) => {
            if (!(el instanceof HTMLElement)) return;
            const start = Math.max(0, startIndex);
            const end = Math.max(start, endIndex);
            if (start === end) return;
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let offset = 0;
            while (walker.nextNode()) {
                const node = walker.currentNode;
                const value = node.nodeValue || '';
                const len = value.length;
                const nodeStart = offset;
                const nodeEnd = offset + len;
                if (end <= nodeStart) break;
                if (start >= nodeEnd) {
                    offset = nodeEnd;
                    continue;
                }
                const sliceStart = Math.max(0, start - nodeStart);
                const sliceEnd = Math.min(len, end - nodeStart);
                let target = node;
                if (sliceStart > 0) target = target.splitText(sliceStart);
                if (sliceEnd - sliceStart < target.nodeValue.length) {
                    target.splitText(sliceEnd - sliceStart);
                }
                const span = document.createElement('span');
                span.className = 'mdw-preview-selection';
                target.parentNode?.insertBefore(span, target);
                span.appendChild(target);
                previewHighlights.push(span);
                offset = nodeEnd;
            }
        };

        const highlightPreviewRange = (startEl, startIndex, endEl, endIndex) => {
            clearPreviewHighlights();
            if (!(startEl instanceof HTMLElement) || !(endEl instanceof HTMLElement)) return;
            if (startEl === endEl) {
                highlightTextRange(startEl, startIndex, endIndex);
                return;
            }
            const startOffset = Number(startEl.dataset.mdwSrcStart);
            const endOffset = Number(endEl.dataset.mdwSrcEnd);
            if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) return;
            const blocks = Array.from(prev.querySelectorAll('[data-mdw-src-start]'));
            blocks.forEach((block) => {
                const s = Number(block.dataset.mdwSrcStart);
                const e = Number(block.dataset.mdwSrcEnd);
                if (!Number.isFinite(s) || !Number.isFinite(e)) return;
                if (e < startOffset || s > endOffset) return;
                if (block === startEl) {
                    highlightTextRange(block, startIndex, Number.POSITIVE_INFINITY);
                } else if (block === endEl) {
                    highlightTextRange(block, 0, endIndex);
                } else if (block instanceof HTMLElement) {
                    highlightTextRange(block, 0, (block.textContent || '').length);
                }
            });
        };

        const syncFromEditor = () => {
            const map = getOffsetMap();
            const source = map.preview;
            clearSelectionOverlay();
            const start = ta.selectionStart ?? 0;
            const end = ta.selectionEnd ?? 0;
            if (start === end) {
                debug('skip editor sync: empty selection', { start, end });
                return;
            }
            const previewStart = editorToPreviewOffset(start, map);
            const previewEnd = editorToPreviewOffset(Math.max(end - 1, start), map);
            if (previewStart === null || previewEnd === null) {
                debug('skip editor sync: selection in metadata block');
                return;
            }
            const startEl = findBlockForOffset(previewStart);
            const endEl = findBlockForOffset(previewEnd);
            if (!(startEl instanceof HTMLElement) || !(endEl instanceof HTMLElement)) {
                debug('skip editor sync: no preview block for selection', { start, end });
                return;
            }
            const startInfo = getMapForElement(startEl);
            const endInfo = getMapForElement(endEl);
            if (!startInfo || !endInfo) {
                debug('skip editor sync: missing mapping', { hasStart: !!startInfo, hasEnd: !!endInfo });
                return;
            }
            const startIndex = sourceOffsetToDisplay(startInfo, previewStart);
            const endIndex = sourceOffsetToDisplay(endInfo, previewEnd);
            syncing = true;
            highlightPreviewRange(startEl, startIndex, endEl, endIndex);
            syncing = false;
            debug('editor -> preview', { start, end, startIndex, endIndex, delta: map.delta });
        };

        const syncFromPreview = () => {
            const map = getOffsetMap();
            const sel = document.getSelection();
            if (!sel || !sel.rangeCount) {
                debug('skip preview sync: no selection');
                return;
            }
            const range = sel.getRangeAt(0);
            if (!range) {
                debug('skip preview sync: no range');
                return;
            }
            const startEl = getBlockFromNode(range.startContainer);
            const endEl = getBlockFromNode(range.endContainer);
            if (!(startEl instanceof HTMLElement) || !(endEl instanceof HTMLElement)) {
                debug('skip preview sync: no source block for range');
                return;
            }
            const startInfo = getMapForElement(startEl);
            const endInfo = getMapForElement(endEl);
            if (!startInfo || !endInfo) {
                debug('skip preview sync: missing mapping', { hasStart: !!startInfo, hasEnd: !!endInfo });
                return;
            }
            const startIndex = getDisplayIndex(startEl, range.startContainer, range.startOffset);
            const endIndex = getDisplayIndex(endEl, range.endContainer, range.endOffset);
            const srcStart = displayIndexToSource(startInfo, startIndex, false);
            const srcEnd = displayIndexToSource(endInfo, Math.max(endIndex - 1, startIndex), true);
            const editorStart = previewToEditorOffset(srcStart, map);
            const editorEnd = previewToEditorOffset(srcEnd, map);
            if (editorStart === null || editorEnd === null) {
                debug('skip preview sync: selection in hidden metadata block');
                return;
            }
            if (srcStart === srcEnd) {
                syncing = true;
                ta.setSelectionRange(editorStart, editorStart);
                syncing = false;
                renderSelectionOverlay(ta.value || '', editorStart, editorStart);
                debug('preview caret -> editor', { srcStart, editorStart });
                return;
            }
            syncing = true;
            ta.setSelectionRange(editorStart, editorEnd);
            syncing = false;
            renderSelectionOverlay(ta.value || '', editorStart, editorEnd);
            debug('preview -> editor', { srcStart, srcEnd, startIndex, endIndex, delta: map.delta });
        };

        const runSync = () => {
            if (syncing) return;
            const sel = document.getSelection();
            if (document.activeElement === ta) {
                debug('run sync: editor active');
                syncFromEditor();
                return;
            }
            if (sel && sel.rangeCount && prev.contains(sel.anchorNode)) {
                debug('run sync: preview selection');
                syncFromPreview();
            }
        };

        const schedule = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                runSync();
            });
        };

        document.addEventListener('selectionchange', schedule);
        ta.addEventListener('mouseup', schedule);
        ta.addEventListener('keyup', schedule);
        ta.addEventListener('select', schedule);
        prev.addEventListener('mouseup', schedule);
        prev.addEventListener('keyup', schedule);

        return { reset, syncFromPreview };
    })();

    window.__mdwResetSelectionSync = selectionSync.reset;
    window.__mdwSyncPreviewSelectionToTextarea = selectionSync.syncFromPreview;

    // Recompute wraps when panes are resized (affects visual line wrapping).
    let resizeTicking = false;
    const onResize = () => {
        if (resizeTicking) return;
        resizeTicking = true;
        requestAnimationFrame(() => {
            resizeTicking = false;
            updateLineNumbers();
            ln.scrollTop = ta.scrollTop;
            syncOverlayMetrics();
            syncOverlayScroll();
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
            if (window.__mdDirty && !confirm(t('js.unsaved_confirm', 'You have unsaved changes. Discard them and continue?'))) {
                return;
            }
            ta.value = normalizeNewlines(window.initialContent || '');
            updateLineNumbers();
            recomputeDirty();
            schedulePreview();
            scheduleBracketOverlay();
        });
    }

    updateLineNumbers();
    window.initialContent = normalizeNewlines(window.initialContent || '');
    recomputeDirty();
    scheduleBracketOverlay();
    if (typeof window.__mdwResetSelectionSync === 'function') {
        const initialPreview = (typeof window.__mdwBuildPreviewContent === 'function') ? window.__mdwBuildPreviewContent() : ta.value;
        window.__mdwResetSelectionSync(initialPreview);
    }
})();

// Editor: Markdown keyboard shortcuts (edit.php)
(function(){
    const ta = document.getElementById('editor');
    if (!(ta instanceof HTMLTextAreaElement)) return;
    const editorForm = document.getElementById('editor-form');
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const wrapToggle = document.getElementById('wrapToggle');
    const lineNumbersToggle = document.getElementById('lineNumbersToggle');
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
    const readWrapSetting = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        return !!(s && s.editor_wrap);
    };
    let wrapSaveSeq = 0;
    const saveWrapSetting = async (enabled) => {
        const saveFn = window.__mdwSaveSettingsToServer;
        if (typeof saveFn !== 'function') return;
        const seq = ++wrapSaveSeq;
        const result = await saveFn({ editor_wrap: !!enabled });
        if (seq !== wrapSaveSeq) return;
        if (!result || result.ok !== true) {
            console.warn('editor wrap setting save failed', result);
        }
    };
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

    document.documentElement.classList.toggle('mdw-wrap-on', readWrapSetting());
    applyWrapUi();
    applyLinesUi();
    wrapToggle?.addEventListener('click', () => {
        const on = !isWrapOn();
        document.documentElement.classList.toggle('mdw-wrap-on', on);
        saveWrapSetting(on).catch((err) => {
            console.warn('editor wrap setting save error', err);
        });
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

    const normalizeHeadingText = (value) => {
        return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    };

    const normalizeMarkdownHeadingLine = (line) => {
        const m = String(line || '').match(/^(\s*#{1,6})(\s+)(.*)$/);
        if (!m) return String(line || '');
        return `${m[1]}${m[2]}${normalizeHeadingText(m[3])}`;
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

    const normalizeMarkdownHeadingFormatting = () => {
        const value = ta.value;
        const selStart = ta.selectionStart ?? 0;
        const selEnd = ta.selectionEnd ?? selStart;
        let offset = 0;
        let startDelta = 0;
        let endDelta = 0;
        let changed = false;
        const lines = value.split('\n').map((line) => {
            const absStart = offset;
            offset += line.length + 1;
            const next = normalizeMarkdownHeadingLine(line);
            if (next === line) return line;
            changed = true;
            const delta = next.length - line.length;
            const lineEnd = absStart + line.length;
            if (selStart > lineEnd) {
                startDelta += delta;
            } else if (selStart > absStart) {
                startDelta += Math.min(0, delta);
            }
            if (selEnd > lineEnd) {
                endDelta += delta;
            } else if (selEnd > absStart) {
                endDelta += Math.min(0, delta);
            }
            return next;
        });
        if (!changed) return false;
        ta.value = lines.join('\n');
        setSelection(selStart + startDelta, selEnd + endDelta);
        dispatchInput();
        return true;
    };

    let lastFormatAction = null;
    const runFormatAction = (fn) => {
        if (typeof fn !== 'function') return;
        lastFormatAction = fn;
        fn();
    };

    ta.addEventListener('paste', () => {
        setTimeout(normalizeMarkdownHeadingFormatting, 0);
    });

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

    const changeLineIndent = (direction) => {
        const indentText = '  ';
        const value = ta.value;
        const selStart = ta.selectionStart ?? 0;
        const selEnd = ta.selectionEnd ?? 0;
        const effectiveEnd = selEnd > selStart && value[selEnd - 1] === '\n' ? selEnd - 1 : selEnd;
        const blockStart = value.lastIndexOf('\n', selStart - 1) + 1;
        let blockEnd = value.indexOf('\n', effectiveEnd);
        if (blockEnd === -1) blockEnd = value.length;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split('\n');
        let offset = 0;
        const deltas = [];
        let changed = false;
        const newLines = lines.map((line) => {
            const absStart = blockStart + offset;
            offset += line.length + 1;

            if (direction > 0) {
                const out = indentText + line;
                deltas.push({ absStart, delta: indentText.length });
                changed = true;
                return out;
            }

            let removeLen = 0;
            if (line.startsWith('\t')) {
                removeLen = 1;
            } else {
                const m = line.match(/^ {1,2}/);
                removeLen = m ? m[0].length : 0;
            }
            if (removeLen <= 0) {
                deltas.push({ absStart, delta: 0 });
                return line;
            }

            changed = true;
            deltas.push({ absStart, delta: -removeLen });
            return line.slice(removeLen);
        });

        if (!changed) return false;

        const replacement = newLines.join('\n');
        replaceRange(blockStart, blockEnd, replacement);

        const shiftPos = (pos) => {
            let out = pos;
            for (const d of deltas) {
                if (pos > d.absStart) out += d.delta;
            }
            return Math.max(blockStart, out);
        };

        setSelection(shiftPos(selStart), shiftPos(selEnd));
        return true;
    };

    const wrapOrUnwrap = (left, right, { singleCharSafe, lineWiseOnMultiline = false } = {}) => {
        const { start, end, text } = getSelection();
        const v = ta.value;

        const leftLen = left.length;
        const rightLen = right.length;

        const canLineWrap = (
            lineWiseOnMultiline
            && start !== end
            && text.includes('\n')
            && leftLen > 0
            && rightLen > 0
            && !left.includes('\n')
            && !right.includes('\n')
        );
        if (canLineWrap) {
            const lines = text.split('\n');
            const hasContent = lines.some((line) => line.trim() !== '');
            if (hasContent) {
                const lineIsWrapped = (line) => {
                    if (line.trim() === '') return true;
                    return line.startsWith(left) && line.endsWith(right) && line.length >= leftLen + rightLen;
                };
                const unwrapAll = lines.every(lineIsWrapped);
                const mapped = lines.map((line) => {
                    if (line.trim() === '') return line;
                    if (unwrapAll) return line.slice(leftLen, line.length - rightLen);
                    return left + line + right;
                });
                const nextText = mapped.join('\n');
                replaceRange(start, end, nextText);
                setSelection(start, start + nextText.length);
                return;
            }
        }

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
                    const out = '## ' + normalizeHeadingText(line);
                    deltas.push({ absStart, delta: out.length - line.length });
                    return out;
                }
                deltas.push({ absStart, delta: 0 });
                return line;
            }

            const indent = m[1] || '';
            const hashes = m[2] || '';
            const rest = normalizeHeadingText(m[3] || '');
            const level = hashes.length;
            const rawNextLevel = level + delta;
            const nextLevel = rawNextLevel <= 1 ? 0 : Math.max(2, Math.min(6, rawNextLevel));

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
        const level = Math.max(2, Math.min(6, Number(targetLevel) || 2));
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
            const rest = normalizeHeadingText(restRaw.replace(/^\s+/, ''));
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

    const toggleToc = () => {
        const value = ta.value.replace(/\r\n?/g, '\n');
        const tocLineRe = /(^|\n)\s*\{\s*TOC\s*\}\s*(\n|$)/i;
        const match = value.match(tocLineRe);
        if (match && typeof match.index === 'number') {
            const next = value.replace(tocLineRe, (full, before, after) => (before && after ? '\n' : ''));
            ta.value = next;
            const pos = Math.min(match.index, next.length);
            setSelection(pos, pos);
            dispatchInput();
            return true;
        }

        const hasTocTarget = value.split('\n').some((line) => {
            const raw = String(line || '').trim();
            return /^#{3}\s+\S/.test(raw)
                || /^<h3\b[^>]*>.*<\/h3>\s*$/i.test(raw);
        });
        if (!hasTocTarget) {
            alert(t('edit.toolbar.toc_no_headings', 'No H3 headings yet.'));
            return false;
        }

        const lines = value.split('\n');
        const isFrontmatterLine = (line) => /^\s*(?:\{+\s*[A-Za-z][A-Za-z0-9_-]*\s*:\s*[^}]*\}+)+\s*$/.test(String(line || ''));
        let insertLine = 0;
        while (insertLine < lines.length && String(lines[insertLine] || '').trim() === '') insertLine++;
        while (insertLine < lines.length && isFrontmatterLine(lines[insertLine])) insertLine++;

        lines.splice(insertLine, 0, '{TOC}', '');
        const next = lines.join('\n').replace(/\n{4,}/g, '\n\n\n');
        ta.value = next;
        const before = lines.slice(0, insertLine).join('\n');
        const pos = (before ? before.length + 1 : 0);
        setSelection(pos, pos + 5);
        dispatchInput();
        return true;
    };

    const CUSTOM_CSS_CURSOR = '__MDW_CUSTOM_CSS_CURSOR__';
    let customCssSnippetMap = new Map();
    let lastCustomFormatValue = null;

    const readCustomCssSetting = () => {
        const fn = window.__mdwReadCustomCssSetting;
        if (typeof fn === 'function') {
            return String(fn() || '').trim();
        }
        return '';
    };

    const readCustomFormatSetting = () => {
        const fn = window.__mdwReadCustomFormatSetting;
        if (typeof fn === 'function') return fn();
        return { custom_css: true, sections: false };
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
                    return;
                }
                if (rule.type === CSSRule.IMPORT_RULE) {
                    try {
                        processRules(rule.styleSheet?.cssRules || []);
                    } catch {}
                }
            });
        };
        try {
            processRules(styleEl.sheet?.cssRules || []);
        } catch {}
        styleEl.remove();
        return entries;
    };

    const readSectionSnippetEntries = () => {
        const raw = Array.isArray(window.MDW_SECTION_SNIPPETS) ? window.MDW_SECTION_SNIPPETS : [];
        return raw.map((entry) => {
            const label = String(entry?.label || '').trim();
            const snippet = String(entry?.snippet || '').trim();
            return label && snippet ? { label, snippet } : null;
        }).filter(Boolean);
    };

    const classAttrSnippet = (snippet) => {
        const cleaned = String(snippet || '').replace(CUSTOM_CSS_CURSOR, '').trim();
        return /^\{:\s*class\s*=\s*(?:"[^"]+"|'[^']+')\s*\}$/i.test(cleaned) ? cleaned : '';
    };

    const markdownLinkRangeAtSelection = (value, start, end) => {
        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        let lineEnd = value.indexOf('\n', Math.max(start, end));
        if (lineEnd === -1) lineEnd = value.length;
        const line = value.slice(lineStart, lineEnd);
        const re = /!?\[[^\]\n]+\]\([^\n)]*(?:\([^\n)]*\)[^\n)]*)*\)/g;
        let match;
        while ((match = re.exec(line))) {
            const linkStart = lineStart + match.index;
            const linkEnd = linkStart + match[0].length;
            if (start >= linkStart && end <= linkEnd) return { start: linkStart, end: linkEnd, lineEnd };
        }
        return null;
    };

    const insertClassAttrAfterSelection = (snippet) => {
        const attr = classAttrSnippet(snippet);
        if (!attr) return false;
        const { start, end } = getSelection();
        if (end <= start) return false;
        const value = ta.value;
        const linkRange = markdownLinkRangeAtSelection(value, start, end);
        if (linkRange) {
            const tail = value.slice(linkRange.end, linkRange.lineEnd);
            const existing = tail.match(/^\s*\{:\s*[^}]*\}/);
            if (existing) {
                replaceRange(linkRange.end, linkRange.end + existing[0].length, ` ${attr}`);
            } else {
                replaceRange(linkRange.end, linkRange.end, ` ${attr}`);
            }
            setSelection(start, end);
            return true;
        }
        let blockEnd = value.indexOf('\n', Math.max(start, end));
        if (blockEnd === -1) blockEnd = value.length;
        let nextLineEnd = value.indexOf('\n', blockEnd + 1);
        if (nextLineEnd === -1) nextLineEnd = value.length;
        const nextLine = blockEnd < value.length ? value.slice(blockEnd + 1, nextLineEnd) : '';
        if (/^\s*\{:\s*[^}]*\}\s*$/.test(nextLine)) {
            replaceRange(blockEnd + 1, nextLineEnd, attr);
            setSelection(start, end);
            return true;
        }
        const insert = `\n${attr}`;
        replaceRange(blockEnd, blockEnd, insert);
        setSelection(start, end);
        return true;
    };

    let pendingCustomFormatSelection = null;

    const restoreCustomFormatSelection = () => {
        if (!isUsingVisualEditor() || !pendingCustomFormatSelection) return false;
        const { start, end } = pendingCustomFormatSelection;
        pendingCustomFormatSelection = null;
        if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
        ta.setSelectionRange(start, end);
        return true;
    };

    const insertCustomCssSnippet = (snippet) => {
        const raw = String(snippet || '');
        if (!raw) return;
        if (typeof isUsingVisualEditor === 'function' && isUsingVisualEditor()) {
            const attr = classAttrSnippet(raw);
            const visualRange = !attr && typeof window.__mdwGetVisualInsertionRange === 'function'
                ? window.__mdwGetVisualInsertionRange()
                : null;
            if (visualRange) {
                pendingCustomFormatSelection = null;
                ta.setSelectionRange(visualRange.start, visualRange.end);
            } else if (!restoreCustomFormatSelection() && typeof window.__mdwSyncPreviewSelectionToTextarea === 'function') {
                window.__mdwSyncPreviewSelectionToTextarea();
            }
        }
        if (insertClassAttrAfterSelection(raw)) {
            try {
                pushUndoSnapshot(snapshot(), { merge: false });
                redoStack.length = 0;
            } catch {}
            ta.focus();
            return;
        }
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

    const refreshCustomFormat = (force = false) => {
        if (!(customFormat instanceof HTMLSelectElement)) return;
        const format = readCustomFormatSetting();
        const showCss = format.custom_css !== false;
        const showSections = format.sections === true;
        const css = showCss ? readCustomCssSetting() : '';
        const sections = showSections ? readSectionSnippetEntries() : [];
        const cacheValue = `${showCss ? 'css' : 'no-css'}:${showSections ? 'sections' : 'no-sections'}\n${css}\n/* sections:${sections.map((entry) => `${entry.label}:${entry.snippet.length}`).join('|')} */`;
        if (!force && cacheValue === lastCustomFormatValue) return;
        lastCustomFormatValue = cacheValue;
        const entries = [...sections, ...buildCustomCssEntries(css)];
        const hasCss = !!String(css || '').trim();
        customCssSnippetMap = new Map();
        customFormat.textContent = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('edit.toolbar.custom_format', 'Custom format');
        placeholder.selected = true;
        customFormat.appendChild(placeholder);
        entries.forEach((entry, index) => {
            const key = `custom-css-${index}`;
            customCssSnippetMap.set(key, entry.snippet);
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = entry.label;
            customFormat.appendChild(opt);
        });
        const hasEntries = entries.length > 0;
        customFormat.hidden = !hasCss && sections.length === 0;
        customFormat.disabled = !hasEntries;
        if (!hasEntries) customFormat.value = '';
    };

    window.__mdwRefreshCustomCssSelect = refreshCustomFormat;

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
    const tocBtn = document.getElementById('toggleTocBtn');
    const customFormat = document.getElementById('customFormat');
    document.querySelectorAll('.editor-toolbar button, .editor-toolbar select').forEach((control) => {
        if (!(control instanceof HTMLElement) || control.title) return;
        const label = String(
            control.getAttribute('aria-label')
            || control.querySelector('.btn-label')?.textContent
            || control.textContent
            || ''
        ).trim();
        if (label) control.title = label;
    });
    const isUsingVisualEditor = () => typeof window.__mdwVisualEditorMode === 'function' && window.__mdwVisualEditorMode();
    const saveVisualSelectionBeforeToolbar = (el) => {
        if (!(el instanceof HTMLElement)) return;
        const rememberInsertionPoint = () => {
            if (!isUsingVisualEditor()) return;
            if (typeof window.__mdwSaveVisualSelection === 'function') window.__mdwSaveVisualSelection();
            if (typeof window.__mdwSyncPreviewSelectionToTextarea === 'function') window.__mdwSyncPreviewSelectionToTextarea();
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            if (el === customFormat && Number.isInteger(start) && Number.isInteger(end)) {
                pendingCustomFormatSelection = { start, end };
            }
        };
        if ('PointerEvent' in window) {
            el.addEventListener('pointerdown', rememberInsertionPoint);
        } else {
            el.addEventListener('mousedown', rememberInsertionPoint);
        }
    };
    [
        headingSelect,
        alignSelect,
        boldBtn,
        italicBtn,
        underlineBtn,
        blockquoteBtn,
        orderedListBtn,
        unorderedListBtn,
        insertTableBtn,
        tocBtn,
        customFormat,
        document.getElementById('addLinkBtn'),
        document.getElementById('addImageBtn'),
    ].forEach(saveVisualSelectionBeforeToolbar);

    const previewElForToolbar = document.getElementById('preview');
    const closestEditableBlock = (node) => {
        const el = node instanceof Element ? node : node?.parentElement;
        if (!(el instanceof Element) || !(previewElForToolbar instanceof HTMLElement) || !previewElForToolbar.contains(el)) return null;
        return el.closest('h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th,div');
    };
    const readAlignFromElement = (el) => {
        if (!(el instanceof HTMLElement)) return 'left';
        if (el.classList.contains('right') || el.classList.contains('align-right')) return 'right';
        if (el.classList.contains('center') || el.classList.contains('align-center')) return 'center';
        const inlineAlign = String(el.style?.textAlign || '').trim().toLowerCase();
        if (inlineAlign === 'right' || inlineAlign === 'center') return inlineAlign;
        let computedAlign = '';
        try { computedAlign = String(window.getComputedStyle(el).textAlign || '').trim().toLowerCase(); } catch {}
        return (computedAlign === 'right' || computedAlign === 'center') ? computedAlign : 'left';
    };
    const currentMarkdownLineInfo = () => {
        const value = ta.value;
        const pos = ta.selectionStart ?? 0;
        const lineStart = value.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
        let lineEnd = value.indexOf('\n', pos);
        if (lineEnd === -1) lineEnd = value.length;
        const line = value.slice(lineStart, lineEnd);
        const headingMatch = line.match(/^\s*(#{1,6})\s+/);
        const readAttrLine = (raw) => {
            const m = String(raw || '').match(/^\s*\{\s*:\s*([^}]*)\}\s*$/);
            if (!m) return '';
            const cls = String(m[1] || '').match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/i);
            const classes = String(cls?.[1] || cls?.[2] || cls?.[3] || '').split(/\s+/);
            if (classes.includes('right') || classes.includes('align-right')) return 'right';
            if (classes.includes('center') || classes.includes('align-center')) return 'center';
            return '';
        };
        let nextLineEnd = value.indexOf('\n', lineEnd + 1);
        if (nextLineEnd === -1) nextLineEnd = value.length;
        const nextLine = lineEnd < value.length ? value.slice(lineEnd + 1, nextLineEnd) : '';
        const currentAttrAlign = readAttrLine(line);
        return {
            heading: headingMatch && headingMatch[1].length >= 2 ? String(headingMatch[1].length) : '',
            align: currentAttrAlign || readAttrLine(nextLine) || 'left',
        };
    };
    let toolbarSyncScheduled = false;
    const setToolbarControlState = (control, active) => {
        if (!(control instanceof HTMLElement)) return;
        control.classList.toggle('is-active', active);
        if (control instanceof HTMLButtonElement) control.setAttribute('aria-pressed', active ? 'true' : 'false');
    };
    const visualCommandIsActive = (command, fallbackSelector) => {
        try {
            if (document.queryCommandState(command)) return true;
        } catch {}
        const sel = window.getSelection?.();
        if (!sel || !sel.rangeCount || !(previewElForToolbar instanceof HTMLElement)) return false;
        const nodes = [sel.anchorNode, sel.focusNode, sel.getRangeAt(0).commonAncestorContainer];
        return nodes.some((node) => {
            const el = node instanceof Element ? node : node?.parentElement;
            return el instanceof Element && previewElForToolbar.contains(el) && !!el.closest(fallbackSelector);
        });
    };
    const syncToolbarFromSelection = () => {
        toolbarSyncScheduled = false;
        let heading = '';
        let align = 'left';
        let bold = false;
        let italic = false;
        let underline = false;
        const sel = window.getSelection?.();
        if (isUsingVisualEditor() && sel && sel.rangeCount && previewElForToolbar instanceof HTMLElement && previewElForToolbar.contains(sel.anchorNode)) {
            const block = closestEditableBlock(sel.anchorNode);
            if (block instanceof HTMLElement) {
                const tag = block.tagName.toLowerCase();
                if (/^h[2-6]$/.test(tag)) heading = tag.slice(1);
                align = readAlignFromElement(block);
            }
            bold = visualCommandIsActive('bold', 'strong,b');
            italic = visualCommandIsActive('italic', 'em,i');
            underline = visualCommandIsActive('underline', 'u');
        } else if (document.activeElement === ta) {
            const info = currentMarkdownLineInfo();
            heading = info.heading;
            align = info.align;
        }
        if (headingSelect instanceof HTMLSelectElement) headingSelect.value = heading;
        if (alignSelect instanceof HTMLSelectElement) alignSelect.value = align;
        setToolbarControlState(headingSelect, heading !== '');
        setToolbarControlState(alignSelect, align !== 'left');
        setToolbarControlState(boldBtn, bold);
        setToolbarControlState(italicBtn, italic);
        setToolbarControlState(underlineBtn, underline);
    };
    const scheduleToolbarSync = () => {
        if (toolbarSyncScheduled) return;
        toolbarSyncScheduled = true;
        requestAnimationFrame(syncToolbarFromSelection);
    };
    document.addEventListener('selectionchange', scheduleToolbarSync);
    ta.addEventListener('keyup', scheduleToolbarSync);
    ta.addEventListener('mouseup', scheduleToolbarSync);
    ta.addEventListener('click', scheduleToolbarSync);
    if (previewElForToolbar instanceof HTMLElement) {
        previewElForToolbar.addEventListener('keyup', scheduleToolbarSync);
        previewElForToolbar.addEventListener('mouseup', scheduleToolbarSync);
        previewElForToolbar.addEventListener('click', scheduleToolbarSync);
    }

    headingSelect?.addEventListener('change', () => {
        if (!(headingSelect instanceof HTMLSelectElement)) return;
        const value = String(headingSelect.value || '').trim();
        if (!value) return;
        const level = value;
        if (isUsingVisualEditor()) {
            window.__mdwRunVisualCommand?.('formatBlock', `h${level}`);
        } else {
            runFormatAction(() => setHeadingLevel(level));
            ta.focus();
        }
        setTimeout(scheduleToolbarSync, 0);
    });

    alignSelect?.addEventListener('change', () => {
        if (!(alignSelect instanceof HTMLSelectElement)) return;
        const value = String(alignSelect.value || '').trim();
        if (!value) return;
        const align = value;
        if (isUsingVisualEditor()) {
            const command = align === 'center' ? 'justifyCenter' : (align === 'right' ? 'justifyRight' : 'justifyLeft');
            window.__mdwRunVisualCommand?.(command);
        } else {
            runFormatAction(() => applyAlignment(align));
            ta.focus();
        }
        setTimeout(scheduleToolbarSync, 0);
    });

    boldBtn?.addEventListener('click', () => {
        if (isUsingVisualEditor()) {
            window.__mdwRunVisualCommand?.('bold');
            setTimeout(scheduleToolbarSync, 0);
            return;
        }
        runFormatAction(() => wrapOrUnwrap('**', '**', { lineWiseOnMultiline: true }));
        ta.focus();
    });
    italicBtn?.addEventListener('click', () => {
        if (isUsingVisualEditor()) {
            window.__mdwRunVisualCommand?.('italic');
            setTimeout(scheduleToolbarSync, 0);
            return;
        }
        runFormatAction(() => wrapOrUnwrap('*', '*', {
            lineWiseOnMultiline: true,
            singleCharSafe: ({ value, start, end }) => {
                const prev = value[start - 2] || '';
                const next = value[end + 1] || '';
                return prev !== '*' && next !== '*';
            }
        }));
        ta.focus();
    });
    underlineBtn?.addEventListener('click', () => {
        if (isUsingVisualEditor()) {
            window.__mdwRunVisualCommand?.('underline');
            setTimeout(scheduleToolbarSync, 0);
            return;
        }
        runFormatAction(() => wrapOrUnwrap('<u>', '</u>', { lineWiseOnMultiline: true }));
        ta.focus();
    });
    blockquoteBtn?.addEventListener('click', () => {
        if (isUsingVisualEditor()) {
            window.__mdwToggleVisualBlockquote?.();
            return;
        }
        runFormatAction(() => toggleLinePrefix('quote'));
        ta.focus();
    });
    orderedListBtn?.addEventListener('click', () => {
        if (isUsingVisualEditor()) {
            window.__mdwRunVisualCommand?.('insertOrderedList');
            return;
        }
        runFormatAction(() => toggleOrderedList());
        ta.focus();
    });
    unorderedListBtn?.addEventListener('click', () => {
        if (isUsingVisualEditor()) {
            window.__mdwRunVisualCommand?.('insertUnorderedList');
            return;
        }
        runFormatAction(() => toggleLinePrefix('bullet'));
        ta.focus();
    });
    insertTableBtn?.addEventListener('click', () => {
        if (isUsingVisualEditor()) {
            window.__mdwInsertVisualTable?.();
            return;
        }
        runFormatAction(() => insertTable());
        ta.focus();
    });
    tocBtn?.addEventListener('click', () => {
        if (isUsingVisualEditor()) {
            let changed = false;
            runFormatAction(() => { changed = toggleToc(); });
            if (!changed) return;
            if (typeof window.__mdwCancelScheduledPreview === 'function') window.__mdwCancelScheduledPreview();
            if (typeof window.__mdwSendPreview === 'function') window.__mdwSendPreview();
            prev.focus();
            return;
        }
        runFormatAction(() => toggleToc());
        ta.focus();
    });

    customFormat?.addEventListener('change', () => {
        if (!(customFormat instanceof HTMLSelectElement)) return;
        const key = String(customFormat.value || '').trim();
        if (!key) return;
        const snippet = customCssSnippetMap.get(key);
        if (snippet) insertCustomCssSnippet(snippet);
        customFormat.value = '';
    });

    refreshCustomFormat(true);

    ta.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
        if (ta.selectionStart == null || ta.selectionEnd == null) return;

        if (!e.shiftKey && ta.selectionStart === ta.selectionEnd) {
            const tokenInfo = findHtmlTabToken();
            const info = tokenInfo ? parseHtmlTabToken(tokenInfo.token) : null;
            const snippet = info ? buildHtmlSnippet(info) : null;
            if (tokenInfo && snippet) {
                e.preventDefault();
                replaceRange(tokenInfo.start, tokenInfo.end, snippet.text);
                const caret = tokenInfo.start + snippet.caretOffset;
                setSelection(caret, caret);
                ta.focus();
                return;
            }
        }

        e.preventDefault();
        changeLineIndent(e.shiftKey ? -1 : 1);
        ta.focus();
    });

    ta.addEventListener('keydown', (e) => {
        // Find and replace use the standard Ctrl+Shift shortcuts, independent of
        // the configurable Ctrl+Alt formatting modifier.
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                if (typeof window.__mdwOpenFindModal === 'function') window.__mdwOpenFindModal();
                return;
            }
            if (e.key === 'h' || e.key === 'H') {
                e.preventDefault();
                if (typeof window.__mdwOpenReplaceModal === 'function') window.__mdwOpenReplaceModal();
                return;
            }
        }
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
            runFormatAction(() => wrapOrUnwrap('**', '**', { lineWiseOnMultiline: true }));
            return;
        }

        // Italic: Ctrl+Alt+I
        if (!e.shiftKey && (e.key === 'i' || e.key === 'I')) {
            e.preventDefault();
            runFormatAction(() => wrapOrUnwrap('*', '*', {
                lineWiseOnMultiline: true,
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
            runFormatAction(() => wrapOrUnwrap('~~', '~~', { lineWiseOnMultiline: true }));
            return;
        }

        // Inline code: Ctrl+Alt+` (backquote key)
        if (!e.shiftKey && (e.code === 'Backquote' || e.key === '`')) {
            e.preventDefault();
            runFormatAction(() => wrapOrUnwrap('`', '`', { lineWiseOnMultiline: true }));
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

        // Set heading level directly: Ctrl+Alt+2..6 (H1 is reserved for the page title).
        if (!e.shiftKey && /^[2-6]$/.test(String(e.key || ''))) {
            e.preventDefault();
            const level = Number(e.key);
            runFormatAction(() => setHeadingLevel(level));
        }
    });
})();

(function(){
    const exportBtn = document.getElementById('exportHtmlBtn');
    const exportTemplateBtn = document.getElementById('exportTemplateBtn');
    const copyHtmlBtn = document.getElementById('copyHtmlBtn');
    const copyMdBtn = document.getElementById('copyMdBtn');
    const preview = document.getElementById('preview');
    if (!exportBtn && !exportTemplateBtn && !copyHtmlBtn && !copyMdBtn) return;
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
    const normalizeExportClassPrefix = (value) => {
        let out = String(value || '').trim();
        out = out.replace(/[^A-Za-z0-9_-]+/g, '');
        if (out.length > 24) out = out.slice(0, 24);
        return out;
    };
    const readExportClassPrefixSetting = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        const raw = s && typeof s.export_class_prefix === 'string' ? s.export_class_prefix : '';
        return normalizeExportClassPrefix(raw);
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
    const stripSourceMapAttrs = (rootEl) => {
        if (!(rootEl instanceof Element)) return;
        const strip = (el) => {
            el.removeAttribute('data-mdw-src-start');
            el.removeAttribute('data-mdw-src-end');
        };
        strip(rootEl);
        rootEl.querySelectorAll('[data-mdw-src-start], [data-mdw-src-end]').forEach((el) => strip(el));
    };

    const unwrapSectionIncludeMarkers = (rootEl) => {
        if (!(rootEl instanceof Element)) return;
        rootEl.querySelectorAll('[data-mdw-section-include]').forEach((el) => {
            const parent = el.parentNode;
            if (!parent) return;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            el.remove();
        });
    };

    const stripCssAttributes = (rootEl, preserveClasses) => {
        if (!(rootEl instanceof Element)) return;
        const keepSet = preserveClasses instanceof Set ? preserveClasses : null;
        const strip = (el) => {
            const raw = String(el.getAttribute('class') || '').trim();
            if (raw && keepSet && keepSet.size) {
                const keep = raw
                    .split(/\s+/)
                    .map((c) => String(c || '').trim())
                    .filter((c) => c && keepSet.has(c));
                if (keep.length) el.setAttribute('class', keep.join(' '));
                else el.removeAttribute('class');
            } else {
                el.removeAttribute('class');
            }
            el.removeAttribute('style');
        };
        strip(rootEl);
        rootEl.querySelectorAll('[class], [style]').forEach((el) => strip(el));
    };

    const remapMdClassesInDom = (rootEl, prefix) => {
        if (!(rootEl instanceof Element)) return;
        const nextPrefix = normalizeExportClassPrefix(prefix);
        if (nextPrefix === 'md-') return;
        const remapOne = (el) => {
            const raw = String(el.getAttribute('class') || '').trim();
            if (!raw) return;
            const mapped = [];
            raw.split(/\s+/).forEach((cls) => {
                if (!cls) return;
                if (cls.startsWith('md-')) mapped.push(nextPrefix + cls.slice(3));
                else mapped.push(cls);
            });
            const dedup = Array.from(new Set(mapped.filter(Boolean)));
            if (dedup.length) el.setAttribute('class', dedup.join(' '));
            else el.removeAttribute('class');
        };
        remapOne(rootEl);
        rootEl.querySelectorAll('[class]').forEach((el) => remapOne(el));
    };

    const normalizeFootnotesForPlainExport = (rootEl) => {
        if (!(rootEl instanceof Element)) return;
        const allLists = Array.from(rootEl.querySelectorAll('ol'));
        allLists.forEach((list) => {
            if (!(list instanceof HTMLOListElement)) return;
            const items = Array.from(list.children).filter((el) =>
                el instanceof HTMLLIElement && /^fn-/.test(String(el.id || ''))
            );
            if (!items.length) return;
            list.classList.add('fn-section');
            items.forEach((li) => {
                const markers = li.querySelectorAll('.md-footnote-marker, .fn-marker');
                if (markers.length) {
                    markers.forEach((el) => el.remove());
                    return;
                }
                const first = li.firstElementChild;
                if (
                    first instanceof HTMLSpanElement &&
                    /^\s*\[[A-Za-z0-9_-]+\]\s*$/.test(String(first.textContent || ''))
                ) {
                    first.remove();
                }
            });
        });
        rootEl.querySelectorAll('sup.md-footnote').forEach((el) => el.classList.add('fn'));
        rootEl.querySelectorAll('a.md-footnote-ref').forEach((el) => el.classList.add('fn'));
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

    const applyHtmlMode = (targetRoot, htmlMode, allowedClasses, exportClassPrefix) => {
        if (!(targetRoot instanceof Element)) return;
        if (htmlMode === 'dry') {
            normalizeFootnotesForPlainExport(targetRoot);
            stripCssAttributes(targetRoot);
            return;
        }
        if (htmlMode === 'medium') {
            normalizeFootnotesForPlainExport(targetRoot);
            stripInlineStyles(targetRoot);
            filterClassesByAllowlist(targetRoot, allowedClasses);
            remapMdClassesInDom(targetRoot, exportClassPrefix);
            return;
        }
        if (htmlMode === 'wet') {
            filterClassesByAllowlist(targetRoot, allowedClasses);
            remapMdClassesInDom(targetRoot, exportClassPrefix);
            return;
        }
        if (htmlMode !== 'wet') return;
    };

    const normalizeTocLayoutForExport = (targetRoot, htmlMode) => {
        if (!(targetRoot instanceof Element)) return;
        if (htmlMode !== 'dry') return;
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

    const normalizeTocTemplateStructureForExport = (targetRoot, htmlMode) => {
        if (!(targetRoot instanceof Element) || htmlMode !== 'medium') return;
        const layouts = Array.from(targetRoot.querySelectorAll('.toc-layout'));
        layouts.forEach((layout) => {
            if (!(layout instanceof HTMLElement)) return;
            layout.className = 'toc-layout';
            layout.removeAttribute('data-mdw-toc-layout');
            const nav = layout.querySelector('nav.toc-side');
            const tocWrap = nav instanceof HTMLElement ? nav.querySelector('.toc-wrap[data-mdw-toc="1"]') : null;
            if (nav instanceof HTMLElement && tocWrap instanceof HTMLElement) {
                tocWrap.classList.add('toc-side', 'toc-wrap');
                nav.replaceWith(tocWrap);
            }
        });
    };

    const getPreviewSnapshot = (stripMeta, htmlMode, allowedClasses, exportClassPrefix) => {
        if (!(preview instanceof HTMLElement)) return null;
        const clone = preview.cloneNode(true);
        if (clone instanceof HTMLElement) clone.removeAttribute('id');
        if (stripMeta) stripMetaHtml(clone);
        stripSourceMapAttrs(clone);
        unwrapSectionIncludeMarkers(clone);
        normalizeTocLayoutForExport(clone, htmlMode);
        applyHtmlMode(clone, htmlMode, allowedClasses, exportClassPrefix);
        normalizeTocTemplateStructureForExport(clone, htmlMode);
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

    const buildPreviewWrapper = (html, stripMeta, htmlMode, allowedClasses, exportClassPrefix) => {
        const wrapper = document.createElement(preview instanceof HTMLElement ? preview.tagName : 'div');
        if (preview instanceof HTMLElement && preview.className) {
            wrapper.className = preview.className;
        } else {
            wrapper.className = 'preview-content';
        }
        wrapper.innerHTML = html || '';
        if (stripMeta) stripMetaHtml(wrapper);
        stripSourceMapAttrs(wrapper);
        unwrapSectionIncludeMarkers(wrapper);
        normalizeTocLayoutForExport(wrapper, htmlMode);
        applyHtmlMode(wrapper, htmlMode, allowedClasses, exportClassPrefix);
        normalizeTocTemplateStructureForExport(wrapper, htmlMode);
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
    const remapMdClassPrefixInCss = (css, prefix) => {
        const nextPrefix = normalizeExportClassPrefix(prefix);
        const raw = String(css || '');
        if (!raw || nextPrefix === 'md-') return raw;
        return raw.replace(/(?<=\.)md-([A-Za-z0-9_-]+)/g, `${nextPrefix}$1`);
    };

    const sanitizeExportSelector = (selector, allowedClasses) => {
        let s = String(selector || '').trim();
        if (!s) return null;
        s = s.replace(/\.preview-content\b/g, ' ').replace(/\s+/g, ' ');
        s = s.replace(/^\s*[>+~]\s*/, '').trim();
        if (!s) s = 'body';
        if (
            s.includes('.md-') &&
            !/\.md-toc\b|\.md-toc-|\.md-footnote\b|\.md-footnote-|\.md-footnotes\b/.test(s)
        ) return null;
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

    const collectExportCss = async (htmlMode, allowedClasses, exportClassPrefix) => {
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
            const customCssStyle = document.getElementById('mdwCustomCssStyle');
            const customCss = customCssStyle instanceof HTMLStyleElement ? String(customCssStyle.textContent || '') : '';
            if (customCss.trim()) chunks.push(customCss);
        } else if (htmlMode === 'medium') {
            const customCss = readCustomCssSetting();
            if (customCss) chunks.push(customCss);
        }
        const combined = chunks.filter((c) => String(c || '').trim() !== '').join('\n\n');
        const sanitized = sanitizeExportCss(combined, allowedClasses);
        const mapped = remapMdClassPrefixInCss(sanitized, exportClassPrefix);
        return sanitizeCssForStyleTag(mapped);
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

    const buildAllowedClassesSet = (markdownSource, htmlMode) => {
        const allow = htmlMode !== 'dry' ? collectAttrListClasses(markdownSource) : null;
        if (!(allow instanceof Set)) return allow;
        [
            'md-toc-layout',
            'md-toc-inline',
            'md-toc-left',
            'md-toc-right',
            'md-toc-side',
            'md-toc-body',
            'md-toc-wrap',
            'md-toc',
            'md-toc-item',
            'is-active',
            'md-footnotes',
            'md-footnote',
            'md-footnote-ref',
            'md-footnote-item',
            'md-footnote-marker',
            'md-footnote-text',
            'fn-section',
            'fn',
        ].forEach((cls) => allow.add(cls));
        return allow;
    };

    const buildExportHtml = async (opts = {}) => {
        const includeMeta = opts.includeMeta !== false;
        const stripMeta = !includeMeta;
        const htmlMode = (opts.htmlMode === 'wet' || opts.htmlMode === 'dry' || opts.htmlMode === 'medium') ? opts.htmlMode : 'dry';
        const title = (document.querySelector('.app-title')?.textContent || '').trim() || 'Markdown export';
        const src = getBasename(window.CURRENT_FILE || 'export.md').replace(/\.md$/i, '');
        const filename = `${src || 'export'}.html`;
        const exportClassPrefix = readExportClassPrefixSetting();
        const markdownSource = getMarkdownSource();
        const allowedClasses = buildAllowedClassesSet(markdownSource, htmlMode);
        let bodyHtml = getPreviewSnapshot(stripMeta, htmlMode, allowedClasses, exportClassPrefix);
        const exportCss = await collectExportCss(htmlMode, allowedClasses, exportClassPrefix);
        const fontLinks = buildThemeFontLinks(htmlMode);
        if (!bodyHtml) {
            const rendered = (typeof markdownSource === 'string')
                ? await getServerRenderedHtml(markdownSource)
                : await getServerRenderedHtml();
            bodyHtml = buildPreviewWrapper(rendered, stripMeta, htmlMode, allowedClasses, exportClassPrefix);
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

    const buildTemplateFilename = () => {
        const src = getBasename(window.CURRENT_FILE || 'export.md').replace(/\.md$/i, '');
        return `${src || 'export'}.html`;
    };

    const fetchJinjaTemplate = async (markdownSource) => {
        if (!window.CURRENT_FILE) throw new Error('No file selected');
        const fd = new FormData();
        fd.set('content', typeof markdownSource === 'string' ? markdownSource : '');
        const url = 'edit.php?file=' + encodeURIComponent(window.CURRENT_FILE) + '&preview=1&template=jinja';
        if (mdmApi && typeof mdmApi.form === 'function') {
            const data = await mdmApi.form(url, fd);
            return String(data || '');
        }
        const res = await fetch(url, { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Template export request failed');
        return await res.text();
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

    if (exportTemplateBtn) {
        exportTemplateBtn.addEventListener('click', async () => {
            if (!window.CURRENT_FILE) return;
            if (mdmUi && typeof mdmUi.busy === 'function') {
                mdmUi.busy(exportTemplateBtn, true, { label: t('js.exporting', 'Exporting…') });
            } else {
                exportTemplateBtn.disabled = true;
            }
            try {
                const markdownSource = getMarkdownSource();
                const markdown = typeof markdownSource === 'string' ? markdownSource : '';
                const template = await fetchJinjaTemplate(markdown);
                const filename = buildTemplateFilename();
                downloadTextFile(filename, template, 'text/plain;charset=utf-8');
            } catch (e) {
                console.error('Template export failed', e);
                alert(t('js.template_export_failed', 'Template export failed. Check the console for details.'));
            } finally {
                if (mdmUi && typeof mdmUi.busy === 'function') {
                    mdmUi.busy(exportTemplateBtn, false);
                } else {
                    exportTemplateBtn.disabled = false;
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
