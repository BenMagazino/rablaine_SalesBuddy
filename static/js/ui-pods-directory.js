/** Native POD navigation and per-history-entry directory reading context. */
(() => {
    'use strict';
    function validateReading(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0) {
            throw new Error('Invalid POD directory reading context.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateReading};
    if (typeof document === 'undefined') return;
    const root = document.querySelector('[data-pods-directory]');
    if (!root) return;
    const reading = root.querySelector('.sb-pods-reading');
    const notice = root.querySelector('.sb-pod-notice');
    let restoring = false;
    function save() {
        if (restoring) return;
        history.replaceState({...history.state, sbPodsDirectory: {
            top: reading.scrollTop, left: reading.scrollLeft,
        }}, '');
    }
    function restore() {
        restoring = true;
        try {
            const saved = history.state?.sbPodsDirectory;
            if (saved) {
                validateReading(saved);
                reading.scrollTop = saved.top;
                reading.scrollLeft = saved.left;
            }
        } catch (error) {
            notice.textContent = error.message;
            notice.hidden = false;
        }
        restoring = false;
    }
    restore();
    root.addEventListener('click', event => {
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey || event.target.closest('a,button,input')) return;
        const row = event.target.closest('[data-pod-href]');
        if (row) { save(); window.location.assign(row.dataset.podHref); }
    });
    document.addEventListener('click', event => {
        if (event.target.closest('a[href]') && !event.defaultPrevented) save();
    }, true);
    reading.addEventListener('scroll', save, {passive: true});
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', restore);
})();
