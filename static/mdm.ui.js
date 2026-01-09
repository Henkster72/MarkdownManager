(function(){
    const root = window;
    const MDM = root.MDM = root.MDM || {};

    const modalOpen = (on) => {
        document.documentElement.classList.toggle('modal-open', !!on);
    };

    const busy = (btn, on, opts) => {
        if (!(btn instanceof HTMLElement)) return;
        const options = opts && typeof opts === 'object' ? opts : {};
        const labelEl = btn.querySelector('.btn-label');
        const labelKey = 'mdmBusyLabel';
        if (on) {
            if (labelEl && !btn.dataset[labelKey]) {
                btn.dataset[labelKey] = labelEl.textContent || '';
            }
            if (labelEl && typeof options.label === 'string') {
                labelEl.textContent = options.label;
            }
            btn.setAttribute('aria-busy', 'true');
            btn.classList.add('is-loading');
            if (options.disable !== false) btn.disabled = true;
            return;
        }
        if (labelEl && btn.dataset[labelKey]) {
            labelEl.textContent = btn.dataset[labelKey];
            delete btn.dataset[labelKey];
        }
        btn.removeAttribute('aria-busy');
        btn.classList.remove('is-loading');
        if (options.disable !== false) btn.disabled = false;
    };

    MDM.ui = MDM.ui || { modalOpen, busy };
})();
