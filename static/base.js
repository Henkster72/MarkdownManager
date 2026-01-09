/* Legacy shim: base.js was split into mdm.* modules. */
(function(){
    const core = window.MDM && window.MDM.core;
    if (core && typeof core.init === 'function') {
        core.init();
    }
})();
