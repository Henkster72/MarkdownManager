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
    const ROW_STORAGE_KEY = String(grid.dataset.splitRowStorageKey || 'mdw_edit_split_row_heights');
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
(function(){
    const panel = document.getElementById('indexShortcutsPanel');
    const resizer = document.getElementById('indexShortcutsResizer');
    if (!(panel instanceof HTMLElement) || !(resizer instanceof HTMLElement)) return;

    const root = document.documentElement;
    const mobileQuery = window.matchMedia('(max-width: 960px)');
    const touchMoveOpts = { passive: false };
    const container = panel.closest('.index-split-root');
    const storageKey = String(panel.dataset.shortcutsStorageKey || 'mdw_index_shortcuts_panel_height');
    const minHeight = (() => {
        const raw = parseInt(String(panel.dataset.shortcutsMinHeight || '0'), 10);
        return Number.isFinite(raw) ? Math.max(0, raw) : 0;
    })();
    const defaultDesktopVh = (() => {
        const raw = parseFloat(String(panel.dataset.shortcutsDefaultDesktopVh || '31'));
        return Number.isFinite(raw) ? Math.max(6, Math.min(72, raw)) : 31;
    })();
    const defaultMobileVh = (() => {
        const raw = parseFloat(String(panel.dataset.shortcutsDefaultMobileVh || '24'));
        return Number.isFinite(raw) ? Math.max(5, Math.min(68, raw)) : 24;
    })();
    const maxDesktopRatio = (() => {
        const raw = parseFloat(String(panel.dataset.shortcutsMaxDesktopRatio || '0.44'));
        return Number.isFinite(raw) ? Math.max(0.2, Math.min(0.9, raw)) : 0.44;
    })();
    const maxMobileRatio = (() => {
        const raw = parseFloat(String(panel.dataset.shortcutsMaxMobileRatio || '0.34'));
        return Number.isFinite(raw) ? Math.max(0.18, Math.min(0.9, raw)) : 0.34;
    })();
    const hideTitleScale = (() => {
        const raw = parseFloat(String(panel.dataset.shortcutsTitleHideScale || '0.24'));
        return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.24;
    })();
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const readStorage = (key) => {
        try {
            if (typeof window.__mdwStorageGet === 'function') return window.__mdwStorageGet(key);
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    };
    const writeStorage = (key, value) => {
        try {
            if (typeof window.__mdwStorageSet === 'function') {
                window.__mdwStorageSet(key, value);
                return;
            }
            localStorage.setItem(key, value);
        } catch {}
    };
    const readNumeric = (raw) => {
        const parsed = parseInt(String(raw || '').trim(), 10);
        return Number.isFinite(parsed) ? parsed : null;
    };
    const viewHeight = () => {
        if (container instanceof HTMLElement) {
            const rect = container.getBoundingClientRect();
            if (rect.height > 0) return rect.height;
        }
        return Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
    };
    const maxHeight = () => {
        const ratio = mobileQuery.matches ? maxMobileRatio : maxDesktopRatio;
        const height = Math.round(viewHeight() * ratio);
        return Math.max(minHeight + 24, height);
    };
    const defaultHeight = () => {
        const vh = mobileQuery.matches ? defaultMobileVh : defaultDesktopVh;
        return Math.round(viewHeight() * (vh / 100));
    };
    const applyScale = (heightPx) => {
        const max = maxHeight();
        const span = Math.max(1, max - minHeight);
        const scale = clamp((heightPx - minHeight) / span, 0, 1);
        root.style.setProperty('--index-shortcuts-scale', scale.toFixed(3));
        panel.classList.toggle('is-title-hidden', scale <= hideTitleScale);
    };
    const applyHeight = (value, save) => {
        const next = clamp(Math.round(value), minHeight, maxHeight());
        root.style.setProperty('--index-shortcuts-height', `${next}px`);
        applyScale(next);
        if (save) writeStorage(storageKey, String(next));
    };
    const syncToViewport = () => {
        const current = panel.getBoundingClientRect().height || defaultHeight();
        applyHeight(current, false);
    };
    const restore = () => {
        const saved = readNumeric(readStorage(storageKey));
        if (saved !== null) {
            applyHeight(saved, false);
            return;
        }
        syncToViewport();
    };
    restore();

    let syncRaf = null;
    const scheduleSync = () => {
        if (syncRaf !== null) return;
        syncRaf = requestAnimationFrame(() => {
            syncRaf = null;
            syncToViewport();
        });
    };

    window.addEventListener('resize', scheduleSync, { passive: true });
    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', scheduleSync);
    } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(scheduleSync);
    }
    if (typeof ResizeObserver === 'function' && container instanceof HTMLElement) {
        const ro = new ResizeObserver(() => scheduleSync());
        ro.observe(container);
    }

    const getClientY = (ev) => {
        if (ev && ev.touches && ev.touches.length > 0) {
            return ev.touches[0].clientY;
        }
        if (ev && ev.changedTouches && ev.changedTouches.length > 0) {
            return ev.changedTouches[0].clientY;
        }
        if (ev && typeof ev.clientY === 'number') {
            return ev.clientY;
        }
        return null;
    };

    let drag = null;
    const stopDrag = () => {
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDragMove, touchMoveOpts);
        document.removeEventListener('touchend', stopDrag);
        document.removeEventListener('touchcancel', stopDrag);
        root.classList.remove('mdw-resizing');
        document.body.style.cursor = '';
        drag = null;
    };
    const onDragMove = (ev) => {
        if (!drag) return;
        if (ev.cancelable) ev.preventDefault();
        const clientY = getClientY(ev);
        if (clientY === null) return;
        const delta = clientY - drag.startY;
        applyHeight(drag.startHeight + delta, true);
    };
    const startDrag = (ev) => {
        if (ev.cancelable) ev.preventDefault();
        const clientY = getClientY(ev);
        if (clientY === null) return;
        drag = {
            startY: clientY,
            startHeight: panel.getBoundingClientRect().height,
        };
        root.classList.add('mdw-resizing');
        document.body.style.cursor = 'row-resize';
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onDragMove, touchMoveOpts);
        document.addEventListener('touchend', stopDrag);
        document.addEventListener('touchcancel', stopDrag);
    };

    resizer.addEventListener('mousedown', startDrag);
    resizer.addEventListener('touchstart', startDrag, { passive: false });

    resizer.addEventListener('keydown', (ev) => {
        const key = String(ev.key || '');
        if (!key) return;
        const step = ev.shiftKey ? 48 : 18;
        const current = panel.getBoundingClientRect().height || minHeight;

        if (key === 'ArrowUp') {
            ev.preventDefault();
            applyHeight(current - step, true);
            return;
        }
        if (key === 'ArrowDown') {
            ev.preventDefault();
            applyHeight(current + step, true);
            return;
        }
        if (key === 'PageUp') {
            ev.preventDefault();
            applyHeight(current - (step * 2), true);
            return;
        }
        if (key === 'PageDown') {
            ev.preventDefault();
            applyHeight(current + (step * 2), true);
            return;
        }
        if (key === 'Home') {
            ev.preventDefault();
            applyHeight(minHeight, true);
            return;
        }
        if (key === 'End') {
            ev.preventDefault();
            applyHeight(maxHeight(), true);
        }
    });

    resizer.addEventListener('dblclick', () => {
        applyHeight(defaultHeight(), true);
    });
})();
    };
})();
