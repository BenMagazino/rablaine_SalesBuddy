(function (global) {
    'use strict';
    const DATE_KEY = 'connectImpactSinceDate';

    function validDate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
    }

    function initialDate(explicit, rendered, saved) {
        if (!validDate(rendered)) throw new Error('Invalid report start date.');
        return !explicit && validDate(saved) ? saved : rendered;
    }

    function validateView(value, since) {
        if (!value || typeof value !== 'object' || Array.isArray(value)
            || !validDate(value.since)
            || (value.selected !== null && (typeof value.selected !== 'string'
                || !/^[1-9]\d*$/.test(value.selected)))
            || !Number.isFinite(value.listScroll) || value.listScroll < 0
            || !Number.isFinite(value.detailScroll) || value.detailScroll < 0) {
            throw new Error('Invalid saved Connect Impact view.');
        }
        return value.since === since ? value : null;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {validDate, initialDate, validateView};
    }
    if (!global.document) return;

    function init() {
        const root = document.querySelector('[data-sb-impact]');
        if (!root) return;
        const embedded = root.dataset.embedded === 'true';
        const since = root.dataset.since;
        const input = root.querySelector('#impactSinceDate');
        const preset = root.querySelector('#impactDatePreset');
        const notice = root.querySelector('.sb-impact-notice');
        const url = new URL(global.location.href);

        function warn(message, error) {
            if (error) console.error('Connect Impact:', error);
            notice.textContent = message;
            notice.hidden = false;
        }

        if (!embedded) {
            let saved = null;
            try {
                saved = global.localStorage.getItem(DATE_KEY);
            } catch (error) {
                warn('Could not read the saved start date. Showing the report date.', error);
            }
            const target = initialDate(url.searchParams.has('since'), since, saved);
            if (target !== since) {
                url.searchParams.set('since', target);
                try {
                    global.location.replace(url.href);
                    return;
                } catch (error) {
                    warn('Could not open the saved date. Select a start date to retry.', error);
                }
            }
            if ((url.searchParams.has('since') && !validDate(url.searchParams.get('since')))
                || (!url.searchParams.has('since') && saved && !validDate(saved))) {
                warn('Invalid start date format. Showing the report date, ' + since + '.');
            }
            try {
                global.localStorage.setItem(DATE_KEY, since);
            } catch (error) {
                warn('Could not remember the start date. The current report is unchanged.', error);
            }
            // Pin the effective scope so Back cannot redirect through a newer saved preference.
            url.searchParams.set('since', since);
            try {
                global.history.replaceState(global.history.state, '', url.href);
            } catch (error) {
                warn('Could not preserve the date scope for Back navigation.', error);
            }
        }

        const rows = Array.from(root.querySelectorAll('#impactCustomers tbody tr'));
        const details = Array.from(root.querySelectorAll('[data-impact-customer]'));
        const listReading = root.querySelector('.sb-impact-list-reading');
        const detailReading = root.querySelector('.sb-impact-detail-reading');
        const status = document.querySelector('[data-impact-status]');
        let selected = rows[0]?.dataset.customerId || null;
        if (rows.length) global.SBTableSort.create(root.querySelector('#impactCustomers'));

        function select(id, resetScroll = true) {
            selected = rows.some(row => row.dataset.customerId === id)
                ? id : rows[0]?.dataset.customerId || null;
            rows.forEach(row => {
                const active = row.dataset.customerId === selected;
                row.dataset.selected = String(active);
                row.querySelector('[data-impact-select]').setAttribute('aria-pressed',
                    String(active));
            });
            details.forEach(detail => {
                detail.hidden = detail.dataset.impactCustomer !== selected;
                if (!detail.hidden) {
                    detail.querySelector('[data-impact-table]').dataset.sbSortable = '';
                    global.SBTableSort.mount(detail);
                }
            });
            if (resetScroll && detailReading) detailReading.scrollTop = 0;
            const name = rows.find(row => row.dataset.customerId === selected)?.dataset.customerName;
            if (status) status.textContent = rows.length + ' customers'
                + (name ? ' | ' + name : '') + ' | Committed since ' + since;
        }

        function restoreDateControls() {
            input.value = since;
            preset.value = Array.from(preset.options).some(option => option.value === since)
                ? since : '';
        }

        function save() {
            restoreDateControls();
            if (embedded) return;
            try {
                global.history.replaceState({...global.history.state, sbImpact: {
                    since, selected, listScroll: listReading?.scrollTop || 0,
                    detailScroll: detailReading?.scrollTop || 0,
                }}, '');
            } catch (error) {
                warn('Could not preserve the customer view for Back navigation.', error);
            }
        }

        function applyDate(wanted) {
            restoreDateControls();
            if (!validDate(wanted)) {
                warn('Choose a valid start date. The report still starts on ' + since + '.');
                return;
            }
            if (!embedded) {
                try {
                    global.localStorage.setItem(DATE_KEY, wanted);
                } catch (error) {
                    warn('Could not remember the new date. Applying it for this visit only.', error);
                }
            }
            save();
            const next = new URL(global.location.href);
            next.searchParams.set('since', wanted);
            try {
                global.location.assign(next.href);
            } catch (error) {
                warn('Could not open the requested date. Select it again to retry.', error);
            }
        }
        input.addEventListener('change', () => applyDate(input.value));
        preset.addEventListener('change', () => {
            if (preset.value) applyDate(preset.value);
            else {
                restoreDateControls();
                input.focus();
            }
        });
        root.addEventListener('click', event => {
            const choose = event.target.closest('[data-impact-select]');
            if (choose) select(choose.dataset.impactSelect);
            const preview = event.target.closest('[data-impact-preview]');
            if (preview) global.SBMilestonePreview.open(Number(preview.dataset.impactPreview));
        });
        global.addEventListener('pagehide', save);
        global.addEventListener('pageshow', restoreDateControls);
        document.addEventListener('click', event => {
            if (event.target.closest('a[href]')) save();
        }, true);
        let savedView = null;
        try {
            if (!embedded && global.history.state?.sbImpact) {
                savedView = validateView(global.history.state.sbImpact, since);
            }
        } catch (error) {
            warn('Could not restore the saved customer view.', error);
        }
        select(savedView?.selected || selected);
        if (savedView && listReading) {
            listReading.scrollTop = savedView.listScroll;
            detailReading.scrollTop = savedView.detailScroll;
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, {once: true});
    } else {
        init();
    }
})(typeof window === 'undefined' ? globalThis : window);
