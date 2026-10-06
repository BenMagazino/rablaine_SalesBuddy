/* Filter the canonical report directory without rewriting links or menu order. */
(() => {
    'use strict';
    const root = document.querySelector('[data-sb-reports-hub]');
    if (!root) return;
    const input = root.querySelector('#findReport');
    const clear = root.querySelector('[data-sb-reports-clear]');
    const empty = root.querySelector('[data-sb-reports-empty]');
    const notice = root.querySelector('[data-sb-reports-filter-notice]');
    const embedded = root.dataset.sbReportEmbedded === 'true';
    const counter = embedded ? root.querySelector('[data-sb-reports-count]') :
        document.querySelector('.sb-page-status [data-sb-reports-count]');
    const groups = [...root.querySelectorAll('[data-sb-report-group]')].map(group => ({
        element: group,
        rows: [...group.querySelectorAll('[data-sb-report-entry]')].map(row => ({
            element: row, text: (group.dataset.sbReportGroup + ' ' + row.textContent)
                .replace(/\s+/g, ' ').toLocaleLowerCase(),
        })),
    }));
    const total = groups.reduce((count, group) => count + group.rows.length, 0);
    function fail(message, error) {
        notice.textContent = message; notice.hidden = false; clear.disabled = false;
        console.error(message, error);
        throw error;
    }
    function apply() {
        const query = input.value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
        let count = 0, visibleGroups = 0;
        for (const group of groups) {
            let visible = 0;
            for (const row of group.rows) {
                row.element.hidden = !row.text.includes(query);
                if (!row.element.hidden) visible++;
            }
            group.element.hidden = visible === 0;
            if (visible) visibleGroups++;
            count += visible;
        }
        empty.hidden = count !== 0;
        empty.textContent = total ? 'No reports match your filter.' : 'No reports available.';
        clear.disabled = input.value.length === 0 && notice.hidden;
        if (counter) counter.textContent = (query ? count + ' of ' + total : total) +
            ' reports across ' + visibleGroups + ' group' + (visibleGroups === 1 ? '' : 's');
    }
    function restore() {
        const saved = window.history.state?.sbReportsHub;
        if (saved !== undefined && (saved === null || typeof saved !== 'object' ||
            Array.isArray(saved) || typeof saved.query !== 'string')) {
            fail('Saved report filter could not be restored. Use Clear to reset it.',
                new Error('Invalid report directory state.'));
        }
        input.value = saved?.query ?? '';
        apply();
    }
    function persist() {
        const state = window.history.state;
        try {
            window.history.replaceState({
                ...(state && typeof state === 'object' ? state : {}),
                sbReportsHub: {query: input.value},
            }, '');
            notice.hidden = true;
        } catch (error) { fail('Report filter could not be saved.', error); }
    }
    input.addEventListener('input', apply);
    clear.addEventListener('click', () => {
        input.value = '';
        apply(); input.focus();
        if (!embedded) persist();
        else notice.hidden = true;
        clear.disabled = true;
    });
    if (!embedded) {
        window.addEventListener('pagehide', persist);
        window.addEventListener('pageshow', restore);
        window.addEventListener('popstate', restore);
        restore();
    } else apply();
})();
