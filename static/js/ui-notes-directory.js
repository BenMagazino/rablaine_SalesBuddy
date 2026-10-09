/** Standalone chronological notes: original page-size memory and entry-local reading. */
((window) => {
    'use strict';
    function validateReading(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0) {
            throw new Error('Invalid Notes directory reading context.');
        }
        return value;
    }
    function pageSizeUrl(href, value) {
        const url = new URL(href);
        url.searchParams.set('per_page', value);
        url.searchParams.delete('page');
        return url.toString();
    }
    if (typeof module !== 'undefined') module.exports = {validateReading, pageSizeUrl};
    if (!window.document) return;
    const root = window.document.querySelector('[data-notes-directory]');
    if (!root) return;
    const reading = root.querySelector('.notes-reading');
    const notice = root.querySelector('.notes-notice');
    const select = root.querySelector('#perPageSelect');
    const storageKey = 'notesList.perPage';
    let restoring = false;
    function warn(message, error) {
        window.console.error(message, error);
        notice.textContent = message;
        notice.hidden = false;
    }
    function save() {
        if (restoring) return;
        try {
            window.history.replaceState({...window.history.state, sbNotesDirectory: {
                top: reading.scrollTop, left: reading.scrollLeft,
            }}, '');
        } catch (error) { warn('Could not remember Notes reading context for Back.', error); }
    }
    function restore() {
        restoring = true;
        try {
            const saved = window.history.state?.sbNotesDirectory;
            if (saved) {
                validateReading(saved);
                reading.scrollTop = saved.top;
                reading.scrollLeft = saved.left;
            }
        } catch (error) { warn('Could not restore Notes reading context for Back.', error); }
        restoring = false;
    }
    try {
        const url = new URL(window.location.href);
        const saved = window.localStorage.getItem(storageKey);
        if (!url.searchParams.get('per_page') && saved && saved !== select.value) {
            window.location.replace(pageSizeUrl(url.href, saved));
            return;
        }
        window.localStorage.setItem(storageKey, select.value);
    } catch (error) { warn('Could not remember your Notes page size. The current page is usable.', error); }
    select.addEventListener('change', () => {
        save();
        try { window.localStorage.setItem(storageKey, select.value); }
        catch (error) { warn('Could not remember your Notes page size for future visits.', error); }
        window.location.assign(pageSizeUrl(window.location.href, select.value));
    });
    root.addEventListener('click', event => {
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey || event.target.closest('a,button,input,select')) return;
        const row = event.target.closest('[data-note-href]');
        if (row) { save(); window.location.assign(row.dataset.noteHref); }
    });
    window.document.addEventListener('click', event => {
        if (event.target.closest('a[href]') && !event.defaultPrevented) save();
    }, true);
    reading.addEventListener('scroll', save, {passive: true});
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', restore);
    restore();
})(typeof window === 'undefined' ? {} : window);
