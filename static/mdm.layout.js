(function(){
    const MDM = window.MDM = window.MDM || {};
    const module = MDM.layout = MDM.layout || {};
    const mdmDelegate = MDM.delegate || ((root, event, selector, fn) => {
        if (!root) return null;
        const handler = (e) => {
            const target = e.target instanceof Element ? e.target.closest(selector) : null;
            if (!target || !root.contains(target)) return;
            fn(e, target);
        };
        root.addEventListener(event, handler);
        return handler;
    });

    module.init = () => {
        if (module._init) return;
        module._init = true;

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
            if (root.classList.contains('mdw-resizing')) {
                lastTop = el.scrollTop;
                return;
            }
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
(function(){
    const grid = document.getElementById('editorGrid');
    if (!grid) return;
    const buttons = Array.from(document.querySelectorAll('.pane-focus-toggle'));
    if (buttons.length === 0) return;

    const root = document.documentElement;
    const mobileQuery = window.matchMedia('(max-width: 960px)');
    const ROW_STORAGE_KEY = 'mdw_editor_row_heights';
    let focused = null;

    const readSavedRows = () => {
        try {
            const saved = JSON.parse(mdwStorageGet(ROW_STORAGE_KEY) || 'null');
            if (saved && saved.top && saved.bottom) return saved;
        } catch {}
        return null;
    };

    const applyRows = (top, bottom) => {
        root.style.setProperty('--row-top', top);
        root.style.setProperty('--row-bottom', bottom);
    };

    const restoreRows = () => {
        const saved = readSavedRows();
        if (saved && saved.top && saved.bottom) {
            applyRows(saved.top, saved.bottom);
            return;
        }
        applyRows('50vh', '50vh');
    };

    const updateButtons = () => {
        buttons.forEach((btn) => {
            const target = String(btn.dataset.focusTarget || '').trim();
            const active = target !== '' && target === focused;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    };

    const setFocusClasses = () => {
        root.classList.toggle('mdw-pane-focus-md', focused === 'markdown');
        root.classList.toggle('mdw-pane-focus-preview', focused === 'preview');
    };

    const measureHeight = () => {
        const view = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
        const rect = grid.getBoundingClientRect();
        const top = Math.max(0, rect.top || 0);
        const available = view - top;
        if (available > 0) return available;
        if (rect.height) return rect.height;
        return view;
    };

    let focusRaf = null;
    const scheduleFocusRows = () => {
        if (!focused || !mobileQuery.matches) return;
        if (focusRaf) return;
        focusRaf = requestAnimationFrame(() => {
            focusRaf = null;
            applyFocusRows();
        });
    };

    const applyFocusRows = () => {
        if (!focused) return;
        const resizer = document.querySelector('.col-resizer[data-resizer="right"]');
        const resizerHeight = resizer instanceof HTMLElement ? resizer.getBoundingClientRect().height : 12;
        const total = Math.max(0, measureHeight() - resizerHeight);
        const major = Math.max(0, Math.round(total * 0.95));
        const minor = Math.max(0, total - major);
        const top = focused === 'preview' ? minor : major;
        const bottom = focused === 'preview' ? major : minor;
        applyRows(`${top}px`, `${bottom}px`);
    };

    const clearFocus = () => {
        focused = null;
        setFocusClasses();
        restoreRows();
        updateButtons();
    };

    const setFocus = (target) => {
        focused = target === 'preview' ? 'preview' : 'markdown';
        setFocusClasses();
        applyFocusRows();
        updateButtons();
    };

    mdmDelegate(document, 'click', '.pane-focus-toggle', (e, btn) => {
        if (!mobileQuery.matches) return;
        if (e.defaultPrevented) return;
        const target = String(btn.dataset.focusTarget || '').trim();
        if (!target) return;
        if (focused === target) {
            clearFocus();
        } else {
            setFocus(target);
        }
    });

    updateButtons();

    const handleResize = () => {
        if (!mobileQuery.matches) {
            if (focused) clearFocus();
            return;
        }
        if (focused) scheduleFocusRows();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', handleResize);
    } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(handleResize);
    }

    if (typeof MutationObserver === 'function') {
        const headerObserver = new MutationObserver(() => {
            scheduleFocusRows();
        });
        headerObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    }
})();
    };
})();
