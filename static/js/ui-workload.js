(function () {
    'use strict';
    const STORAGE_KEY = 'salesbuddy_workload_filter';
    const PRESETS = ['', 'fq', 'prev_fq', '30d', '90d', 'all'];
    const money = value => '$' + value.toLocaleString('en-US', {maximumFractionDigits: 0});

    function validDate(value) {
        if (value === '') return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
        const date = new Date(value + 'T00:00:00Z');
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }

    function validateFilter(value) {
        if (!value || Array.isArray(value) || typeof value !== 'object' ||
            typeof value.from !== 'string' || typeof value.to !== 'string' ||
            !validDate(value.from) || !validDate(value.to) ||
            (value.preset !== undefined && typeof value.preset !== 'string') ||
            !PRESETS.includes(value.preset ?? '') ||
            (value.preset === 'all' && (value.from || value.to)) ||
            (value.from && value.to && value.from > value.to)) {
            throw new Error('Invalid workload date filter');
        }
        return {from: value.from, to: value.to, preset: value.preset ?? ''};
    }

    function summarize(groups, milestones, filter) {
        validateFilter(filter);
        const names = new Set(), ids = new Set();
        let entries = 0, total = 0;
        const visible = groups.map(group => {
            const rows = group.entries.filter(row => {
                if (typeof row.name !== 'string' || typeof row.date !== 'string' ||
                    !validDate(row.date) || typeof row.acr !== 'number' ||
                    !Number.isFinite(row.acr) || !Array.isArray(row.ids)) {
                    throw new Error('Invalid workload customer data');
                }
                row.ids.forEach(id => {
                    if (!Object.hasOwn(milestones, id) ||
                        typeof milestones[id] !== 'number' ||
                        !Number.isFinite(milestones[id])) {
                        throw new Error('Invalid workload milestone ACR');
                    }
                });
                return (!filter.from || row.date >= filter.from) &&
                    (!filter.to || (row.date && row.date <= filter.to));
            });
            rows.forEach(row => {
                names.add(row.name.trim());
                row.ids.forEach(id => ids.add(id));
            });
            entries += rows.length;
            return {id: group.id, rows, count: rows.length,
                acr: rows.reduce((sum, row) => sum + row.acr, 0)};
        });
        ids.forEach(id => { total += milestones[id]; });
        if (!Number.isFinite(total) || visible.some(group => !Number.isFinite(group.acr))) {
            throw new Error('Workload ACR exceeds the supported numeric range');
        }
        return {groups: visible, customers: names.size, entries, total,
            workloads: visible.filter(group => group.count > 0).length};
    }

    function rollingFilter(days, now = new Date()) {
        const start = new Date(now);
        start.setDate(start.getDate() - days);
        return {from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10),
            preset: days + 'd'};
    }

    if (typeof module !== 'undefined') module.exports = {validateFilter, summarize, rollingFilter};
    if (typeof document === 'undefined') return;

    function mount() {
        const root = document.querySelector('[data-sb-workload]');
        if (!root) return;
        const embedded = root.dataset.embedded === 'true';
        const from = root.querySelector('#dateFrom'), to = root.querySelector('#dateTo');
        const presets = [...root.querySelectorAll('[data-preset]')];
        const notice = root.querySelector('[data-sb-workload-notice]');
        const errorText = root.querySelector('[data-sb-workload-error]');
        const retry = root.querySelector('[data-sb-workload-retry]');
        const topicReading = root.querySelector('.sb-workload-topic-reading');
        const customerReading = root.querySelector('.sb-workload-customers');
        const errors = new Map(), offsets = {};
        let retryMode = 'read', selected = null, restoring = false;
        let filter = validateFilter({from: presets[0].dataset.from, to: presets[0].dataset.to,
            preset: 'fq'});
        const groups = [...root.querySelectorAll('.sb-workload-group')].map(panel => ({
            id: panel.dataset.topicId, panel,
            nav: root.querySelector('[data-sb-topic-row="' + panel.dataset.topicId + '"]'),
            table: panel.querySelector('table'),
            entries: [...panel.querySelectorAll('.workload-row')].map(element => ({
                element, date: element.dataset.noteDate, acr: Number(element.dataset.acr),
                name: element.cells[0].dataset.sbSortValue,
                ids: element.dataset.milestoneIds ? element.dataset.milestoneIds.split(',') : [],
            })),
        }));
        let milestones;
        const sorts = [];

        function report(kind, message, error) {
            if (error) console.error(message, error);
            errors.set(kind, message);
            displayErrors();
        }

        function displayErrors() {
            notice.hidden = !errors.size;
            errorText.textContent = [...errors.values()].join(' ');
            retry.hidden = !errors.has('storage');
        }

        function captureScroll() {
            if (selected) offsets[selected] = customerReading.scrollTop;
        }

        function saveView() {
            if (embedded || restoring || errors.has('data')) return;
            captureScroll();
            try {
                window.history.replaceState({...window.history.state, sbWorkload: {
                    filter, topic: selected, topicsScroll: topicReading.scrollTop,
                    customersScroll: {...offsets},
                }}, '');
                errors.delete('history');
                displayErrors();
            } catch (error) {
                report('history', 'View position could not be saved. Back may reset this view.', error);
            }
        }

        function chooseTopic(id, persist = true) {
            if (!restoring) captureScroll();
            selected = id;
            groups.forEach(group => {
                if (!embedded) group.panel.hidden = group.id !== id;
                if (group.nav) {
                    group.nav.dataset.active = String(group.id === id);
                    group.nav.querySelector('button').setAttribute('aria-pressed',
                        String(group.id === id));
                }
            });
            if (!embedded) customerReading.scrollTop = offsets[id] ?? 0;
            const status = document.querySelector('[data-sb-workload-selected]');
            if (status) status.textContent = id ?
                groups.find(group => group.id === id).nav.cells[0].textContent.trim() :
                'No workload selected';
            if (persist) saveView();
        }

        function applyFilter(next, persist = false) {
            const result = summarize(groups, milestones, next);
            filter = next;
            from.value = next.from;
            to.value = next.to;
            presets.forEach(button => button.setAttribute('aria-pressed',
                String(button.dataset.preset === next.preset)));
            result.groups.forEach(value => {
                const group = groups.find(item => item.id === value.id);
                const visible = new Set(value.rows);
                group.entries.forEach(row => {
                    row.element.style.display = visible.has(row) ? '' : 'none';
                });
                group.table.dataset.workloadVisible = String(value.count > 0);
                group.panel.querySelector('.group-count').textContent =
                    value.count + ' customer' + (value.count === 1 ? '' : 's');
                group.panel.querySelector('.group-acr').textContent =
                    value.acr > 0 ? money(value.acr) + '/mo' : '';
                if (embedded) group.panel.hidden = !value.count;
                if (group.nav) {
                    group.nav.hidden = !value.count;
                    const count = group.nav.querySelector('[data-sb-topic-count]');
                    const acr = group.nav.querySelector('[data-sb-topic-acr]');
                    count.textContent = String(value.count);
                    count.dataset.sbSortValue = String(value.count);
                    acr.textContent = value.acr ? money(value.acr) : '-';
                    acr.dataset.sbSortValue = String(value.acr);
                }
            });
            [['statUniqueCustomers', result.customers], ['statWorkloads', result.workloads],
                ['statCustomers', result.entries], ['statAcr', money(result.total)]].forEach(
                ([id, value]) => { root.querySelector('#' + id).textContent = String(value); });
            root.querySelector('#emptyState').hidden = result.workloads > 0 || !groups.length;
            const scope = document.querySelector('[data-sb-workload-scope]');
            if (scope) scope.textContent = next.from || next.to ?
                (next.from || 'Any date') + ' to ' + (next.to || 'Any date') : 'All note dates';
            sorts.forEach(sort => { if (sort.state) sort.restore(sort.state); });
            if (!embedded) chooseTopic(
                result.groups.find(group => group.id === selected && group.count)?.id ??
                result.groups.find(group => group.count)?.id ?? null, false);
            if (persist) {
                saveFilter();
                saveView();
            }
        }

        function saveFilter() {
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filter));
                errors.delete('storage');
                displayErrors();
            } catch (error) {
                retryMode = 'write';
                report('storage', 'Date scope is applied, but could not be saved for later visits.', error);
            }
        }

        function restoreFilter() {
            try {
                const saved = window.localStorage.getItem(STORAGE_KEY);
                if (saved !== null) applyFilter(validateFilter(JSON.parse(saved)));
                errors.delete('storage');
                displayErrors();
            } catch (error) {
                retryMode = 'read';
                report('storage', 'Saved date filter could not be restored. Current scope is shown. Choose a preset to replace it or Retry.', error);
            }
        }

        function restoreView() {
            if (embedded) return;
            restoring = true;
            try {
                const value = window.history.state?.sbWorkload;
                if (value === undefined) return;
                if (!value || Array.isArray(value) || typeof value !== 'object' ||
                    (value.topic !== null && typeof value.topic !== 'string') ||
                    !Number.isFinite(value.topicsScroll) || value.topicsScroll < 0 ||
                    !value.customersScroll || Array.isArray(value.customersScroll) ||
                    typeof value.customersScroll !== 'object' ||
                    Object.entries(value.customersScroll).some(([id, offset]) =>
                        !/^\d+$/.test(id) || !Number.isFinite(offset) || offset < 0)) {
                    throw new Error('Invalid workload view state');
                }
                const next = validateFilter(value.filter);
                Object.keys(offsets).forEach(key => { delete offsets[key]; });
                Object.assign(offsets, value.customersScroll);
                selected = value.topic;
                applyFilter(next);
                topicReading.scrollTop = value.topicsScroll;
                errors.delete('history');
                displayErrors();
            } catch (error) {
                report('history', 'Saved view could not be restored. Current scope is shown; select a workload to save a new view.', error);
            } finally {
                restoring = false;
            }
        }

        try {
            milestones = JSON.parse(root.querySelector('[data-sb-workload-data]').textContent);
            if (!milestones || Array.isArray(milestones) || typeof milestones !== 'object' ||
                Object.entries(milestones).some(([id, value]) =>
                    !/^\d+$/.test(id) || typeof value !== 'number' || !Number.isFinite(value)) ||
                groups.some(group => group.entries.some(row =>
                    row.element.dataset.acr.trim() === ''))) {
                throw new Error('Invalid workload report data');
            }
            applyFilter(filter);
            if (!window.SBTableSort) throw new Error('Table sorting is unavailable');
            root.querySelectorAll('[data-sb-sortable]').forEach(table => {
                sorts.push(window.SBTableSort.create(table));
            });
            restoreFilter();
            restoreView();
        } catch (error) {
            groups.forEach(group => { group.table.dataset.workloadVisible = 'false'; });
            report('data', 'Workload data could not be displayed. Reload this report to retry.', error);
            return;
        }

        presets.forEach(button => button.addEventListener('click', () => {
            const preset = button.dataset.preset;
            const next = preset === 'all' ? {from: '', to: '', preset} :
                ['30d', '90d'].includes(preset) ? rollingFilter(parseInt(preset, 10)) :
                    {from: button.dataset.from, to: button.dataset.to, preset};
            errors.delete('range');
            from.setAttribute('aria-invalid', 'false');
            to.setAttribute('aria-invalid', 'false');
            applyFilter(validateFilter(next), true);
            displayErrors();
        }));
        [from, to].forEach(input => input.addEventListener('change', () => {
            try {
                const next = validateFilter({from: from.value, to: to.value, preset: ''});
                errors.delete('range');
                applyFilter(next, true);
                from.setAttribute('aria-invalid', 'false');
                to.setAttribute('aria-invalid', 'false');
                displayErrors();
            } catch (error) {
                from.setAttribute('aria-invalid', 'true');
                to.setAttribute('aria-invalid', 'true');
                report('range', 'Enter valid dates with From on or before To. Previous valid scope is still shown.', error);
            }
        }));
        retry.addEventListener('click', () => {
            if (retryMode === 'write') saveFilter();
            else restoreFilter();
            saveView();
        });
        groups.forEach(group => {
            group.nav?.querySelector('button').addEventListener('click', () => chooseTopic(group.id));
        });
        if (!embedded) {
            window.addEventListener('pagehide', saveView);
            window.addEventListener('pageshow', restoreView);
            window.addEventListener('popstate', restoreView);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();
