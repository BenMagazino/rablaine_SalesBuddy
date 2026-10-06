/** Native U2C report preferences, chart colors and owned reading history. */
(function(root) {
    'use strict';
    const columns = ['customer', 'milestone', 'workload', 'due_date', 'acr', 'status'];

    function validateSort(value) {
        if (!value || !columns.includes(value.column) ||
            !['asc', 'desc'].includes(value.direction)) throw new Error('Invalid U2C sort');
        return {column: value.column, direction: value.direction};
    }

    function validateFilters(value) {
        if (!value || !['seller', 'customer'].every(key =>
            typeof value[key] === 'string' && /^(|[1-9]\d*)$/.test(value[key]))) {
            throw new Error('Invalid U2C filters');
        }
        return {seller: value.seller, customer: value.customer};
    }

    function validateReading(value) {
        if (!value || !Number.isFinite(value.scroll) || value.scroll < 0 ||
            !Array.isArray(value.composers) || value.composers.some(item =>
                !item || !/^u2cAgendaComposer[1-9]\d*$/.test(item.id) ||
                typeof item.text !== 'string')) throw new Error('Invalid U2C reading state');
        return {scroll: value.scroll, composers: value.composers};
    }

    function reportError(message, error) {
        root.console.error(message, error);
        const notice = root.document.getElementById('u2cNavigationStatus');
        notice.hidden = false;
        notice.textContent = message;
    }

    function readPreference(key) {
        try { return root.localStorage.getItem(key); }
        catch (error) {
            reportError('Saved U2C preferences could not be read. Current controls still work.', error);
            return null;
        }
    }

    function writePreference(key, value) {
        try {
            if (value === null) root.localStorage.removeItem(key);
            else root.localStorage.setItem(key, value);
        } catch (error) {
            reportError('U2C preferences could not be saved. Current filters still apply.', error);
        }
    }

    let pixel;
    function chartColors() {
        const styles = root.getComputedStyle(root.document.documentElement);
        if (!pixel) {
            pixel = root.document.createElement('canvas');
            pixel.width = pixel.height = 1;
        }
        const context = pixel.getContext('2d', {willReadFrequently: true});
        function color(token) {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = styles.getPropertyValue(token).trim();
            context.fillRect(0, 0, 1, 1);
            const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
            return `rgb(${r}, ${g}, ${b})`;
        }
        return {
            muted: color('--sb-ui-muted'), grid: color('--sb-ui-grid-line'),
            text: color('--sb-ui-ink'), committed: color('--sb-ui-milestone-rail'),
            goal: color('--sb-ui-accent')
        };
    }

    function init() {
        const document = root.document;
        const surface = document.querySelector('.sb-u2c');
        if (!surface) return;
        const reading = document.getElementById('u2cReading');
        const embedded = surface.dataset.embedded === 'true';
        surface.querySelectorAll('th.sortable').forEach(header => {
            header.tabIndex = 0;
            header.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    header.click();
                }
            });
        });
        new root.MutationObserver(() => {
            if (typeof root.renderU2cTrend === 'function') {
                root.resetU2cTrendTheme();
            }
        }).observe(document.documentElement, {
            attributes: true, attributeFilter: ['data-sb-mode', 'data-sb-family']
        });
        if (embedded) return;

        function saveReading() {
            try {
                const value = {
                    scroll: reading.scrollTop,
                    composers: [...reading.querySelectorAll('.u2c-agenda-composer:not(.is-hidden)')]
                        .map(composer => ({
                            id: composer.id, text: composer.querySelector('textarea').value
                        }))
                };
                root.history.replaceState(
                    Object.assign({}, root.history.state, {sbU2c: value}), ''
                );
            } catch (error) { reportError('U2C reading position could not be saved.', error); }
        }
        function restoreReading() {
            if (!root.history.state?.sbU2c) return;
            try {
                const value = validateReading(root.history.state.sbU2c);
                value.composers.forEach(item => {
                    const composer = document.getElementById(item.id);
                    if (!composer) return;
                    composer.classList.remove('is-hidden');
                    composer.querySelector('textarea').value = item.text;
                    composer.parentElement.querySelector('.js-u2c-agenda-toggle')
                        .setAttribute('aria-expanded', 'true');
                });
                reading.scrollTop = value.scroll;
            } catch (error) { reportError('U2C reading position could not be restored.', error); }
        }
        root.requestAnimationFrame(restoreReading);
        root.addEventListener('pageshow', () => root.requestAnimationFrame(restoreReading));
        root.addEventListener('pagehide', saveReading);
    }

    const api = {validateSort, validateFilters, validateReading,
        reportError, readPreference, writePreference, chartColors};
    root.SBU2c = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root.document) {
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', init, {once: true});
        } else init();
    }
})(typeof window === 'undefined' ? globalThis : window);
