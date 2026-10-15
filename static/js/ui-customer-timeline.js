/** Source-dated customer history, loaded only when its desktop rail is visible. */
((window) => {
    'use strict';
    const DAY = 86400000;

    function layoutEvents(events) {
        return events.map((event, index) => {
            const date = new Date(event.at);
            if (!Number.isFinite(date.getTime())) throw new Error('Invalid customer history date.');
            const older = events[index + 1];
            const days = older ? Math.max(0, Math.floor((date - new Date(older.at)) / DAY)) : 0;
            const previous = events[index - 1];
            return {...event, date, days, gap: Math.min(112, days * 3),
                year: !previous || new Date(previous.at).getFullYear() !== date.getFullYear(),
                showDate: !previous || new Date(previous.at).toDateString() !== date.toDateString()};
        });
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = {layoutEvents};
    if (!window.document) return;
    const root = document.currentScript.closest('[data-sb-customer-detail]');
    const rail = root?.querySelector('[data-customer-timeline]');
    if (!rail || rail.dataset.mounted) return;
    rail.dataset.mounted = 'true';
    const list = rail.querySelector('.ct-events');
    const message = rail.querySelector('.ct-message');
    const more = rail.querySelector('.ct-more');
    const source = rail.querySelector('.ct-source-note');
    const scroll = rail.querySelector('.ct-scroll');
    const preview = rail.querySelector('.ct-preview');
    preview.id = 'customerHistoryPreview-' + root.dataset.sbCustomerDetail;
    const media = window.matchMedia('(min-width: 1712px)');
    let events = [], nextOffset = 0, loading = false, loaded = false, failed = false;
    const dateTime = new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'});

    function closePreview() {
        if (preview.matches(':popover-open')) preview.hidePopover();
    }
    function showPreview(event, anchor) {
        preview.querySelector('.ct-preview-label').textContent = event.label;
        preview.querySelector('strong').textContent = event.title;
        preview.querySelector('p').textContent = event.summary;
        preview.querySelector('time').textContent = dateTime.format(event.date);
        preview.showPopover();
        const box = anchor.getBoundingClientRect(), size = preview.getBoundingClientRect();
        preview.style.left = Math.max(12, box.left - size.width - 12) + 'px';
        preview.style.top = Math.max(12, Math.min(box.top - 12,
            window.innerHeight - size.height - 12)) + 'px';
    }
    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function render() {
        const top = scroll.scrollTop, fragment = document.createDocumentFragment();
        for (const event of layoutEvents(events)) {
            if (event.year) fragment.append(element('li', 'ct-year', event.date.getFullYear()));
            const row = element('li', 'ct-event');
            row.dataset.kind = event.kind;
            row.style.setProperty('--ct-gap', Math.max(4, event.gap) + 'px');
            const time = element('time', '', event.showDate
                ? event.date.toLocaleDateString(undefined, {month: 'short'}) : '');
            time.dateTime = event.at;
            if (event.showDate) time.append(element('span', '', event.date.getDate()));
            const marker = element('a', 'ct-marker');
            marker.href = event.href;
            marker.setAttribute('aria-label', `${event.label}: ${event.title}, ` +
                dateTime.format(event.date));
            marker.setAttribute('aria-describedby', preview.id);
            const text = element('div', 'ct-event-text');
            text.append(element('small', '', event.label));
            const title = element('a', 'ct-event-title', event.title);
            title.href = event.href;
            title.tabIndex = -1;
            for (const link of [marker, title]) {
                link.addEventListener('mouseenter', () => showPreview(event, marker));
                link.addEventListener('mouseleave', closePreview);
                link.addEventListener('focus', () => showPreview(event, marker));
                link.addEventListener('blur', closePreview);
                link.addEventListener('click', closePreview);
            }
            text.append(title);
            if (event.days >= 7) text.append(element('span', 'ct-gap',
                `${event.days} days between recorded events`));
            row.append(time, marker, text);
            fragment.append(row);
        }
        list.replaceChildren(fragment);
        scroll.scrollTop = top;
    }
    async function load() {
        if (loading || (!failed && loaded && nextOffset === null)) return;
        loading = true;
        more.disabled = true;
        message.hidden = false;
        message.setAttribute('role', 'status');
        message.textContent = 'Loading customer history...';
        try {
            const response = await window.fetch(
                rail.dataset.customerTimeline + '?offset=' + nextOffset);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Customer history could not be loaded.');
            if (!Array.isArray(data.events) || data.events.some(event =>
                typeof event.title !== 'string' || typeof event.at !== 'string'
                || !/^\/(note|engagement|opportunity|milestone)\/\d+$/.test(event.href))) {
                throw new Error('Customer history returned an invalid response.');
            }
            const combined = [...events, ...data.events];
            layoutEvents(combined);
            events = combined;
            nextOffset = data.next_offset;
            loaded = true;
            failed = false;
            closePreview();
            render();
            message.textContent = events.length ? '' : 'No recorded activity for this customer yet.';
            message.hidden = events.length > 0;
            source.hidden = !data.undated_opportunities;
            source.textContent = `${data.undated_opportunities} opportunity creation dates ` +
                'will appear after those records refresh from MSX.';
            more.hidden = nextOffset === null;
            more.textContent = 'Show older events';
        } catch (error) {
            console.error('Customer history failed', error);
            failed = true;
            message.setAttribute('role', 'alert');
            message.textContent = error.message || 'Customer history could not be loaded.';
            more.hidden = false;
            more.textContent = 'Retry';
        } finally {
            loading = false;
            more.disabled = false;
        }
    }
    more.addEventListener('click', load);
    scroll.addEventListener('scroll', closePreview, {passive: true});
    rail.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePreview();
    });
    media.addEventListener('change', () => {
        closePreview();
        if (media.matches && !loaded) load();
    });
    window.addEventListener('pagehide', closePreview);
    window.addEventListener('resize', closePreview);
    if (media.matches) load();
})(typeof window === 'undefined' ? {} : window);
