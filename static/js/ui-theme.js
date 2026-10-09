/**
 * Bridge the existing persisted light/dark choice into the new token namespace.
 * Remove the legacy observer once all theme consumers use data-sb-mode directly.
 */
(() => {
    'use strict';

    const root = document.documentElement;

    function syncMode() {
        const legacyMode = root.getAttribute('data-bs-theme');
        const mode = legacyMode === null
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : legacyMode;
        if (mode !== 'dark' && mode !== 'light') {
            console.error('Sales Buddy theme: invalid legacy mode', mode);
            return;
        }
        root.setAttribute('data-sb-mode', mode);
    }

    syncMode();
    const observer = new MutationObserver(syncMode);
    observer.observe(root, {attributes: true, attributeFilter: ['data-bs-theme']});
})();
