/** Native 1:1 report lenses and independent reading context. */
(function(root) {
    'use strict';
    const tabs = ['recent', 'alltime'];
    const periodStorageKey = 'salesbuddy_one_on_one_period_days';

    function record(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function sellerWorkspaceUrl(id) {
        if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id)) {
            throw new Error('Select a valid seller to open their 1:1 notes.');
        }
        return '/seller/' + id + '/one-on-one';
    }

    function validateView(value) {
        if (!record(value) || !tabs.includes(value.tab)
            || !record(value.scroll) || Object.keys(value.scroll).length !== 2
            || !tabs.every(tab =>
                Number.isFinite(value.scroll[tab]) && value.scroll[tab] >= 0)
            || !Array.isArray(value.closed) || value.closed.some(id =>
                typeof id !== 'string' || !/^oo-(recent|alltime)-[1-9]\d*$/.test(id))
            || !Array.isArray(value.notes) || value.notes.some(id =>
                typeof id !== 'string' || !/^notes-[1-9]\d*$/.test(id))
            || !record(value.tables) || Object.values(value.tables).some(offset =>
                !Number.isFinite(offset) || offset < 0)
            || Object.keys(value.tables).some(id =>
                !/^oneOnOne(Commitments|Quarter|Topics|Revenue)$/.test(id))) {
            throw new Error('Invalid saved 1:1 report reading state.');
        }
        return value;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {sellerWorkspaceUrl, validateView};
    }
    if (!root.document) return;

    function init() {
        const document = root.document;
        const surface = document.querySelector('.sb-one-on-one');
        if (!surface) return;
        const reading = document.getElementById('oneOnOneReading');
        const buttons = [...surface.querySelectorAll('[role="tab"]')];
        const panels = tabs.map(tab => document.getElementById(tab));
        const scroll = {recent: 0, alltime: 0};
        let active = 'recent';
        const embedded = surface.dataset.embedded === 'true';

        function warn(message, error) {
            root.console.error(message, error);
            const notice = document.getElementById('oneOnOneNavigationStatus');
            notice.textContent = message;
            notice.hidden = false;
        }

        const period = document.getElementById('oneOnOnePeriod');
        if (period) {
            period.addEventListener('change', () => {
                try {
                    root.localStorage.setItem(periodStorageKey, period.value);
                } catch (error) {
                    warn('Could not remember your reporting period for future visits.', error);
                }
                period.form.requestSubmit();
            });
            const url = new URL(root.location.href);
            if (!url.searchParams.has('days')) {
                try {
                    const saved = root.localStorage.getItem(periodStorageKey);
                    if (saved !== null && !['14', '30'].includes(saved)) {
                        throw new Error('Invalid saved 1:1 reporting period.');
                    }
                    if (saved && saved !== period.value) {
                        url.searchParams.set('days', saved);
                        root.location.replace(url.href);
                        return;
                    }
                } catch (error) {
                    warn('Could not restore your saved reporting period.', error);
                }
            }
        }

        function selectTab(tab, restore = false) {
            if (!restore) scroll[active] = reading.scrollTop;
            active = tab;
            buttons.forEach(button => {
                const selected = button.getAttribute('aria-controls') === tab;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
            });
            panels.forEach(panel => { panel.hidden = panel.id !== tab; });
            reading.scrollTop = scroll[tab];
            const status = document.getElementById('oneOnOneScopeStatus');
            if (status) {
                const panel = document.getElementById(tab);
                const count = panel.querySelectorAll('.oo-customer').length;
                status.textContent = (tab === 'recent' ? surface.dataset.periodLabel : 'All Open Engagements')
                    + ' · ' + count + ' customer' + (count === 1 ? '' : 's');
            }
        }

        buttons.forEach((button, index) => {
            button.addEventListener('click', () => selectTab(button.getAttribute('aria-controls')));
            button.addEventListener('keydown', event => {
                let next;
                if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
                else if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = buttons.length - 1;
                else return;
                event.preventDefault();
                selectTab(buttons[next].getAttribute('aria-controls'));
                buttons[next].focus({preventScroll: true});
            });
        });
        selectTab('recent', true);

        const sellerButton = document.getElementById('openSellerOneOnOne');
        if (sellerButton) sellerButton.addEventListener('click', () => {
            try {
                root.location.assign(sellerWorkspaceUrl(
                    document.getElementById('oneOnOneSellerSelect').value));
            } catch (error) {
                root.console.error('1:1 seller workspace navigation:', error);
                const status = document.getElementById('oneOnOneLauncherStatus');
                status.textContent = error.message;
                status.hidden = false;
            }
        });
        if (embedded) return;

        function save() {
            try {
                scroll[active] = reading.scrollTop;
                const value = {
                    tab: active, scroll: {...scroll},
                    closed: [...surface.querySelectorAll('.oo-customer:not([open])')]
                        .map(detail => detail.id),
                    notes: [...surface.querySelectorAll('.oo-notes[open]')]
                        .map(detail => detail.id),
                    tables: Object.fromEntries([...surface.querySelectorAll('.oo-table')]
                        .map(table => [table.id, table.parentElement.scrollTop])),
                };
                root.history.replaceState({...root.history.state, sbOneOnOneReport: value}, '');
            } catch (error) {
                warn('Could not save your 1:1 report reading position for Back.', error);
            }
        }

        function restore() {
            if (root.history.state?.sbOneOnOneReport === undefined) return;
            try {
                const value = validateView(root.history.state.sbOneOnOneReport);
                Object.assign(scroll, value.scroll);
                surface.querySelectorAll('.oo-customer').forEach(detail => {
                    detail.open = !value.closed.includes(detail.id);
                });
                surface.querySelectorAll('.oo-notes').forEach(detail => {
                    detail.open = value.notes.includes(detail.id);
                });
                selectTab(value.tab, true);
                Object.entries(value.tables).forEach(([id, offset]) => {
                    const table = document.getElementById(id);
                    if (table) table.parentElement.scrollTop = offset;
                });
            } catch (error) {
                warn('Could not restore your 1:1 report reading position.', error);
            }
        }
        root.requestAnimationFrame(restore);
        root.addEventListener('pageshow', () => root.requestAnimationFrame(restore));
        root.addEventListener('pagehide', save);
    }

    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', init, {once: true});
    } else init();
})(typeof window === 'undefined' ? globalThis : window);
