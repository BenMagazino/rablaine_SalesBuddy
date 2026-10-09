(function () {
    'use strict';
    const FILTER_KEY = 'whats_new_filters';
    const COLLAPSE_KEY = 'whats_new_collapsed';
    const DAYS_KEY = 'whats_new_days';

    function validateFilter(value) {
        if (!value || Array.isArray(value) || typeof value !== 'object' ||
            typeof value.seller !== 'string' || typeof value.area !== 'string' ||
            !['', 'on', 'off'].includes(value.team) || typeof value.grouped !== 'boolean' ||
            (value.changeTypes !== null && (!Array.isArray(value.changeTypes) ||
                value.changeTypes.some(type => typeof type !== 'string')))) {
            throw new Error('Invalid saved milestone filters');
        }
        return {seller: value.seller, area: value.area, team: value.team,
            grouped: value.grouped, changeTypes: value.changeTypes};
    }

    function validateCollapsed(value) {
        if (!value || Array.isArray(value) || typeof value !== 'object' ||
            Object.entries(value).some(([key, closed]) =>
                !/^(created|updated):(seller|cust):/.test(key) || typeof closed !== 'boolean')) {
            throw new Error('Invalid saved milestone groups');
        }
        return Object.assign(Object.create(null), value);
    }

    function validateDays(value) {
        if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 90) {
            throw new Error('Lookback must be between 1 and 90 days');
        }
        return String(Number(value));
    }

    function restoreLookback(select, sourceDays) {
        const value = validateDays(sourceDays);
        select.value = value;
        return value;
    }

    function calendarDate(value) {
        if (typeof value !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d:[0-5]\d)?$/.test(value)) {
            throw new Error('Invalid milestone calendar date');
        }
        const parsed = new Date(value.slice(0, 10) + 'T00:00:00Z');
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !==
            value.slice(0, 10) || (value.length > 10 &&
                !Number.isFinite(Date.parse(value + 'Z')))) {
            throw new Error('Invalid milestone calendar date');
        }
        return value.slice(0, 10);
    }

    function restrictedTypes(filter, available) {
        return filter.changeTypes !== null &&
            !available.every(type => filter.changeTypes.includes(type));
    }

    function matches(row, filter, available) {
        return (!filter.seller || row.sellerId === filter.seller) &&
            (!filter.area || row.area === filter.area) &&
            (!filter.team || row.onMyTeam === String(filter.team === 'on')) &&
            (row.section !== 'updated' || !restrictedTypes(filter, available) ||
                row.types.some(type => filter.changeTypes.includes(type)));
    }

    function auditDate(id, filter, available, audits) {
        if (!restrictedTypes(filter, available)) return null;
        return filter.changeTypes.map(type => audits[id]?.[type]).filter(Boolean).sort().at(-1) ||
            null;
    }

    function createTeamChanger(write, confirmed) {
        let busy = false;
        const uncertain = new Set();
        return {
            get busy() { return busy; },
            uncertain,
            async change(id, onTeam) {
                if (busy || uncertain.has(id)) throw new Error('Membership needs review first');
                busy = true;
                try {
                    const response = await write(id, onTeam);
                    if (!response || typeof response.success !== 'boolean') {
                        throw new Error('Invalid membership confirmation');
                    }
                    if (!response.success) {
                        const error = new Error(response.error || 'MSX rejected the team change');
                        error.rejected = true;
                        throw error;
                    }
                    confirmed(id, onTeam);
                } catch (error) {
                    if (!error.rejected) uncertain.add(id);
                    throw error;
                } finally {
                    busy = false;
                }
            },
        };
    }

    function setMembership(rows, id, onTeam) {
        rows.filter(row => row.id === id).forEach(row => {
            row.onMyTeam = String(onTeam);
            row.element.dataset.onMyTeam = row.onMyTeam;
            const cell = row.element.cells[4];
            cell.dataset.exportBool = row.onMyTeam;
            cell.dataset.sbSortValue = onTeam ? '1' : '0';
            const button = cell.querySelector('button');
            button.dataset.onTeam = row.onMyTeam;
            button.title = onTeam ? 'Leave milestone team' : 'Join milestone team';
            button.setAttribute('aria-label', (onTeam ? 'Leave' : 'Join') +
                ' milestone team: ' + row.element.cells[0].dataset.sbSortValue);
            button.querySelector('span').textContent = onTeam ? 'On team' : 'Join';
            button.querySelector('i').className = 'bi bi-' +
                (onTeam ? 'people-fill' : 'person-plus');
        });
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {validateFilter, validateCollapsed, validateDays, calendarDate,
            restrictedTypes, matches, auditDate, createTeamChanger, setMembership,
            restoreLookback};
    }
    if (typeof document === 'undefined') return;

    function mount() {
        const root = document.querySelector('[data-sb-whats-new]');
        if (!root) return;
        const embedded = root.dataset.embedded === 'true';
        const seller = root.querySelector('#sellerFilter');
        const area = root.querySelector('#areaFilter');
        const team = root.querySelector('#teamFilter');
        const days = root.querySelector('#daysFilter');
        const currentDays = root.dataset.days;
        const groupButton = root.querySelector('#groupByBtn');
        const boxes = [...root.querySelectorAll('.change-type-cb')];
        const available = boxes.map(box => box.value);
        const menu = root.querySelector('.sb-whats-new-types');
        const notice = root.querySelector('.sb-whats-new-notice');
        const retry = root.querySelector('[data-sb-whats-new-retry]');
        const errors = new Map();
        const panes = {};
        const sorts = new Map();
        const states = new Map();
        let grouped = true;
        let collapsed = Object.create(null);
        let audits;
        let retryMode = 'read';
        let pendingDays = null;
        let restoring = false;

        function displayErrors() {
            notice.hidden = errors.size === 0;
            root.querySelector('[data-sb-whats-new-error]').textContent =
                [...errors.values()].join(' ');
            retry.hidden = !errors.has('storage');
            retry.textContent = retryMode === 'days' ?
                'Retry lookback' : 'Retry saved preferences';
        }

        function report(key, message, error) {
            console.error('[whats-new:' + key + ']', error);
            errors.set(key, message);
            displayErrors();
        }

        function getFilter() {
            return {seller: seller?.value || '', area: area.value, team: team.value, grouped,
                changeTypes: boxes.length ? boxes.filter(box => box.checked).map(box => box.value) :
                    null};
        }

        function setFilter(value) {
            const next = validateFilter(value);
            for (const [select, value] of [[seller, next.seller], [area, next.area]]) {
                if (select && value && ![...select.options].some(option => option.value === value)) {
                    throw new Error('Saved seller or area is not in this lookback');
                }
            }
            if (seller) seller.value = next.seller;
            area.value = next.area;
            team.value = next.team;
            grouped = next.grouped;
            boxes.forEach(box => { box.checked = next.changeTypes === null ||
                next.changeTypes.includes(box.value); });
        }

        function savePreferences() {
            try {
                window.localStorage.setItem(FILTER_KEY, JSON.stringify(getFilter()));
                window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
                errors.delete('storage');
                displayErrors();
            } catch (error) {
                retryMode = 'write';
                report('storage', 'Filters are applied, but preferences could not be saved. Retry to save them.', error);
            }
        }

        function saveView() {
            if (embedded || restoring) return;
            try {
                window.history.replaceState({...window.history.state, sbWhatsNew: {
                    days: currentDays, filter: getFilter(), collapsed: {...collapsed},
                    scroll: Object.fromEntries(Object.entries(panes).map(([key, pane]) =>
                        [key, pane.reading.scrollTop])),
                }}, '');
                errors.delete('history');
                displayErrors();
            } catch (error) {
                report('history', 'Reading position could not be saved for Back.', error);
            }
        }

        function updateExports() {
            root.querySelectorAll('.sb-whats-new-table').forEach(table => {
                let parent = table.parentElement;
                let visible = true;
                while (parent && parent !== root) {
                    if (parent.matches('details.sb-whats-new-group') && !parent.open) visible = false;
                    parent = parent.parentElement;
                }
                table.dataset.exportVisible = String(visible && table.tBodies[0].rows.length > 0);
            });
        }

        function buildTable(pane, host, rows, key, context) {
            const table = document.createElement('table');
            table.className = 'sb-whats-new-table';
            table.dataset.sbSortable = '';
            table.dataset.sbSortKey = key;
            const head = table.createTHead().insertRow();
            pane.specs.forEach((spec, index) => {
                const th = document.createElement('th');
                th.dataset.sbSortType = spec.type;
                th.dataset.exportLabel = spec.label + (index === 0 ? ' (' + context + ')' : '');
                th.textContent = spec.label;
                head.appendChild(th);
            });
            const body = table.createTBody();
            rows.forEach(row => body.appendChild(row.element));
            host.appendChild(table);
            const sort = window.SBTableSort.create(table);
            if (states.has(key)) sort.restore(states.get(key));
            sorts.set(key, sort);
        }

        function buildGroup(host, key, name, count, level) {
            const details = document.createElement('details');
            details.className = 'sb-whats-new-group';
            details.dataset.level = level;
            details.dataset.groupKey = key;
            details.open = !collapsed[key];
            const summary = document.createElement('summary');
            const arrow = document.createElement('i');
            arrow.className = 'bi bi-chevron-right';
            arrow.setAttribute('aria-hidden', 'true');
            const icon = document.createElement('i');
            icon.className = 'bi bi-' + (level === 'seller' ? 'person' : 'building');
            icon.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.textContent = name;
            if (level === 'seller') label.className = 'sb-whats-new-seller';
            const total = document.createElement('span');
            total.className = 'sb-whats-new-count';
            total.textContent = count;
            summary.append(arrow, icon, label, total);
            details.appendChild(summary);
            details.addEventListener('toggle', () => {
                if (!details.isConnected) return;
                const closed = !details.open;
                if (Boolean(collapsed[key]) === closed) return;
                collapsed[key] = closed;
                updateExports();
                savePreferences();
                saveView();
            });
            host.appendChild(details);
            return details;
        }

        function render(persist = false) {
            const filter = getFilter();
            const offsets = Object.fromEntries(Object.entries(panes).map(([key, pane]) =>
                [key, pane.reading.scrollTop]));
            sorts.forEach((sort, key) => states.set(key, sort.state));
            sorts.clear();
            groupButton.setAttribute('aria-pressed', String(grouped));
            if (menu) menu.querySelector('summary').textContent =
                !restrictedTypes(filter, available) ? 'All changes' :
                    filter.changeTypes.length === 0 ? 'No changes selected' :
                        filter.changeTypes.length === 1 ? filter.changeTypes[0] :
                            filter.changeTypes.length + ' change types';
            for (const [section, pane] of Object.entries(panes)) {
                pane.host.replaceChildren();
                const rows = pane.rows.filter(row => matches(row, filter, available));
                pane.count.textContent = rows.length;
                pane.empty.hidden = rows.length > 0;
                pane.empty.textContent = pane.rows.length === 0 ?
                    'No ' + section + ' milestones in the last ' + currentDays + ' days.' :
                    'No ' + section + ' milestones match these filters.';
                if (section === 'updated') pane.rows.forEach(row => {
                    const selected = auditDate(row.id, filter, available, audits);
                    const span = row.element.querySelector('[data-original-date]');
                    const iso = selected ? calendarDate(selected) : span.dataset.originalIso;
                    span.textContent = selected ?
                        new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US',
                            {month: 'short', day: 'numeric', timeZone: 'UTC'}) :
                        span.dataset.originalDate;
                    span.title = iso;
                    span.parentElement.dataset.sbSortValue = iso;
                });
                if (!grouped) buildTable(pane, pane.host, rows, 'whats-new-' + section, section);
                else {
                    const groups = new Map();
                    rows.forEach(row => {
                        const sName = row.sellerName || 'No Seller';
                        const cName = row.customerName || 'No Customer';
                        if (!groups.has(sName)) groups.set(sName, new Map());
                        const customers = groups.get(sName);
                        if (!customers.has(cName)) customers.set(cName, []);
                        customers.get(cName).push(row);
                    });
                    const ordered = entries => [...entries].sort(([a], [b]) =>
                        a.toLowerCase() < b.toLowerCase() ? -1 :
                            a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                    for (const [sName, customers] of ordered(groups)) {
                        const prefix = filter.seller ? '' : 'seller:' + sName + '/';
                        const host = filter.seller ? pane.host :
                            buildGroup(pane.host, section + ':seller:' + sName, sName,
                                [...customers.values()].reduce((sum, list) => sum + list.length, 0),
                                'seller');
                        for (const [cName, list] of ordered(customers)) {
                            const key = section + ':' + prefix + 'cust:' + cName;
                            const group = buildGroup(host, key, cName, list.length, 'customer');
                            buildTable(pane, group, list, 'whats-new-' + key,
                                section + ' / Seller: ' + sName + ' / Customer: ' + cName);
                        }
                    }
                }
                pane.reading.scrollTop = offsets[section];
            }
            updateExports();
            const status = document.querySelector('[data-sb-whats-new-status]');
            if (status) status.textContent = panes.created.count.textContent + ' created / ' +
                panes.updated.count.textContent + ' updated / Last ' + currentDays + ' days';
            if (persist) { savePreferences(); saveView(); }
        }

        function changeDays(value, replace = false) {
            try {
                const next = validateDays(value);
                pendingDays = next;
                const url = new URL(window.location.href);
                url.searchParams.set('days', next);
                if (replace) window.location.replace(url.toString());
                else {
                    window.localStorage.setItem(DAYS_KEY, next);
                    saveView();
                    restoreLookback(days, currentDays);
                    window.location.assign(url.toString());
                }
                return true;
            } catch (error) {
                restoreLookback(days, currentDays);
                retryMode = 'days';
                report('storage', 'Lookback was not changed because its preference could not be saved. Retry to apply it.', error);
                return false;
            }
        }

        function restorePreferences() {
            try {
                const value = window.localStorage.getItem(FILTER_KEY);
                const groups = window.localStorage.getItem(COLLAPSE_KEY);
                const savedDays = window.localStorage.getItem(DAYS_KEY);
                const saved = value === null ? null : validateFilter(JSON.parse(value));
                const savedGroups = groups === null ? Object.create(null) :
                    validateCollapsed(JSON.parse(groups));
                if (savedDays !== null) validateDays(savedDays);
                if (saved) setFilter({...saved, seller: saved.seller || seller?.value || ''});
                collapsed = savedGroups;
                errors.delete('storage');
                displayErrors();
                if (!new URL(window.location.href).searchParams.has('days') && savedDays !== null &&
                    savedDays !== currentDays &&
                    window.history.state?.sbWhatsNew?.days !== currentDays) {
                    return changeDays(savedDays, true);
                }
                render();
            } catch (error) {
                retryMode = 'read';
                report('storage', 'Saved preferences could not be restored. Current filters are shown. Change a filter to replace them, or Retry.', error);
            }
            return false;
        }

        function restoreView() {
            restoreLookback(days, currentDays);
            if (embedded) return;
            restoring = true;
            try {
                const view = window.history.state?.sbWhatsNew;
                if (view === undefined) return;
                if (!view || Array.isArray(view) || typeof view !== 'object' || !view.scroll ||
                    (view.days !== undefined && validateDays(view.days) !== currentDays) ||
                    ['created', 'updated'].some(key =>
                        !Number.isFinite(view.scroll[key]) || view.scroll[key] < 0)) {
                    throw new Error('Invalid milestone reading position');
                }
                const groups = validateCollapsed(view.collapsed);
                setFilter(view.filter);
                collapsed = groups;
                render();
                for (const [section, pane] of Object.entries(panes)) {
                    pane.reading.scrollTop = view.scroll[section];
                }
                errors.delete('history');
                displayErrors();
            } catch (error) {
                report('history', 'Previous view could not be restored. Current filters are shown.', error);
            } finally { restoring = false; }
        }

        try {
            restoreLookback(days, currentDays);
            if (!window.SBTableSort || !window.SBDialog) throw new Error('Native controls unavailable');
            audits = JSON.parse(root.querySelector('[data-sb-whats-new-audits]').textContent);
            if (!audits || Array.isArray(audits) || typeof audits !== 'object') {
                throw new Error('Invalid milestone audit data');
            }
            Object.values(audits).forEach(fields => {
                if (!fields || Array.isArray(fields) || typeof fields !== 'object') {
                    throw new Error('Invalid milestone audit fields');
                }
                Object.values(fields).forEach(calendarDate);
            });
            root.querySelectorAll('[data-section]').forEach(pane => {
                const section = pane.dataset.section;
                panes[section] = {host: pane.querySelector('[data-sb-whats-new-tables]'),
                    reading: pane.querySelector('.sb-whats-new-reading'),
                    count: pane.querySelector('.sb-whats-new-count'),
                    empty: pane.querySelector('.sb-whats-new-empty'),
                    specs: [...pane.querySelectorAll('th')].map((th, index) =>
                        ({label: index === 0 ? 'Milestone' : th.dataset.exportLabel,
                            type: th.dataset.sbSortType})),
                    rows: [...pane.querySelectorAll('.data-row')].sort((a, b) =>
                        Number(a.dataset.sourceOrder) - Number(b.dataset.sourceOrder)).map(element => {
                        const row = {element, section, id: element.dataset.milestoneId,
                            sellerId: element.dataset.sellerId, sellerName: element.dataset.sellerName,
                            customerName: element.dataset.customerName, area: element.dataset.area,
                            onMyTeam: element.dataset.onMyTeam,
                            types: element.dataset.changeTypes.split('|').filter(Boolean)};
                        if (!/^\d+$/.test(row.id) || !/^\d+$/.test(element.dataset.sourceOrder) ||
                            !['true', 'false'].includes(row.onMyTeam) ||
                            element.cells.length !== 5 ||
                            (element.cells[2].dataset.sbSortValue !== '' &&
                                !Number.isFinite(Number(element.cells[2].dataset.sbSortValue)))) {
                            throw new Error('Invalid milestone row metadata');
                        }
                        calendarDate(element.cells[3].dataset.sbSortValue);
                        return row;
                    })};
            });
            render();
            if (restorePreferences()) return;
            restoreView();
        } catch (error) {
            root.querySelectorAll('.sb-whats-new-table').forEach(table => {
                table.dataset.exportVisible = 'false';
            });
            report('data', 'Report controls could not be initialized. Reload to retry; exports are disabled.', error);
            return;
        }

        [seller, area, team, ...boxes].filter(Boolean).forEach(input =>
            input.addEventListener('change', () => render(true)));
        groupButton.addEventListener('click', () => {
            grouped = !grouped;
            if (!grouped) collapsed = Object.create(null);
            render(true);
        });
        root.querySelectorAll('.sb-whats-new-type-menu button[data-change-types]').forEach(button =>
            button.addEventListener('click', () => {
                boxes.forEach(box => { box.checked = button.dataset.changeTypes === 'all'; });
                render(true);
            }));
        days.addEventListener('change', () => changeDays(days.value));
        retry.addEventListener('click', () => {
            if (retryMode === 'days') changeDays(pendingDays);
            else if (retryMode === 'write') savePreferences();
            else restorePreferences();
        });
        if (menu) {
            menu.addEventListener('keydown', event => {
                if (event.key !== 'Escape' || !menu.open) return;
                event.preventDefault();
                event.stopPropagation();
                menu.open = false;
                menu.querySelector('summary').focus();
            });
            document.addEventListener('pointerdown', event => {
                if (menu.open && !menu.contains(event.target)) menu.open = false;
            });
        }
        Object.values(panes).forEach(pane => pane.reading.addEventListener('scroll', saveView,
            {passive: true}));
        window.addEventListener('pagehide', saveView);
        window.addEventListener('popstate', restoreView);
        window.addEventListener('pageshow', event => { if (event.persisted) restoreView(); });

        const dialog = root.querySelector('#whatsNewTeamDialog');
        const confirm = dialog.querySelector('[data-sb-team-confirm]');
        const failure = dialog.querySelector('[data-sb-team-error]');
        const review = dialog.querySelector('[data-sb-team-review]');
        let context = null;
        const changer = createTeamChanger(async (id, onTeam) => {
            const response = await fetch('/api/msx/' +
                (onTeam ? 'join' : 'leave') + '-milestone-team', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({milestone_id: Number(id)}),
            });
            if (!response.headers.get('Content-Type')?.includes('application/json')) {
                throw new Error('Unexpected membership response');
            }
            const data = await response.json();
            if (!response.ok) {
                const error = new Error(data.error || 'Membership request failed');
                error.rejected = response.status >= 400 && response.status < 500;
                throw error;
            }
            return data;
        }, (id, onTeam) => {
            setMembership(Object.values(panes).flatMap(pane => pane.rows), id, onTeam);
            render();
        });
        root.addEventListener('click', event => {
            const button = event.target.closest('.sb-whats-new-team');
            if (!button || changer.busy) return;
            const element = button.closest('.data-row');
            context = {id: element.dataset.milestoneId,
                section: element.closest('[data-section]').dataset.section,
                onTeam: element.dataset.onMyTeam !== 'true'};
            dialog.querySelector('h2').textContent = context.onTeam ?
                'Join milestone team?' : 'Leave milestone team?';
            dialog.querySelector('[data-sb-team-context]').textContent =
                element.dataset.customerName + ': ' + element.cells[0].dataset.sbSortValue;
            const unknown = changer.uncertain.has(context.id);
            failure.hidden = !unknown;
            failure.textContent = unknown ? 'This change could not be confirmed. Review the milestone in MSX before trying again.' : '';
            review.hidden = !unknown;
            review.href = element.cells[0].dataset.exportUrl;
            review.target = '_blank';
            review.rel = 'noopener';
            confirm.disabled = unknown;
            confirm.textContent = context.onTeam ? 'Join team' : 'Leave team';
            window.SBDialog.open(dialog);
        });
        dialog.addEventListener('sb:dialog-before-close', event => {
            if (changer.busy && event.detail.reason !== 'saved') event.preventDefault();
        });
        confirm.addEventListener('click', async () => {
            if (!context || changer.busy || changer.uncertain.has(context.id)) return;
            confirm.disabled = true;
            confirm.textContent = 'Saving...';
            failure.hidden = true;
            try {
                await changer.change(context.id, context.onTeam);
                window.SBDialog.close(dialog, 'saved');
                if (document.activeElement === document.body) {
                    panes[context.section].reading.focus({preventScroll: true});
                }
            } catch (error) {
                console.error('[whats-new:team]', error);
                failure.hidden = false;
                failure.textContent = changer.uncertain.has(context.id) ?
                    'Membership change could not be confirmed. Review the milestone in MSX before trying again; this request will not be repeated automatically.' :
                    error.message;
                review.hidden = !changer.uncertain.has(context.id);
            } finally {
                confirm.disabled = changer.uncertain.has(context.id);
                confirm.textContent = context.onTeam ? 'Join team' : 'Leave team';
            }
        });
        window.addEventListener('beforeunload', event => {
            if (changer.busy) { event.preventDefault(); event.returnValue = ''; }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();
