(() => {
    'use strict';

    const reportedNumber = value => typeof value === 'number' && Number.isFinite(value);
    const amount = (value, precision = 2) => reportedNumber(value) ?
        value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: precision}) :
        'Not reported';
    const percent = value => reportedNumber(value) ?
        `${value.toLocaleString(undefined, {maximumFractionDigits: 2})}%` : 'Not reported';

    function element(tag, text) {
        const node = document.createElement(tag);
        node.textContent = text;
        return node;
    }

    function monthlyMix(row) {
        const ri = row.reservation_revenue ?? 0;
        const paygo = row.paygo_revenue ?? 0;
        const total = row.total_revenue;
        if (![ri, paygo, total].every(reportedNumber)) {
            return {reason: 'Missing revenue measurements'};
        }
        if (ri < 0 || paygo < 0 || total < 0) {
            return {reason: 'Negative adjustment; a 100% mix is not meaningful'};
        }
        if (total === 0) return {reason: 'Zero total; percentage mix is undefined'};
        const combined = ri + paygo;
        if (combined === 0 ||
            Math.abs(combined - total) > Math.max(0.0001, Math.abs(total) * 0.000000001)) {
            return {reason: 'RI and PAYG amounts do not reconcile to the reported total'};
        }
        const reservation = 100 * (ri / combined);
        return {reservation, paygo: 100 - reservation};
    }

    function mixLabel(value, rounded) {
        if (value > 0 && value < 1) return '<1%';
        if (value > 99 && value < 100) return '>99%';
        return `${rounded}%`;
    }

    function renderMixChart(container, note, rows) {
        if (!rows.length) return;
        const bars = element('div', '');
        bars.className = 'sb-fabric-revenue-bars';
        bars.style.setProperty('--sb-revenue-month-count', rows.length);
        let unavailable = 0;
        for (const row of rows) {
            const month = row.fiscal_month ?? 'Month not reported';
            const mix = monthlyMix(row);
            const column = element('div', '');
            column.className = 'sb-fabric-revenue-month';
            const bar = element('div', '');
            bar.className = 'sb-fabric-revenue-stack';
            bar.setAttribute('role', 'img');
            bar.setAttribute('tabindex', '0');
            let description = `${month}: RI ${amount(row.reservation_revenue, 4)}, ` +
                `PAYG ${amount(row.paygo_revenue, 4)}, total ${amount(row.total_revenue, 4)}`;
            if (mix.reason) {
                unavailable++;
                bar.classList.add('sb-fabric-revenue-stack--unavailable');
                bar.append(element('span', 'No mix'));
                description += `. ${mix.reason}. See the monthly amounts below.`;
            } else {
                const roundedRI = Math.round(mix.reservation);
                for (const [kind, value, rounded] of [
                    ['ri', mix.reservation, roundedRI], ['paygo', mix.paygo, 100 - roundedRI],
                ]) {
                    const segment = element('span', value >= 8 ? mixLabel(value, rounded) : '');
                    segment.className = `sb-fabric-revenue-segment sb-fabric-revenue-segment--${kind}`;
                    segment.style.height = `${value}%`;
                    segment.setAttribute('aria-hidden', 'true');
                    bar.append(segment);
                }
                description += `. RI ${percent(mix.reservation)}, PAYG ${percent(mix.paygo)}.`;
                if (row.reservation_revenue == null || row.paygo_revenue == null) {
                    description += ' Only one revenue category was reported, and it matches ' +
                        'the total. The chart shows 100% for that category; missing dollar ' +
                        'amounts remain Not reported in the table.';
                }
            }
            bar.title = description;
            bar.setAttribute('aria-label', description);
            const label = element('span', month);
            label.className = 'sb-fabric-revenue-month-label';
            column.append(bar, label);
            bars.append(column);
        }
        container.replaceChildren(bars);
        note.hidden = unavailable === 0;
        note.textContent = unavailable ?
            'Months with missing totals, no reported components, zero totals, negative ' +
            'adjustments, or unreconciled amounts have no percentage bar. A single reported ' +
            'category matching the total shows 100%. Reported amounts remain in the table.' : '';
    }

    function renderMonthlyTable(headings, body, rows) {
        if (!rows.length) return;
        const metric = element('th', 'Revenue');
        metric.setAttribute('scope', 'col');
        headings.append(metric);
        for (const row of rows) {
            const month = row.fiscal_month ?? 'Month not reported';
            const match = month.match(
                /^(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})$/i);
            const label = match ? `${match[1].slice(0, 3)} ${match[2]}` : month;
            const header = element('th', label);
            header.setAttribute('scope', 'col');
            header.setAttribute('aria-label', month);
            header.title = month;
            headings.append(header);
        }
        for (const [label, key] of [
            ['Reserved instance (RI)', 'reservation_revenue'],
            ['PAYG revenue', 'paygo_revenue'], ['Total revenue', 'total_revenue'],
        ]) {
            const tr = document.createElement('tr');
            const header = element('th', label);
            header.setAttribute('scope', 'row');
            tr.append(header);
            for (const row of rows) {
                const td = element('td', amount(row[key]));
                td.className = 'sb-fabric-number';
                if (row[key] == null || row[key] === 0) td.classList.add('sb-fabric-quiet');
                tr.append(td);
            }
            body.append(tr);
        }
    }

    function render(root, customer) {
        const find = name => root.querySelector(`[data-revenue-${name}]`);
        const summary = find('summary');
        const months = find('months');
        summary.replaceChildren();
        months.replaceChildren();
        find('month-headings').replaceChildren();
        find('chart').replaceChildren();
        find('chart-note').textContent = '';
        find('chart-note').hidden = true;
        find('context').textContent = '';
        find('body').hidden = true;
        root.hidden = !customer;
        if (!customer) return;

        const revenue = customer.revenue;
        const state = find('state');
        state.hidden = false;
        state.setAttribute('role', 'status');
        if (customer.status === 'missing_tpid') {
            state.textContent = 'A valid TPID is needed to import this customer\'s revenue.';
            return;
        }
        if (!revenue || revenue.state === 'not_imported') {
            state.textContent = 'Revenue breakdown has not been imported yet. Use Import from MSXi.';
            return;
        }
        if (revenue.state === 'no_data') {
            state.textContent = 'No revenue measurements returned for this TPID. This does not prove zero revenue or no reservations.';
            return;
        }
        if (revenue.state !== 'available') {
            state.setAttribute('role', 'alert');
            state.textContent = 'Could not read the saved revenue breakdown. Its status is invalid.';
            console.error('Invalid saved Fabric revenue status:', revenue.state);
            return;
        }

        state.hidden = true;
        find('body').hidden = false;
        const values = revenue.summary ?? {};
        for (const [label, value] of [
            ['Total revenue YTD', amount(values.total_revenue_ytd)],
            ['Reserved instance revenue YTD', amount(values.reservation_revenue_ytd)],
            ['PAYG revenue YTD', amount(values.paygo_revenue_ytd)],
            ['RI share of revenue YTD', percent(values.reservation_share_pct)],
        ]) {
            const group = document.createElement('div');
            group.append(element('dt', label), element('dd', value));
            summary.append(group);
        }

        const metadata = revenue.metadata ?? {};
        const period = [
            metadata.fiscal_year_label ?? 'Microsoft fiscal YTD (July-June)',
            metadata.latest_month_label ? `through ${metadata.latest_month_label}` : null,
            metadata.currency_label ?? metadata.unit_label ?? 'Source revenue (CD)',
        ].filter(Boolean).join(' / ');
        find('context').textContent = period;
        if (metadata.imported_at) {
            const imported = new Date(metadata.imported_at);
            find('context').textContent += Number.isNaN(imported.getTime()) ?
                ' / Revenue import date unavailable' :
                ` / Revenue imported ${imported.toLocaleDateString()}`;
        }
        const rows = revenue.months ?? [];
        find('monthly').hidden = !rows.length;
        renderMixChart(find('chart'), find('chart-note'), rows);
        renderMonthlyTable(find('month-headings'), months, rows);
    }

    window.SBFabricRevenue = {render};
})();
