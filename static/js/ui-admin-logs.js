/* Keep request inspections in their own Back history entry. */
(() => {
    'use strict';
    const logs = [...document.querySelectorAll('[data-sb-log-id]')];
    const saved = history.state?.sbAiLogInspections || {};
    for (const log of logs) {
        const key = log.dataset.sbLogId;
        if (Object.hasOwn(saved, key)) log.open = saved[key] === true;
        log.addEventListener('toggle', () => {
            history.replaceState({...history.state, sbAiLogInspections: {
                ...history.state?.sbAiLogInspections, [key]: log.open,
            }}, '');
        });
    }
})();
