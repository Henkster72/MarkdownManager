// GitHub Pages export (edit.php + index.php)
(function(){
    const exportBtn = document.getElementById('githubPagesExportBtn');
    const checkBtn = document.getElementById('githubPagesCheckBtn');
    const statusEl = document.getElementById('githubPagesCheckStatus');
    const detailsEl = document.getElementById('githubPagesCheckDetails');
    if (!exportBtn && !checkBtn) return;

    const t = (k, f, vars) => (typeof window.MDW_T === 'function' ? window.MDW_T(k, f, vars) : (typeof f === 'string' ? f : ''));
    const authMeta = (window.MDW_AUTH_META && typeof window.MDW_AUTH_META === 'object') ? window.MDW_AUTH_META : { has_user: false, has_superuser: false };
    const authRequired = !!(authMeta.has_user || authMeta.has_superuser);

    const setStatus = (msg, kind = 'info') => {
        if (!(statusEl instanceof HTMLElement)) return;
        statusEl.textContent = String(msg || '');
        statusEl.style.color = kind === 'error'
            ? 'var(--danger)'
            : (kind === 'ok' ? '#16a34a' : 'var(--text-muted)');
    };

    const setDetails = (errors, warnings) => {
        if (!(detailsEl instanceof HTMLElement)) return;
        const parts = [];
        if (Array.isArray(errors) && errors.length) {
            parts.push(`${t('js.github_pages.errors_label', 'Errors')}:`);
            parts.push(...errors.map((m) => `- ${m}`));
        }
        if (Array.isArray(warnings) && warnings.length) {
            if (parts.length) parts.push('');
            parts.push(`${t('js.github_pages.warnings_label', 'Warnings')}:`);
            parts.push(...warnings.map((m) => `- ${m}`));
        }
        detailsEl.textContent = parts.join('\n');
    };

    const showError = (message, details) => {
        if (typeof window.__mdwShowErrorModal === 'function') {
            window.__mdwShowErrorModal(message, details);
            return;
        }
        const detailText = details ? `\n\n${details}` : '';
        alert(`${message || t('js.error_generic', 'Something went wrong.')}${detailText}`);
    };

    const buildAuthPayload = () => {
        const auth = (typeof window.__mdwAuthState === 'function') ? window.__mdwAuthState() : null;
        if (!authRequired) return null;
        if (!auth || auth.role !== 'superuser' || !auth.token) return null;
        return { role: auth.role, token: auth.token };
    };

    const request = async (payload) => {
        const res = await fetch('github_pages_export.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        let data = null;
        try {
            data = await res.json();
        } catch {}
        return { res, data };
    };

    if (checkBtn) {
        checkBtn.addEventListener('click', async () => {
            const csrf = String(window.MDW_CSRF || '').trim();
            if (!csrf) {
                setStatus(t('js.csrf_missing', 'Missing session token.'), 'error');
                setDetails(['Reload the page and try again.'], []);
                return;
            }
            const auth = buildAuthPayload();
            if (authRequired && !auth) {
                setStatus(t('js.auth_required', 'Superuser login required.'), 'error');
                setDetails([], []);
                return;
            }

            checkBtn.disabled = true;
            setStatus(t('js.github_pages.checking', 'Checking configuration…'));
            setDetails([], []);
            try {
                const { res, data } = await request({ action: 'check', csrf, auth });
                if (data && data.ok) {
                    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
                    if (warnings.length) {
                        setStatus(t('js.github_pages.ok_with_warnings', 'Config OK with warnings.'), 'ok');
                        setDetails([], warnings);
                    } else {
                        setStatus(t('js.github_pages.ok', 'Config OK.'), 'ok');
                        setDetails([], []);
                    }
                    return;
                }
                const errors = (data && Array.isArray(data.errors)) ? data.errors : [];
                const warnings = (data && Array.isArray(data.warnings)) ? data.warnings : [];
                if (!res.ok || errors.length || warnings.length) {
                    setStatus(t('js.github_pages.config_error', 'Configuration errors found.'), 'error');
                    setDetails(errors, warnings);
                    return;
                }
                setStatus(t('js.github_pages.check_failed', 'Configuration check failed.'), 'error');
            } catch (e) {
                console.error('GitHub Pages check failed', e);
                setStatus(t('js.github_pages.check_failed', 'Configuration check failed.'), 'error');
            } finally {
                checkBtn.disabled = false;
            }
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            if (!window.CURRENT_FILE) return;
            const csrf = String(window.MDW_CSRF || '').trim();
            if (!csrf) {
                showError(t('js.csrf_missing', 'Missing session token.'));
                return;
            }
            const auth = buildAuthPayload();
            if (authRequired && !auth) {
                showError(t('js.auth_required', 'Superuser login required.'));
                return;
            }
            exportBtn.disabled = true;
            try {
                const { res, data } = await request({
                    action: 'export',
                    csrf,
                    file: window.CURRENT_FILE,
                    auth,
                });
                if (!res.ok || !data || data.ok === false) {
                    const message = (data && (data.message || data.error)) || t('js.github_pages.export_failed', 'Export failed.');
                    const details = data && Array.isArray(data.errors) ? data.errors.join('\n') : '';
                    showError(message, details);
                    return;
                }
                const warnings = Array.isArray(data.warnings) ? data.warnings : [];
                const location = data.output_dir ? `${data.output_dir}/${data.path || ''}` : (data.path || '');
                if (warnings.length) {
                    alert(`${t('js.github_pages.export_warn', 'Exported with warnings.')}\n${warnings.map((m) => `- ${m}`).join('\n')}`);
                } else {
                    alert(`${t('js.github_pages.export_ok', 'Exported to')}: ${location}`);
                }
            } catch (e) {
                console.error('GitHub Pages export failed', e);
                showError(t('js.github_pages.export_failed', 'Export failed. Check the console for details.'));
            } finally {
                exportBtn.disabled = false;
            }
        });
    }
})();
