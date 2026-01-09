(function(){
    const MDM = window.MDM = window.MDM || {};
    const module = MDM.settings = MDM.settings || {};
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

(function(){
    const overlay = document.getElementById('wpmUserOverlay');
    const modal = document.getElementById('wpmUserModal');
    if (!overlay || !modal) return;

    const authorInput = document.getElementById('wpmAuthorInput');
    const langSelect = document.getElementById('wpmLangSelect');
    const kbdModOption = document.getElementById('wpmKbdShortcutModOption');
    const kbdModCommand = document.getElementById('wpmKbdShortcutModCommand');
    const saveBtn = document.getElementById('wpmUserSaveBtn');
    const switchBtn = document.getElementById('wpmUserSwitchBtn');
    const statusEl = document.getElementById('wpmUserStatus');
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const AUTHOR_KEY = 'mdw_wpm_author';
    const LANG_KEY = 'mdw_ui_lang';
    const TUTORIAL_SEEN_KEY = 'mdw_wpm_tutorial_seen';
    const SHORTCUT_MOD_KEY = 'mdw_shortcut_mod';

    const isWpm = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        return !!(s && s.publisher_mode);
    };

    const getDefaultLang = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        const raw = s && typeof s.ui_language === 'string' ? s.ui_language.trim() : '';
        const list = Array.isArray(window.MDW_LANGS) ? window.MDW_LANGS : [];
        const allowed = new Set(list.map((l) => String(l?.code || '')).filter(Boolean));
        if (raw && (!allowed.size || allowed.has(raw))) return raw;
        const current = String(window.MDW_LANG || '').trim();
        if (current && (!allowed.size || allowed.has(current))) return current;
        return allowed.size ? Array.from(allowed)[0] : '';
    };

    const normalizeTutorialLang = (lang) => {
        const raw = String(lang || '').trim().toLowerCase();
        if (!raw) return 'en';
        const base = raw.includes('-') ? raw.split('-')[0] : raw;
        const supported = new Set(['en', 'nl', 'de', 'fr', 'pt']);
        return supported.has(base) ? base : 'en';
    };

    const tutorialPathForLang = (lang) => {
        const code = normalizeTutorialLang(lang);
        return `tutorials/md_tutorial_${code}.md`;
    };

    const getAuthor = () => String(mdwStorageGet(AUTHOR_KEY) || '').trim();
    const setAuthor = (value) => {
        const next = String(value || '').trim();
        if (next) mdwStorageSet(AUTHOR_KEY, next);
        return next;
    };

    const isApple = (() => {
        try {
            const p = String(navigator.platform || '');
            const ua = String(navigator.userAgent || '');
            return /Mac|iPhone|iPad|iPod/i.test(p) || /Macintosh|iPhone|iPad|iPod/i.test(ua);
        } catch {
            return false;
        }
    })();

    const readShortcutMod = () => {
        try {
            const v = mdwStorageGet(SHORTCUT_MOD_KEY);
            if (v === 'command' || v === 'option') return v;
        } catch {}
        return isApple ? 'command' : 'option';
    };

    const writeShortcutMod = (v) => {
        const next = (v === 'command' || v === 'option') ? v : (isApple ? 'command' : 'option');
        try { mdwStorageSet(SHORTCUT_MOD_KEY, next); } catch {}
        window.__mdwShortcutMod = next;
        return next;
    };

    const setStatus = (msg, kind = 'info') => {
        if (!(statusEl instanceof HTMLElement)) return;
        statusEl.textContent = String(msg || '');
        statusEl.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const applyAuthorToForms = (value) => {
        const author = String(value || '').trim() || getAuthor();
        if (!author) return;
        document.querySelectorAll('form').forEach((form) => {
            if (!(form instanceof HTMLFormElement)) return;
            let input = form.querySelector('input[name="publisher_author"]');
            if (!(input instanceof HTMLInputElement)) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'publisher_author';
                form.appendChild(input);
            }
            input.value = author;
        });
    };

    const syncLangSelect = () => {
        if (!(langSelect instanceof HTMLSelectElement)) return;
        const saved = String(mdwStorageGet(LANG_KEY) || '').trim();
        const current = getDefaultLang();
        const list = Array.isArray(window.MDW_LANGS) ? window.MDW_LANGS : [];
        const allowed = new Set(list.map((l) => String(l?.code || '')).filter(Boolean));
        const next = (saved && allowed.has(saved)) ? saved : (allowed.has(current) ? current : '');
        if (next) langSelect.value = next;
    };

    const syncShortcutMod = () => {
        const mod = readShortcutMod();
        if (kbdModOption instanceof HTMLInputElement) kbdModOption.checked = mod === 'option';
        if (kbdModCommand instanceof HTMLInputElement) kbdModCommand.checked = mod === 'command';
    };

    const ensureDefaultLang = () => {
        const saved = String(mdwStorageGet(LANG_KEY) || '').trim();
        if (saved) return saved;
        const next = getDefaultLang();
        if (!next) return '';
        mdwStorageSet(LANG_KEY, next);
        if (String(window.MDW_LANG || '') !== next) {
            mdwSetLangCookie(next);
        }
        return next;
    };

    const isNewWpmUser = () => {
        const hasAuthor = !!getAuthor();
        const hasLang = !!String(mdwStorageGet(LANG_KEY) || '').trim();
        return !hasAuthor && !hasLang;
    };

    const maybeOpenTutorial = () => {
        if (!isWpm()) return false;
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (!auth || !auth.token || auth.role !== 'user') return false;
        if (!isNewWpmUser()) return false;
        if (String(mdwStorageGet(TUTORIAL_SEEN_KEY) || '').trim() === '1') return false;

        const lang = ensureDefaultLang() || String(window.MDW_LANG || '').trim();
        const tutorialFile = tutorialPathForLang(lang);
        const params = new URLSearchParams(window.location.search || '');
        const currentFile = params.get('file') || '';
        const inEdit = /\/edit\.php$/i.test(window.location.pathname || '');
        if (inEdit && currentFile === tutorialFile) {
            mdwStorageSet(TUTORIAL_SEEN_KEY, '1');
            return false;
        }
        mdwStorageSet(TUTORIAL_SEEN_KEY, '1');
        window.location.href = `edit.php?file=${encodeURIComponent(tutorialFile)}`;
        return true;
    };

    const getAppTitle = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        const raw = s && typeof s.app_title === 'string' ? s.app_title.trim() : '';
        return raw || 'Markdown Manager';
    };

    const show = () => {
        overlay.hidden = false;
        mdmModalOpen(true);
        const titleEl = document.getElementById('wpmUserTitle');
        if (titleEl) {
            const appTitle = getAppTitle();
            titleEl.textContent = appTitle ? `${appTitle} • ${t('wpm.setup_title', 'WPM setup')}` : t('wpm.setup_title', 'WPM setup');
        }
        setStatus(t('wpm.setup_hint', 'Set your author name and UI language.'), 'info');
        if (authorInput instanceof HTMLInputElement) {
            authorInput.focus();
            authorInput.select();
        }
    };
    const hide = () => {
        overlay.hidden = true;
        mdmModalOpen(false);
        setStatus('', 'info');
    };

    const save = () => {
        const author = (authorInput instanceof HTMLInputElement) ? String(authorInput.value || '').trim() : '';
        if (!author) {
            setStatus(t('wpm.author_required', 'Please enter your author name.'), 'error');
            authorInput?.focus?.();
            return;
        }
        setAuthor(author);
        applyAuthorToForms(author);
        const lang = (langSelect instanceof HTMLSelectElement) ? String(langSelect.value || '').trim() : '';
        if (lang) {
            mdwStorageSet(LANG_KEY, lang);
            if (String(window.MDW_LANG || '') !== lang) {
                if (mdwSetLangCookie(lang)) {
                    window.location.reload();
                    return;
                }
            }
        }
        if (kbdModOption instanceof HTMLInputElement && kbdModOption.checked) {
            writeShortcutMod('option');
        } else if (kbdModCommand instanceof HTMLInputElement && kbdModCommand.checked) {
            writeShortcutMod('command');
        }
        hide();
    };

    const maybeShow = () => {
        if (!isWpm()) return;
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (!auth || !auth.token || auth.role !== 'user') return;
        if (maybeOpenTutorial()) return;
        if (getAuthor()) return;
        syncLangSelect();
        show();
    };

    window.__mdwMaybeShowWpmSetup = maybeShow;
    window.__mdwGetWpmAuthor = getAuthor;

    switchBtn?.addEventListener('click', () => {
        try {
            mdwStorageRemove('mdw_auth_role');
            mdwStorageRemove('mdw_auth_token');
        } catch {}
        hide();
        if (typeof window.__mdwShowAuthModal === 'function') {
            window.__mdwShowAuthModal();
        }
    });

    document.addEventListener('submit', (e) => {
        if (!isWpm()) return;
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        const author = getAuthor();
        if (!author) return;
        let input = form.querySelector('input[name="publisher_author"]');
        if (!(input instanceof HTMLInputElement)) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'publisher_author';
            form.appendChild(input);
        }
        input.value = author;
    }, true);

    saveBtn?.addEventListener('click', save);
    const isPlainEnter = (e) =>
        (e.key === 'Enter' || e.code === 'NumpadEnter') &&
        !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;

    modal?.addEventListener('keydown', (e) => {
        if (!isPlainEnter(e)) return;
        const target = e.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
        e.preventDefault();
        save();
    });
    if (authorInput instanceof HTMLInputElement) authorInput.value = getAuthor();
    syncLangSelect();
    syncShortcutMod();
    applyAuthorToForms(getAuthor());
    maybeShow();
})();

// Enter-to-submit for inputs inside forms (textarea excluded).
(function(){
    const skipTypes = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color']);
    const isTextInput = (input) => {
        const type = String(input.getAttribute('type') || 'text').toLowerCase();
        return !skipTypes.has(type);
    };
    document.addEventListener('keydown', (e) => {
        if (!(e.key === 'Enter' || e.code === 'NumpadEnter') || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
        const target = e.target;
        if (target instanceof HTMLTextAreaElement) return;
        if (target instanceof HTMLInputElement && !isTextInput(target)) return;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
        const form = target.closest('form');
        if (!form) return;
        e.preventDefault();
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
        } else {
            form.submit();
        }
    });
})();

(function(){
    const btn = document.getElementById('themeToggle');
    const icon = document.getElementById('themeIcon');
    const root = document.documentElement;

    if (!btn || !icon) return;

    const getSettings = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        return s && typeof s === 'object' ? s : null;
    };
    const isPublisherMode = () => {
        const s = getSettings();
        return !!(s && s.publisher_mode);
    };
    const readPreferredUiTheme = () => {
        const s = getSettings();
        const fromServer = s && typeof s.ui_theme === 'string' ? s.ui_theme.trim().toLowerCase() : '';
        if (isPublisherMode() && (fromServer === 'dark' || fromServer === 'light')) return fromServer;
        try {
            const v = String(mdwStorageGet('mdsite-theme') || '').trim().toLowerCase();
            if (v === 'dark' || v === 'light') return v;
        } catch {}
        return root.classList.contains('dark') ? 'dark' : 'light';
    };

    function updateIcon() {
        const isDark = root.classList.contains('dark');
        icon.classList.toggle('pi-moon', isDark);
        icon.classList.toggle('pi-sun', !isDark);
    }

    function setTheme(mode) {
        const useDark = mode === 'dark';
        root.classList.toggle('dark', useDark);
        root.classList.toggle('theme-light', !useDark);
        mdwStorageSet('mdsite-theme', useDark ? 'dark' : 'light');
        updateIcon();
        if (typeof window.__mdwRefreshMermaid === 'function') {
            window.__mdwRefreshMermaid();
        }
    }

    btn.addEventListener('click', function(){
        const next = root.classList.contains('dark') ? 'light' : 'dark';
        setTheme(next);
        // Persist across devices only when publisher mode is enabled.
        if (isPublisherMode() && typeof window.__mdwSaveSettingsToServer === 'function' && (!window.__mdwIsSuperuser || window.__mdwIsSuperuser())) {
            window.__mdwSaveSettingsToServer({ ui_theme: next }).then((result) => {
                if (!result.ok) {
                    console.warn('ui theme save failed', result);
                }
            });
        }
    });

    // Apply initial theme (server-driven when publisher mode is enabled).
    const initial = readPreferredUiTheme();
    setTheme(initial);
    updateIcon();
})();

// Theme presets + overrides (edit.php + index.php)
(function(){
    const STORAGE_PRESET = 'mdw-theme-preset';
    const STORAGE_OVERRIDES = 'mdw-theme-overrides';
    const STYLE_ID = 'mdwThemeStyle';
    const SHORTCUT_MOD_KEY = 'mdw_shortcut_mod';
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const getSettings = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        return s && typeof s === 'object' ? s : null;
    };
    const isPublisherMode = () => {
        const s = getSettings();
        return !!(s && s.publisher_mode);
    };

    const settingsErrorMessage = (code, serverMsg) => {
        if (serverMsg) return serverMsg;
        if (code === 'auth_required') return t('auth.superuser_required', 'Superuser login required.');
        if (code === 'csrf' || code === 'no_session') {
            return t('flash.csrf_invalid', 'Invalid session (CSRF). Reload the page.');
        }
        if (code === 'publisher_author_required') {
            return t('theme.publisher.author_required', 'Please enter an author name to enable WPM.');
        }
        if (code === 'invalid_json' || code === 'invalid_config') {
            return t('theme.settings.invalid', 'Invalid settings data.');
        }
        if (code === 'network') return t('theme.settings.network_error', 'Network error. Try again.');
        return t('theme.settings.save_failed', 'Save failed');
    };

    const saveSettingsToServer = async (partial) => {
        const csrf = String(window.MDW_CSRF || '');
        if (!csrf) {
            return { ok: false, error: 'csrf', message: settingsErrorMessage('csrf') };
        }
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const cur = (cfg && cfg._settings && typeof cfg._settings === 'object') ? cfg._settings : {};
        const settings = { ...(cur || {}), ...(partial || {}) };
        const authMeta = (window.MDW_AUTH_META && typeof window.MDW_AUTH_META === 'object') ? window.MDW_AUTH_META : { has_user: false, has_superuser: false };
        const authRequired = !!(authMeta.has_user || authMeta.has_superuser);
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (authRequired && (!auth || auth.role !== 'superuser' || !auth.token)) {
            if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
            return { ok: false, error: 'auth_required', message: settingsErrorMessage('auth_required') };
        }

        let data = null;
        try {
            if (!mdmApi || typeof mdmApi.json !== 'function') {
                throw new Error('network');
            }
            data = await mdmApi.json('metadata_config_save.php', {
                csrf,
                settings,
                auth: authRequired ? { role: auth.role, token: auth.token } : null,
            });
        } catch (err) {
            if (typeof window.__mdwReportNetworkError === 'function') {
                window.__mdwReportNetworkError(err);
            }
            const dataErr = err && typeof err === 'object' ? err.data : null;
            const code = (dataErr && dataErr.error) ? String(dataErr.error) : 'network';
            const msg = settingsErrorMessage(code, dataErr && dataErr.message ? String(dataErr.message) : '');
            return { ok: false, error: code, message: msg };
        }
        if (!data || data.ok !== true) {
            const code = (data && data.error) ? String(data.error) : 'save_failed';
            const msg = settingsErrorMessage(code, data && data.message ? String(data.message) : '');
            return { ok: false, error: code, message: msg };
        }
        if (data.config) window.MDW_META_CONFIG = data.config;
        if (data.publisher_config) window.MDW_META_PUBLISHER_CONFIG = data.publisher_config;
        if (typeof window.__mdwMarkOnline === 'function') {
            window.__mdwMarkOnline();
        }
        return { ok: true };
    };
    window.__mdwSaveSettingsToServer = saveSettingsToServer;

    const isApple = (() => {
        try {
            const p = String(navigator.platform || '');
            const ua = String(navigator.userAgent || '');
            return /Mac|iPhone|iPad|iPod/i.test(p) || /Macintosh|iPhone|iPad|iPod/i.test(ua);
        } catch {
            return false;
        }
    })();

    const readShortcutMod = () => {
        try {
            const v = mdwStorageGet(SHORTCUT_MOD_KEY);
            if (v === 'command' || v === 'option') return v;
        } catch {}
        return isApple ? 'command' : 'option';
    };

    const writeShortcutMod = (v) => {
        const next = (v === 'command' || v === 'option') ? v : (isApple ? 'command' : 'option');
        try { mdwStorageSet(SHORTCUT_MOD_KEY, next); } catch {}
        window.__mdwShortcutMod = next;
        return next;
    };

    window.__mdwReadShortcutMod = readShortcutMod;
    window.__mdwWriteShortcutMod = writeShortcutMod;
    window.__mdwShortcutMod = readShortcutMod();

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
        // In publisher mode, prefer server-saved preset for cross-device consistency.
        const s = getSettings();
        const serverPreset = s && typeof s.theme_preset === 'string' ? s.theme_preset.trim() : '';
        if (isPublisherMode() && serverPreset) {
            const normalized = serverPreset.toLowerCase() === 'candy' && findTheme('Candy') ? 'Candy' : (findTheme(serverPreset)?.name || 'default');
            try { mdwStorageSet(STORAGE_PRESET, normalized); } catch {}
            return normalized;
        }
        const raw = String(mdwStorageGet(STORAGE_PRESET) || '').trim();
        if (!raw) return 'default';
        if (raw.toLowerCase() === 'candy' && findTheme('Candy')) return 'Candy';
        const t = findTheme(raw);
        return t ? t.name : 'default';
    };

    const normalizeOverrides = (raw) => {
        const out = { preview: {}, editor: {} };
        if (!raw || typeof raw !== 'object') return out;
        const preview = (raw.preview && typeof raw.preview === 'object') ? raw.preview : {};
        const editor = (raw.editor && typeof raw.editor === 'object') ? raw.editor : {};
        const previewKeys = ['bg', 'text', 'font', 'fontSize', 'headingFont', 'headingColor', 'listColor', 'blockquoteTint'];
        const editorKeys = ['font', 'fontSize', 'accent'];
        previewKeys.forEach((k) => {
            if (!Object.prototype.hasOwnProperty.call(preview, k)) return;
            const v = String(preview[k] || '').trim();
            if (v) out.preview[k] = v;
        });
        editorKeys.forEach((k) => {
            if (!Object.prototype.hasOwnProperty.call(editor, k)) return;
            const v = String(editor[k] || '').trim();
            if (v) out.editor[k] = v;
        });
        return out;
    };

    const readOverridesFromStorage = () => {
        try {
            const raw = mdwStorageGet(STORAGE_OVERRIDES);
            if (!raw) return { preview: {}, editor: {} };
            const obj = JSON.parse(raw);
            return normalizeOverrides(obj);
        } catch {
            return { preview: {}, editor: {} };
        }
    };

    const readOverrides = () => {
        const s = getSettings();
        if (s && s.theme_overrides && typeof s.theme_overrides === 'object') {
            const fromSettings = normalizeOverrides(s.theme_overrides);
            const hasSettings = Object.keys(fromSettings.preview).length || Object.keys(fromSettings.editor).length;
            if (hasSettings) return fromSettings;
            const fromStorage = readOverridesFromStorage();
            const hasStorage = Object.keys(fromStorage.preview).length || Object.keys(fromStorage.editor).length;
            if (hasStorage) return fromStorage;
            return fromSettings;
        }
        return readOverridesFromStorage();
    };

    const writeOverrides = (o) => {
        const next = normalizeOverrides(o || { preview: {}, editor: {} });
        try { mdwStorageSet(STORAGE_OVERRIDES, JSON.stringify(next)); } catch {}
        if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
            window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
            window.MDW_META_CONFIG._settings.theme_overrides = next;
        }
    };

    const normalizeCustomCss = (value) => {
        let css = String(value || '');
        css = css.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        css = css.replace(/<\/?style[^>]*>/gi, '');
        return css.trim();
    };

    const readCustomCssSetting = () => {
        const s = getSettings();
        const raw = s && typeof s.custom_css === 'string' ? s.custom_css : '';
        return normalizeCustomCss(raw);
    };
    window.__mdwReadCustomCssSetting = readCustomCssSetting;

    const writeCustomCssSetting = (value) => {
        const next = normalizeCustomCss(value);
        if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
            window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
            window.MDW_META_CONFIG._settings.custom_css = next;
        }
        return next;
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
        const customCss = readCustomCssSetting();
        const styleEl = ensureStyleEl();
        const combined = [css, customCss].filter((chunk) => String(chunk || '').trim() !== '').join('\n\n');
        styleEl.textContent = combined ? (combined + '\n') : '';
        const themeLink = document.getElementById('mdwThemeHtmlpreviewCss');
        if (themeLink && themeLink.tagName === 'LINK' && !themeLink.disabled) {
            themeLink.addEventListener('load', () => {
                if (typeof window.__mdwRefreshMermaid === 'function') {
                    window.__mdwRefreshMermaid();
                }
            }, { once: true });
        }
        if (typeof window.__mdwRefreshMermaid === 'function') {
            window.__mdwRefreshMermaid();
        }
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
    const kbdModOption = document.getElementById('kbdShortcutModOption');
    const kbdModCommand = document.getElementById('kbdShortcutModCommand');
    const langSelect = document.getElementById('langSelect');
    const metaSaveBtn = document.getElementById('metaSettingsSaveBtn');
    const metaStatus = document.getElementById('metaSettingsStatus');
    const metaInputs = Array.from(document.querySelectorAll('input[type="checkbox"][data-meta-key][data-meta-field][data-meta-scope]'))
        .filter(el => el instanceof HTMLInputElement);
    const baseMetaInputs = metaInputs.filter(el => String(el.dataset.metaScope || '') === 'base');
    const publisherMetaInputs = metaInputs.filter(el => String(el.dataset.metaScope || '') === 'publisher');
    const publisherModeToggle = document.getElementById('publisherModeToggle');
    const publisherAuthorInput = document.getElementById('publisherAuthorInput');
    const publisherRequireH2Toggle = document.getElementById('publisherRequireH2Toggle');
    const appTitleInput = document.getElementById('appTitleInput');
    const appTitleSaveBtn = document.getElementById('appTitleSaveBtn');
    const appTitleStatus = document.getElementById('appTitleStatus');
    const deleteAfterOverview = document.getElementById('deleteAfterOverview');
    const deleteAfterNext = document.getElementById('deleteAfterNext');
    const offlineDelaySelect = document.getElementById('offlineDelaySelect');
    const allowUserPublishToggle = document.getElementById('allowUserPublishToggle');
    const allowUserDeleteToggle = document.getElementById('allowUserDeleteToggle');
    const allowUserDeleteStatus = document.getElementById('allowUserDeleteStatus');
    const copyButtonsToggle = document.getElementById('copyButtonsToggle');
    const copyIncludeMetaToggle = document.getElementById('copyIncludeMetaToggle');
    const copyHtmlModeSelect = document.getElementById('copyHtmlModeSelect');
    const copySettingsStatus = document.getElementById('copySettingsStatus');
    const tocMenuSelect = document.getElementById('tocMenuSelect');
    const tocMenuStatus = document.getElementById('tocMenuStatus');
    const settingsExportBtn = document.getElementById('settingsExportBtn');
    const settingsImportBtn = document.getElementById('settingsImportBtn');
    const settingsImportFile = document.getElementById('settingsImportFile');
    const settingsImportExportStatus = document.getElementById('settingsImportExportStatus');
    const postDateFormatSelect = document.getElementById('postDateFormatSelect');
    const postDateFormatStatus = document.getElementById('postDateFormatStatus');
    const postDateAlignSelect = document.getElementById('postDateAlignSelect');
    const postDateAlignStatus = document.getElementById('postDateAlignStatus');
    const folderIconStyleSelect = document.getElementById('folderIconStyleSelect');
    const folderIconStyleStatus = document.getElementById('folderIconStyleStatus');

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
        customCss: document.getElementById('themeCustomCss'),
    };

    let overridesStatusTimer = null;
    const setOverridesStatus = (msg, kind = 'info') => {
        if (!(overridesStatus instanceof HTMLElement)) return;
        if (overridesStatusTimer) {
            clearTimeout(overridesStatusTimer);
            overridesStatusTimer = null;
        }
        const text = String(msg || '').trim();
        overridesStatus.classList.remove('chip-ok', 'chip-error');
        if (!text) {
            overridesStatus.textContent = '';
            overridesStatus.hidden = true;
            return;
        }
        overridesStatus.textContent = text;
        overridesStatus.hidden = false;
        if (kind === 'ok') {
            overridesStatus.classList.add('chip-ok');
            overridesStatusTimer = setTimeout(() => {
                overridesStatus.textContent = '';
                overridesStatus.hidden = true;
                overridesStatus.classList.remove('chip-ok');
                overridesStatusTimer = null;
            }, 1800);
            return;
        }
        if (kind === 'error') {
            overridesStatus.classList.add('chip-error');
        }
    };

    const setAppTitleStatus = (msg, kind = 'info') => {
        if (!(appTitleStatus instanceof HTMLElement)) return;
        appTitleStatus.textContent = String(msg || '');
        appTitleStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const setAllowUserDeleteStatus = (msg, kind = 'info') => {
        if (!(allowUserDeleteStatus instanceof HTMLElement)) return;
        allowUserDeleteStatus.textContent = String(msg || '');
        allowUserDeleteStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const setCopySettingsStatus = (msg, kind = 'info') => {
        if (!(copySettingsStatus instanceof HTMLElement)) return;
        copySettingsStatus.textContent = String(msg || '');
        copySettingsStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const setTocMenuStatus = (msg, kind = 'info') => {
        if (!(tocMenuStatus instanceof HTMLElement)) return;
        tocMenuStatus.textContent = String(msg || '');
        tocMenuStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const setSettingsIoStatus = (msg, kind = 'info') => {
        if (!(settingsImportExportStatus instanceof HTMLElement)) return;
        settingsImportExportStatus.textContent = String(msg || '');
        settingsImportExportStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const setPostDateFormatStatus = (msg, kind = 'info') => {
        if (!(postDateFormatStatus instanceof HTMLElement)) return;
        postDateFormatStatus.textContent = String(msg || '');
        postDateFormatStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };
    const setPostDateAlignStatus = (msg, kind = 'info') => {
        if (!(postDateAlignStatus instanceof HTMLElement)) return;
        postDateAlignStatus.textContent = String(msg || '');
        postDateAlignStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };
    const setFolderIconStyleStatus = (msg, kind = 'info') => {
        if (!(folderIconStyleStatus instanceof HTMLElement)) return;
        folderIconStyleStatus.textContent = String(msg || '');
        folderIconStyleStatus.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const readAppTitleSetting = () => {
        const s = getSettings();
        return s && typeof s.app_title === 'string' ? s.app_title.trim() : '';
    };
    const readAllowUserPublishSetting = () => {
        const s = getSettings();
        if (!s || typeof s !== 'object') return false;
        return !Object.prototype.hasOwnProperty.call(s, 'allow_user_publish') ? false : !!s.allow_user_publish;
    };
    const readAllowUserDeleteSetting = () => {
        const s = getSettings();
        if (!s || typeof s !== 'object') return true;
        return !Object.prototype.hasOwnProperty.call(s, 'allow_user_delete') ? true : !!s.allow_user_delete;
    };
    const readCopyButtonsSetting = () => {
        const s = getSettings();
        if (!s || typeof s !== 'object') return true;
        return !Object.prototype.hasOwnProperty.call(s, 'copy_buttons_enabled') ? true : !!s.copy_buttons_enabled;
    };
    const readCopyIncludeMetaSetting = () => {
        const s = getSettings();
        if (!s || typeof s !== 'object') return true;
        return !Object.prototype.hasOwnProperty.call(s, 'copy_include_meta') ? true : !!s.copy_include_meta;
    };
    const readCopyHtmlModeSetting = () => {
        const s = getSettings();
        const v = s && typeof s.copy_html_mode === 'string' ? s.copy_html_mode.trim() : '';
        return (v === 'wet' || v === 'dry' || v === 'medium') ? v : 'dry';
    };
    const readTocMenuSetting = () => {
        const s = getSettings();
        const v = s && typeof s.toc_menu === 'string' ? s.toc_menu.trim().toLowerCase() : '';
        return (v === 'left' || v === 'right' || v === 'inline') ? v : 'inline';
    };
    const readPostDateFormatSetting = () => {
        const s = getSettings();
        const v = s && typeof s.post_date_format === 'string' ? s.post_date_format.trim() : '';
        return (v === 'mdy_short' || v === 'dmy_long') ? v : 'mdy_short';
    };
    const readPostDateAlignSetting = () => {
        const s = getSettings();
        const v = s && typeof s.post_date_align === 'string' ? s.post_date_align.trim() : '';
        return (v === 'left' || v === 'center' || v === 'right') ? v : 'left';
    };
    const readFolderIconStyleSetting = () => {
        const s = getSettings();
        const v = s && typeof s.folder_icon_style === 'string' ? s.folder_icon_style.trim().toLowerCase() : '';
        return (v === 'caret' || v === 'folder') ? v : 'folder';
    };
    const readUiLanguageSetting = () => {
        const s = getSettings();
        return s && typeof s.ui_language === 'string' ? s.ui_language.trim() : '';
    };

    const readOfflineDelaySetting = () => {
        if (typeof window.__mdwReadOfflineDelay === 'function') {
            return window.__mdwReadOfflineDelay();
        }
        return 3;
    };

    const applyAppTitleUi = (title) => {
        if (!document.body?.classList.contains('index-page')) return;
        const textEl = document.querySelector('.app-title-text');
        if (!(textEl instanceof HTMLElement)) return;
        const next = title && title.trim() ? title.trim() : 'Markdown Manager';
        textEl.textContent = next;
    };

    const applyCopyButtonsSetting = (enabled) => {
        const show = !!enabled;
        document.querySelectorAll('[data-copy-buttons="1"]').forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            el.hidden = !show;
        });
    };
    window.__mdwApplyCopyButtonsSetting = applyCopyButtonsSetting;

    const applyFolderIconStyle = (style) => {
        const body = document.body;
        if (!body) return;
        body.classList.remove('folder-icons-folder', 'folder-icons-caret');
        const next = style === 'caret' ? 'folder-icons-caret' : 'folder-icons-folder';
        body.classList.add(next);
    };

    const syncDeleteAfterUi = () => {
        const v = mdwReadDeleteAfter();
        if (deleteAfterOverview instanceof HTMLInputElement) {
            deleteAfterOverview.checked = v === 'overview';
        }
        if (deleteAfterNext instanceof HTMLInputElement) {
            deleteAfterNext.checked = v === 'next';
        }
    };

    const updateThemeUi = () => {
        const selected = presetSelect ? presetSelect.value : '';
        const theme = selected && selected !== 'default' ? findTheme(selected) : null;

        const name = theme?.label || theme?.name || t('theme.default', 'Default');
        const color = String(theme?.color || '').trim();
        const bg = String(theme?.bg || '').trim();
        const secondary = String(theme?.secondary || '').trim();

        if (presetSelect instanceof HTMLSelectElement) {
            presetSelect.style.color = color || '';
            presetSelect.style.backgroundColor = bg || '';
            presetSelect.style.borderColor = color ? 'rgba(148, 163, 184, 0.55)' : '';
        }

        if (swatchPrimary instanceof HTMLElement) {
            swatchPrimary.style.backgroundColor = color || 'transparent';
            const primaryLabel = t('theme.swatch.primary', 'Primary');
            swatchPrimary.title = color ? `${primaryLabel}: ${color}` : primaryLabel;
        }
        if (swatchSecondary instanceof HTMLElement) {
            swatchSecondary.style.backgroundColor = secondary || 'transparent';
            const secondaryLabel = t('theme.swatch.secondary', 'Secondary');
            swatchSecondary.title = secondary ? `${secondaryLabel}: ${secondary}` : secondaryLabel;
        }

        if (presetPreview instanceof HTMLElement) {
            if (!theme) {
                presetPreview.textContent = t('theme.default_preview', 'Default theme (uses built-in styles)');
                presetPreview.style.color = '';
                presetPreview.style.backgroundColor = '';
                presetPreview.style.borderColor = '';
            } else {
                presetPreview.textContent = `${name} • ${t('theme.preview_label', 'preview')}`;
                presetPreview.style.backgroundColor = bg || '';
                presetPreview.style.color = color || '';
                presetPreview.style.borderColor = color ? 'rgba(148, 163, 184, 0.55)' : '';
            }
        }
    };

    const normalizePresetName = (raw) => {
        const name = String(raw || '').trim();
        if (!name) return 'default';
        if (name.toLowerCase() === 'candy' && findTheme('Candy')) return 'Candy';
        const t = findTheme(name);
        return t ? t.name : 'default';
    };

    const sanitizeFilename = (name) => {
        const base = String(name || '').trim() || 'settings';
        const cleaned = base.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        return cleaned || 'settings';
    };

    const downloadJsonFile = (filename, data) => {
        const text = JSON.stringify(data, null, 2);
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    const buildSettingsExport = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : {};
        const pubCfg = (window.MDW_META_PUBLISHER_CONFIG && typeof window.MDW_META_PUBLISHER_CONFIG === 'object') ? window.MDW_META_PUBLISHER_CONFIG : {};
        const settings = { ...(cfg._settings || {}) };
        delete settings.publisher_default_author;
        if (!settings.ui_language) {
            const activeLang = String(window.MDW_LANG || '').trim();
            if (activeLang) settings.ui_language = activeLang;
        }
        const appTitle = readAppTitleSetting() || 'Markdown Manager';
        const name = `${appTitle}_settings`;
        const themePreset = normalizePresetName(readPreset());
        const themeOverrides = readOverrides();
        const customCss = readCustomCssSetting();
        settings.theme_overrides = themeOverrides;
        settings.custom_css = customCss;
        return {
            name,
            _meta: { version: 1 },
            settings,
            fields: cfg.fields || {},
            publisher: {
                fields: pubCfg.fields || {},
                html_map: pubCfg.html_map || {},
            },
            theme: {
                preset: themePreset,
                overrides: themeOverrides,
                custom_css: customCss,
            },
        };
    };

    let persistSettingsOnClose = async () => true;

    let overridesSaveTimer = null;
    let overridesSavePending = null;
    const flushOverridesSave = async () => {
        if (!overridesSavePending) return true;
        const payload = overridesSavePending;
        overridesSavePending = null;
        const result = await saveSettingsToServer(payload);
        if (!result.ok) {
            setOverridesStatus(result.message || t('theme.overrides.save_failed', 'Save failed'), 'error');
            return false;
        }
        setOverridesStatus(t('theme.overrides.saved', 'Saved'), 'ok');
        return true;
    };
    const queueOverridesSave = (payload, immediate = false) => {
        overridesSavePending = payload;
        if (overridesSaveTimer) {
            clearTimeout(overridesSaveTimer);
            overridesSaveTimer = null;
        }
        if (immediate) {
            return flushOverridesSave();
        }
        overridesSaveTimer = setTimeout(() => {
            overridesSaveTimer = null;
            flushOverridesSave();
        }, 500);
        return true;
    };

    const open = () => {
        if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) return;
        if (typeof window.__mdwCloseLinkModal === 'function') window.__mdwCloseLinkModal();
        if (typeof window.__mdwCloseImageModal === 'function') window.__mdwCloseImageModal();

        const preset = readPreset();
        if (presetSelect instanceof HTMLSelectElement) presetSelect.value = preset;
        updateThemeUi();

        const mod = readShortcutMod();
        if (kbdModOption instanceof HTMLInputElement) kbdModOption.checked = mod === 'option';
        if (kbdModCommand instanceof HTMLInputElement) kbdModCommand.checked = mod === 'command';

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
        if (inputs.customCss instanceof HTMLTextAreaElement) inputs.customCss.value = readCustomCssSetting();
        if (appTitleInput instanceof HTMLInputElement) {
            appTitleInput.value = readAppTitleSetting();
        }
        if (allowUserPublishToggle instanceof HTMLInputElement) {
            allowUserPublishToggle.checked = readAllowUserPublishSetting();
        }
        if (allowUserDeleteToggle instanceof HTMLInputElement) {
            allowUserDeleteToggle.checked = readAllowUserDeleteSetting();
        }
        if (copyButtonsToggle instanceof HTMLInputElement) {
            copyButtonsToggle.checked = readCopyButtonsSetting();
        }
        if (copyIncludeMetaToggle instanceof HTMLInputElement) {
            copyIncludeMetaToggle.checked = readCopyIncludeMetaSetting();
        }
        if (copyHtmlModeSelect instanceof HTMLSelectElement) {
            copyHtmlModeSelect.value = readCopyHtmlModeSetting();
        }
        if (tocMenuSelect instanceof HTMLSelectElement) {
            tocMenuSelect.value = readTocMenuSetting();
        }
        if (postDateFormatSelect instanceof HTMLSelectElement) {
            postDateFormatSelect.value = readPostDateFormatSetting();
        }
        if (postDateAlignSelect instanceof HTMLSelectElement) {
            postDateAlignSelect.value = readPostDateAlignSetting();
        }
        if (folderIconStyleSelect instanceof HTMLSelectElement) {
            folderIconStyleSelect.value = readFolderIconStyleSetting();
        }
        if (langSelect instanceof HTMLSelectElement) {
            const uiLang = readUiLanguageSetting();
            if (uiLang) langSelect.value = uiLang;
        }
        if (offlineDelaySelect instanceof HTMLSelectElement) {
            const desired = String(readOfflineDelaySetting());
            const hasOption = Array.from(offlineDelaySelect.options).some((opt) => opt.value === desired);
            offlineDelaySelect.value = hasOption ? desired : '30';
        }
        setAppTitleStatus(t('theme.app_title.hint', 'Leave blank to use the default.'), 'info');
        syncDeleteAfterUi();
        setAllowUserDeleteStatus(t('theme.permissions.hint', 'Saved for all users.'), 'info');
        setCopySettingsStatus(t('theme.copy.hint', 'Saved for all users.'), 'info');
        setPostDateFormatStatus(t('theme.post_date_format.hint', 'Saved for all users.'), 'info');
        setPostDateAlignStatus(t('theme.post_date_align.hint', 'Saved for all users.'), 'info');
        setFolderIconStyleStatus(t('theme.folder_icons.hint', 'Saved for all users.'), 'info');
        setSettingsIoStatus('', 'info');

        overlay.hidden = false;
        modal.hidden = false;
        mdmModalOpen(true);
        setTimeout(() => presetSelect?.focus(), 0);
    };

    const performClose = () => {
        overlay.hidden = true;
        modal.hidden = true;
        mdmModalOpen(false);
        btn?.focus();
    };

    const close = async (opts = {}) => {
        const force = !!(opts && opts.force);
        if (force) {
            performClose();
            try { await persistSettingsOnClose(); } catch (e) { console.error('settings close save failed', e); }
            return;
        }
        const ok = await persistSettingsOnClose();
        if (!ok) return;
        performClose();
    };

    window.__mdwCloseThemeModal = close;

    const persistFromInputs = (opts = null) => {
        const immediate = !!(opts && typeof opts === 'object' && opts.immediate === true);
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

        const customCssValue = (inputs.customCss instanceof HTMLTextAreaElement)
            ? inputs.customCss.value
            : '';
        writeOverrides(ov);
        writeCustomCssSetting(customCssValue);
        applyTheme();
        setOverridesStatus(t('theme.overrides.saving', 'Saving…'), 'info');
        queueOverridesSave({
            theme_overrides: ov,
            custom_css: normalizeCustomCss(customCssValue),
        }, immediate);
        if (typeof window.__mdwRefreshCustomCssSelect === 'function') {
            window.__mdwRefreshCustomCssSelect();
        }
    };

    const saveAppTitleSetting = async (nextTitle) => {
        setAppTitleStatus(t('theme.app_title.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setAppTitleStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const result = await saveSettingsToServer({ app_title: nextTitle });
            if (!result.ok) throw new Error(result.message || t('theme.app_title.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.app_title = nextTitle;
            }
            applyAppTitleUi(nextTitle);
            if (typeof window.__mdwUpdateAuthTitle === 'function') {
                window.__mdwUpdateAuthTitle();
            }
            setAppTitleStatus(t('theme.app_title.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('app title save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.app_title.save_failed', 'Save failed');
            setAppTitleStatus(msg, 'error');
            return false;
        }
    };

    const saveAllowUserPublishSetting = async (nextValue) => {
        setAllowUserDeleteStatus(t('theme.permissions.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setAllowUserDeleteStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const result = await saveSettingsToServer({ allow_user_publish: nextValue });
            if (!result.ok) throw new Error(result.message || t('theme.permissions.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.allow_user_publish = nextValue;
            }
            if (typeof window.__mdwApplyPublishPermissions === 'function') {
                window.__mdwApplyPublishPermissions();
            }
            setAllowUserDeleteStatus(t('theme.permissions.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('allow user publish save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.permissions.save_failed', 'Save failed');
            setAllowUserDeleteStatus(msg, 'error');
            return false;
        }
    };

    const saveAllowUserDeleteSetting = async (nextValue) => {
        setAllowUserDeleteStatus(t('theme.permissions.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setAllowUserDeleteStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const result = await saveSettingsToServer({ allow_user_delete: nextValue });
            if (!result.ok) throw new Error(result.message || t('theme.permissions.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.allow_user_delete = nextValue;
            }
            if (typeof window.__mdwApplyDeletePermissions === 'function') {
                window.__mdwApplyDeletePermissions();
            }
            setAllowUserDeleteStatus(t('theme.permissions.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('allow user delete save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.permissions.save_failed', 'Save failed');
            setAllowUserDeleteStatus(msg, 'error');
            return false;
        }
    };

    const saveCopyButtonsSetting = async (nextValue) => {
        setCopySettingsStatus(t('theme.copy.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setCopySettingsStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const result = await saveSettingsToServer({ copy_buttons_enabled: nextValue });
            if (!result.ok) throw new Error(result.message || t('theme.copy.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.copy_buttons_enabled = nextValue;
            }
            applyCopyButtonsSetting(nextValue);
            setCopySettingsStatus(t('theme.copy.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('copy buttons save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.copy.save_failed', 'Save failed');
            setCopySettingsStatus(msg, 'error');
            return false;
        }
    };

    const saveCopyIncludeMetaSetting = async (nextValue) => {
        setCopySettingsStatus(t('theme.copy.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setCopySettingsStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const result = await saveSettingsToServer({ copy_include_meta: nextValue });
            if (!result.ok) throw new Error(result.message || t('theme.copy.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.copy_include_meta = nextValue;
            }
            setCopySettingsStatus(t('theme.copy.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('copy include meta save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.copy.save_failed', 'Save failed');
            setCopySettingsStatus(msg, 'error');
            return false;
        }
    };

    const saveCopyHtmlModeSetting = async (nextValue) => {
        setCopySettingsStatus(t('theme.copy.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setCopySettingsStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const value = (nextValue === 'wet' || nextValue === 'dry' || nextValue === 'medium') ? nextValue : 'dry';
            const result = await saveSettingsToServer({ copy_html_mode: value });
            if (!result.ok) throw new Error(result.message || t('theme.copy.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.copy_html_mode = value;
            }
            setCopySettingsStatus(t('theme.copy.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('copy html mode save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.copy.save_failed', 'Save failed');
            setCopySettingsStatus(msg, 'error');
            return false;
        }
    };

    const saveTocMenuSetting = async (nextValue) => {
        setTocMenuStatus(t('theme.toc_menu.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setTocMenuStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const value = (nextValue === 'left' || nextValue === 'right' || nextValue === 'inline') ? nextValue : 'inline';
            const result = await saveSettingsToServer({ toc_menu: value });
            if (!result.ok) throw new Error(result.message || t('theme.toc_menu.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.toc_menu = value;
            }
            refreshPreviewAfterSettings();
            setTocMenuStatus(t('theme.toc_menu.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('toc menu save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.toc_menu.save_failed', 'Save failed');
            setTocMenuStatus(msg, 'error');
            return false;
        }
    };

    const refreshPreviewAfterSettings = () => {
        const ta = document.getElementById('editor');
        if (ta instanceof HTMLTextAreaElement) {
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    const savePostDateFormatSetting = async (nextValue) => {
        setPostDateFormatStatus(t('theme.post_date_format.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setPostDateFormatStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const value = (nextValue === 'mdy_short' || nextValue === 'dmy_long') ? nextValue : 'mdy_short';
            const result = await saveSettingsToServer({ post_date_format: value });
            if (!result.ok) throw new Error(result.message || t('theme.post_date_format.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.post_date_format = value;
            }
            refreshPreviewAfterSettings();
            setPostDateFormatStatus(t('theme.post_date_format.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('post date format save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.post_date_format.save_failed', 'Save failed');
            setPostDateFormatStatus(msg, 'error');
            return false;
        }
    };

    const savePostDateAlignSetting = async (nextValue) => {
        setPostDateAlignStatus(t('theme.post_date_align.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setPostDateAlignStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const value = (nextValue === 'left' || nextValue === 'center' || nextValue === 'right') ? nextValue : 'left';
            const result = await saveSettingsToServer({ post_date_align: value });
            if (!result.ok) throw new Error(result.message || t('theme.post_date_align.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.post_date_align = value;
            }
            refreshPreviewAfterSettings();
            setPostDateAlignStatus(t('theme.post_date_align.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('post date align save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.post_date_align.save_failed', 'Save failed');
            setPostDateAlignStatus(msg, 'error');
            return false;
        }
    };

    const saveFolderIconStyleSetting = async (nextValue) => {
        setFolderIconStyleStatus(t('theme.folder_icons.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setFolderIconStyleStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const value = (nextValue === 'caret' || nextValue === 'folder') ? nextValue : 'folder';
            const result = await saveSettingsToServer({ folder_icon_style: value });
            if (!result.ok) throw new Error(result.message || t('theme.folder_icons.save_failed', 'Save failed'));
            if (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                window.MDW_META_CONFIG._settings.folder_icon_style = value;
            }
            applyFolderIconStyle(value);
            setFolderIconStyleStatus(t('theme.folder_icons.saved', 'Saved'), 'ok');
            return true;
        } catch (e) {
            console.error('folder icon style save failed', e);
            const msg = (e && typeof e.message === 'string' && e.message.trim())
                ? e.message.trim()
                : t('theme.folder_icons.save_failed', 'Save failed');
            setFolderIconStyleStatus(msg, 'error');
            return false;
        }
    };

    const resetOverrides = () => {
        const next = { preview: {}, editor: {} };
        writeOverrides(next);
        Object.values(inputs).forEach((el) => {
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = '';
        });
        writeCustomCssSetting('');
        applyTheme();
        setOverridesStatus(t('theme.overrides.saving', 'Saving…'), 'info');
        queueOverridesSave({ theme_overrides: next, custom_css: '' }, true);
    };

    const buildImportPayload = (data) => {
        if (!data || typeof data !== 'object') return null;
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : {};
        const curSettings = (cfg && cfg._settings && typeof cfg._settings === 'object') ? cfg._settings : {};
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        const authMeta = (window.MDW_AUTH_META && typeof window.MDW_AUTH_META === 'object') ? window.MDW_AUTH_META : { has_user: false, has_superuser: false };
        const authRequired = !!(authMeta.has_user || authMeta.has_superuser);

        const settingsIn = (data.settings && typeof data.settings === 'object') ? data.settings
            : ((data._settings && typeof data._settings === 'object') ? data._settings : {});
        const nextSettings = { ...curSettings, ...settingsIn };
        nextSettings.publisher_default_author = String(curSettings.publisher_default_author || '');

        const themeIn = (data.theme && typeof data.theme === 'object') ? data.theme : null;
        if (themeIn && typeof themeIn.preset === 'string' && !nextSettings.theme_preset) {
            nextSettings.theme_preset = themeIn.preset;
        }
        if (themeIn && themeIn.overrides && typeof themeIn.overrides === 'object' && !nextSettings.theme_overrides) {
            nextSettings.theme_overrides = normalizeOverrides(themeIn.overrides);
        }
        if (themeIn && typeof themeIn.custom_css === 'string' && !nextSettings.custom_css) {
            nextSettings.custom_css = themeIn.custom_css;
        }

        const fieldsIn = (data.fields && typeof data.fields === 'object')
            ? data.fields
            : ((data.config && typeof data.config === 'object' && data.config.fields && typeof data.config.fields === 'object')
                ? data.config.fields
                : {});

        const publisherRaw = (data.publisher && typeof data.publisher === 'object')
            ? data.publisher
            : ((data.publisher_config && typeof data.publisher_config === 'object') ? data.publisher_config : {});

        const publisherFieldsIn = (publisherRaw.fields && typeof publisherRaw.fields === 'object')
            ? publisherRaw.fields
            : publisherRaw;
        const publisherHtmlMapIn = (publisherRaw.html_map && typeof publisherRaw.html_map === 'object')
            ? publisherRaw.html_map
            : ((data.publisher_html_map && typeof data.publisher_html_map === 'object') ? data.publisher_html_map : null);

        const csrf = String(window.MDW_CSRF || '');
        if (!csrf) return null;

        const publisherConfig = { fields: publisherFieldsIn };
        if (publisherHtmlMapIn && typeof publisherHtmlMapIn === 'object') {
            publisherConfig.html_map = publisherHtmlMapIn;
        }

        return {
            csrf,
            config: { fields: fieldsIn },
            publisher_config: publisherConfig,
            settings: nextSettings,
            auth: (authRequired && auth && auth.role && auth.token) ? { role: auth.role, token: auth.token } : null,
        };
    };

    const applyImportedTheme = (theme) => {
        if (!theme || typeof theme !== 'object') return;
        const preset = normalizePresetName(theme.preset);
        try { mdwStorageSet('mdw-theme-preset', preset); } catch {}
        if (theme.overrides && typeof theme.overrides === 'object') {
            writeOverrides(theme.overrides);
        }
        if (typeof theme.custom_css === 'string') {
            writeCustomCssSetting(theme.custom_css);
        }
        applyTheme();
        updateThemeUi();
    };

    if (btn && modal && overlay) {
        btn.addEventListener('click', open);
        overlay.addEventListener('click', () => close());
        closeBtn?.addEventListener('click', () => close());
        cancelBtn?.addEventListener('click', () => close());
        resetBtn?.addEventListener('click', resetOverrides);
        saveBtn?.addEventListener('click', () => persistFromInputs({ immediate: true }));
        appTitleSaveBtn?.addEventListener('click', async () => {
            if (!(appTitleInput instanceof HTMLInputElement)) return;
            const nextTitle = String(appTitleInput.value || '').trim();
            await saveAppTitleSetting(nextTitle);
        });

        const onDeleteAfterChange = (e) => {
            const input = e.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (input.name !== 'deleteAfter') return;
            mdwWriteDeleteAfter(input.value);
        };
        deleteAfterOverview?.addEventListener('change', onDeleteAfterChange);
        deleteAfterNext?.addEventListener('change', onDeleteAfterChange);

        offlineDelaySelect?.addEventListener('change', () => {
            if (!(offlineDelaySelect instanceof HTMLSelectElement)) return;
            const next = parseInt(String(offlineDelaySelect.value || '0'), 10);
            if (typeof window.__mdwWriteOfflineDelay === 'function') {
                window.__mdwWriteOfflineDelay(next);
            }
        });

        allowUserPublishToggle?.addEventListener('change', async () => {
            if (!(allowUserPublishToggle instanceof HTMLInputElement)) return;
            const next = !!allowUserPublishToggle.checked;
            await saveAllowUserPublishSetting(next);
        });
        allowUserDeleteToggle?.addEventListener('change', async () => {
            if (!(allowUserDeleteToggle instanceof HTMLInputElement)) return;
            const next = !!allowUserDeleteToggle.checked;
            await saveAllowUserDeleteSetting(next);
        });

        copyButtonsToggle?.addEventListener('change', async () => {
            if (!(copyButtonsToggle instanceof HTMLInputElement)) return;
            const next = !!copyButtonsToggle.checked;
            await saveCopyButtonsSetting(next);
        });

        copyIncludeMetaToggle?.addEventListener('change', async () => {
            if (!(copyIncludeMetaToggle instanceof HTMLInputElement)) return;
            const next = !!copyIncludeMetaToggle.checked;
            await saveCopyIncludeMetaSetting(next);
        });

        copyHtmlModeSelect?.addEventListener('change', async () => {
            if (!(copyHtmlModeSelect instanceof HTMLSelectElement)) return;
            const next = String(copyHtmlModeSelect.value || '').trim();
            await saveCopyHtmlModeSetting(next);
        });

        tocMenuSelect?.addEventListener('change', async () => {
            if (!(tocMenuSelect instanceof HTMLSelectElement)) return;
            const next = String(tocMenuSelect.value || '').trim();
            await saveTocMenuSetting(next);
        });

        settingsExportBtn?.addEventListener('click', () => {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setSettingsIoStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return;
            }
            try {
                const data = buildSettingsExport();
                const filename = sanitizeFilename(data.name) + '.json';
                downloadJsonFile(filename, data);
                setSettingsIoStatus(t('theme.settings_io.exported', 'Exported.'), 'ok');
            } catch (e) {
                console.error('settings export failed', e);
                setSettingsIoStatus(t('theme.settings_io.export_failed', 'Export failed'), 'error');
            }
        });

        settingsImportBtn?.addEventListener('click', async () => {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setSettingsIoStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return;
            }
            const file = settingsImportFile instanceof HTMLInputElement ? settingsImportFile.files?.[0] : null;
            if (!file) {
                setSettingsIoStatus(t('theme.settings_io.import_missing', 'Choose a JSON file.'), 'error');
                return;
            }
            setSettingsIoStatus(t('theme.settings_io.importing', 'Importing…'), 'info');
            try {
                const text = await file.text();
                let data = null;
                try {
                    data = JSON.parse(text);
                } catch {
                    setSettingsIoStatus(t('theme.settings_io.import_invalid', 'Invalid settings file.'), 'error');
                    return;
                }
                const payload = buildImportPayload(data);
                if (!payload) {
                    setSettingsIoStatus(t('theme.settings_io.import_invalid', 'Invalid settings file.'), 'error');
                    return;
                }
                if (!mdmApi || typeof mdmApi.json !== 'function') {
                    throw new Error('network');
                }
                let resp = null;
                try {
                    resp = await mdmApi.json('metadata_config_save.php', payload);
                } catch (err) {
                    resp = err && typeof err === 'object' ? err.data : null;
                    if (!resp || typeof resp !== 'object') throw err;
                }
                if (!resp || resp.ok !== true) {
                    const errCode = resp && resp.error ? String(resp.error) : '';
                    if (errCode === 'publisher_author_required') {
                        setSettingsIoStatus(t('theme.publisher.author_required', 'Please enter an author name to enable WPM.'), 'error');
                    } else if (errCode === 'auth_required') {
                        setSettingsIoStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                        if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                    } else if (errCode === 'csrf' || errCode === 'no_session') {
                        setSettingsIoStatus(t('flash.csrf_invalid', 'Invalid session (CSRF). Reload the page.'), 'error');
                    } else {
                        setSettingsIoStatus(t('theme.settings_io.import_failed', 'Import failed'), 'error');
                    }
                    return;
                }
                if (resp.config) window.MDW_META_CONFIG = resp.config;
                if (resp.publisher_config) window.MDW_META_PUBLISHER_CONFIG = resp.publisher_config;
                let themeData = null;
                if (data && typeof data === 'object') {
                    if (data.theme && typeof data.theme === 'object') {
                        themeData = data.theme;
                    } else if (data.settings && typeof data.settings === 'object' && data.settings.theme_preset) {
                        themeData = { preset: data.settings.theme_preset };
                    }
                }
                if (themeData) applyImportedTheme(themeData);
                setSettingsIoStatus(t('theme.settings_io.imported', 'Imported. Reloading…'), 'ok');
                if (settingsImportFile instanceof HTMLInputElement) settingsImportFile.value = '';
                setTimeout(() => window.location.reload(), 600);
            } catch (e) {
                console.error('settings import failed', e);
                setSettingsIoStatus(t('theme.settings_io.import_failed', 'Import failed'), 'error');
            }
        });

        postDateFormatSelect?.addEventListener('change', async () => {
            if (!(postDateFormatSelect instanceof HTMLSelectElement)) return;
            const next = String(postDateFormatSelect.value || '').trim();
            await savePostDateFormatSetting(next);
        });
        postDateAlignSelect?.addEventListener('change', async () => {
            if (!(postDateAlignSelect instanceof HTMLSelectElement)) return;
            const next = String(postDateAlignSelect.value || '').trim();
            await savePostDateAlignSetting(next);
        });

        folderIconStyleSelect?.addEventListener('change', async () => {
            if (!(folderIconStyleSelect instanceof HTMLSelectElement)) return;
            const next = String(folderIconStyleSelect.value || '').trim();
            await saveFolderIconStyleSetting(next);
        });

        const onKbdModChange = (e) => {
            const t = e.target;
            if (!(t instanceof HTMLInputElement)) return;
            if (t.name !== 'kbdShortcutMod') return;
            writeShortcutMod(t.value);
        };
        kbdModOption?.addEventListener('change', onKbdModChange);
        kbdModCommand?.addEventListener('change', onKbdModChange);

        if (langSelect instanceof HTMLSelectElement) {
            langSelect.addEventListener('change', async () => {
                const v = String(langSelect.value || '').trim();
                if (!v) return;
                const list = Array.isArray(window.MDW_LANGS) ? window.MDW_LANGS : [];
                const allowed = new Set(list.map(x => String(x?.code || '')).filter(Boolean));
                if (!allowed.has(v)) return;
                const isSuperuser = (typeof window.__mdwIsSuperuser === 'function') ? window.__mdwIsSuperuser() : false;
                if (isSuperuser) {
                    try {
                        const result = await saveSettingsToServer({ ui_language: v });
                        if (result.ok && window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
                            window.MDW_META_CONFIG._settings = window.MDW_META_CONFIG._settings || {};
                            window.MDW_META_CONFIG._settings.ui_language = v;
                        }
                    } catch {}
                }
                if (String(window.MDW_LANG || '') === v) return;
                if (mdwSetLangCookie(v)) window.location.reload();
            });
        }

        // Metadata settings: enforce rules + save to disk
        const setMetaStatus = (msg, kind = 'info') => {
            if (!(metaStatus instanceof HTMLElement)) return;
            metaStatus.textContent = String(msg || '');
            metaStatus.style.color = kind === 'error'
                ? 'var(--danger)'
                : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
        };

        const syncMetaUiRules = (inputs) => {
            const byKey = new Map();
            inputs.forEach((input) => {
                const key = String(input.dataset.metaKey || '').trim();
                const field = String(input.dataset.metaField || '').trim();
                if (!key || !field) return;
                const row = byKey.get(key) || {};
                row[field] = input;
                byKey.set(key, row);
            });
            byKey.forEach((row) => {
                const md = row.markdown;
                const html = row.html;
                if (!(md instanceof HTMLInputElement) || !(html instanceof HTMLInputElement)) return;
                if (!md.checked) {
                    html.checked = false;
                    html.disabled = true;
                } else {
                    html.disabled = false;
                }
            });
        };

        const readMetaUi = (inputs) => {
            const cfg = {};
            inputs.forEach((input) => {
                const key = String(input.dataset.metaKey || '').trim();
                const field = String(input.dataset.metaField || '').trim();
                if (!key || !field) return;
                cfg[key] = cfg[key] || {};
                if (field === 'markdown') cfg[key].markdown_visible = input.checked;
                if (field === 'html') cfg[key].html_visible = input.checked;
            });
            Object.entries(cfg).forEach(([_, v]) => {
                if (!v.markdown_visible) v.html_visible = false;
            });
            return cfg;
        };

        const readPublisherSettings = () => {
        const author = (publisherAuthorInput instanceof HTMLInputElement) ? String(publisherAuthorInput.value || '').trim() : '';
        const mode = (publisherModeToggle instanceof HTMLInputElement) ? !!publisherModeToggle.checked : false;
        const requireH2 = (publisherRequireH2Toggle instanceof HTMLInputElement)
            ? !!publisherRequireH2Toggle.checked
            : true;
        return {
            publisher_mode: mode,
            publisher_default_author: author,
            publisher_require_h2: requireH2,
        };
        };

        const syncPublisherUi = () => {
            if (!(publisherModeToggle instanceof HTMLInputElement)) return;
            if (!(publisherAuthorInput instanceof HTMLInputElement)) return;
        const on = !!publisherModeToggle.checked;
        publisherAuthorInput.disabled = false;
        publisherAuthorInput.placeholder = on
            ? t('theme.publisher.author_placeholder', 'Your name')
            : t('theme.publisher.author_placeholder', 'Your name');
        if (publisherRequireH2Toggle instanceof HTMLInputElement) {
            publisherRequireH2Toggle.disabled = !on;
        }
    };

        const publisherMetaWrap = document.getElementById('publisherMetaFields');
        publisherModeToggle?.addEventListener('change', () => {
            syncPublisherUi();
            setMetaStatus('', 'info');
            if (publisherMetaWrap instanceof HTMLElement) {
                publisherMetaWrap.style.display = (publisherModeToggle instanceof HTMLInputElement && publisherModeToggle.checked) ? '' : 'none';
            }
            if (publisherModeToggle instanceof HTMLInputElement && publisherModeToggle.checked) {
                if (publisherAuthorInput instanceof HTMLInputElement) {
                    const v = String(publisherAuthorInput.value || '').trim();
                    if (!v) {
                        try { publisherAuthorInput.focus(); } catch {}
                    }
                }
            }
        });
        publisherAuthorInput?.addEventListener('input', () => setMetaStatus('', 'info'));
        syncPublisherUi();

        if (baseMetaInputs.length) {
            baseMetaInputs.forEach((input) => {
                input.addEventListener('change', () => {
                    syncMetaUiRules(baseMetaInputs);
                    setMetaStatus('', 'info');
                });
            });
            syncMetaUiRules(baseMetaInputs);
        }
        if (publisherMetaInputs.length) {
            publisherMetaInputs.forEach((input) => {
                input.addEventListener('change', () => {
                    syncMetaUiRules(publisherMetaInputs);
                    setMetaStatus('', 'info');
                });
            });
            syncMetaUiRules(publisherMetaInputs);
        }

        const readVisibilityFromConfig = (inputs, fields) => {
            const out = {};
            inputs.forEach((input) => {
                const key = String(input.dataset.metaKey || '').trim();
                if (!key || out[key]) return;
                const f = (fields && typeof fields === 'object') ? fields[key] : null;
                const mdVis = f ? !!f.markdown_visible : true;
                const htmlVis = f ? (!!f.html_visible && mdVis) : false;
                out[key] = { markdown_visible: mdVis, html_visible: htmlVis };
            });
            return out;
        };

        const hasFieldDiff = (current, next) => {
            const keys = new Set([...Object.keys(current || {}), ...Object.keys(next || {})]);
            for (const key of keys) {
                const c = current[key] || {};
                const n = next[key] || {};
                if (!!c.markdown_visible !== !!n.markdown_visible) return true;
                if (!!c.html_visible !== !!n.html_visible) return true;
            }
            return false;
        };

        const hasMetaChanges = () => {
            if (!baseMetaInputs.length && !publisherMetaInputs.length) return false;
            const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
            const pubCfg = (window.MDW_META_PUBLISHER_CONFIG && typeof window.MDW_META_PUBLISHER_CONFIG === 'object')
                ? window.MDW_META_PUBLISHER_CONFIG
                : null;
            const currentBase = readVisibilityFromConfig(
                baseMetaInputs,
                (cfg && cfg.fields && typeof cfg.fields === 'object') ? cfg.fields : {}
            );
            const nextBase = readMetaUi(baseMetaInputs);
            if (hasFieldDiff(currentBase, nextBase)) return true;
            const currentPub = readVisibilityFromConfig(
                publisherMetaInputs,
                (pubCfg && pubCfg.fields && typeof pubCfg.fields === 'object') ? pubCfg.fields : {}
            );
            const nextPub = readMetaUi(publisherMetaInputs);
            if (hasFieldDiff(currentPub, nextPub)) return true;
            const s = getSettings() || {};
            const nextSettings = readPublisherSettings();
            if (!!s.publisher_mode !== !!nextSettings.publisher_mode) return true;
            if (String(s.publisher_default_author || '') !== String(nextSettings.publisher_default_author || '')) return true;
            if (!!s.publisher_require_h2 !== !!nextSettings.publisher_require_h2) return true;
            return false;
        };

        const buildWpmMigrationNotice = (migration) => {
            if (!migration || typeof migration !== 'object') return null;
            const renamed = Array.isArray(migration.renamed) ? migration.renamed : [];
            const moved = Array.isArray(migration.moved) ? migration.moved : [];
            const errors = Array.isArray(migration.errors) ? migration.errors : [];
            if (!renamed.length && !moved.length && !errors.length) return null;

            const summary = [];
            if (renamed.length) summary.push(t('theme.publisher.migration_renamed', 'Renamed folders: {n}', { n: renamed.length }));
            if (moved.length) summary.push(t('theme.publisher.migration_moved', 'Moved subfolders to root: {n}', { n: moved.length }));
            if (errors.length) summary.push(t('theme.publisher.migration_errors', 'Migration errors: {n}', { n: errors.length }));

            const detailLines = [];
            renamed.forEach((item) => {
                const from = item && item.from ? String(item.from) : '';
                const to = item && item.to ? String(item.to) : '';
                if (from && to) detailLines.push(`${from} -> ${to}`);
            });
            moved.forEach((item) => {
                const from = item && item.from ? String(item.from) : '';
                const to = item && item.to ? String(item.to) : '';
                if (from && to) detailLines.push(`${from} -> ${to}`);
            });
            errors.forEach((item) => {
                const from = item && item.from ? String(item.from) : '';
                const to = item && item.to ? String(item.to) : '';
                const err = item && item.error ? String(item.error) : '';
                if (from || to || err) {
                    const parts = [from || '?', '->', to || '?'];
                    if (err) parts.push(`(${err})`);
                    detailLines.push(parts.join(' '));
                }
            });

            const details = summary.concat(detailLines.length ? [''].concat(detailLines) : []).join('\n').trim();
            return {
                message: t('theme.publisher.migration_title', 'WPM updated your folder structure.'),
                details,
            };
        };

        const showWpmMigrationNotice = (migration) => {
            const notice = buildWpmMigrationNotice(migration);
            if (!notice) return;
            if (typeof window.__mdwShowErrorModal === 'function') {
                window.__mdwShowErrorModal(notice.message, notice.details);
            } else {
                const msg = notice.details ? `${notice.message}\n\n${notice.details}` : notice.message;
                alert(msg);
            }
        };

        const saveMetadataSettings = async () => {
            try {
                if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                    setMetaStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                    if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                    return false;
                }
                const publisherSettings = readPublisherSettings();
                if (publisherSettings.publisher_mode && !publisherSettings.publisher_default_author) {
                    setMetaStatus(t('theme.publisher.author_required', 'Please enter an author name to enable WPM.'), 'error');
                    try { publisherAuthorInput?.focus?.(); } catch {}
                    return false;
                }
                const currentSettings = getSettings() || {};
                const enablingWpm = !currentSettings.publisher_mode && !!publisherSettings.publisher_mode;
                if (enablingWpm) {
                    const confirmMsg = t(
                        'theme.publisher.enable_confirm',
                        'Enabling WPM will sanitize folder names (emoji removed) and move subfolders to the top level. Continue?'
                    );
                    if (!confirm(confirmMsg)) {
                        if (publisherModeToggle instanceof HTMLInputElement) {
                            publisherModeToggle.checked = false;
                            publisherModeToggle.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        return false;
                    }
                }
                setMetaStatus(t('theme.metadata.saving', 'Saving…'), 'info');
                // Also persist UI theme + theme preset to disk so publisher mode is consistent across devices.
                try {
                    const uiTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                    publisherSettings.ui_theme = uiTheme;
                } catch {}
                try {
                    const preset = String(mdwStorageGet(STORAGE_PRESET) || '').trim();
                    publisherSettings.theme_preset = preset || 'default';
                } catch {
                    publisherSettings.theme_preset = 'default';
                }
                const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
                const payload = {
                    csrf: String(window.MDW_CSRF || ''),
                    config: readMetaUi(baseMetaInputs),
                    publisher_config: readMetaUi(publisherMetaInputs),
                    settings: publisherSettings,
                    auth: (auth && auth.role && auth.token) ? { role: auth.role, token: auth.token } : null,
                };
                if (!mdmApi || typeof mdmApi.json !== 'function') {
                    throw new Error('network');
                }
                let data = null;
                try {
                    data = await mdmApi.json('metadata_config_save.php', payload);
                } catch (err) {
                    data = err && typeof err === 'object' ? err.data : null;
                    if (!data || typeof data !== 'object') throw err;
                }
                if (!data || data.ok !== true) {
                    const errCode = (data && data.error) ? String(data.error) : '';
                    const serverMsg = (data && data.message) ? String(data.message) : '';
                    if (errCode === 'publisher_author_required') {
                        throw new Error(t('theme.publisher.author_required', 'Please enter an author name to enable WPM.'));
                    }
                    if (errCode === 'auth_required') {
                        if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                        throw new Error(t('auth.superuser_required', 'Superuser login required.'));
                    }
                    if (errCode === 'csrf' || errCode === 'no_session') {
                        throw new Error(t('flash.csrf_invalid', 'Invalid session (CSRF). Reload the page.'));
                    }
                    if (serverMsg) throw new Error(serverMsg);
                    if (errCode) throw new Error(errCode);
                    throw new Error(t('theme.metadata.save_failed', 'Save failed'));
                }
                window.MDW_META_CONFIG = data.config;
                if (data.publisher_config) window.MDW_META_PUBLISHER_CONFIG = data.publisher_config;
                setMetaStatus(t('theme.metadata.saved', 'Saved'), 'ok');
                if (data && data.wpm_migration) {
                    showWpmMigrationNotice(data.wpm_migration);
                }
                if (typeof window.__mdwApplyMetaVisibility === 'function') {
                    window.__mdwApplyMetaVisibility();
                }
                // HTML preview uses server-side config; force a refresh even if the textarea content didn't change.
                const ta = document.getElementById('editor');
                if (ta instanceof HTMLTextAreaElement) {
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return true;
            } catch (e) {
                console.error('metadata settings save failed', e);
                const msg = (e && typeof e.message === 'string' && e.message.trim()) ? e.message.trim() : t('theme.metadata.save_failed', 'Save failed');
                setMetaStatus(msg, 'error');
                return false;
            }
        };

        persistSettingsOnClose = async () => {
            if (appTitleInput instanceof HTMLInputElement) {
                const nextTitle = String(appTitleInput.value || '').trim();
                if (nextTitle !== readAppTitleSetting()) {
                    const ok = await saveAppTitleSetting(nextTitle);
                    if (!ok) return false;
                }
            }
            if (allowUserPublishToggle instanceof HTMLInputElement) {
                const next = !!allowUserPublishToggle.checked;
                if (next !== readAllowUserPublishSetting()) {
                    const ok = await saveAllowUserPublishSetting(next);
                    if (!ok) return false;
                }
            }
            if (allowUserDeleteToggle instanceof HTMLInputElement) {
                const next = !!allowUserDeleteToggle.checked;
                if (next !== readAllowUserDeleteSetting()) {
                    const ok = await saveAllowUserDeleteSetting(next);
                    if (!ok) return false;
                }
            }
            if (copyButtonsToggle instanceof HTMLInputElement) {
                const next = !!copyButtonsToggle.checked;
                if (next !== readCopyButtonsSetting()) {
                    const ok = await saveCopyButtonsSetting(next);
                    if (!ok) return false;
                }
            }
            if (copyIncludeMetaToggle instanceof HTMLInputElement) {
                const next = !!copyIncludeMetaToggle.checked;
                if (next !== readCopyIncludeMetaSetting()) {
                    const ok = await saveCopyIncludeMetaSetting(next);
                    if (!ok) return false;
                }
            }
            if (postDateFormatSelect instanceof HTMLSelectElement) {
                const next = String(postDateFormatSelect.value || '').trim();
                if (next !== readPostDateFormatSetting()) {
                    const ok = await savePostDateFormatSetting(next);
                    if (!ok) return false;
                }
            }
            if (postDateAlignSelect instanceof HTMLSelectElement) {
                const next = String(postDateAlignSelect.value || '').trim();
                if (next !== readPostDateAlignSetting()) {
                    const ok = await savePostDateAlignSetting(next);
                    if (!ok) return false;
                }
            }
            if (folderIconStyleSelect instanceof HTMLSelectElement) {
                const next = String(folderIconStyleSelect.value || '').trim();
                if (next !== readFolderIconStyleSetting()) {
                    const ok = await saveFolderIconStyleSetting(next);
                    if (!ok) return false;
                }
            }
            if (hasMetaChanges()) {
                const ok = await saveMetadataSettings();
                if (!ok) return false;
            }
            return true;
        };

        metaSaveBtn?.addEventListener('click', async () => {
            await saveMetadataSettings();
        });

        presetSelect?.addEventListener('change', () => {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) return;
            const v = String(presetSelect.value || '').trim();
            const t = findTheme(v);
            const nextPreset = t ? t.name : 'default';
            mdwStorageSet(STORAGE_PRESET, nextPreset);
            if (isPublisherMode()) {
                try {
                    const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
                    if (cfg && cfg._settings && typeof cfg._settings === 'object') {
                        cfg._settings.theme_preset = nextPreset;
                    }
                } catch {}
                saveSettingsToServer({ theme_preset: nextPreset }).then((result) => {
                    if (!result.ok) {
                        console.warn('theme preset save failed', result);
                    }
                });
            }
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
    applyCopyButtonsSetting(readCopyButtonsSetting());
    applyFolderIconStyle(readFolderIconStyleSetting());
    applyTheme();
})();
    };
})();
