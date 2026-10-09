/** Engagement directory presentation over the unchanged all-engagements provider. */
(() => {
    'use strict';
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char =>
            ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
    }
    function selectItems(data, state) {
        const order = new Map(data.map((item, index) => [item.id, index]));
        return data.filter(item => (!state.filter || item.status === state.filter) &&
            (!state.favoritesOnly || item.is_favorited)).sort((a, b) => {
            if (a.is_favorited !== b.is_favorited) return a.is_favorited ? -1 : 1;
            if (state.sort === 'story-asc' || state.sort === 'story-desc') {
                return ((a.story_completeness || 0) - (b.story_completeness || 0)) *
                    (state.sort === 'story-asc' ? 1 : -1);
            }
            if (state.sort === 'target' || state.sort === 'target-desc') {
                if (!a.target_date || !b.target_date) {
                    return a.target_date === b.target_date ? 0 : !a.target_date ? 1 : -1;
                }
                return a.target_date.localeCompare(b.target_date) *
                    (state.sort === 'target' ? 1 : -1);
            }
            // The provider supplies exact updated_at DESC order, including sub-day values.
            return (order.get(a.id) - order.get(b.id)) *
                (state.sort === 'updated-asc' ? -1 : 1);
        });
    }
    function groupItems(items, grouped, showSeller) {
        if (!grouped) return [{items}];
        const sellers = new Map();
        for (const item of items) {
            const seller = showSeller ? (item.seller_name || 'Unassigned') : '';
            if (!sellers.has(seller)) sellers.set(seller, new Map());
            const customers = sellers.get(seller), key = item.customer_id || 0;
            if (!customers.has(key)) customers.set(key, {seller, customer: item, items: []});
            customers.get(key).items.push(item);
        }
        return [...sellers.values()].flatMap(customers => [...customers.values()]);
    }
    function dateLabel(raw, calendar = false) {
        if (!raw) return '-';
        const date = new Date(calendar ? raw + 'T00:00:00' : raw);
        return Number.isNaN(date.getTime()) ? '-' :
            date.toLocaleDateString('en-US', {month: 'short', day: 'numeric',
                ...(calendar ? {year: 'numeric'} : {})});
    }
    function rowHtml(item, sellerScope = false) {
        const e = escapeHtml;
        const tone = {Active: 'success', 'On Hold': 'warning', Won: 'accent', Lost: ''};
        const story = item.story_completeness || 0;
        const storyTone = story >= 80 ? 'success' : story >= 40 ? 'warning' : 'danger';
        const rawCell = (raw, label) =>
            `<td data-sb-sort-value="${e(raw)}">${e(label)}</td>`;
        const noteKey = item.latest_note_date ? Date.parse(item.latest_note_date) : '';
        const customer = item.customer_nickname || item.customer_name;
        const favicon = item.customer_favicon ?
            `<img src="data:image/png;base64,${e(item.customer_favicon)}" width="12" height="12" alt="">` :
            '<i class="bi bi-building" aria-hidden="true"></i>';
        return `<tr data-engagement-id="${e(item.id)}">
            <td data-sb-sort-value="${e(item.title)}"><a class="sb-eng-title" href="/engagement/${e(item.id)}">${e(item.title)}</a></td>
            <td data-sb-sort-value="${e(customer + ' ' + (item.seller_name || ''))}">${favicon} <a href="/customer/${e(item.customer_id)}">${e(customer)}</a>${item.seller_name ? `<small class="sb-eng-seller-tag"><i class="bi bi-person" aria-hidden="true"></i> ${e(item.seller_name)}</small>` : ''}</td>
            <td data-sb-sort-value="${e(item.status)}"><span class="sb-eng-tag" data-tone="${tone[item.status] || ''}">${e(item.status)}</span></td>
            <td data-sb-sort-value="${story}"><span data-tone="${storyTone}">${story}%</span><span class="sb-eng-story-bar" aria-hidden="true"><span data-tone="${storyTone}" style="width:${story}%"></span></span></td>
            ${rawCell(item.estimated_acr ?? '', item.estimated_acr ? '$' + Number(item.estimated_acr).toLocaleString() : '-')}
            ${rawCell(item.target_date || '', dateLabel(item.target_date, true))}
            ${rawCell(Number.isFinite(noteKey) ? noteKey : '', dateLabel(item.latest_note_date))}
            ${sellerScope ? '' : rawCell(item.open_action_item_count || 0, item.open_action_item_count || 0)}
            ${rawCell(item.linked_note_count || 0, item.linked_note_count || 0)}
            ${rawCell(item.opportunity_count || 0, item.opportunity_count || 0)}
            ${rawCell(item.milestone_count || 0, item.milestone_count || 0)}
            <td><button type="button" class="sb-eng-favorite" data-eng-favorite="${e(item.id)}" aria-label="${item.is_favorited ? 'Remove from' : 'Add to'} favorites: ${e(item.title)}" title="${item.is_favorited ? 'Remove from' : 'Add to'} favorites"><i class="bi bi-star${item.is_favorited ? '-fill' : ''}" aria-hidden="true"></i></button></td>
        </tr>`;
    }
    function tableHtml(groups, key, sellerScope = false) {
        const columns = [['Engagement', 'text'], ['Customer / seller', 'text'],
            ['Status', 'text'], ['Story', 'number'], ['ACR/mo', 'number'],
            ['Target', 'date'], ['Latest note', 'number'], ['Tasks', 'number'],
            ['Notes', 'number'], ['Opps', 'number', 'Opportunities'],
            ['MS', 'number', 'Milestones'], ['Star', null, 'Favorite']];
        if (sellerScope) {
            columns[1][0] = 'Customer';
            columns.splice(7, 1);
        }
        let lastSeller = null;
        const bodies = groups.map(group => {
            let heading = '';
            if (group.customer) {
                if (group.seller && group.seller !== lastSeller) {
                    heading += `<tr data-sb-sort-fixed><td colspan="${columns.length}" class="sb-eng-seller"><i class="bi bi-person" aria-hidden="true"></i> ${escapeHtml(group.seller)}</td></tr>`;
                    lastSeller = group.seller;
                }
                const customer = group.customer;
                heading += `<tr data-sb-sort-fixed><td colspan="${columns.length}" class="sb-eng-customer"><a href="/customer/${escapeHtml(customer.customer_id)}">${escapeHtml(customer.customer_nickname || customer.customer_name)}</a><span>${group.items.length}</span></td></tr>`;
            }
            return `<tbody data-eng-customer="${group.customer?.customer_id || ''}" data-eng-seller="${escapeHtml(group.seller || '')}">${heading}${group.items.map(item => rowHtml(item, sellerScope)).join('')}</tbody>`;
        }).join('');
        return `<table class="sb-eng-table" data-sb-sortable data-sb-sort-key="${escapeHtml(key)}"><thead><tr>${columns.map(([label, type, full]) => `<th scope="col" title="${full || label}" data-export-label="${full || label}"${type ? ` data-sb-sort-type="${type}"` : ''}>${label}</th>`).join('')}</tr></thead>${bodies}</table>`;
    }
    if (typeof module !== 'undefined') module.exports = {
        escapeHtml, selectItems, groupItems, rowHtml, tableHtml, dateLabel,
    };
    if (typeof document === 'undefined') return;

    function mount() {
        const root = document.querySelector('[data-eng-directory]');
        if (!root || root.dataset.mounted) return;
        root.dataset.mounted = 'true';
        const id = root.dataset.bodyId, body = document.getElementById(id);
        const reading = document.querySelector('.sb-eng-reading');
        const storageKey = 'eng_panel_' + id;
        const sortSelect = document.getElementById(id + '_sortSelect');
        const groupButton = document.getElementById(id + '_groupToggle');
        const favoriteButton = document.getElementById(id + '_favoritesBtn');
        let data = [], restoring = true, generation = 0;
        const pending = new Set();
        const state = {filter: '', sort: 'updated', group: root.dataset.showSeller === 'true',
            favoritesOnly: false};
        function warn(message, error) {
            console.error(message, error);
            const notice = document.getElementById('engDirectoryNotice');
            notice.textContent = message; notice.hidden = false;
        }
        function save() {
            if (restoring) return;
            try {
                localStorage.setItem(storageKey, JSON.stringify(state));
                history.replaceState({...history.state, sbEngDirectory: {
                    ...state, top: reading.scrollTop, left: reading.scrollLeft,
                }}, '');
            } catch (error) { warn('Could not save engagement reading context for Back.', error); }
        }
        function render() {
            root.querySelectorAll('[data-status]').forEach(button =>
                button.setAttribute('aria-pressed', String(button.dataset.status === state.filter)));
            sortSelect.value = state.sort;
            groupButton.setAttribute('aria-pressed', String(state.group));
            favoriteButton.setAttribute('aria-pressed', String(state.favoritesOnly));
            const items = selectItems(data, state);
            document.getElementById(root.dataset.countId).textContent =
                items.length + ' shown / ' + data.length + ' total';
            body.innerHTML = items.length ? tableHtml(groupItems(items, state.group,
                root.dataset.showSeller === 'true'), id + (state.group ? '-grouped' : '-flat'),
                root.dataset.sellerScope === 'true') :
                `<p class="sb-eng-empty">${escapeHtml(root.dataset.emptyMsg)}</p>`;
            body.querySelectorAll('[data-eng-favorite]').forEach(button => {
                button.disabled = pending.has(button.dataset.engFavorite);
            });
            window.SBTableSort?.mount(body);
        }
        function restore(saved) {
            if (!saved || typeof saved !== 'object') return;
            if (['', 'Active', 'On Hold', 'Won', 'Lost'].includes(saved.filter)) {
                state.filter = saved.filter;
            }
            if ([...sortSelect.options].some(option => option.value === saved.sort)) {
                state.sort = saved.sort;
            }
            if (typeof saved.group === 'boolean') state.group = saved.group;
            if (typeof saved.favoritesOnly === 'boolean') state.favoritesOnly = saved.favoritesOnly;
        }
        try {
            restore(JSON.parse(localStorage.getItem(storageKey) || '{}'));
            restore(history.state?.sbEngDirectory);
        } catch (error) { warn('Could not restore the saved engagement filters.', error); }
        async function load() {
            const version = ++generation;
            body.innerHTML = '<p class="sb-eng-empty" role="status">Loading engagements...</p>';
            try {
                const response = await fetch(root.dataset.apiUrl);
                if (!response.ok) throw new Error('Engagement HTTP ' + response.status);
                const result = await response.json();
                if (!result.success || !Array.isArray(result.engagements)) {
                    throw new Error('Invalid engagement response.');
                }
                if (version !== generation) return;
                data = result.engagements;
                document.getElementById('engDirectoryNotice').hidden = true;
                render();
                const saved = history.state?.sbEngDirectory;
                if (saved) {
                    reading.scrollTop = Number.isFinite(saved.top) ? saved.top : 0;
                    reading.scrollLeft = Number.isFinite(saved.left) ? saved.left : 0;
                }
            } catch (error) {
                if (version !== generation) return;
                body.innerHTML = '<p class="sb-eng-empty" role="alert">Error loading engagements. <button class="sb-eng-command" type="button" data-eng-retry>Retry</button></p>';
                warn('Engagements could not be loaded.', error);
            } finally { restoring = false; }
        }
        root.addEventListener('click', event => {
            const status = event.target.closest('[data-status]');
            if (status) state.filter = status.dataset.status;
            else if (event.target.closest('#' + groupButton.id)) state.group = !state.group;
            else if (event.target.closest('#' + favoriteButton.id)) {
                state.favoritesOnly = !state.favoritesOnly;
            } else return;
            render(); save();
        });
        sortSelect.addEventListener('change', () => {
            state.sort = sortSelect.value;
            // Explicit order commands replace any remembered header sort.
            const sorts = {...history.state?.sbTableSort};
            delete sorts[id + '-flat']; delete sorts[id + '-grouped'];
            history.replaceState({...history.state, sbTableSort: sorts}, '');
            render(); save();
        });
        body.addEventListener('click', async event => {
            if (event.target.closest('[data-eng-retry]')) { load(); return; }
            const button = event.target.closest('[data-eng-favorite]');
            if (!button || button.disabled || pending.has(button.dataset.engFavorite)) return;
            button.disabled = true;
            pending.add(button.dataset.engFavorite);
            try {
                const response = await fetch('/api/engagement/' + button.dataset.engFavorite +
                    '/favorite', {method: 'POST'});
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error('Favorite could not be saved.');
                const item = data.find(item => String(item.id) === button.dataset.engFavorite);
                item.is_favorited = result.is_favorited;
                document.getElementById('engDirectoryNotice').hidden = true;
                if (state.favoritesOnly && !result.is_favorited) {
                    const top = reading.scrollTop;
                    render(); reading.scrollTop = top; save();
                } else {
                    const current = body.querySelector(
                        `[data-eng-favorite="${button.dataset.engFavorite}"]`) || button;
                    current.querySelector('i').className =
                        'bi bi-star' + (result.is_favorited ? '-fill' : '');
                    current.title = (result.is_favorited ? 'Remove from' : 'Add to') + ' favorites';
                    current.setAttribute('aria-label', current.title + ': ' + item.title);
                }
            } catch (error) {
                warn('Favorite was not saved. Try again.', error);
            } finally {
                pending.delete(button.dataset.engFavorite);
                button.disabled = false;
                const current = body.querySelector(
                    `[data-eng-favorite="${button.dataset.engFavorite}"]`);
                if (current) current.disabled = false;
            }
        });
        document.addEventListener('click', event => {
            if (!pending.size || !event.target.closest('a[href], [data-sb-dialog]')) return;
            event.preventDefault(); event.stopImmediatePropagation();
            warn('Wait for the favorite save to finish before leaving.', null);
        }, true);
        window.addEventListener('beforeunload', event => {
            if (!pending.size) return;
            event.preventDefault(); event.returnValue = '';
        });
        reading.addEventListener('scroll', save, {passive: true});
        window.addEventListener('pagehide', save);
        window.addEventListener('pageshow', event => {
            if (event.persisted) {
                const saved = history.state?.sbEngDirectory;
                if (saved) {
                    reading.scrollTop = saved.top || 0;
                    reading.scrollLeft = saved.left || 0;
                }
            }
        });
        window['engLoad_' + id] = load;
        if (root.dataset.autoLoad !== 'false') load();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, {once: true});
    } else mount();
})();
