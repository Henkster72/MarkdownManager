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

const mdwNormalizeMermaidPie = (source) => {
    const raw = String(source || '').replace(/\r\n/g, '\n');
    const lines = raw.split('\n');
    let i = 0;
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) return source;
    const line = lines[i];
    const trimmed = line.trim();
    if (!/^pie\b/i.test(trimmed)) return source;
    const m = trimmed.match(/^pie(?:\s+(showData))?(?:\s+title\s+(.+))?$/i);
    if (!m) return source;
    const title = String(m[2] || '').trim();
    if (!title) return source;
    const lead = line.match(/^\s*/)?.[0] ?? '';
    const header = `pie${m[1] ? ' showData' : ''}`;
    lines[i] = lead + header;
    lines.splice(i + 1, 0, lead + `title ${title}`);
    return lines.join('\n');
};

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
        node.textContent = mdwNormalizeMermaidPie(node.textContent || '');
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
            nodeTextColor: text,
            clusterBkg: surface,
            clusterBorder: border,
            defaultLinkColor: primary,
            titleColor: text,
            edgeLabelBackground: bg,
            noteBkgColor: surface,
            noteTextColor: text,
            noteBorderColor: border,
            darkMode: false,
            actorBorder: border,
            actorBkg: surface,
            actorTextColor: text,
            actorLineColor: primary,
            signalColor: primary,
            signalTextColor: text,
            labelBoxBkgColor: surface,
            labelBoxBorderColor: border,
            labelTextColor: text,
            loopTextColor: text,
            activationBorderColor: border,
            activationBkgColor: surface,
            sequenceNumberColor: text,
            sectionBkgColor: surface,
            altSectionBkgColor: bg,
            gridColor: border,
            primaryTextColor2: text,
            secondaryTextColor2: text,
            tertiaryTextColor2: text,
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

(function(){
    const MDM = window.MDM = window.MDM || {};
    const module = MDM.core = MDM.core || {};
    const init = () => {
        if (module._init) return;
        module._init = true;
        const order = ['auth', 'settings', 'editor', 'explorer', 'modals', 'layout'];
        order.forEach((name) => {
            const mod = MDM[name];
            if (mod && typeof mod.init === 'function') mod.init();
        });
    };
    module.init = init;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
