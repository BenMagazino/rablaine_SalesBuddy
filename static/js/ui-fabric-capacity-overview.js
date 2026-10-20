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
        if (row.customerMode) {
            return `Average ${row.trialsOnly ? 'trial' : 'all'} capacity utilization over saved source-retained history. Equal weight per capacity; missing values excluded. ${row.measuredCount}/${row.measuredTotal} capacities measured.`;
        }
        const latest = row.capacity?.latest_utilization_pct;
        return `Latest available hour utilization: ${latest == null ? 'No measurement' : percent(latest)}`;
    }
    function workloadGroups(workloads) {
        const definitions = [
            ['Applications / real-time', ['AppDev', 'Planning', 'Real Time Intelligence']],
            ['Data engineering / integration / warehouse',
                ['DE and DS', 'Data Integration', 'Data Warehousing Core']],
            ['Storage / AI / BI', ['OneLake', 'Copilot', 'Power BI']],
            ['SQL', ['SQLDb']],
        ];
        const known = new Set(definitions.flatMap(([, names]) => names));
        return [
            ...definitions.map(([label, names]) =>
                [label, names.filter(name => workloads.includes(name))]),
            ['Other workloads', workloads.filter(name => !known.has(name))],
        ].filter(([, names]) => names.length);
    }
    function customerRows(rows, trialsOnly) {
        const customers = new Map();
        for (const row of rows) {
            if (!customers.has(row.id)) customers.set(row.id, []);
            customers.get(row.id).push(row);
        }
        return [...customers.values()].map(members => {
            const capacities = members.filter(row => row.capacity);
            const selected = trialsOnly ? capacities.filter(isTrialCapacity) : capacities;
            const values = selected.map(row => row.capacity.utilization_pct)
                .filter(value => typeof value === 'number' && Number.isFinite(value));
            const mix = new Map();
            for (const row of capacities) {
                const sku = row.capacity.sku?.trim().toUpperCase() || 'Unknown';
                mix.set(sku, (mix.get(sku) || 0) + 1);
            }
            return {
                ...members[0], customerMode: true, trialsOnly,
                capacity: {utilization_pct: values.length ?
                    values.reduce((sum, value) => sum + value, 0) / values.length : null},
                measuredCount: values.length, measuredTotal: selected.length,
                capacityMix: [...mix].sort(([a], [b]) => a.localeCompare(b, undefined, {numeric: true})),
                searchText: capacities.map(row =>
                    `${row.capacity.tenant_id ?? ''} ${row.capacity.capacity_id ?? ''} ${row.capacity.sku ?? ''}`).join(' '),
            };
        });
    }
    function skuBadge(sku, count = 1) {
        const badge = element('span', count > 1 ? `${sku} ×${count}` : sku);
        badge.className = ['FTL4', 'FTL64'].includes(sku) ? 'sb-fabric-trial-sku' :
            /^P[1-9]\d*$/.test(sku) ? 'sb-fabric-p-sku' :
            /^F[1-9]\d*$/.test(sku) ? 'sb-fabric-f-sku' : '';
        return badge;
    }
    function sellerGroups(rows, grouped) {
        if (!grouped) return [{seller: null, rows}];
        const groups = new Map();
        for (const row of rows) {
            const key = row.seller?.id ?? null;
            if (!groups.has(key)) groups.set(key, {seller: row.seller, rows: []});
            groups.get(key).rows.push(row);
        }
        return [...groups.values()].sort((a, b) => {
            if (!a.seller || !b.seller) return Number(!a.seller) - Number(!b.seller);
            return a.seller.name.localeCompare(b.seller.name) || a.seller.id - b.seller.id;
        });
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
        const scopedRows = orderedRows.filter(row =>
            (!trialCustomers || trialCustomers.has(row.id)) &&
            (!pCustomers || pCustomers.has(row.id)) &&
            (modePreference.value === 'all' || row.capacity));
        const onePerCustomer = find('customers').checked;
        const grouped = find('sellers').checked;
        const candidates = onePerCustomer ? customerRows(scopedRows, trialsOnly) : scopedRows;
        const rows = candidates.filter(row => {
            const capacity = row.capacity;
            if (trialCustomers && !trialCustomers.has(row.id)) return false;
            if (pCustomers && !pCustomers.has(row.id)) return false;
            if (modePreference.value !== 'all' && !capacity) return false;
            if (!`${row.name} ${row.account_name} ${row.nickname ?? ''} ${row.tpid ?? ''} ${row.searchText ?? ''} ${capacity?.tenant_id ?? ''} ${capacity?.capacity_id ?? ''} ${capacity?.sku ?? ''}`
                .toLocaleLowerCase().includes(query)) return false;
            return true;
        });
        const old = find('table');
        const sortKey = `fabric-capacity-overview-v4:${onePerCustomer ? 'customers' : 'capacities'}:${grouped ? 'sellers' : 'all'}:${report.workloads.join('|')}`;
        const state = old.dataset.sbSortKey === sortKey ? window.SBTableSort?.create(old)?.state : null;
        const table = old.cloneNode(false);
        table.dataset.sbSortable = '';
        const workloadSections = workloadGroups(report.workloads);
        table.dataset.sbSortKey = sortKey;
        const head = document.createElement('thead');
        const headings = document.createElement('tr');
        const columns = [
            { name: 'Customer', value: row => row.name },
            { name: 'TPID', value: row => row.tpid, numeric: true },
            { name: onePerCustomer ? 'Capacity mix' : 'SKU', value: row => row.customerMode ?
                row.capacityMix.map(([sku, count]) => `${sku} (${count})`).join(', ') : row.capacity?.sku },
            { name: 'Used %', value: row => row.capacity?.utilization_pct, numeric: true, format: percent,
                title: onePerCustomer ?
                    `Average ${trialsOnly ? 'trial' : 'all'} capacity utilization over saved source-retained history, equally weighted; missing values excluded.` :
                    'Capacity consumption over source-retained history, including autoscale', start: true },
            ...workloadSections.flatMap(([, names]) => names.map((name, index) => ({
                name: `${workloadLabels[name] ?? name} %`, title: `${name}, customer-wide share of consumed CU hours`,
                numeric: true, start: index === 0,
                value: row => row.workload_shares[name], format: percent })))
        ];
        for (const column of columns) {
            const th = element('th', column.name);
            th.dataset.sbSortType = column.numeric ? 'number' : 'text';
            if (column.title) th.title = column.title;
            if (column.start) th.classList.add('sb-fabric-group-start');
            headings.append(th);
        }
        head.append(headings);
        table.append(head);
        const groups = sellerGroups(rows, grouped);
        if (!groups.length) groups.push({seller: null, rows: []});
        for (const group of groups) {
            const body = document.createElement('tbody');
            if (grouped && group.rows.length) {
                const heading = document.createElement('tr');
                heading.dataset.sbSortFixed = '';
                heading.className = 'sb-fabric-seller-heading';
                const cell = document.createElement('th');
                cell.colSpan = columns.length;
                cell.scope = 'rowgroup';
                if (group.seller) {
                    const badge = element('a', group.seller.name);
                    badge.href = `/seller/${group.seller.id}`;
                    badge.className = 'badge bg-primary text-decoration-none';
                    const icon = document.createElement('i');
                    icon.className = 'bi bi-person';
                    icon.setAttribute('aria-hidden', 'true');
                    badge.prepend(icon, ' ');
                    cell.append(badge);
                } else cell.textContent = 'No seller assigned';
                const count = new Set(group.rows.map(row => row.id)).size;
                cell.append(` · ${count} customer${count === 1 ? '' : 's'}`);
                heading.append(cell);
                body.append(heading);
            }
            for (const row of group.rows) {
                const tr = document.createElement('tr');
                columns.forEach((column, index) => {
                    const value = column.value(row);
                    const td = element('td', column.format ? column.format(value) : value ?? '-');
                    td.dataset.sbSortValue = value ?? '';
                    if (column.numeric) td.classList.add('sb-fabric-number');
                    if (column.start) td.classList.add('sb-fabric-group-start');
                    if (value == null || value === 0) td.classList.add('sb-fabric-quiet');
                    if (index >= 4 && value > 0) td.classList.add('sb-fabric-workload-active');
                    if (index === 3) {
                        td.classList.add('sb-fabric-primary-metric');
                        td.title = getUsedTooltip(row);
                    }
                    if (isTrialCapacity(row)) {
                        if (index === 2) {
                            const badge = element('span', value);
                            badge.className = 'sb-fabric-trial-sku';
                            badge.title = 'Fabric trial capacity';
                            td.replaceChildren(badge);
                        }
                        if (trialsOnly && index === 3 && value != null) {
                            td.classList.add('sb-fabric-trial-utilization');
                            td.style.setProperty('--sb-fabric-trial-color', getTrialUtilizationColor(value));
                            td.title += '\nTrial utilization: green at 0%, amber at 25%, red at 50% and above.';
                        }
                    }
                    if (isPCapacity(row) && index === 2) {
                        const badge = element('span', value);
                        badge.className = 'sb-fabric-p-sku';
                        badge.title = 'Power BI Premium capacity';
                        td.replaceChildren(badge);
                    }
                    if (index === 2 && row.customerMode) {
                        td.classList.add('sb-fabric-capacity-mix');
                        const mix = document.createElement('div');
                        mix.className = 'sb-fabric-sku-list';
                        mix.append(...row.capacityMix.map(([sku, count]) => skuBadge(sku, count)));
                        td.replaceChildren(mix);
                        if (!row.capacityMix.length) td.textContent = 'None observed';
                    } else if (index === 2 && row.capacity) {
                        const label = window.SBFabricCapacityLabel.create(
                            row.capacity, row.capacity_index, row.capacity_total,
                            row.name, null, row.seller);
                        label.textContent = row.capacity.sku || 'Unknown';
                        const style = skuBadge(label.textContent.trim().toUpperCase()).className;
                        if (style) label.classList.add(style);
                        td.replaceChildren(label);
                    }
                    if (index === 0) {
                        const link = element('a', row.name);
                        const url = new URL('/reports/fabric-consumption', location.origin);
                        url.searchParams.set('customer_id', row.id);
                        if (row.capacity && !row.customerMode) {
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
            table.append(body);
        }
        old.replaceWith(table);
        const sorter = window.SBTableSort?.create(table);
        if (state) sorter?.restore(state);
        find('status').textContent = `${rows.length} / ${onePerCustomer ?
            new Set(report.rows.map(row => row.id)).size : report.rows.length} ${onePerCustomer ? 'customers' : 'rows'}`;
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
    window.SBFabricPreferences.bindCheckbox(find('customers'),
        'salesbuddy_fabric_overview_customers',
        new URLSearchParams(window.location.search).get('customers'));
    find('customers').addEventListener('change', render);
    window.SBFabricPreferences.bindCheckbox(find('sellers'),
        'salesbuddy_fabric_overview_sellers');
    find('sellers').addEventListener('change', render);
    const modePreference = window.SBFabricPreferences.bindMode(
        find('mode'), 'salesbuddy_fabric_overview_mode', render,
        new URLSearchParams(window.location.search).get('mode'));
    const importController = window.SBFabricImport.create(root, load);
    load();
})();
