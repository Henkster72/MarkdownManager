(function(){
    const root = window;
    const MDM = root.MDM = root.MDM || {};

    const parseResponse = async (res) => {
        const ct = String(res.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
            return res.json().catch(() => null);
        }
        return res.text();
    };

    const extractError = (res, data) => {
        if (data && typeof data === 'object') {
            const msg = data.message || data.error || data.error_code;
            if (msg) return String(msg);
        }
        return String(res.statusText || 'Request failed');
    };

    const authHeaders = (url) => {
        try {
            const target = new URL(url, window.location.href);
            if (target.origin !== window.location.origin || typeof window.__mdwStorageGet !== 'function') {
                return {};
            }
            const role = String(window.__mdwStorageGet('mdw_auth_role') || '').trim();
            const token = String(window.__mdwStorageGet('mdw_auth_token') || '').trim();
            if (!role || !token) return {};
            return {
                'X-MDW-Auth-Role': role,
                'X-MDW-Auth-Token': token,
            };
        } catch {
            return {};
        }
    };

    const request = async (url, options) => {
        const requestOptions = Object.assign({}, options || {});
        requestOptions.headers = Object.assign(authHeaders(url), requestOptions.headers || {});
        const res = await fetch(url, requestOptions);
        const data = await parseResponse(res);
        if (!res.ok || (data && typeof data === 'object' && data.ok === false)) {
            const err = new Error(extractError(res, data));
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    };

    const json = (url, data, opts) => {
        const options = Object.assign({ method: 'POST' }, opts || {});
        options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
        options.body = JSON.stringify(data || {});
        return request(url, options);
    };

    const get = (url, opts) => request(url, Object.assign({ method: 'GET' }, opts || {}));

    const form = (url, formData, opts) => {
        const options = Object.assign({ method: 'POST', body: formData }, opts || {});
        return request(url, options);
    };

    MDM.api = MDM.api || { request, json, get, form };
})();
