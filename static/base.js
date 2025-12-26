(function(){
    // i18n helper (populated by PHP via window.MDW_I18N)
    const data = (window.MDW_I18N && typeof window.MDW_I18N === 'object') ? window.MDW_I18N : null;
    const get = (key) => {
        if (!data || !key || typeof key !== 'string') return null;
        let cur = data;
        for (const part of key.split('.')) {
            if (!cur || typeof cur !== 'object' || !(part in cur)) return null;
            cur = cur[part];
        }
        return (typeof cur === 'string') ? cur : null;
    };
    const format = (str, vars) => {
        let out = String(str ?? '');
        if (!vars || typeof vars !== 'object') return out;
        for (const [k, v] of Object.entries(vars)) {
            out = out.replaceAll(`{${k}}`, String(v ?? ''));
        }
        return out;
    };
    window.MDW_T = (key, fallback = '', vars = null) => {
        const v = get(key);
        if (typeof v === 'string' && v !== '') return format(v, vars);
        return format(typeof fallback === 'string' ? fallback : '', vars);
    };
})();

// localStorage helpers (namespace keys per app base URL)
(function(){
    const existingKey = (typeof window.__mdwStorageKey === 'function') ? window.__mdwStorageKey : null;
    const buildKey = () => {
        const loc = window.location || {};
        const origin = String(loc.origin || '');
        const path = String(loc.pathname || '/');
        const dir = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
        const prefix = `mdw:${origin}${dir}`;
        return (key) => `${prefix}:${key}`;
    };
    const storageKey = existingKey || buildKey();
    const get = (key) => {
        try { return localStorage.getItem(storageKey(key)); } catch { return null; }
    };
    const set = (key, value) => {
        try { localStorage.setItem(storageKey(key), value); } catch {}
    };
    const remove = (key) => {
        try { localStorage.removeItem(storageKey(key)); } catch {}
    };
    if (!existingKey) window.__mdwStorageKey = storageKey;
    if (typeof window.__mdwStorageGet !== 'function') window.__mdwStorageGet = get;
    if (typeof window.__mdwStorageSet !== 'function') window.__mdwStorageSet = set;
    if (typeof window.__mdwStorageRemove !== 'function') window.__mdwStorageRemove = remove;
})();

const mdwStorageGet = (key) => {
    const fn = window.__mdwStorageGet;
    if (typeof fn === 'function') return fn(key);
    try { return localStorage.getItem(key); } catch { return null; }
};
const mdwStorageSet = (key, value) => {
    const fn = window.__mdwStorageSet;
    if (typeof fn === 'function') { fn(key, value); return; }
    try { localStorage.setItem(key, value); } catch {}
};
const mdwStorageRemove = (key) => {
    const fn = window.__mdwStorageRemove;
    if (typeof fn === 'function') { fn(key); return; }
    try { localStorage.removeItem(key); } catch {}
};

const MDW_DELETE_AFTER_KEY = 'mdw_delete_after';
const mdwReadDeleteAfter = () => {
    try {
        const v = String(mdwStorageGet(MDW_DELETE_AFTER_KEY) || '').trim();
        return v === 'next' ? 'next' : 'overview';
    } catch {}
    return 'overview';
};
const mdwWriteDeleteAfter = (value) => {
    const next = value === 'next' ? 'next' : 'overview';
    try { mdwStorageSet(MDW_DELETE_AFTER_KEY, next); } catch {}
    return next;
};
window.__mdwReadDeleteAfter = mdwReadDeleteAfter;
window.__mdwWriteDeleteAfter = mdwWriteDeleteAfter;

const mdwRenderMermaid = async (root) => {
    const mermaid = window.mermaid;
    if (!mermaid || typeof mermaid.run !== 'function') return;
    const scope = root instanceof HTMLElement ? root : document;
    const nodes = scope.querySelectorAll('.mermaid');
    if (!nodes.length) return;
    nodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (typeof node.__mdwMermaidSrc !== 'string') {
            node.__mdwMermaidSrc = node.textContent || '';
        } else {
            node.textContent = node.__mdwMermaidSrc;
        }
        node.removeAttribute('data-processed');
    });
    try {
        await mermaid.run({ nodes });
    } catch (err) {
        console.warn('Mermaid render failed', err);
    }
};
window.__mdwRenderMermaid = mdwRenderMermaid;

const mdwApplyMermaidTheme = () => {
    const mermaid = window.mermaid;
    if (!mermaid || typeof mermaid.initialize !== 'function') return false;
    const probe = document.querySelector('.preview-content') || document.querySelector('.preview-container') || document.body;
    const styles = getComputedStyle(probe || document.body);
    const val = (v, fallback) => {
        const out = String(v || '').trim();
        return out || fallback;
    };
    const cssVar = (name, fallback) => val(styles.getPropertyValue(name), fallback);
    const normalizeMermaidColor = (value, fallback) => {
        const raw = String(value || '').trim();
        if (!raw) return fallback;
        const srgbMatch = raw.match(/^color\((?:srgb|display-p3)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\)$/i);
        if (srgbMatch) {
            const r = Math.round(Math.max(0, Math.min(1, parseFloat(srgbMatch[1]))) * 255);
            const g = Math.round(Math.max(0, Math.min(1, parseFloat(srgbMatch[2]))) * 255);
            const b = Math.round(Math.max(0, Math.min(1, parseFloat(srgbMatch[3]))) * 255);
            const aRaw = srgbMatch[4];
            if (aRaw !== undefined) {
                const a = Math.max(0, Math.min(1, parseFloat(aRaw)));
                if (!Number.isNaN(a) && a < 1) return `rgba(${r}, ${g}, ${b}, ${a})`;
            }
            return `rgb(${r}, ${g}, ${b})`;
        }
        return raw;
    };
    const resolveCssColor = (value, fallback) => {
        const raw = String(value || '').trim();
        if (!raw) return fallback;
        const host = probe || document.body;
        const el = document.createElement('span');
        el.style.color = raw;
        el.style.display = 'none';
        host.appendChild(el);
        const computed = getComputedStyle(el).color;
        host.removeChild(el);
        return normalizeMermaidColor(computed || '', fallback);
    };
    const text = resolveCssColor(val(styles.color, cssVar('--text-main', '#111827')), '#111827');
    const bg = resolveCssColor(cssVar('--theme-bg', cssVar('--bg-panel-alt', val(styles.backgroundColor, '#ffffff'))), '#ffffff');
    const surface = resolveCssColor(cssVar('--theme-surface', cssVar('--surface-code', bg)), bg);
    const border = resolveCssColor(cssVar('--theme-border', cssVar('--border-soft', surface)), surface);
    const primary = resolveCssColor(cssVar('--theme-primary', cssVar('--accent', text)), text);
    const secondary = resolveCssColor(
        cssVar('--theme-secondary', cssVar('--theme-secondary-fallback', cssVar('--text-muted', primary))),
        primary
    );
    const fontFamily = val(styles.fontFamily, cssVar('--font-sans', 'sans-serif'));
    const fontSize = val(styles.fontSize, '14px');

    mermaid.initialize({
        startOnLoad: true,
        theme: 'base',
        themeVariables: {
            fontFamily,
            fontSize,
            background: bg,
            primaryColor: surface,
            primaryTextColor: text,
            primaryBorderColor: border,
            secondaryColor: bg,
            secondaryTextColor: text,
            secondaryBorderColor: border,
            tertiaryColor: surface,
            tertiaryTextColor: text,
            tertiaryBorderColor: border,
            lineColor: primary,
            textColor: text,
            mainBkg: bg,
            nodeBorder: border,
            clusterBkg: surface,
            clusterBorder: border,
            titleColor: text,
            edgeLabelBackground: surface,
            actorBkg: surface,
            actorBorder: border,
            actorTextColor: text,
            noteBkgColor: surface,
            noteTextColor: text,
            noteBorderColor: border,
            pie1: primary,
            pie2: secondary,
            pie3: text,
            pie4: border,
        },
    });
    return true;
};
window.__mdwApplyMermaidTheme = mdwApplyMermaidTheme;

const mdwRefreshMermaid = (root) => {
    if (!mdwApplyMermaidTheme()) return;
    mdwRenderMermaid(root || document).catch(() => {});
};
window.__mdwRefreshMermaid = mdwRefreshMermaid;

if (document.readyState === 'complete') {
    mdwRefreshMermaid();
} else {
    window.addEventListener('load', () => mdwRefreshMermaid(), { once: true });
}

const mdwSetLangCookie = (lang) => {
    const v = String(lang || '').trim();
    if (!v) return false;
    const parts = [
        `mdw_lang=${encodeURIComponent(v)}`,
        'Path=/',
        `Max-Age=${60 * 60 * 24 * 365}`,
        'SameSite=Lax',
    ];
    if (window.location && window.location.protocol === 'https:') parts.push('Secure');
    document.cookie = parts.join('; ');
    return true;
};
window.__mdwSetLangCookie = mdwSetLangCookie;

(function(){
    const saved = String(mdwStorageGet('mdw_ui_lang') || '').trim();
    if (!saved) return;
    const current = String(window.MDW_LANG || '').trim();
    if (saved === '' || saved === current) return;
    const list = Array.isArray(window.MDW_LANGS) ? window.MDW_LANGS : [];
    const allowed = new Set(list.map((l) => String(l?.code || '')).filter(Boolean));
    if (allowed.size && !allowed.has(saved)) return;
    if (mdwSetLangCookie(saved)) {
        window.location.reload();
    }
})();

// Auth (user/superuser)
(function(){
    const meta = (window.MDW_AUTH_META && typeof window.MDW_AUTH_META === 'object') ? window.MDW_AUTH_META : { has_user: false, has_superuser: false };
    const overlay = document.getElementById('authOverlay');
    const modal = document.getElementById('authModal');
    const titleEl = document.getElementById('authModalTitle');
    const setupFields = document.getElementById('authSetupFields');
    const loginFields = document.getElementById('authLoginFields');
    const setupUser = document.getElementById('authSetupUserPassword');
    const setupSuper = document.getElementById('authSetupSuperPassword');
    const loginPassword = document.getElementById('authLoginPassword');
    const submitBtn = document.getElementById('authSubmitBtn');
    const authForm = document.getElementById('authForm');
    const statusEl = document.getElementById('authStatus');
    const authBtn = document.getElementById('authToggleBtn');
    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const getStoredAuth = () => {
        let role = '';
        let token = '';
        try {
            role = String(mdwStorageGet('mdw_auth_role') || '').trim();
            token = String(mdwStorageGet('mdw_auth_token') || '').trim();
        } catch {}
        return { role, token };
    };

    const isSuperuser = () => {
        const { role } = getStoredAuth();
        return role === 'superuser';
    };

    window.__mdwAuthState = getStoredAuth;
    window.__mdwIsSuperuser = isSuperuser;

    const setStatus = (msg, kind = 'info') => {
        if (!(statusEl instanceof HTMLElement)) return;
        statusEl.textContent = String(msg || '');
        statusEl.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const setLocked = (locked) => {
        document.documentElement.classList.toggle('auth-locked', !!locked);
        if (overlay) overlay.hidden = !locked;
    };

    const updateSuperuserUi = () => {
        const allow = isSuperuser();
        document.querySelectorAll('[data-auth-superuser="1"]').forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            el.style.display = allow ? '' : 'none';
        });
        document.querySelectorAll('[data-auth-regular="1"]').forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            el.style.display = allow ? 'none' : '';
        });
        document.querySelectorAll('[data-auth-superuser-enable="1"]').forEach((el) => {
            if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLButtonElement || el instanceof HTMLTextAreaElement) {
                el.disabled = !allow;
            }
        });
        if (typeof window.__mdwApplyDeletePermissions === 'function') {
            window.__mdwApplyDeletePermissions();
        }
    };

    window.__mdwShowAuthModal = () => {
        const needsSetup = !meta.has_user && !meta.has_superuser;
        setMode(needsSetup ? 'setup' : 'login');
        setLocked(true);
        updateSuperuserUi();
        updateAuthButton();
        if (loginPassword instanceof HTMLInputElement) {
            try { loginPassword.focus(); } catch {}
        }
    };

    const updateAuthButton = () => {
        if (!(authBtn instanceof HTMLElement)) return;
        const { role, token } = getStoredAuth();
        const loggedIn = !!(role && token);
        const icon = authBtn.querySelector('.pi');
        if (icon) {
            icon.classList.toggle('pi-upload', loggedIn);
            icon.classList.toggle('auth-logout-icon', loggedIn);
            icon.classList.toggle('pi-login', !loggedIn);
        }
        authBtn.title = loggedIn ? 'Logout' : 'Login';
        authBtn.setAttribute('aria-label', loggedIn ? 'Logout' : 'Login');
        authBtn.style.display = (meta.has_user || meta.has_superuser) ? '' : (loggedIn ? '' : 'none');
    };

    const DEFAULT_APP_TITLE = 'Markdown Manager';
    let authMode = 'login';

    const getAppTitle = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        const raw = s && typeof s.app_title === 'string' ? s.app_title.trim() : '';
        return raw || DEFAULT_APP_TITLE;
    };

    const applyAuthTitle = () => {
        if (!titleEl) return;
        const modeLabel = authMode === 'setup'
            ? t('auth.setup_title', 'Set passwords')
            : t('auth.login_title', 'Login');
        const appTitle = getAppTitle();
        titleEl.textContent = appTitle ? `${appTitle} • ${modeLabel}` : modeLabel;
    };

    const setMode = (mode) => {
        authMode = mode === 'setup' ? 'setup' : 'login';
        applyAuthTitle();
        if (setupFields) setupFields.hidden = mode !== 'setup';
        if (loginFields) loginFields.hidden = mode !== 'login';
        if (submitBtn instanceof HTMLButtonElement) {
            const label = submitBtn.querySelector('.btn-label');
            if (label instanceof HTMLElement) {
                label.textContent = mode === 'setup'
                    ? t('auth.setup_submit', 'Save passwords')
                    : t('auth.login_submit', 'Login');
            }
        }
    };

    window.__mdwUpdateAuthTitle = applyAuthTitle;

    const FAIL_KEY = 'mdw_auth_fail_count';
    const LOCK_KEY = 'mdw_auth_lock_until';
    const LOCK_MS = 5 * 60 * 1000;
    let lockTimer = null;

    const readLockUntil = () => {
        let until = 0;
        try { until = parseInt(mdwStorageGet(LOCK_KEY) || '0', 10) || 0; } catch {}
        return until;
    };

    const isLocked = () => readLockUntil() > Date.now();

    const formatMs = (ms) => {
        const total = Math.max(0, Math.ceil(ms / 1000));
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const updateLockUi = () => {
        const until = readLockUntil();
        if (until <= Date.now()) {
            if (lockTimer) {
                clearInterval(lockTimer);
                lockTimer = null;
            }
            if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
            if (loginPassword instanceof HTMLInputElement) loginPassword.disabled = false;
            return false;
        }
        const remaining = until - Date.now();
        setStatus(
            t('auth.locked', 'Too many attempts. Try again in {time}.', { time: formatMs(remaining) }),
            'error'
        );
        if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
        if (loginPassword instanceof HTMLInputElement) loginPassword.disabled = true;
        if (!lockTimer) {
            lockTimer = setInterval(updateLockUi, 1000);
        }
        return true;
    };

    const authRequest = async (payload) => {
        const res = await fetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {}),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.ok !== true) {
            const err = (data && data.error) ? String(data.error) : 'auth_failed';
            throw new Error(err);
        }
        return data;
    };

    const storeAuth = (role, token) => {
        try {
            mdwStorageSet('mdw_auth_role', String(role || ''));
            mdwStorageSet('mdw_auth_token', String(token || ''));
        } catch {}
    };

    const login = async () => {
        if (!(loginPassword instanceof HTMLInputElement)) return;
        const password = String(loginPassword.value || '');
        if (isLocked()) {
            updateLockUi();
            return;
        }
        if (!password.trim()) {
            setStatus(t('auth.missing_password', 'Enter a password.'), 'error');
            return;
        }
        setStatus(t('auth.signing_in', 'Signing in...'), 'info');
        const data = await authRequest({ action: 'login', password });
        storeAuth(data.role, data.token);
        try { mdwStorageSet('mdw_auth_role_hint', data.role); } catch {}
        try { mdwStorageRemove(FAIL_KEY); mdwStorageRemove(LOCK_KEY); } catch {}
        loginPassword.value = '';
        setStatus('', 'info');
        setLocked(false);
        updateSuperuserUi();
        updateAuthButton();
        if (typeof window.__mdwMaybeShowWpmSetup === 'function') {
            window.__mdwMaybeShowWpmSetup();
        }
    };

    const setup = async () => {
        if (!(setupUser instanceof HTMLInputElement) || !(setupSuper instanceof HTMLInputElement)) return;
        const userPw = String(setupUser.value || '').trim();
        const superPw = String(setupSuper.value || '').trim();
        if (!userPw || !superPw) {
            setStatus(t('auth.set_passwords', 'Set both passwords.'), 'error');
            return;
        }
        setStatus(t('auth.saving', 'Saving...'), 'info');
        const data = await authRequest({ action: 'setup', user_password: userPw, superuser_password: superPw });
        meta.has_user = !!data.has_user;
        meta.has_superuser = !!data.has_superuser;
        storeAuth(data.role, data.token);
        setupUser.value = '';
        setupSuper.value = '';
        setStatus('', 'info');
        setMode('login');
        setLocked(false);
        updateSuperuserUi();
        updateAuthButton();
    };

    const onSubmit = async () => {
        try {
            const needsSetup = !meta.has_user && !meta.has_superuser;
            if (needsSetup) {
                await setup();
            } else {
                await login();
            }
        } catch (e) {
            const msg = (e && typeof e.message === 'string' && e.message.trim()) ? e.message.trim() : 'Auth failed';
            const friendly = msg === 'invalid_password'
                ? t('auth.wrong_password', 'Wrong password.')
                : (msg === 'missing_password'
                    ? t('auth.missing_password', 'Enter a password.')
                    : (msg === 'auth_failed'
                        ? t('auth.failed', 'Auth failed.')
                        : msg));
            setStatus(friendly, 'error');
            if (msg === 'invalid_password') {
                let count = 0;
                try { count = parseInt(mdwStorageGet(FAIL_KEY) || '0', 10) || 0; } catch {}
                count += 1;
                if (count >= 3) {
                    const until = Date.now() + LOCK_MS;
                    try {
                        mdwStorageSet(LOCK_KEY, String(until));
                        mdwStorageRemove(FAIL_KEY);
                    } catch {}
                    updateLockUi();
                } else {
                    try { mdwStorageSet(FAIL_KEY, String(count)); } catch {}
                }
            }
        }
    };

    authForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        onSubmit();
    });

    const authEnterHandler = (e) => {
        if ((e.key !== 'Enter' && e.code !== 'NumpadEnter') || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target !== loginPassword && target !== setupUser && target !== setupSuper) return;
        console.debug('[auth] enter key detected on', target.id);
        e.preventDefault();
        onSubmit();
    };
    loginPassword?.addEventListener('keydown', authEnterHandler);
    setupUser?.addEventListener('keydown', authEnterHandler);
    setupSuper?.addEventListener('keydown', authEnterHandler);

    authBtn?.addEventListener('click', () => {
        const { role, token } = getStoredAuth();
        if (role && token) {
            try {
                mdwStorageRemove('mdw_auth_role');
                mdwStorageRemove('mdw_auth_token');
            } catch {}
            setLocked(true);
            updateSuperuserUi();
            updateAuthButton();
            window.location.href = 'index.php';
        } else {
            setLocked(true);
            updateSuperuserUi();
            updateAuthButton();
        }
    });

    const { role, token } = getStoredAuth();
    const loggedIn = !!(role && token);
    const needsSetup = !meta.has_user && !meta.has_superuser;
    setMode(needsSetup ? 'setup' : 'login');
    setLocked(!loggedIn || needsSetup);
    updateSuperuserUi();
    updateAuthButton();
    updateLockUi();

    // Attach auth fields to all form submissions.
    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        const { role, token } = getStoredAuth();
        if (!role || !token) return;
        const ensureInput = (name, value) => {
            let input = form.querySelector(`input[name="${name}"]`);
            if (!(input instanceof HTMLInputElement)) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                form.appendChild(input);
            }
            input.value = String(value || '');
        };
        ensureInput('auth_role', role);
        ensureInput('auth_token', token);
    }, true);
})();

(function(){
    const readAllowUserDelete = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        if (!s || typeof s !== 'object') return true;
        return !Object.prototype.hasOwnProperty.call(s, 'allow_user_delete') ? true : !!s.allow_user_delete;
    };

    const canDelete = () => {
        const meta = (window.MDW_AUTH_META && typeof window.MDW_AUTH_META === 'object')
            ? window.MDW_AUTH_META
            : { has_user: false, has_superuser: false };
        const hasAuth = !!(meta.has_user || meta.has_superuser);
        if (!hasAuth) return true;
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (!auth || !auth.role) return false;
        if (auth.role === 'superuser') return true;
        if (auth.role === 'user') return readAllowUserDelete();
        return false;
    };

    const applyDeletePermissions = () => {
        const allow = canDelete();
        document.querySelectorAll('form.deleteForm').forEach((form) => {
            if (!(form instanceof HTMLFormElement)) return;
            const btn = form.querySelector('button[type="submit"], input[type="submit"]');
            if (btn instanceof HTMLButtonElement || btn instanceof HTMLInputElement) {
                btn.disabled = !allow;
            }
        });
    };

    const normalizePath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const folderFromFile = (p) => {
        const path = normalizePath(p);
        const idx = path.lastIndexOf('/');
        return idx === -1 ? 'root' : path.slice(0, idx);
    };
    const getNeighborFile = (row) => {
        if (!(row instanceof HTMLElement)) return null;
        const list = row.closest('.notes-list');
        if (!list) return null;
        const items = Array.from(list.querySelectorAll('.note-item.doclink[data-file]'))
            .filter(el => el instanceof HTMLElement && el.offsetParent !== null);
        const idx = items.indexOf(row);
        if (idx === -1) return null;
        const next = items[idx + 1] || items[idx - 1];
        if (!(next instanceof HTMLElement)) return null;
        return String(next.dataset.file || '') || null;
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

    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.classList.contains('deleteForm')) return;
        if (!canDelete()) {
            e.preventDefault();
            if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
            return;
        }

        const fileInput = form.querySelector('input[name="file"]');
        const file = String((fileInput instanceof HTMLInputElement ? fileInput.value : form.dataset.file) || '').trim();
        if (!file) return;

        const deleteAfter = mdwReadDeleteAfter();
        ensureInput(form, 'delete_after', deleteAfter);
        ensureInput(form, 'return_open', folderFromFile(file));

        try {
            const params = new URLSearchParams(window.location.search);
            const inView = !!params.get('file');
            const folderFilter = !inView ? String(params.get('folder') || '') : '';
            if (folderFilter) ensureInput(form, 'return_filter', folderFilter);
        } catch {}

        const row = form.closest('[data-file]');
        let focus = getNeighborFile(row);
        if (!focus && window.MDW_VIEW_NAV && typeof window.MDW_VIEW_NAV === 'object') {
            focus = window.MDW_VIEW_NAV.next || window.MDW_VIEW_NAV.prev || '';
        }
        if (!focus) focus = file;
        ensureInput(form, 'return_focus', focus);
    }, true);

    window.__mdwCanDelete = canDelete;
    window.__mdwApplyDeletePermissions = applyDeletePermissions;
    applyDeletePermissions();
})();

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
        document.documentElement.classList.add('modal-open');
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
        document.documentElement.classList.remove('modal-open');
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
            window.__mdwSaveSettingsToServer({ ui_theme: next }).catch(() => {});
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

    const saveSettingsToServer = async (partial) => {
        const csrf = String(window.MDW_CSRF || '');
        if (!csrf) return false;
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const cur = (cfg && cfg._settings && typeof cfg._settings === 'object') ? cfg._settings : {};
        const settings = { ...(cur || {}), ...(partial || {}) };
        const authMeta = (window.MDW_AUTH_META && typeof window.MDW_AUTH_META === 'object') ? window.MDW_AUTH_META : { has_user: false, has_superuser: false };
        const authRequired = !!(authMeta.has_user || authMeta.has_superuser);
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (authRequired && (!auth || auth.role !== 'superuser' || !auth.token)) return false;

        const res = await fetch('metadata_config_save.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf, settings, auth: authRequired ? { role: auth.role, token: auth.token } : null }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.ok !== true) return false;
        if (data.config) window.MDW_META_CONFIG = data.config;
        if (data.publisher_config) window.MDW_META_PUBLISHER_CONFIG = data.publisher_config;
        return true;
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

    const readOverrides = () => {
        try {
            const raw = mdwStorageGet(STORAGE_OVERRIDES);
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
        mdwStorageSet(STORAGE_OVERRIDES, JSON.stringify(o || { preview: {}, editor: {} }));
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
    const allowUserDeleteToggle = document.getElementById('allowUserDeleteToggle');
    const allowUserDeleteStatus = document.getElementById('allowUserDeleteStatus');
    const copyButtonsToggle = document.getElementById('copyButtonsToggle');
    const copyIncludeMetaToggle = document.getElementById('copyIncludeMetaToggle');
    const copyHtmlModeSelect = document.getElementById('copyHtmlModeSelect');
    const copySettingsStatus = document.getElementById('copySettingsStatus');
    const settingsExportBtn = document.getElementById('settingsExportBtn');
    const settingsImportBtn = document.getElementById('settingsImportBtn');
    const settingsImportFile = document.getElementById('settingsImportFile');
    const settingsImportExportStatus = document.getElementById('settingsImportExportStatus');
    const postDateFormatSelect = document.getElementById('postDateFormatSelect');
    const postDateFormatStatus = document.getElementById('postDateFormatStatus');
    const postDateAlignSelect = document.getElementById('postDateAlignSelect');
    const postDateAlignStatus = document.getElementById('postDateAlignStatus');

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

    const readAppTitleSetting = () => {
        const s = getSettings();
        return s && typeof s.app_title === 'string' ? s.app_title.trim() : '';
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
    const readUiLanguageSetting = () => {
        const s = getSettings();
        return s && typeof s.ui_language === 'string' ? s.ui_language.trim() : '';
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
            },
        };
    };

    let persistSettingsOnClose = async () => true;

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
        if (appTitleInput instanceof HTMLInputElement) {
            appTitleInput.value = readAppTitleSetting();
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
        if (postDateFormatSelect instanceof HTMLSelectElement) {
            postDateFormatSelect.value = readPostDateFormatSetting();
        }
        if (postDateAlignSelect instanceof HTMLSelectElement) {
            postDateAlignSelect.value = readPostDateAlignSetting();
        }
        if (langSelect instanceof HTMLSelectElement) {
            const uiLang = readUiLanguageSetting();
            if (uiLang) langSelect.value = uiLang;
        }
        setAppTitleStatus(t('theme.app_title.hint', 'Leave blank to use the default.'), 'info');
        syncDeleteAfterUi();
        setAllowUserDeleteStatus(t('theme.permissions.hint', 'Saved for all users.'), 'info');
        setCopySettingsStatus(t('theme.copy.hint', 'Saved for all users.'), 'info');
        setPostDateFormatStatus(t('theme.post_date_format.hint', 'Saved for all users.'), 'info');
        setPostDateAlignStatus(t('theme.post_date_align.hint', 'Saved for all users.'), 'info');
        setSettingsIoStatus('', 'info');

        overlay.hidden = false;
        modal.hidden = false;
        document.documentElement.classList.add('modal-open');
        setTimeout(() => presetSelect?.focus(), 0);
    };

    const performClose = () => {
        overlay.hidden = true;
        modal.hidden = true;
        document.documentElement.classList.remove('modal-open');
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
        setOverridesStatus(t('theme.overrides.saved', 'Saved'), 'ok');
    };

    const saveAppTitleSetting = async (nextTitle) => {
        setAppTitleStatus(t('theme.app_title.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setAppTitleStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const ok = await saveSettingsToServer({ app_title: nextTitle });
            if (!ok) throw new Error(t('theme.app_title.save_failed', 'Save failed'));
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

    const saveAllowUserDeleteSetting = async (nextValue) => {
        setAllowUserDeleteStatus(t('theme.permissions.saving', 'Saving…'), 'info');
        try {
            if (typeof window.__mdwIsSuperuser === 'function' && !window.__mdwIsSuperuser()) {
                setAllowUserDeleteStatus(t('auth.superuser_required', 'Superuser login required.'), 'error');
                if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
                return false;
            }
            const ok = await saveSettingsToServer({ allow_user_delete: nextValue });
            if (!ok) throw new Error(t('theme.permissions.save_failed', 'Save failed'));
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
            const ok = await saveSettingsToServer({ copy_buttons_enabled: nextValue });
            if (!ok) throw new Error(t('theme.copy.save_failed', 'Save failed'));
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
            const ok = await saveSettingsToServer({ copy_include_meta: nextValue });
            if (!ok) throw new Error(t('theme.copy.save_failed', 'Save failed'));
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
            const ok = await saveSettingsToServer({ copy_html_mode: value });
            if (!ok) throw new Error(t('theme.copy.save_failed', 'Save failed'));
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
            const ok = await saveSettingsToServer({ post_date_format: value });
            if (!ok) throw new Error(t('theme.post_date_format.save_failed', 'Save failed'));
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
            const ok = await saveSettingsToServer({ post_date_align: value });
            if (!ok) throw new Error(t('theme.post_date_align.save_failed', 'Save failed'));
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

    const resetOverrides = () => {
        writeOverrides({ preview: {}, editor: {} });
        Object.values(inputs).forEach((el) => {
            if (el instanceof HTMLInputElement) el.value = '';
        });
        applyTheme();
        setOverridesStatus(t('theme.overrides.cleared', 'Cleared'), 'ok');
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
        applyTheme();
        updateThemeUi();
    };

    if (btn && modal && overlay) {
        btn.addEventListener('click', open);
        overlay.addEventListener('click', () => close());
        closeBtn?.addEventListener('click', () => close());
        cancelBtn?.addEventListener('click', () => close());
        resetBtn?.addEventListener('click', resetOverrides);
        saveBtn?.addEventListener('click', persistFromInputs);
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
                const res = await fetch('metadata_config_save.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const resp = await res.json().catch(() => null);
                if (!res.ok || !resp || resp.ok !== true) {
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
                        const ok = await saveSettingsToServer({ ui_language: v });
                        if (ok && window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') {
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

        const saveMetadataSettings = async () => {
            setMetaStatus(t('theme.metadata.saving', 'Saving…'), 'info');
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
                const res = await fetch('metadata_config_save.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data || data.ok !== true) {
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
                saveSettingsToServer({ theme_preset: nextPreset }).catch(() => {});
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
    applyTheme();
})();

// Editor: metadata visibility (hide/show in markdown textarea; always saved in file)
(function(){
    const editor = document.getElementById('editor');
    const form = document.getElementById('editor-form');
    if (!(editor instanceof HTMLTextAreaElement) || !(form instanceof HTMLFormElement)) return;

    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));

    const metaLineRe = /^\s*_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*$/u;

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
        for (const line of lines) {
            const normalized = String(line).replace(/\u00a0/g, ' ').replace(/[\u200B\uFEFF]/g, '');
            const m = normalized.match(metaLineRe);
            if (m) {
                const key = String(m[1] || '').trim().toLowerCase();
                const val = String(m[2] || '').trim();
                if (known.has(key)) {
                    meta[key] = val;
                    continue;
                }
            }
            bodyLines.push(line);
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
            out.push(`_${k}: ${v}_`);
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
    window.addEventListener('load', measure);

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        document.fonts.ready.then(() => measure()).catch(() => {});
    }

    if (typeof ResizeObserver === 'function') {
        const ro = new ResizeObserver(() => {
            measure();
        });
        ro.observe(header);
    }

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
        const name = window.prompt(t('js.prompt_new_folder', 'New folder name (no slashes):'), '');
        if (name === null) return;
        const folder = name.trim();
        if (!folder) return;
        if (folder.includes('/') || folder.includes('\\') || folder.includes('..')) {
            alert(t('js.invalid_folder_alert', 'Invalid folder name.'));
            return;
        }
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
                    if (!confirm(t('js.unsaved_confirm', 'You have unsaved changes. Discard them and continue?'))) {
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

        } catch (error) {
            console.error('Failed to load document:', error);
            document.getElementById('liveStatus').textContent = 'Error loading file.';
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
            const res = await fetch(`${apiUrl}?action=list`, { headers: { 'Accept': 'application/json' } });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok !== true) {
                throw new Error((data && data.error) ? data.error : t('image_modal.load_failed', 'Failed to load images.'));
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
        document.documentElement.classList.add('modal-open');
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
        uploadBtn.disabled = true;
        try {
            const fd = new FormData();
            fd.append('action', 'upload');
            fd.append('csrf', csrf);
            fd.append('image', file);

            const res = await fetch(apiUrl, { method: 'POST', body: fd });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok !== true) {
                throw new Error((data && data.error) ? data.error : t('image_modal.upload_failed', 'Upload failed.'));
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
            uploadBtn.disabled = false;
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
        document.documentElement.classList.add('modal-open');
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
        document.documentElement.classList.remove('modal-open');
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
        document.documentElement.classList.add('modal-open');
        setStatus('');
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    };

    const close = () => {
        overlay.hidden = true;
        modal.hidden = true;
        document.documentElement.classList.remove('modal-open');
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
        if (saveErrorMessage) saveErrorMessage.textContent = message || 'Save failed.';
        if (saveErrorDetails) saveErrorDetails.textContent = details || '';
        if (saveErrorDetailsWrap) saveErrorDetailsWrap.hidden = !details;
        if (saveErrorPanel) saveErrorPanel.hidden = false;
    };
    const clearSaveError = () => {
        if (saveErrorPanel) saveErrorPanel.hidden = true;
        if (saveErrorMessage) saveErrorMessage.textContent = '';
        if (saveErrorDetails) saveErrorDetails.textContent = '';
        if (saveErrorDetailsWrap) saveErrorDetailsWrap.hidden = true;
    };

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

        if (status) status.textContent = 'Saving…';
        clearSaveError();
        try {
            const res = await fetch(action, {
                method: 'POST',
                body: fd,
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok !== true) {
                const msg = (data && data.error) ? String(data.error) : 'Save failed.';
                if (status) status.textContent = msg;
                showSaveError(msg, data && data.details ? String(data.details) : '');
                clearIgnoreBeforeUnload();
                return;
            }
            if (typeof window.__mdwResetDirty === 'function') {
                window.__mdwResetDirty();
            }
            if (status) status.textContent = 'Saved';
            showSaveChip();
            clearSaveError();
        } catch (err) {
            if (status) status.textContent = 'Save failed.';
            showSaveError('Save failed.', '');
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
            if (typeof window.__mdwRenderMermaid === 'function') {
                window.__mdwRenderMermaid(prev).catch(() => {});
            }
            if (typeof window.__mdwInitCodeCopyButtons === 'function') {
                window.__mdwInitCodeCopyButtons();
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

    const clickById = (id) => {
        const el = document.getElementById(id);
        if (el instanceof HTMLElement) el.click();
    };

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

        // Bold: Ctrl+Alt+B
        if (!e.shiftKey && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            wrapOrUnwrap('**', '**');
            return;
        }

        // Italic: Ctrl+Alt+I
        if (!e.shiftKey && (e.key === 'i' || e.key === 'I')) {
            e.preventDefault();
            wrapOrUnwrap('*', '*', {
                singleCharSafe: ({ value, start, end }) => {
                    const prev = value[start - 2] || '';
                    const next = value[end + 1] || '';
                    return prev !== '*' && next !== '*';
                }
            });
            return;
        }

        // Strikethrough: Ctrl+Alt+X
        if (!e.shiftKey && (e.key === 'x' || e.key === 'X')) {
            e.preventDefault();
            wrapOrUnwrap('~~', '~~');
            return;
        }

        // Inline code: Ctrl+Alt+` (backquote key)
        if (!e.shiftKey && (e.code === 'Backquote' || e.key === '`')) {
            e.preventDefault();
            wrapOrUnwrap('`', '`');
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
            toggleLinePrefix('quote');
            return;
        }

        // Bullet list toggle: Ctrl+Alt+U
        if (!e.shiftKey && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            toggleLinePrefix('bullet');
            return;
        }

        // Fenced code block: Ctrl+Alt+O
        if (!e.shiftKey && (e.key === 'o' || e.key === 'O')) {
            e.preventDefault();
            wrapOrUnwrap('```\n', '\n```');
            return;
        }

        // Comment: Ctrl+Alt+/
        if (e.code === 'Slash') {
            e.preventDefault();
            wrapOrUnwrap('<!-- ', ' -->');
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
            adjustHeadingLevel(1);
            return;
        }
        if (isMinus) {
            e.preventDefault();
            adjustHeadingLevel(-1);
            return;
        }

        // Set heading level directly: Ctrl+Alt+1..6
        if (!e.shiftKey && /^[1-6]$/.test(String(e.key || ''))) {
            e.preventDefault();
            setHeadingLevel(Number(e.key));
        }
    });
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
            mdwStorageSet(STORAGE_KEY, JSON.stringify({
                left, mid, right
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

// Export HTML preview (edit.php + index.php)
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
        const metaLineRe = /^\s*_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*$/u;
        const allowed = collectAllowedMetaKeys();
        const lines = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n');
        if (!lines.length) return '';
        if (lines[0]) lines[0] = lines[0].replace(/^\uFEFF/, '');
        const out = [];
        for (const line of lines) {
            const normalized = String(line)
                .replace(/\u00a0/g, ' ')
                .replace(/[\u200B\uFEFF]/g, '');
            const match = normalized.match(metaLineRe);
            if (match) {
                const key = String(match[1] || '').trim().toLowerCase();
                if (key && allowed.has(key)) {
                    continue;
                }
            }
            out.push(line);
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

    const stripPreviewClasses = (rootEl) => {
        if (!(rootEl instanceof Element)) return;
        const filterClasses = (el) => {
            const raw = el.getAttribute('class');
            if (!raw) return;
            const keep = raw
                .split(/\s+/)
                .map((c) => String(c || '').trim())
                .filter((c) => c && c.indexOf('md-') !== 0 && c.indexOf('meta-') !== 0);
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

    const applyHtmlMode = (targetRoot, htmlMode, sourceRoot) => {
        if (!(targetRoot instanceof Element)) return;
        if (htmlMode === 'dry') {
            stripCssAttributes(targetRoot);
            return;
        }
        if (htmlMode === 'medium') {
            stripInlineStyles(targetRoot);
            stripPreviewClasses(targetRoot);
            return;
        }
        if (htmlMode !== 'wet') return;
        const src = (sourceRoot instanceof Element) ? sourceRoot : targetRoot;
        const inDoc = (targetRoot instanceof Element) && document.body?.contains(targetRoot);
        if (src === targetRoot && !inDoc) {
            const holder = document.createElement('div');
            holder.style.cssText = 'position:fixed; left:-9999px; top:0; visibility:hidden; pointer-events:none; z-index:-1;';
            document.body.appendChild(holder);
            holder.appendChild(targetRoot);
            inlineComputedStyles(targetRoot, targetRoot);
            holder.remove();
        } else {
            inlineComputedStyles(src, targetRoot);
        }
    };

    const getPreviewSnapshot = (stripMeta, htmlMode) => {
        if (!(preview instanceof HTMLElement)) return null;
        const clone = preview.cloneNode(true);
        if (clone instanceof HTMLElement) clone.removeAttribute('id');
        if (stripMeta) stripMetaHtml(clone);
        applyHtmlMode(clone, htmlMode, preview);
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

    const buildPreviewWrapper = (html, stripMeta, htmlMode) => {
        const wrapper = document.createElement(preview instanceof HTMLElement ? preview.tagName : 'div');
        if (preview instanceof HTMLElement && preview.className) {
            wrapper.className = preview.className;
        } else {
            wrapper.className = 'preview-content';
        }
        wrapper.innerHTML = html || '';
        if (stripMeta) stripMetaHtml(wrapper);
        applyHtmlMode(wrapper, htmlMode);
        return wrapper.outerHTML;
    };

    const getServerRenderedHtml = async (markdownOverride) => {
        if (!window.CURRENT_FILE) return preview?.innerHTML || '';
        const content = (typeof markdownOverride === 'string')
            ? markdownOverride
            : (editor instanceof HTMLTextAreaElement ? editor.value : null);
        if (content === null) return preview?.innerHTML || '';
        const fd = new FormData();
        fd.set('content', content);
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
        let bodyHtml = getPreviewSnapshot(stripMeta, htmlMode);
        if (!bodyHtml) {
            const markdown = getMarkdownSource();
            const rendered = (typeof markdown === 'string')
                ? await getServerRenderedHtml(markdown)
                : await getServerRenderedHtml();
            bodyHtml = buildPreviewWrapper(rendered, stripMeta, htmlMode);
        }

        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
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
            exportBtn.disabled = true;
            try {
                const includeMeta = readCopyIncludeMetaSetting();
                const htmlMode = readCopyHtmlModeSetting();
                const { filename, html } = await buildExportHtml({ includeMeta, htmlMode });
                downloadTextFile(filename, html, 'text/html;charset=utf-8');
            } catch (e) {
                console.error('Export failed', e);
                alert(t('js.export_failed', 'Export failed. Check the console for details.'));
            } finally {
                exportBtn.disabled = false;
            }
        });
    }

    if (copyHtmlBtn) {
        copyHtmlBtn.addEventListener('click', async () => {
            if (!window.CURRENT_FILE) return;
            copyHtmlBtn.disabled = true;
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
                copyHtmlBtn.disabled = false;
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
