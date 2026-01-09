(function(){
    const MDM = window.MDM = window.MDM || {};
    const module = MDM.auth = MDM.auth || {};
    const mdmApi = MDM.api;

    module.init = () => {
        if (module._init) return;
        module._init = true;

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
    const loginPasswordToggle = document.getElementById('authLoginPasswordToggle');
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
        const { role, token } = getStoredAuth();
        return role === 'superuser' && !!token;
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
        if (typeof window.__mdwApplyPublishPermissions === 'function') {
            window.__mdwApplyPublishPermissions();
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

    const setLoginVisibility = (show) => {
        if (loginPassword instanceof HTMLInputElement) {
            loginPassword.type = show ? 'text' : 'password';
        }
        if (loginPasswordToggle instanceof HTMLInputElement) {
            loginPasswordToggle.checked = !!show;
        }
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
        const showLoginPassword = mode === 'login'
            && loginPasswordToggle instanceof HTMLInputElement
            && loginPasswordToggle.checked;
        setLoginVisibility(showLoginPassword);
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
            setStatus('', 'info');
            if (loginPassword instanceof HTMLInputElement && loginFields && !loginFields.hidden && (!overlay || !overlay.hidden)) {
                try {
                    loginPassword.focus();
                    loginPassword.select();
                } catch {}
            }
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
        if (!mdmApi || typeof mdmApi.json !== 'function') {
            throw new Error('auth_failed');
        }
        const data = await mdmApi.json('auth.php', payload || {});
        if (!data || data.ok !== true) {
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

    loginPasswordToggle?.addEventListener('change', () => {
        if (!(loginPasswordToggle instanceof HTMLInputElement)) return;
        setLoginVisibility(loginPasswordToggle.checked);
        if (loginPasswordToggle.checked && loginPassword instanceof HTMLInputElement) {
            try {
                loginPassword.focus();
                loginPassword.select();
            } catch {}
        }
    });

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
    const readAllowUserPublish = () => {
        const cfg = (window.MDW_META_CONFIG && typeof window.MDW_META_CONFIG === 'object') ? window.MDW_META_CONFIG : null;
        const s = cfg && cfg._settings && typeof cfg._settings === 'object' ? cfg._settings : null;
        if (!s || typeof s !== 'object') return false;
        return !Object.prototype.hasOwnProperty.call(s, 'allow_user_publish') ? false : !!s.allow_user_publish;
    };

    const canPublish = () => {
        const meta = (window.MDW_AUTH_META && typeof window.MDW_AUTH_META === 'object')
            ? window.MDW_AUTH_META
            : { has_user: false, has_superuser: false };
        const hasAuth = !!(meta.has_user || meta.has_superuser);
        if (!hasAuth) return true;
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (!auth || !auth.role) return false;
        if (auth.role === 'superuser') return true;
        if (auth.role === 'user') return readAllowUserPublish();
        return false;
    };

    const applyPublishPermissions = () => {
        const allow = canPublish();
        document.querySelectorAll('[data-auth-publish="1"]').forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            el.style.display = allow ? '' : 'none';
            if (!allow && (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
                el.disabled = true;
            }
        });
    };

    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        const submitter = e.submitter;
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const isPublish = (
            (submitter instanceof HTMLElement && submitter.getAttribute('name') === 'publish_action') ||
            (active && active.getAttribute('name') === 'publish_action')
        );
        if (!isPublish) return;
        if (canPublish()) return;
        e.preventDefault();
        if (typeof window.__mdwShowAuthModal === 'function') window.__mdwShowAuthModal();
    }, true);

    window.__mdwCanPublish = canPublish;
    window.__mdwApplyPublishPermissions = applyPublishPermissions;
    applyPublishPermissions();
})();
    };
})();
