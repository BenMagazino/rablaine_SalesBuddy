/** Native seller disclosure and per-history-entry reading context. */
(() => {
    'use strict';
    async function activate(id) {
        const response = await fetch('/api/seller-mode/activate/' + id, {method: 'POST'});
        const result = await response.json();
        if (!response.ok || result.seller_mode !== true || result.seller_id !== Number(id)) {
            throw new Error(result.error || 'The server did not confirm seller mode.');
        }
        return result;
    }
    function validateReading(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0 ||
                !Array.isArray(value.expanded) ||
                !value.expanded.every(id => typeof id === 'string')) {
            throw new Error('Invalid seller directory reading context.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {activate, validateReading};
    if (typeof document === 'undefined') return;
    const root = document.querySelector('[data-sellers-directory]');
    if (!root) return;
    const reading = root.querySelector('.sb-sellers-reading');
    const records = [...root.querySelectorAll('[data-seller-id]')];
    const toggle = root.querySelector('#toggleAllBtn');
    const notice = root.querySelector('.sb-seller-notice');
    let restoring = false, pending = false;
    function report(message) {
        notice.textContent = message;
        notice.hidden = !message;
    }
    function updateToggle() {
        const expanded = records.length > 0 && records.every(record => record.open);
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.querySelector('span').textContent = expanded ? 'Collapse All' : 'Expand All';
        toggle.querySelector('i').className = expanded ?
            'bi bi-arrows-collapse' : 'bi bi-arrows-expand';
    }
    function save() {
        if (restoring) return;
        history.replaceState({...history.state, sbSellersDirectory: {
            top: reading.scrollTop, left: reading.scrollLeft,
            expanded: records.filter(record => record.open).map(record => record.dataset.sellerId),
        }}, '');
    }
    function restore() {
        restoring = true;
        try {
            const saved = history.state?.sbSellersDirectory;
            if (saved) {
                validateReading(saved);
                records.forEach(record => { record.open = saved.expanded.includes(
                    record.dataset.sellerId); });
                reading.scrollTop = saved.top;
                reading.scrollLeft = saved.left;
            }
        } catch (error) { report(error.message); }
        updateToggle();
        restoring = false;
    }
    restore();
    records.forEach(record => record.addEventListener('toggle', () => {
        updateToggle(); save();
    }));
    toggle.addEventListener('click', () => {
        const expand = records.some(record => !record.open);
        records.forEach(record => { record.open = expand; });
        updateToggle(); save();
    });
    root.addEventListener('click', async event => {
        const button = event.target.closest('[data-view-as]');
        if (button) {
            event.preventDefault();
            if (pending) return;
            pending = true;
            root.querySelectorAll('[data-view-as]').forEach(item => { item.disabled = true; });
            save();
            try {
                await activate(button.dataset.viewAs);
                pending = false;
                window.location.assign('/');
            } catch (error) {
                report('Seller mode was not activated. ' + error.message);
                pending = false;
                root.querySelectorAll('[data-view-as]').forEach(item => { item.disabled = false; });
            }
            return;
        }
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey || event.target.closest('a,button,summary')) return;
        const row = event.target.closest('[data-customer-href]');
        if (row && !pending) { save(); window.location.assign(row.dataset.customerHref); }
    });
    document.addEventListener('click', event => {
        if (!event.target.closest('a[href]') || event.defaultPrevented) return;
        if (pending) { event.preventDefault(); report('Wait for seller mode before leaving.'); }
        else save();
    }, true);
    window.addEventListener('beforeunload', event => {
        if (!pending) return;
        event.preventDefault(); event.returnValue = '';
    });
    reading.addEventListener('scroll', save, {passive: true});
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', restore);
})();
