(function(){
    const root = window;
    const MDM = root.MDM = root.MDM || {};

    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
    const on = (el, event, fn, options) => {
        if (!el) return null;
        el.addEventListener(event, fn, options);
        return fn;
    };
    const delegate = (rootEl, event, selector, fn) => {
        if (!rootEl) return null;
        const handler = (e) => {
            const target = e.target instanceof Element ? e.target.closest(selector) : null;
            if (!target || !rootEl.contains(target)) return;
            fn(e, target);
        };
        rootEl.addEventListener(event, handler);
        return handler;
    };
    const addClass = (el, ...cls) => {
        if (!el) return;
        const filtered = cls.filter((c) => typeof c === 'string' && c.trim() !== '');
        if (filtered.length) el.classList.add(...filtered);
    };
    const removeClass = (el, ...cls) => {
        if (!el) return;
        const filtered = cls.filter((c) => typeof c === 'string' && c.trim() !== '');
        if (filtered.length) el.classList.remove(...filtered);
    };
    const toggleClass = (el, cls, on) => {
        if (!el || !cls) return;
        el.classList.toggle(cls, !!on);
    };

    MDM.$ = MDM.$ || $;
    MDM.$$ = MDM.$$ || $$;
    MDM.on = MDM.on || on;
    MDM.delegate = MDM.delegate || delegate;
    MDM.addClass = MDM.addClass || addClass;
    MDM.removeClass = MDM.removeClass || removeClass;
    MDM.toggleClass = MDM.toggleClass || toggleClass;
})();
