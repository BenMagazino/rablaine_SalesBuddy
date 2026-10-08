/** Entry-local directory reading context; sharing remains an explicit command. */
((window) => {
    'use strict';
    function validateReading(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0) {
            throw new Error('Invalid Partners directory reading context.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateReading};
    if (!window.document) return;
    const root = window.document.querySelector('[data-partners-directory]');
    if (!root) return;
    const reading = root.querySelector('.partners-reading');
    const notice = root.querySelector('.partners-notice');
    let restoring = false;
    function warn(message, error) {
        window.console.error(message, error);
        notice.textContent = message;
        notice.hidden = false;
    }
    function save() {
        if (restoring) return;
        try {
            window.history.replaceState({...window.history.state, sbPartnersDirectory: {
                top: reading.scrollTop, left: reading.scrollLeft,
            }}, '');
        } catch (error) { warn('Could not remember Partners reading context for Back.', error); }
    }
    function restore() {
        restoring = true;
        try {
            window.SBTableSort?.mount(root);
            const saved = window.history.state?.sbPartnersDirectory;
            if (saved) {
                validateReading(saved);
                reading.scrollTop = saved.top;
                reading.scrollLeft = saved.left;
            }
        } catch (error) { warn('Could not restore Partners reading context for Back.', error); }
        restoring = false;
    }
    root.addEventListener('click', event => {
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey || event.target.closest('a,button,input')) return;
        const row = event.target.closest('[data-partner-href]');
        if (row) { save(); window.location.assign(row.dataset.partnerHref); }
    });
    window.document.addEventListener('click', event => {
        if (event.target.closest('a[href]') && !event.defaultPrevented) save();
    }, true);
    root.querySelector('[data-share-directory]').addEventListener('click', () => {
        save();
        window.Share.openShareModal('directory');
    });
    reading.addEventListener('scroll', save, {passive: true});
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', restore);
    restore();
})(typeof window === 'undefined' ? {} : window);
