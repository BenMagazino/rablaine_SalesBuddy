/** Native seller filtering and per-entry workspace-directory reading context. */
(function(root) {
    'use strict';
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

    function validateView(value) {
        if (!record(value) || typeof value.filter !== 'string'
            || !record(value.scroll) || Object.keys(value.scroll).length !== 3
            || !['directory', 'launcher', 'sellers'].every(key =>
                Number.isFinite(value.scroll[key]) && value.scroll[key] >= 0)
            || !record(value.draft) || typeof value.draft.name !== 'string'
            || value.draft.name.length > 200
            || !['Manager', 'Other'].includes(value.draft.type)) {
            throw new Error('Invalid saved 1:1 workspace directory state.');
        }
        return value;
    }

    function filterSellers(links, value) {
        const query = value.trim().toLowerCase();
        let count = 0;
        for (const link of links) {
            link.hidden = !link.dataset.sellerName.includes(query);
            if (!link.hidden) count++;
        }
        return count;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {validateView, filterSellers};
    }
    if (!root.document) return;

    function init() {
        const document = root.document;
        const surface = document.querySelector('.sb-one-on-one-hub');
        if (!surface) return;
        const filter = document.getElementById('sellerWorkspaceFilter');
        const links = [...surface.querySelectorAll('[data-seller-name]')];
        const empty = document.getElementById('hubSellerEmpty');
        const regions = {
            directory: document.getElementById('hubDirectoryReading'),
            launcher: document.getElementById('hubLauncherReading'),
            sellers: document.getElementById('sellerLaunchList'),
        };
        const name = document.getElementById('hubPersonName');
        const type = document.getElementById('hubPersonType');

        function updateFilter() {
            const count = filterSellers(links, filter?.value ?? '');
            if (empty) empty.hidden = count !== 0;
            const status = document.getElementById('hubSellerStatus');
            if (status) status.textContent = count + ' of ' + links.length
                + ' sellers available to start';
        }
        if (filter) filter.addEventListener('input', updateFilter);
        updateFilter();
        if (surface.dataset.embedded === 'true') return;

        function warn(message, error) {
            root.console.error(message, error);
            const notice = document.getElementById('hubReadingNotice');
            notice.textContent = message;
            notice.hidden = false;
        }

        function save() {
            try {
                const value = {
                    filter: filter?.value ?? '',
                    scroll: Object.fromEntries(Object.entries(regions)
                        .map(([key, region]) => [key, region?.scrollTop ?? 0])),
                    draft: {name: name.value, type: type.value},
                };
                root.history.replaceState({...root.history.state, sbOneOnOneHub: value}, '');
            } catch (error) {
                warn('Could not save your workspace directory context for Back.', error);
            }
        }

        function restore() {
            if (root.history.state?.sbOneOnOneHub === undefined) return;
            try {
                const value = validateView(root.history.state.sbOneOnOneHub);
                if (filter) filter.value = value.filter;
                name.value = value.draft.name;
                type.value = value.draft.type;
                updateFilter();
                for (const [key, region] of Object.entries(regions)) {
                    if (region) region.scrollTop = value.scroll[key];
                }
            } catch (error) {
                warn('Could not restore your workspace directory context.', error);
            }
        }
        root.requestAnimationFrame(restore);
        root.addEventListener('pageshow', () => root.requestAnimationFrame(restore));
        root.addEventListener('pagehide', save);
    }

    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', init, {once: true});
    } else init();
})(typeof window === 'undefined' ? globalThis : window);
