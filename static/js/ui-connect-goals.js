(function (global) {
    'use strict';

    async function confirmBuckets(selected, fetcher) {
        const response = await fetcher('/api/revenue/compensated-buckets', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({buckets: selected, confirm_for_fiscal_year: true}),
        });
        const data = await response.json();
        if (!response.ok || data.success !== true) {
            throw new Error(data.error || 'The server did not confirm the bucket save.');
        }
        if (!/^FY\d{2}$/.test(data.fiscal_year)
            || !Number.isInteger(data.taxonomy_version) || data.taxonomy_version < 0) {
            throw new Error('The server did not confirm the saved fiscal year and taxonomy.');
        }
        return data;
    }

    function coverageFilter(destination) {
        return {...destination, allQuarters: destination.quarters.slice()};
    }

    function quarterChartSeries(u2c) {
        const start = Date.parse(u2c.period_start);
        const end = Date.parse(u2c.period_end);
        return {
            start, end,
            committed: u2c.trend.filter(point => point.source !== 'live').map(point => ({
                ...point, x: Date.parse(point.date), y: point.u2c_pct,
            })),
            live: u2c.trend.filter(point => point.source === 'live').map(point => ({
                ...point, x: Date.parse(point.date), y: point.u2c_pct,
            })),
            goal: [{x: start, y: u2c.target}, {x: end, y: u2c.target}],
        };
    }

    function trendDate(value) {
        return new Date(value).toLocaleDateString(undefined, {
            month: 'short', day: '2-digit', timeZone: 'UTC',
        });
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            confirmBuckets, coverageFilter,
            quarterChartSeries,
        };
    }
    if (!global.document) return;
    const initialized = new WeakSet();
    const cleanup = new WeakMap();

    function initRoot(root) {
        if (initialized.has(root)) return;
        initialized.add(root);
        function find(id) {
            return root.dataset.widgetPrefix
                ? root.querySelector('#' + root.dataset.widgetPrefix + id)
                : document.getElementById(id);
        }
        const config = JSON.parse(find('connectGoalsData').textContent);

        function openMilestoneCoverage() {
            try {
                const state = coverageFilter(config.teamFilter);
                global.localStorage.setItem('salesbuddy_milestone_filters', JSON.stringify(state));
                global.location.assign('/reports/milestone-tracker');
            } catch (error) {
                console.error('Connect Goals milestone navigation:', error);
                const status = find('connectNavigationStatus');
                status.hidden = false;
                status.textContent = 'Could not open the scoped milestone report. ' + error.message;
            }
        }
        root.querySelectorAll('[data-goals-coverage]').forEach(button => {
            button.addEventListener('click', openMilestoneCoverage);
        });

        const canvas = find('connectU2cChart');
        if (!canvas || !config.u2c.trend.length) return;
        const series = quarterChartSeries(config.u2c);
        let chart;
        const chartConfig = {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Snapshot committed ACR %', data: series.committed,
                    fill: true, pointRadius: 3, pointHoverRadius: 5, tension: .18,
                }, {
                    label: config.u2c.target + '% goal',
                    data: series.goal,
                    borderDash: [6, 5], pointRadius: 0, fill: false,
                }, {
                    label: 'Today (live)', data: series.live,
                    showLine: false, fill: false, pointStyle: 'rectRot',
                    pointRadius: 5, pointHoverRadius: 7,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                scales: {
                    x: {
                        type: 'linear', min: series.start, max: series.end,
                        grid: {display: false},
                        ticks: {callback: trendDate, maxTicksLimit: 7},
                    },
                    y: {
                        beginAtZero: true, suggestedMax: Math.max(50, config.u2c.value + 10),
                        ticks: {callback: value => value + '%'}, grid: {},
                    },
                },
                plugins: {
                    colors: {enabled: false},
                    legend: {position: 'bottom', align: 'start', labels: {
                        filter: (item, data) => item.datasetIndex !== 2
                            || data.datasets[2].data.length > 0,
                    }},
                    tooltip: {
                        callbacks: {
                            title: items => items[0].raw.label || trendDate(items[0].parsed.x),
                            label: context => {
                                const value = context.dataset.label + ': '
                                    + context.parsed.y + '%';
                                if (context.datasetIndex !== 2) return value;
                                return value + ' (' + context.raw.committed_acr.toLocaleString(
                                    undefined, {style: 'currency', currency: 'USD',
                                        maximumFractionDigits: 0}) + ' committed)';
                            },
                        },
                    },
                },
            },
        };

        function applyChartTheme() {
            const styles = global.getComputedStyle(document.documentElement);
            const pixel = document.createElement('canvas');
            pixel.width = pixel.height = 1;
            const context = pixel.getContext('2d', {willReadFrequently: true});
            function color(token) {
                // Canvas resolves OKLCH tokens to the RGB colors Chart.js can parse.
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = styles.getPropertyValue(token).trim();
                context.fillRect(0, 0, 1, 1);
                const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
                return `rgb(${r}, ${g}, ${b})`;
            }
            const line = color('--sb-ui-milestone-rail');
            const ink = color('--sb-ui-muted');
            const grid = color('--sb-ui-grid-line');
            chartConfig.data.datasets[0].borderColor = line;
            chartConfig.data.datasets[0].pointBackgroundColor = line;
            chartConfig.data.datasets[0].pointBorderColor = line;
            chartConfig.data.datasets[0].backgroundColor =
                line.replace('rgb(', 'rgba(').replace(')', ', .10)');
            chartConfig.data.datasets[1].borderColor = ink;
            chartConfig.data.datasets[1].backgroundColor = 'transparent';
            const live = color('--sb-ui-accent');
            chartConfig.data.datasets[2].borderColor = live;
            chartConfig.data.datasets[2].pointBackgroundColor = live;
            chartConfig.data.datasets[2].pointBorderColor = live;
            chartConfig.options.plugins.legend.labels.color = ink;
            for (const axis of ['x', 'y']) {
                chartConfig.options.scales[axis].ticks.color = ink;
                chartConfig.options.scales[axis].grid.color = grid;
            }
            if (chart) {
                const visible = chart.data.datasets.map((_, index) => chart.isDatasetVisible(index));
                chart.destroy();
                visible.forEach((shown, index) => {
                    chartConfig.data.datasets[index].hidden = !shown;
                });
            }
            chart = new global.Chart(canvas, chartConfig);
        }
        applyChartTheme();
        const observer = new global.MutationObserver(applyChartTheme);
        observer.observe(document.documentElement, {
            attributes: true, attributeFilter: ['data-sb-mode', 'data-sb-family'],
        });
        cleanup.set(root, () => {
            observer.disconnect();
            chart.destroy();
        });
    }

    function init(container = document) {
        container.querySelectorAll('.sb-connect-goals').forEach(initRoot);
    }
    global.SBConnectGoals = Object.freeze({
        confirmBuckets,
        init,
        destroy(container) {
            container.querySelectorAll('.sb-connect-goals').forEach(root => {
                cleanup.get(root)?.();
                cleanup.delete(root);
                initialized.delete(root);
            });
        },
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else init();
})(typeof window === 'undefined' ? globalThis : window);
