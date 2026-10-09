/** Entry-local topic reading context and the explicit saved default order. */
((window) => {
    'use strict';
    function validateReading(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0) {
            throw new Error('Invalid Topics directory reading context.');
        }
        return value;
    }
    async function savePreference(fetcher, byNotes) {
        const response = await fetcher('/api/preferences/topic-sort', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({topic_sort_by_calls: byNotes}),
        });
        const data = await response.json();
        if (!response.ok || data.topic_sort_by_calls !== byNotes) {
            throw new Error(data.error || 'The default topic order was not saved.');
        }
        return data;
    }
    if (typeof module !== 'undefined') module.exports = {validateReading, savePreference};
    if (!window.document) return;
    const root = window.document.querySelector('[data-topics-directory]');
    if (!root) return;
    const reading = root.querySelector('.topics-reading');
    const notice = root.querySelector('.topics-notice');
    const toggle = root.querySelector('#sortToggle');
    const status = window.document.querySelector('[data-topics-status]');
    let pending = false;
    let restoring = false;
    function warn(message, error) {
        window.console.error(message, error);
        notice.textContent = message;
        notice.hidden = false;
    }
    function save() {
        if (restoring) return;
        try {
            window.history.replaceState({...window.history.state, sbTopicsDirectory: {
                top: reading.scrollTop, left: reading.scrollLeft,
            }}, '');
        } catch (error) { warn('Could not remember Topics reading context for Back.', error); }
    }
    function restore() {
        restoring = true;
        try {
            window.SBTableSort?.mount(root);
            const saved = window.history.state?.sbTopicsDirectory;
            if (saved) {
                validateReading(saved);
                reading.scrollTop = saved.top;
                reading.scrollLeft = saved.left;
            }
        } catch (error) { warn('Could not restore Topics reading context for Back.', error); }
        restoring = false;
    }
    root.addEventListener('click', event => {
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey || event.target.closest('a,button,input')) return;
        const row = event.target.closest('[data-topic-href]');
        if (row && !pending) { save(); window.location.assign(row.dataset.topicHref); }
    });
    window.document.addEventListener('click', event => {
        if (!event.target.closest('a[href]') || event.defaultPrevented) return;
        if (pending) event.preventDefault();
        else save();
    }, true);
    reading.addEventListener('scroll', save, {passive: true});
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', restore);
    window.addEventListener('beforeunload', event => {
        if (!pending) return;
        event.preventDefault();
        event.returnValue = '';
    });
    toggle.addEventListener('click', async () => {
        if (pending) return;
        save();
        pending = true;
        toggle.disabled = true;
        notice.hidden = true;
        status.textContent = 'Saving default order...';
        try {
            await savePreference(window.fetch.bind(window), root.dataset.defaultByNotes !== 'true');
        } catch (error) {
            pending = false;
            toggle.disabled = false;
            status.textContent = 'All Topics';
            warn('Could not save the default order. Your current order is unchanged. Try again.',
                error);
            return;
        }
        pending = false;
        try {
            // Explicitly changing the saved default also resets this entry's temporary sort.
            const entry = window.history.state || {};
            const sorts = {...entry.sbTableSort};
            delete sorts['topics-directory'];
            delete sorts['topics-directory-brief'];
            window.history.replaceState({...entry, sbTableSort: sorts,
                sbTopicsDirectory: {top: 0, left: 0}}, '');
        } catch (error) {
            warn('Default order saved, but the temporary reading context could not be reset.',
                error);
        }
        window.location.reload();
    });
    restore();
})(typeof window === 'undefined' ? {} : window);
