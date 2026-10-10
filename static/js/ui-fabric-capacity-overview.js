(() => {
    'use strict';
    const root = document.querySelector('[data-fabric-overview]');
    if (!root) return;
    const find = name => document.querySelector(`[data-overview-${name}]`);
    const number = value => value == null ? '-' :
        Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const percent = value => value == null ? '-' :
        value > 0 && value < 0.01 ? '<0.01%' : `${number(value)}%`;
    let report = null;
    const workloadLabels = {
        'Data Integration': 'DI', 'Data Warehousing Core': 'DW',
        'DE and DS': 'DE/DS', 'Real Time Intelligence': 'RTI',
        'Power BI': 'PBI', 'SQLDb': 'SQL', 'Planning': 'Plan'
    };
    function element(tag, text) {
        const node = document.createElement(tag);
        node.textContent = text;
        return node;
    }
    function isTrialCapacity(row) {
        return ['FTL4', 'FTL64'].includes(row.capacity?.sku?.trim().toUpperCase());
    }
    function getTrialCustomerIds(rows) {
        return new Set(rows.filter(isTrialCapacity).map(row => row.id));
    }
    function isPCapacity(row) {
        return /^P[1-9]\d*$/.test(row.capacity?.sku?.trim().toUpperCase() ?? '');
    }
    function getPCustomerIds(rows) {
        return new Set(rows.filter(isPCapacity).map(row => row.id));
    }
    function orderMatchingCapacities(rows, matches) {
        const customers = new Map();
        for (const row of rows) {
            if (!customers.has(row.id)) customers.set(row.id, []);
            customers.get(row.id).push(row);
        }
        return [...customers.values()].flatMap(capacities => capacities
            .sort((a, b) => Number(matches(b)) - Number(matches(a)) ||
                a.capacity_index - b.capacity_index)
            .map((row, index) => ({...row, capacity_index: index + 1})));
    }
    function getTrialUtilizationColor(value) {
        const percent = Math.max(0, Math.min(50, value));
        const low = percent <= 25 ? '--sb-ui-milestone-rail' : '--sb-ui-warning';
        const high = percent <= 25 ? '--sb-ui-warning' : '--sb-ui-danger';
        const mix = percent <= 25 ? percent / 25 * 100 : (percent - 25) / 25 * 100;
        return `color-mix(in oklch, var(${low}), var(${high}) ${mix}%)`;
    }
    function getUsedTooltip(row) {
        const latest = row.capacity?.latest_utilization_pct;
        return `Latest available hour utilization: ${latest == null ? 'No measurement' : percent(latest)}`;
    }
    function render() {
        if (!report) return;
        window.SBFabricCapacityLabel.close();
        const query = find('search').value.trim().toLocaleLowerCase();
        const trialsOnly = modePreference.value === 'trials';
        const pOnly = modePreference.value === 'p';
        const trialCustomers = trialsOnly ? getTrialCustomerIds(report.rows) : null;
        const pCustomers = pOnly ? getPCustomerIds(report.rows) : null;
        const orderedRows = trialsOnly || pOnly ? orderMatchingCapacities(report.rows,
            row => (trialsOnly && isTrialCapacity(row)) || (pOnly && isPCapacity(row))) : report.rows;
        const rows = orderedRows.filter(row => {
            const capacity = row.capacity;
            if (trialCustomers && !trialCustomers.has(row.id)) return false;
            if (pCustomers && !pCustomers.has(row.id)) return false;
            if (modePreference.value !== 'all' && !capacity) return false;
            if (!`${row.name} ${row.account_name} ${row.nickname ?? ''} ${row.tpid ?? ''} ${capacity?.tenant_id ?? ''} ${capacity?.capacity_id ?? ''} ${capacity?.sku ?? ''}`
                .toLocaleLowerCase().includes(query)) return false;
            return true;
        });
        const old = find('table');
        const state = old.matches('[data-sb-sortable]') ? window.SBTableSort?.create(old)?.state : null;
        const table = old.cloneNode(false);
        table.dataset.sbSortable = '';
        table.dataset.sbSortKey = `fabric-capacity-overview-v2:${report.workloads.join('|')}`;
        const head = document.createElement('thead');
        const headings = document.createElement('tr');
        const columns = [
            { name: 'Customer', value: row => row.name },
            { name: 'TPID', value: row => row.tpid, numeric: true },
            { name: 'Cap.', value: row => row.capacity_index, numeric: true,
                title: 'Capacity number within this customer. Hover for identity and metrics.' },
            { name: 'SKU', value: row => row.capacity?.sku },
            { name: 'Used %', value: row => row.capacity?.utilization_pct, numeric: true, format: percent,
                title: 'Capacity consumption over source-retained history, including autoscale', start: true },
            { name: 'CU hours', value: row => row.capacity?.unsmoothed_cu_hours, numeric: true, format: number },
            ...report.workloads.map((name, index) => ({
                name: `${workloadLabels[name] ?? name} %`, title: `${name}, customer-wide share of consumed CU hours`,
                numeric: true, start: index === 0,
                value: row => row.workload_shares[name], format: percent }))
        ];
        const groups = document.createElement('tr');
        groups.className = 'sb-fabric-column-groups';
        for (const [label, span] of [['Customer / capacity', 4], ['Capacity consumption', 2],
            ['Workload mix / customer-wide', report.workloads.length]]) {
            if (!span) continue;
            const th = element('th', label);
            th.colSpan = span;
            th.scope = 'colgroup';
            groups.append(th);
        }
        for (const column of columns) {
            const th = element('th', column.name);
            th.dataset.sbSortType = column.numeric ? 'number' : 'text';
            if (column.title) th.title = column.title;
            if (column.start) th.classList.add('sb-fabric-group-start');
            headings.append(th);
        }
        head.append(groups, headings);
        const body = document.createElement('tbody');
        for (const row of rows) {
            const tr = document.createElement('tr');
            columns.forEach((column, index) => {
                const value = column.value(row);
                const td = element('td', column.format ? column.format(value) : value ?? '-');
                td.dataset.sbSortValue = value ?? '';
                if (column.numeric) td.classList.add('sb-fabric-number');
                if (column.start) td.classList.add('sb-fabric-group-start');
                if (value == null || value === 0) td.classList.add('sb-fabric-quiet');
                if (index >= 6 && value > 0) td.classList.add('sb-fabric-workload-active');
                if (index === 4) {
                    td.classList.add('sb-fabric-primary-metric');
                    td.title = getUsedTooltip(row);
                }
                if (isTrialCapacity(row)) {
                    if (index === 3) {
                        const badge = element('span', value);
                        badge.className = 'sb-fabric-trial-sku';
                        badge.title = 'Fabric trial capacity';
                        td.replaceChildren(badge);
                    }
                    if (trialsOnly && index === 4 && value != null) {
                        td.classList.add('sb-fabric-trial-utilization');
                        td.style.setProperty('--sb-fabric-trial-color', getTrialUtilizationColor(value));
                        td.title += '\nTrial utilization: green at 0%, amber at 25%, red at 50% and above.';
                    }
                }
                if (isPCapacity(row) && index === 3) {
                    const badge = element('span', value);
                    badge.className = 'sb-fabric-p-sku';
                    badge.title = 'Power BI Premium capacity';
                    td.replaceChildren(badge);
                }
                if (index === 2 && row.capacity) {
                    td.replaceChildren(window.SBFabricCapacityLabel.create(
                        row.capacity, row.capacity_index, row.capacity_total, row.name, null, row.seller));
                }
                if (index === 0) {
                    const link = element('a', row.name);
                    const url = new URL('/reports/fabric-consumption', location.origin);
                    url.searchParams.set('customer_id', row.id);
                    if (row.capacity) {
                        url.searchParams.set('capacity',
                            `${row.capacity.tenant_id ?? ''}|${row.capacity.capacity_id}`);
                    }
                    link.href = url.href;
                    td.replaceChildren(link);
                }
                tr.append(td);
            });
            body.append(tr);
        }
        if (!rows.length) {
            const tr = document.createElement('tr');
            tr.dataset.sbSortFixed = '';
            const td = element('td', report.snapshot ? 'No rows match these filters.' :
                'No snapshot yet. Use Import from MSXi to load your customer capacities.');
            td.colSpan = columns.length;
            tr.append(td);
            body.append(tr);
        }
        table.append(head, body);
        old.replaceWith(table);
        const sorter = window.SBTableSort?.create(table);
        if (state) sorter?.restore(state);
        find('status').textContent = `${rows.length} / ${report.rows.length} rows`;
    }
    async function load() {
        find('error').hidden = true;
        try {
            const response = await fetch(root.dataset.reportUrl, { headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (!response.ok || payload.success === false) {
                throw new Error(payload.error || `Request failed (${response.status}).`);
            }
            report = payload;
            importController.setImportedAt(report.snapshot?.imported_at);
            find('freshness').textContent = report.snapshot ?
                `Imported ${new Date(report.snapshot.imported_at).toLocaleString()}` : 'No saved snapshot';
            render();
        } catch (error) {
            find('error').textContent = `Could not load capacity overview: ${error.message}`;
            find('error').hidden = false;
            find('status').textContent = 'Load failed. Previously displayed data may be stale.';
        }
    }
    find('search').addEventListener('input', render);
    const modePreference = window.SBFabricPreferences.bindMode(
        find('mode'), 'salesbuddy_fabric_overview_mode', render);
    const importController = window.SBFabricImport.create(root, load);
    load();
})();
