/* Restore the report reading position without owning the table sort state. */
(() => {
    'use strict';
    const root = document.querySelector('[data-sb-report-key]');
    if (!root || root.dataset.sbReportEmbedded === 'true') return;
    const key = root.dataset.sbReportKey;
    const reading = root.querySelector('[data-sb-page-body]');
    const notice = root.querySelector('[data-sb-report-context-notice]');
    if (!key || !reading || !notice) throw new Error('Revenue report reading controls missing.');

    function fail(message, error) {
        notice.textContent = message;
        notice.hidden = false;
        console.error(message, error);
        throw error;
    }

    function savedPositions() {
        const saved = window.history.state?.sbReportReading;
        if (saved !== undefined && (saved === null || typeof saved !== 'object' ||
            Array.isArray(saved))) {
            fail('Saved report position could not be restored.',
                new Error('Invalid revenue report reading state.'));
        }
        return saved;
    }

    function restore() {
        const saved = savedPositions()?.[key];
        if (saved !== undefined && (saved === null || typeof saved !== 'object' ||
            Array.isArray(saved) || !Number.isFinite(saved.scroll) || saved.scroll < 0)) {
            fail('Saved report position could not be restored.',
                new Error('Invalid revenue report reading offset.'));
        }
        if (saved) reading.scrollTop = saved.scroll;
    }

    function persist() {
        const saved = savedPositions();
        const state = window.history.state;
        try {
            window.history.replaceState({
                ...(state && typeof state === 'object' ? state : {}),
                sbReportReading: {...saved, [key]: {scroll: reading.scrollTop}},
            }, '');
        } catch (error) {
            fail('Report reading position could not be saved.', error);
        }
    }

    window.addEventListener('pageshow', () => window.setTimeout(restore, 0));
    window.addEventListener('popstate', restore);
    window.addEventListener('pagehide', persist);
    restore();
})();
