(function(){
    const MDM = window.MDM = window.MDM || {};
    const module = MDM.splitter = MDM.splitter || {};

    module.init = () => {
        if (module._init) return;
        module._init = true;

(function(){
    const grid = document.getElementById('editorGrid');
    if (!(grid instanceof HTMLElement)) return;

    const mode = String(grid.dataset.splitMode || '').trim().toLowerCase();
    if (mode !== 'two' && mode !== 'three') return;

    const root = document.documentElement;
    const mobileMax = (() => {
        const n = parseInt(String(grid.dataset.splitMobileBreakpoint || '960'), 10);
        return Number.isFinite(n) && n > 0 ? n : 960;
    })();
    const mobileQuery = window.matchMedia(`(max-width: ${mobileMax}px)`);
    const touchMoveOpts = { passive: false };
    const storageKey = String(grid.dataset.splitStorageKey || (mode === 'three' ? 'mdw_edit_split_col_widths' : 'mdw_index_split_col_widths'));
    const legacyStorageKey = String(grid.dataset.splitStorageLegacyKey || (mode === 'three' ? 'mdw_editor_col_widths' : 'mdw_index_col_widths'));
    const rowStorageKey = String(grid.dataset.splitRowStorageKey || (mode === 'three' ? 'mdw_edit_split_row_heights' : 'mdw_index_split_row_heights'));
    const legacyRowStorageKey = String(grid.dataset.splitRowStorageLegacyKey || (mode === 'three' ? 'mdw_editor_row_heights' : 'mdw_index_row_heights'));
    const leftVar = String(grid.dataset.splitLeftVar || '--col-left');
    const midVar = String(grid.dataset.splitMidVar || '--col-mid');
    const rightVar = String(grid.dataset.splitRightVar || '--col-right');
    const rowTopVar = String(grid.dataset.splitRowTopVar || '--row-top');
    const rowBottomVar = String(grid.dataset.splitRowBottomVar || '--row-bottom');
    const mobileResizerKey = String(grid.dataset.splitMobileResizer || 'right');
    const focusLockClasses = String(grid.dataset.splitFocusLockClasses || 'mdw-pane-focus-md,mdw-pane-focus-preview')
        .split(',')
        .map((cls) => cls.trim())
        .filter(Boolean);

    const colMinPct = (() => {
        const n = parseFloat(String(grid.dataset.splitColMinPct || (mode === 'three' ? '10' : '15')));
        return Number.isFinite(n) ? Math.max(5, Math.min(45, n)) : (mode === 'three' ? 10 : 15);
    })();
    const rowMinPx = (() => {
        const n = parseInt(String(grid.dataset.splitRowMinPx || '240'), 10);
        return Number.isFinite(n) && n >= 80 ? n : 240;
    })();
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const parsePct = (v) => {
        const n = parseFloat(String(v || '').replace('%', '').trim());
        return Number.isFinite(n) ? n : null;
    };
    const formatPct = (v) => `${v.toFixed(2)}%`;
    const normalizeThreeCols = (values) => {
        if (!values || typeof values !== 'object') return null;
        let leftPct = parsePct(values.left);
        let midPct = parsePct(values.mid);
        let rightPct = parsePct(values.right);
        if (!Number.isFinite(leftPct) || !Number.isFinite(midPct) || !Number.isFinite(rightPct)) return null;
        const total = leftPct + midPct + rightPct;
        if (!(total > 0)) return null;
        const scale = 100 / total;
        leftPct *= scale;
        midPct *= scale;
        rightPct *= scale;

        leftPct = clamp(leftPct, colMinPct, 100 - (colMinPct * 2));
        midPct = clamp(midPct, colMinPct, 100 - leftPct - colMinPct);
        rightPct = 100 - leftPct - midPct;
        if (rightPct < colMinPct) {
            rightPct = colMinPct;
            midPct = 100 - leftPct - rightPct;
            if (midPct < colMinPct) {
                midPct = colMinPct;
                leftPct = 100 - midPct - rightPct;
            }
        }

        return {
            left: formatPct(leftPct),
            mid: formatPct(midPct),
            right: formatPct(rightPct),
        };
    };
    const normalizeTwoCols = (values) => {
        if (!values || typeof values !== 'object') return null;
        let leftPct = parsePct(values.left);
        let rightPct = parsePct(values.right);
        if (!Number.isFinite(leftPct) && !Number.isFinite(rightPct)) return null;
        if (!Number.isFinite(leftPct) && Number.isFinite(rightPct)) {
            leftPct = 100 - rightPct;
        } else if (!Number.isFinite(rightPct) && Number.isFinite(leftPct)) {
            rightPct = 100 - leftPct;
        }
        if (!Number.isFinite(leftPct) || !Number.isFinite(rightPct)) return null;
        const total = leftPct + rightPct;
        if (!(total > 0)) return null;
        if (Math.abs(total - 100) > 0.01) {
            leftPct = (leftPct / total) * 100;
        }
        leftPct = clamp(leftPct, colMinPct, 100 - colMinPct);
        rightPct = 100 - leftPct;
        return {
            left: formatPct(leftPct),
            right: formatPct(rightPct),
        };
    };
    const readSavedJson = (primaryKey, fallbackKey) => {
        const parseState = (raw) => {
            if (!raw) return null;
            try {
                const parsed = JSON.parse(raw);
                return (parsed && typeof parsed === 'object') ? parsed : null;
            } catch {
                return null;
            }
        };
        const primaryRaw = mdwStorageGet(primaryKey);
        if (primaryRaw) {
            const parsed = parseState(primaryRaw);
            if (parsed) return parsed;
        }
        if (!fallbackKey || fallbackKey === primaryKey) return null;
        const legacyRaw = mdwStorageGet(fallbackKey);
        if (!legacyRaw) return null;
        const parsed = parseState(legacyRaw);
        if (!parsed) return null;
        try { mdwStorageSet(primaryKey, legacyRaw); } catch {}
        return parsed;
    };

    const applyCols = (values, save) => {
        if (mode === 'three') {
            const normalized = normalizeThreeCols(values);
            if (!normalized) return;
            root.style.setProperty(leftVar, normalized.left);
            root.style.setProperty(midVar, normalized.mid);
            root.style.setProperty(rightVar, normalized.right);
            if (save) {
                mdwStorageSet(storageKey, JSON.stringify({
                    left: normalized.left,
                    mid: normalized.mid,
                    right: normalized.right,
                }));
            }
            return;
        }

        const normalized = normalizeTwoCols(values);
        if (!normalized) return;
        root.style.setProperty(leftVar, normalized.left);
        root.style.setProperty(rightVar, normalized.right);
        if (save) {
            mdwStorageSet(storageKey, JSON.stringify({
                left: normalized.left,
                right: normalized.right,
            }));
        }
    };

    const applyRows = (top, bottom, save) => {
        root.style.setProperty(rowTopVar, top);
        root.style.setProperty(rowBottomVar, bottom);
        if (save) {
            mdwStorageSet(rowStorageKey, JSON.stringify({
                top,
                bottom,
            }));
        }
    };

    try {
        const saved = readSavedJson(storageKey, legacyStorageKey);
        if (mode === 'three') {
            if (saved && saved.left && saved.mid && saved.right) {
                applyCols({
                    left: saved.left,
                    mid: saved.mid,
                    right: saved.right,
                }, false);
            }
        } else if (saved && (saved.left || saved.right)) {
            applyCols({
                left: saved.left,
                right: saved.right,
            }, false);
        }
    } catch (e) {
        console.warn('splitter width state broken, ignoring', e);
    }

    const loadSavedRows = () => {
        try {
            const saved = readSavedJson(rowStorageKey, legacyRowStorageKey);
            if (saved && saved.top && saved.bottom) {
                applyRows(saved.top, saved.bottom, false);
                return true;
            }
        } catch (e) {
            console.warn('splitter row state broken, ignoring', e);
        }
        return false;
    };

    const initRows = () => {
        if (!mobileQuery.matches) return;
        if (!loadSavedRows()) {
            applyRows('50vh', '50vh', true);
        }
    };
    initRows();

    const parseRowSize = (value, viewHeight) => {
        const raw = String(value || '').trim();
        if (!raw) return null;
        if (raw.endsWith('px')) {
            const n = parseFloat(raw);
            return Number.isFinite(n) ? n : null;
        }
        if (raw.endsWith('vh')) {
            const n = parseFloat(raw);
            if (!Number.isFinite(n)) return null;
            return (viewHeight * n) / 100;
        }
        return null;
    };

    const hasFocusLockClass = () => focusLockClasses.some((cls) => root.classList.contains(cls));

    const getMobileResizer = () => grid.querySelector(`.col-resizer[data-resizer="${CSS.escape(mobileResizerKey)}"]`);

    const syncMobileRows = () => {
        if (!mobileQuery.matches) return;
        if (hasFocusLockClass()) return;
        const main = document.querySelector('.app-main');
        if (!(main instanceof HTMLElement)) return;
        const mainStyles = getComputedStyle(main);
        const padTop = parseFloat(mainStyles.paddingTop) || 0;
        const padBottom = parseFloat(mainStyles.paddingBottom) || 0;
        const innerHeight = Math.max(0, main.clientHeight - padTop - padBottom);
        if (!innerHeight) return;
        const resizer = getMobileResizer();
        const resizerHeight = resizer instanceof HTMLElement ? resizer.getBoundingClientRect().height : 12;
        const total = innerHeight - resizerHeight;
        if (total <= 0) return;
        const rootStyles = getComputedStyle(root);
        const viewHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
        const topPx = parseRowSize(rootStyles.getPropertyValue(rowTopVar), viewHeight);
        const bottomPx = parseRowSize(rootStyles.getPropertyValue(rowBottomVar), viewHeight);
        if (!(topPx > 0) || !(bottomPx > 0)) return;
        const ratio = topPx / (topPx + bottomPx);
        let newTop = Math.round(total * ratio);
        let newBottom = Math.round(total - newTop);
        if (newTop < rowMinPx) {
            newTop = rowMinPx;
            newBottom = Math.max(rowMinPx, total - newTop);
        } else if (newBottom < rowMinPx) {
            newBottom = rowMinPx;
            newTop = Math.max(rowMinPx, total - newBottom);
        }
        applyRows(`${newTop}px`, `${newBottom}px`, false);
    };

    let syncRaf = null;
    const scheduleSyncRows = () => {
        if (syncRaf) return;
        syncRaf = requestAnimationFrame(() => {
            syncRaf = null;
            syncMobileRows();
        });
    };
    scheduleSyncRows();

    const onMqChange = (ev) => {
        if (ev.matches) {
            initRows();
            scheduleSyncRows();
        }
    };
    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', onMqChange);
    } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(onMqChange);
    }

    window.addEventListener('resize', scheduleSyncRows, { passive: true });
    if (typeof MutationObserver === 'function') {
        const mo = new MutationObserver(() => {
            scheduleSyncRows();
        });
        mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    const getClientPoint = (ev) => {
        if (ev && ev.touches && ev.touches.length) {
            return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        }
        if (ev && ev.changedTouches && ev.changedTouches.length) {
            return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
        }
        return { x: ev.clientX, y: ev.clientY };
    };

    let active = null;

    const startDrag = (ev, which) => {
        if (ev.cancelable) ev.preventDefault();
        if (mobileQuery.matches) {
            if (which !== mobileResizerKey) return;
            const scroller = document.querySelector('.app-main');
            const prevOverflow = scroller instanceof HTMLElement ? scroller.style.overflow : '';
            const prevTouch = scroller instanceof HTMLElement ? scroller.style.touchAction : '';
            const prevOverscroll = scroller instanceof HTMLElement ? scroller.style.overscrollBehavior : '';
            if (scroller instanceof HTMLElement) {
                scroller.style.overflow = 'hidden';
                scroller.style.touchAction = 'none';
                scroller.style.overscrollBehavior = 'none';
            }
            root.classList.add('mdw-resizing');
            active = {
                mode: 'row',
                which,
                resizer: (ev.currentTarget instanceof HTMLElement) ? ev.currentTarget : null,
                scroller,
                prevOverflow,
                prevTouch,
                prevOverscroll,
            };
            document.body.style.cursor = 'row-resize';
        } else {
            active = { mode: 'col', which };
            document.body.style.cursor = 'col-resize';
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onMove, touchMoveOpts);
        document.addEventListener('touchend', stopDrag);
        document.addEventListener('touchcancel', stopDrag);
    };

    const stopDrag = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onMove, touchMoveOpts);
        document.removeEventListener('touchend', stopDrag);
        document.removeEventListener('touchcancel', stopDrag);

        if (active && active.mode === 'row') {
            if (active.scroller instanceof HTMLElement) {
                active.scroller.style.overflow = active.prevOverflow || '';
                active.scroller.style.touchAction = active.prevTouch || '';
                active.scroller.style.overscrollBehavior = active.prevOverscroll || '';
            }
            root.classList.remove('mdw-resizing');
        }

        document.body.style.cursor = '';
        active = null;
    };

    const onMove = (ev) => {
        if (!active) return;
        if (ev.cancelable) ev.preventDefault();

        const rect = grid.getBoundingClientRect();
        const total = active.mode === 'row' ? rect.height : rect.width;
        const point = getClientPoint(ev);

        if (active.mode === 'row') {
            const y = point.y - rect.top;
            const resizerHeight = active.resizer instanceof HTMLElement
                ? active.resizer.getBoundingClientRect().height
                : 8;
            const usable = total - resizerHeight;
            if (usable <= rowMinPx * 2) return;
            const maxTop = total - rowMinPx - resizerHeight;
            const newTop = clamp(y, rowMinPx, maxTop);
            const newBottom = Math.max(rowMinPx, total - newTop - resizerHeight);
            applyRows(`${newTop.toFixed(0)}px`, `${newBottom.toFixed(0)}px`, true);
            return;
        }

        const rootStyles = getComputedStyle(root);
        if (mode === 'three') {
            let leftPct = parsePct(rootStyles.getPropertyValue(leftVar));
            let midPct = parsePct(rootStyles.getPropertyValue(midVar));
            let rightPct = parsePct(rootStyles.getPropertyValue(rightVar));
            if (!Number.isFinite(leftPct) || !Number.isFinite(midPct) || !Number.isFinite(rightPct)) return;

            if (active.which === 'left') {
                const x = point.x - rect.left;
                const newLeftPct = clamp((x / total) * 100, colMinPct, 100 - colMinPct);
                const delta = leftPct - newLeftPct;
                midPct += delta;
                leftPct = newLeftPct;
            } else {
                const xFromRight = rect.right - point.x;
                const newRightPct = clamp((xFromRight / total) * 100, colMinPct, 100 - colMinPct);
                const delta = rightPct - newRightPct;
                midPct += delta;
                rightPct = newRightPct;
            }

            if (midPct < colMinPct) return;
            const computedRight = 100 - leftPct - midPct;
            if (computedRight < colMinPct) return;

            applyCols({
                left: `${leftPct.toFixed(2)}%`,
                mid: `${midPct.toFixed(2)}%`,
                right: `${computedRight.toFixed(2)}%`,
            }, true);
            return;
        }

        const x = point.x - rect.left;
        const newLeftPct = clamp((x / total) * 100, colMinPct, 100 - colMinPct);
        const newRightPct = 100 - newLeftPct;
        applyCols({
            left: formatPct(newLeftPct),
            right: formatPct(newRightPct),
        }, true);
    };

    grid.querySelectorAll('.col-resizer').forEach((resizer) => {
        const which = String(resizer.dataset.resizer || '').trim();
        if (!which) return;
        resizer.addEventListener('mousedown', (ev) => startDrag(ev, which));
        resizer.addEventListener('touchstart', (ev) => startDrag(ev, which), { passive: false });
    });
})();
    };
})();
