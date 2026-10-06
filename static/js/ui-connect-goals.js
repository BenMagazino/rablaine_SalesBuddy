(function (global) {
    'use strict';

    function missingRequiredBuckets(selected) {
        return ['Databases', 'Fabric'].filter(bucket => !selected.includes(bucket));
    }

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

    function validateReadingView(view) {
        if (!view || !Number.isFinite(view.scroll) || view.scroll < 0
            || !Array.isArray(view.expanded)
            || view.expanded.some(key => typeof key !== 'string'
                || !/^(Databases|Fabric):[1-9]\d*$/.test(key))) {
            throw new Error('Invalid saved Connect Goals reading position.');
        }
        return view;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            missingRequiredBuckets, confirmBuckets, coverageFilter, validateReadingView,
        };
    }
    if (!global.document) return;

    function init() {
        const root = document.querySelector('.sb-connect-goals');
        if (!root) return;
        const config = JSON.parse(document.getElementById('connectGoalsData').textContent);

        function setStatus(status, message, error) {
            status.classList.toggle('is-danger', error);
            status.classList.toggle('sb-goals-muted', !error);
            status.textContent = message;
        }

        function warn(message, error) {
            console.error('Connect Goals reading state:', error);
            const notice = document.getElementById('connectNavigationStatus');
            notice.hidden = false;
            notice.textContent = message;
        }

        const reading = document.getElementById('connectGoalsReading');
        if (reading && root.dataset.embedded !== 'true') {
            const histories = Array.from(reading.querySelectorAll('[data-goals-history-key]'));
            function restoreReading() {
                const saved = global.history.state?.sbConnectGoals;
                if (saved === undefined) return;
                try {
                    const view = validateReadingView(saved);
                    histories.forEach(detail => {
                        detail.open = view.expanded.includes(detail.dataset.goalsHistoryKey);
                    });
                    reading.scrollTop = view.scroll;
                } catch (error) {
                    warn('Could not restore your dashboard reading position.', error);
                }
            }
            function saveReading() {
                try {
                    global.history.replaceState({
                        ...global.history.state,
                        sbConnectGoals: {
                            scroll: reading.scrollTop,
                            expanded: histories.filter(detail => detail.open)
                                .map(detail => detail.dataset.goalsHistoryKey),
                        },
                    }, '');
                } catch (error) {
                    warn('Could not save your dashboard reading position for Back.', error);
                }
            }
            restoreReading();
            global.addEventListener('pagehide', saveReading);
            global.addEventListener('pageshow', restoreReading);
        }

        function bindForm(form, status, dialog) {
            let pending = false;
            let saved = false;
            if (dialog) {
                dialog.addEventListener('sb:dialog-before-close', event => {
                    if (pending) event.preventDefault();
                });
            }
            form.addEventListener('submit', async event => {
                event.preventDefault();
                if (pending) return;
                if (saved) {
                    global.location.reload();
                    return;
                }
                const selected = Array.from(form.querySelectorAll('input:checked'))
                    .map(input => input.value);
                const missing = missingRequiredBuckets(selected);
                if (missing.length) {
                    setStatus(status, 'Select ' + missing.join(' and ') + ' to continue.', true);
                    return;
                }
                pending = true;
                form.setAttribute('aria-busy', 'true');
                const controls = Array.from(form.querySelectorAll('input, button'));
                const disabled = controls.map(control => control.disabled);
                controls.forEach(control => { control.disabled = true; });
                setStatus(status, 'Saving...', false);
                try {
                    const data = await confirmBuckets(selected, global.fetch.bind(global));
                    saved = true;
                    try {
                        global.localStorage.setItem(
                            'salesbuddy_revenue_bucket_filter', JSON.stringify(selected));
                        global.localStorage.setItem(
                            'salesbuddy_revenue_bucket_taxonomy_version',
                            String(data.taxonomy_version));
                    } catch (error) {
                        console.error('Connect Goals local bucket preferences:', error);
                        setStatus(status, 'Buckets saved. Local preferences could not be updated. '
                            + 'Reload this report to apply the saved scope.', false);
                        form.querySelector('[type="submit"]').textContent = 'Reload report';
                        return;
                    }
                    global.location.reload();
                } catch (error) {
                    console.error('Connect Goals bucket save:', error);
                    setStatus(status, saved
                        ? 'Buckets saved, but this report could not reload. ' + error.message
                        : 'Could not confirm the bucket save. ' + error.message, true);
                    if (saved) {
                        form.querySelector('[type="submit"]').textContent = 'Reload report';
                    }
                } finally {
                    pending = false;
                    form.setAttribute('aria-busy', 'false');
                    controls.forEach((control, index) => { control.disabled = disabled[index]; });
                }
            });
        }

        const setupForm = document.getElementById('connectSetupForm');
        if (setupForm) bindForm(setupForm, document.getElementById('connectSetupStatus'));
        const bucketForm = document.getElementById('connectBucketModalForm');
        if (bucketForm) bindForm(bucketForm,
            document.getElementById('connectBucketModalStatus'),
            document.getElementById('connectBucketModal'));

        global.openMilestoneCoverage = function () {
            try {
                const state = coverageFilter(config.teamFilter);
                global.localStorage.setItem('salesbuddy_milestone_filters', JSON.stringify(state));
                global.location.assign('/reports/milestone-tracker');
            } catch (error) {
                console.error('Connect Goals milestone navigation:', error);
                const status = document.getElementById('connectNavigationStatus');
                status.hidden = false;
                status.textContent = 'Could not open the scoped milestone report. ' + error.message;
            }
        };

        const canvas = document.getElementById('connectU2cChart');
        if (!canvas || !config.u2c.trend.length) return;
        const points = config.u2c.trend;
        const chart = new global.Chart(canvas, {
            type: 'line',
            data: {
                labels: points.map(point => point.label),
                datasets: [{
                    label: 'Committed ACR %', data: points.map(point => point.u2c_pct),
                    fill: true, pointRadius: 3, pointHoverRadius: 5, tension: .18,
                }, {
                    label: config.u2c.target + '% goal',
                    data: points.map(() => config.u2c.target),
                    borderDash: [6, 5], pointRadius: 0, fill: false,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                scales: {
                    x: {grid: {display: false}, ticks: {}},
                    y: {
                        beginAtZero: true, suggestedMax: Math.max(50, config.u2c.value + 10),
                        ticks: {callback: value => value + '%'}, grid: {},
                    },
                },
                plugins: {
                    colors: {enabled: false},
                    legend: {position: 'bottom', align: 'start', labels: {}},
                },
            },
        });

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
            chart.data.datasets[0].borderColor = line;
            chart.data.datasets[0].pointBackgroundColor = line;
            chart.data.datasets[0].pointBorderColor = line;
            chart.data.datasets[0].backgroundColor =
                line.replace('rgb(', 'rgba(').replace(')', ', .10)');
            chart.data.datasets[1].borderColor = ink;
            chart.data.datasets[1].backgroundColor = 'transparent';
            chart.options.plugins.legend.labels.color = ink;
            for (const axis of ['x', 'y']) {
                chart.options.scales[axis].ticks.color = ink;
                chart.options.scales[axis].grid.color = grid;
            }
            chart.update('none');
        }
        applyChartTheme();
        new global.MutationObserver(applyChartTheme).observe(document.documentElement, {
            attributes: true, attributeFilter: ['data-sb-mode', 'data-sb-family'],
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else init();
})(typeof window === 'undefined' ? globalThis : window);
