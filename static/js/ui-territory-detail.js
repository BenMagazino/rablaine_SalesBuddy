/** Preserve territory reading context and the explicit saved view preference. */
((window) => {
    'use strict';
    function validateHistory(value, id, mode) {
        if (!value || value.id !== id || value.mode !== mode
            || !['accounts', 'notes'].includes(mode) || !value.scrolls
            || typeof value.scrolls !== 'object' || Array.isArray(value.scrolls)
            || Object.entries(value.scrolls).some(([key, offset]) =>
                !['sellers', 'work'].includes(key) || !Number.isFinite(offset) || offset < 0)) {
            throw new Error('Invalid territory reading history.');
        }
        return value;
    }
    async function savePreference(fetcher, accounts) {
        const response = await fetcher('/api/preferences/territory-view', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({territory_view_accounts: accounts}),
        });
        const data = await response.json();
        if (!response.ok || data.territory_view_accounts !== accounts) {
            throw new Error(data.error || 'The territory view was not saved.');
        }
        return data;
    }
    if (typeof module !== 'undefined') module.exports = {validateHistory, savePreference};
    if (!window.document) return;

    function mount() {
        const root = document.querySelector('[data-sb-territory-detail]');
        if (!root || root.dataset.mounted) return;
        root.dataset.mounted = 'true';
        const id = Number(root.dataset.sbTerritoryDetail), mode = root.dataset.tdMode;
        const regions = [...root.querySelectorAll('[data-td-scroll]')];
        const radios = [...root.querySelectorAll('input[name="territoryViewToggle"]')];
        const notice = root.querySelector('[data-td-notice]');
        const status = root.querySelector('[data-td-status]');
        let pending = false;
        function warn(message, error) {
            console.error(message, error);
            notice.textContent = message;
            notice.hidden = false;
        }
        function save() {
            try {
                history.replaceState({...history.state, sbTerritoryDetail: {
                    id, mode, scrolls: Object.fromEntries(regions.map(node =>
                        [node.dataset.tdScroll, node.scrollTop])),
                }}, '');
            } catch (error) { warn('Could not remember territory reading context for Back.', error); }
        }
        function restore() {
            const saved = history.state?.sbTerritoryDetail;
            if (!saved || saved.id !== id || saved.mode !== mode) return;
            try {
                validateHistory(saved, id, mode);
                SBTableSort.mount(root);
                regions.forEach(node => { node.scrollTop = saved.scrolls[node.dataset.tdScroll] || 0; });
            } catch (error) { warn('Could not restore territory reading context.', error); }
        }
        SBTableSort.mount(root);
        restore();
        regions.forEach(node => node.addEventListener('scroll', save, {passive: true}));
        window.addEventListener('pagehide', save);
        window.addEventListener('pageshow', restore);
        window.addEventListener('beforeunload', event => {
            if (!pending) return;
            event.preventDefault();
            event.returnValue = '';
        });
        radios.forEach(radio => radio.addEventListener('change', async () => {
            if (!radio.checked || pending) return;
            save();
            pending = true;
            notice.hidden = true;
            radios.forEach(input => { input.disabled = true; });
            status.textContent = 'Saving view...';
            try {
                await savePreference(window.fetch.bind(window), radio.id === 'viewAccounts');
                pending = false;
                window.location.reload();
            } catch (error) {
                pending = false;
                radios.forEach(input => {
                    input.disabled = false;
                    input.checked = input.value === mode;
                });
                status.textContent = '';
                warn('Could not save the territory view. Your current view is unchanged. Try again.', error);
            }
        }));
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, {once: true});
    } else mount();
})(typeof window === 'undefined' ? {} : window);
