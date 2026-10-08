/** Entry-local Specialties reading context using the shared native sorter. */
((window) => {
    'use strict';
    function validateReading(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0) {
            throw new Error('Invalid Specialties directory reading context.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateReading};
    if (!window.document) return;
    const root = window.document.querySelector('[data-specialties-directory]');
    if (!root) return;
    const reading = root.querySelector('.specialties-reading');
    const notice = root.querySelector('.specialties-notice');
    let restoring = false;
    function warn(error) {
        window.console.error('Specialties directory history:', error);
        notice.textContent = 'Could not restore or remember Specialties context for Back.';
        notice.hidden = false;
    }
    function save() {
        if (restoring) return;
        try {
            window.history.replaceState({...window.history.state, sbSpecialtiesDirectory: {
                top: reading.scrollTop, left: reading.scrollLeft,
            }}, '');
        } catch (error) { warn(error); }
    }
    function restore() {
        restoring = true;
        try {
            window.SBTableSort.mount(root);
            const saved = window.history.state?.sbSpecialtiesDirectory;
            if (saved) {
                validateReading(saved);
                reading.scrollTop = saved.top;
                reading.scrollLeft = saved.left;
            }
        } catch (error) { warn(error); }
        restoring = false;
    }
    root.addEventListener('click', event => {
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey || event.target.closest('a,button,input')) return;
        const row = event.target.closest('[data-specialty-href]');
        if (row) { save(); window.location.assign(row.dataset.specialtyHref); }
    });
    window.document.addEventListener('click', event => {
        if (event.target.closest('a[href]') && !event.defaultPrevented) save();
    }, true);
    reading.addEventListener('scroll', save, {passive: true});
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', restore);
    restore();
})(typeof window === 'undefined' ? {} : window);
