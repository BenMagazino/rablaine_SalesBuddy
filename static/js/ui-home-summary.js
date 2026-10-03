/* Summarize rendered items without issuing another data request. */
(() => {
    'use strict';

    const summary = document.getElementById('homeViewSummary');
    const today = document.getElementById('homeCurrentDate');
    const tabs = document.getElementById('noteViewTabs');
    const content = document.getElementById('noteViewTabContent');
    if (!summary || !today || !tabs || !content) {
        throw new Error('Home status summary has incomplete markup');
    }
    const sources = {
        'calendar-tab': ['Calendar', '#calendarBody', null],
        'engagements-tab': ['Engagements', '#engagementsListBody', '[data-engagement-id]'],
        'projects-tab': ['Projects', '#projectsList', 'a[href^="/project/"]'],
        'tasks-tab': ['Action items', '#tasksCalendarBody', '[data-action-item-id]'],
    };
    let clock = null;

    function countText(count, singular) {
        return count + ' ' + singular + (count === 1 ? '' : 's');
    }

    function updateSummary() {
        const selected = tabs.querySelector('[aria-selected="true"]');
        if (!selected) throw new Error('Home has no selected activity tab');
        const source = sources[selected.id];
        if (!source) throw new Error('Unknown Home summary source: ' + selected.id);
        const [label, selector, items] = source;
        const body = content.querySelector(selector);
        if (!body) throw new Error('Missing Home summary body: ' + selector);
        let text;
        const loading = ':scope > tr > td[colspan="7"] > .spinner-border, ' +
            ':scope > div > .spinner-border, :scope > div > .bi-hourglass-split';
        if (!body.childElementCount || body.querySelector(loading)) {
            text = label + ': loading...';
        } else if (body.querySelector(':scope > .text-danger, :scope > tr > td.text-danger')) {
            text = label + ': unavailable';
        } else if (selected.id === 'calendar-tab') {
            const notes = body.querySelectorAll('.calendar-entries > [data-general-note], ' +
                '.calendar-entries > [data-customer-id]:not([data-ghost-id])').length;
            const meetings = body.querySelectorAll('.cal-ghost[data-ghost-id]').length;
            text = countText(notes, 'note') + ' / ' + countText(meetings, 'meeting');
        } else {
            const singular = {'engagements-tab': 'engagement', 'projects-tab': 'project',
                'tasks-tab': 'action item'}[selected.id];
            text = countText(body.querySelectorAll(items).length, singular);
        }
        if (summary.textContent !== text) summary.textContent = text;
        summary.title = selected.id === 'calendar-tab' ?
            'Saved notes and cached meetings in the displayed month' :
            selected.id === 'tasks-tab' ?
                'Action items in the displayed month; excludes the overdue summary' :
                label + ': items matching the current filter';
    }

    function updateDate() {
        const now = new Date();
        today.textContent = now.toLocaleDateString('en-US',
            {weekday: 'short', month: 'short', day: 'numeric'});
        today.dateTime = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0')].join('-');
    }

    const observer = new MutationObserver(updateSummary);
    function start() {
        observer.observe(tabs, {subtree: true, attributes: true, attributeFilter: ['aria-selected']});
        observer.observe(content, {subtree: true, childList: true, characterData: true});
        updateSummary();
        updateDate();
        if (clock === null) clock = setInterval(updateDate, 60000);
    }
    window.addEventListener('pagehide', () => {
        observer.disconnect();
        clearInterval(clock);
        clock = null;
    });
    window.addEventListener('pageshow', start);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateDate();
    });
    start();
})();
