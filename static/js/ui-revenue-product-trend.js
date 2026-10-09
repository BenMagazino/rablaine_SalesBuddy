/** Monthly product history, with genuine gaps and one active chart at a time. */
(() => {
    'use strict';
    const monthLabel = new Intl.DateTimeFormat('en-US', {
        month: 'short', year: 'numeric', timeZone: 'UTC',
    });
    const money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
    const compactMoney = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
    });
    function buildSeries(records) {
        const months = new Map();
        for (const record of records) {
            const date = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(record.month ?? '');
            if (!date || !Number.isFinite(record.revenue) || !record.label) {
                throw new Error('Monthly revenue chart contains an invalid month or amount.');
            }
            const index = Number(date[1]) * 12 + Number(date[2]) - 1;
            if (months.has(index)) throw new Error('Monthly revenue chart contains a duplicate month.');
            months.set(index, record);
        }
        const indices = [...months.keys()].sort((a, b) => a - b);
        const labels = [], values = [], fiscalMonths = [];
        if (!indices.length) return {labels, values, fiscalMonths, gaps: false};
        for (let index = indices[0]; index <= indices.at(-1); index++) {
            labels.push(monthLabel.format(new Date(Date.UTC(Math.floor(index / 12), index % 12))));
            values.push(months.get(index)?.revenue ?? null);
            fiscalMonths.push(months.get(index)?.label ?? null);
        }
        return {labels, values, fiscalMonths, gaps: values.includes(null)};
    }
    function create(root) {
        let active = null, chart = null;
        function colors(figure) {
            const plot = getComputedStyle(figure.querySelector('.sb-product-trend-plot'));
            return {accent: plot.color, line: plot.borderTopColor,
                text: getComputedStyle(figure).color, font: getComputedStyle(root).fontFamily};
        }
        function applyTheme() {
            if (!chart) return;
            const theme = colors(active);
            const dataset = chart.data.datasets[0];
            dataset.borderColor = dataset.pointBackgroundColor = theme.accent;
            dataset.pointBorderColor = dataset.pointHoverBackgroundColor =
                dataset.pointHoverBorderColor = theme.accent;
            for (const scale of Object.values(chart.options.scales)) {
                scale.ticks.color = theme.text;
                scale.ticks.font = {family: theme.font, size: 11};
                scale.grid.color = theme.line;
                scale.border.color = theme.line;
            }
            chart.update('none');
        }
        function show(panel) {
            const figure = panel?.querySelector('[data-sb-product-trend]') ?? null;
            if (figure === active) return;
            if (chart) { chart.destroy(); chart = null; }
            if (active) active.hidden = true;
            active = null;
            if (!figure) return;
            let series;
            try {
                const records = JSON.parse(
                    figure.querySelector('[data-sb-product-trend-data]').textContent);
                series = buildSeries(records);
            } catch (error) {
                const notice = root.querySelector('[data-sb-product-notice]');
                notice.textContent = 'The revenue chart could not read this history. Exact values remain available below.';
                notice.hidden = false;
                console.error('Product revenue history could not be charted.', error);
                throw error;
            }
            if (!series.labels.length) return;
            if (typeof window.Chart !== 'function') {
                const notice = root.querySelector('[data-sb-product-notice]');
                notice.textContent = 'The revenue chart could not load. Exact history remains available below.';
                notice.hidden = false;
                throw new Error('Product revenue chart library is unavailable.');
            }
            figure.querySelector('[data-sb-product-trend-range]').textContent =
                `${series.labels[0]} to ${series.labels.at(-1)}`;
            figure.querySelector('[data-sb-product-trend-gaps]').hidden = !series.gaps;
            figure.hidden = false;
            chart = new window.Chart(figure.querySelector('canvas'), {
                type: 'line',
                data: {labels: series.labels, datasets: [{
                    label: 'Monthly revenue', data: series.values, borderWidth: 2,
                    pointRadius: series.labels.length === 1 ? 4 : 2,
                    pointHoverRadius: 5, pointHitRadius: 10,
                    tension: 0, fill: false, spanGaps: false,
                }]},
                options: {
                    responsive: true, maintainAspectRatio: false, animation: false,
                    plugins: {
                        legend: {display: false},
                        tooltip: {callbacks: {
                            title: items => series.fiscalMonths[items[0].dataIndex],
                            label: item => money.format(item.parsed.y),
                        }},
                    },
                    scales: {
                        x: {border: {}, grid: {display: false},
                            ticks: {maxTicksLimit: 6, maxRotation: 0}},
                        y: {border: {}, grid: {}, beginAtZero: true, ticks: {
                            maxTicksLimit: 5, callback: compactMoney.format,
                        }},
                        yRight: {
                            type: 'linear', position: 'right', border: {display: false},
                            grid: {drawOnChartArea: false, drawTicks: false},
                            afterDataLimits: scale => {
                                const left = scale.chart.scales.y;
                                scale.min = left.min;
                                scale.max = left.max;
                            },
                            afterBuildTicks: scale => {
                                const left = scale.chart.scales.y;
                                // Each axis rounds its limits independently before this callback.
                                scale.min = left.min;
                                scale.max = left.max;
                                scale.ticks = left.ticks.map(tick => ({value: tick.value}));
                            },
                            ticks: {autoSkip: false, callback: compactMoney.format},
                        },
                    },
                },
            });
            active = figure;
            applyTheme();
        }
        new MutationObserver(applyTheme).observe(document.documentElement, {
            attributes: true, attributeFilter: ['data-sb-mode', 'data-sb-family'],
        });
        return Object.freeze({show});
    }
    window.SBProductRevenueTrend = Object.freeze({create, buildSeries});
})();
