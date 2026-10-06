const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/revenue-bucket-filter.js'), 'utf8');
const key = 'salesbuddy_revenue_bucket_filter';
const versionKey = 'salesbuddy_revenue_bucket_taxonomy_version';
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

async function fixture(options = {}) {
    const elements = [], requests = [], errors = [], events = {}, visible = [], faults = {};
    class Element {
        constructor(tag = 'div') {
            this.tag = tag; this.style = {}; this.dataset = {}; this.children = [];
            this.attributes = {}; this.handlers = {}; this.value = ''; this.textContent = '';
            this.hidden = false; this.checked = false; this.open = false;
            elements.push(this);
        }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        appendChild(child) { this.children.push(child); }
        replaceChildren() { this.children = []; }
        addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); }
        dispatch(name, extra = {}) {
            if (name === 'toggle') this.open = extra.newState === 'open';
            const event = {target: this, ...extra};
            let result;
            for (const callback of this.handlers[name] || []) result = callback(event);
            return result;
        }
        querySelectorAll(selector) {
            return this.children.flatMap(child => [
                ...(selector === child.tag ? [child] : []), ...child.querySelectorAll(selector),
            ]);
        }
        focus() { document.activeElement = this; }
        matches() { return this.open; }
        hidePopover() { this.dispatch('toggle', {newState: 'closed'}); }
        getBoundingClientRect() {
            return this.tag === 'button' ? {left: 1300, right: 1370, top: 50, bottom: 70} :
                {width: 280, height: 360};
        }
    }
    const rows = (options.buckets || ['A', 'B', 'C', 'D', 'E', 'F']).map(bucket => {
        const row = new Element(); row.dataset.bucket = bucket; return row;
    });
    const storage = new Map([[key, options.saved ?? '["A"]'], [versionKey, '0']]);
    if (options.version === null) storage.delete(versionKey);
    const container = new Element(), secondary = new Element();
    const document = {
        activeElement: null, createElement: tag => new Element(tag),
        getElementById: id => id === 'bucketFilterContainer' ? container :
            id === 'secondary' ? secondary : elements.find(element => element.id === id),
        querySelectorAll: selector => selector === '[data-bucket]' ? rows : [],
    };
    let replies = options.replies || {};
    const context = {document,
        window: {innerWidth: 1806, innerHeight: 1167,
            addEventListener: (name, handler) => { events[name] = handler; }},
        console: {error: (...args) => errors.push(args)},
        localStorage: {
            getItem: name => { if (faults.read) throw new Error('Storage blocked');
                return storage.get(name) ?? null; },
            setItem: (name, value) => { if (faults.write) throw new Error('Quota exceeded');
                storage.set(name, value); },
            removeItem: name => storage.delete(name),
        },
        fetch: async url => {
            if (options.deferred) return new Promise((resolve, reject) =>
                requests.push({url, resolve, reject}));
            requests.push({url});
            const reply = replies[url];
            if (reply instanceof Error) throw reply;
            return reply || {ok: true, json: async () =>
                url.endsWith('/status') ? {bucket_taxonomy_version: 0} : []};
        },
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    const api = context.RevenueBucketFilter;
    const callback = count => visible.push(count);
    const pending = api.init({containerId: 'bucketFilterContainer', onFilterChange: callback,
        ...options.init});
    if (!options.deferred) await pending;
    function view(host = container) {
        const button = host.children[0], panel = host.children[1];
        const byClass = name => panel.children.find(child => child.className === name);
        return {button, panel, count: button.children[0], search: byClass('sb-bucket-search'),
            list: byClass('sb-bucket-list'), empty: byClass('sb-bucket-empty'),
            status: byClass('sb-bucket-status'), retry: panel.children.at(-1),
            selectAll: panel.children[2].children[0]};
    }
    return {api, container, secondary, storage, rows, visible, view, errors, requests, events,
        document, faults, pending, context, callback, setReplies: value => { replies = value; },
        reply(index, data, extra = {}) {
            requests[index].resolve({ok: true, json: async () => data, ...extra});
        }};
}

test('native bucket control preserves the quiet plain label and fraction', async () => {
    const h = await fixture(), v = h.view();
    assert.equal(v.button.textContent, 'Buckets');
    assert.equal(v.count.textContent, '1/6');
    assert.equal(v.count.hidden, false);
    assert.equal(v.panel.attributes.popover, 'auto');
    assert.equal(v.button.attributes.popovertarget, v.panel.id);
    assert.equal(v.panel.attributes.role, 'dialog');
    assert.equal(v.search.attributes['aria-label'], 'Search revenue buckets');
    assert.doesNotMatch(source, /bootstrap|innerHTML|data-bs-/);
});

test('explicit inline buckets reuse rows and only user edits notify persistence', async () => {
    const changes = [], onSelectionChange = values => changes.push(Array.from(values));
    const h = await fixture({buckets: [], saved: '["Fabric"]',
        init: {buckets: ['Fabric', 'Databases', 'Fabric'], inline: true, onSelectionChange}});
    const v = h.view();
    assert.equal(v.button.hidden, true);
    assert.equal(v.panel.className, 'sb-bucket-inline');
    assert.equal(v.panel.attributes.popover, undefined);
    assert.equal(v.button.attributes.popovertarget, undefined);
    assert.equal(v.panel.attributes.role, 'group');
    assert.deepEqual(Array.from(h.api.getAllBuckets()), ['Databases', 'Fabric']);
    assert.deepEqual(changes, []);
    await h.api.init({containerId: 'bucketFilterContainer', buckets: ['Fabric', 'Databases'],
        inline: true, onSelectionChange});
    assert.deepEqual(changes, []);
    h.api.toggle('Databases');
    assert.deepEqual(changes, [['Fabric', 'Databases']]);
    assert.equal(h.requests.some(request => request.url.endsWith('/compensated-buckets')), false);
    h.api.selectNone();
    assert.deepEqual(changes.at(-1), []);
});

test('inline server hydration never saves a selection and malformed bucket sources fail', async () => {
    const changes = [];
    const h = await fixture({buckets: [], saved: '[]', init: {
        buckets: ['Fabric'], inline: true, onSelectionChange: values => changes.push(values),
    }, replies: {'/api/revenue/compensated-buckets': {ok: true, json: async () => ['Fabric']}}});
    assert.deepEqual(Array.from(h.api.getSelected()), ['Fabric']);
    assert.deepEqual(changes, []);
    assert.throws(() => h.api.init({buckets: 'Fabric'}), /Invalid explicit/);
    assert.throws(() => h.api.init({buckets: ['Fabric', 2]}), /Invalid explicit/);
    assert.throws(() => h.api.init({buckets: ['']}), /Invalid explicit/);
});

test('fraction, persistence, row filtering and callback counts retain their contract', async () => {
    const h = await fixture();
    assert.deepEqual(h.rows.map(row => row.style.display), ['', 'none', 'none', 'none', 'none', 'none']);
    const calls = h.visible.length;
    h.api.toggle('B');
    assert.equal(h.view().count.textContent, '2/6');
    assert.deepEqual(h.rows.map(row => row.style.display), ['', '', 'none', 'none', 'none', 'none']);
    assert.deepEqual(JSON.parse(h.storage.get(key)), ['A', 'B']);
    assert.equal(h.visible.at(-1), 2);
    assert.equal(h.visible.length, calls + 1);
    assert.equal(h.view().selectAll.indeterminate, true);
});

test('all and none retain hidden-count/no-filter behavior and synchronize checkboxes', async () => {
    const h = await fixture(), v = h.view();
    h.api.selectAll();
    assert.equal(v.count.hidden, true);
    assert.ok(h.rows.every(row => row.style.display === ''));
    assert.ok(v.list.querySelectorAll('input').every(input => input.checked));
    assert.equal(v.selectAll.checked, true);
    h.api.selectNone();
    assert.equal(v.count.hidden, true);
    assert.ok(h.rows.every(row => row.style.display === ''));
    assert.ok(v.list.querySelectorAll('input').every(input => !input.checked));
    assert.equal(v.selectAll.indeterminate, false);
    v.selectAll.checked = true;
    v.selectAll.dispatch('change');
    assert.equal(h.api.getSelected().length, 6);
    v.selectAll.checked = false;
    v.selectAll.dispatch('change');
    assert.equal(h.api.getSelected().length, 0);
});

test('search is case-insensitive, whitespace-trimmed, explicit when empty and does not change selection', async () => {
    const h = await fixture(), v = h.view();
    v.search.value = ' b ';
    v.search.dispatch('input');
    assert.deepEqual(v.list.children.map(row => row.hidden), [true, false, true, true, true, true]);
    assert.equal(v.empty.hidden, true);
    v.search.value = 'No match';
    v.search.dispatch('input');
    assert.equal(v.empty.hidden, false);
    assert.equal(v.empty.textContent, 'No buckets match your search.');
    assert.deepEqual(Array.from(h.api.getSelected()), ['A']);
});

test('bucket names remain literal, have collision-free IDs and cannot inject markup', async () => {
    const names = ['A-B', 'A B', '<img onerror=bad()>', 'Quotes " & <'];
    const h = await fixture({buckets: names, saved: '[]'}), rows = h.view().list.children;
    assert.deepEqual(rows.map(row => row.children[1].textContent), names.slice().sort());
    const ids = rows.map(row => row.children[0].id);
    assert.equal(new Set(ids).size, 4);
    assert.ok(rows.every(row => row.htmlFor === row.children[0].id));
    rows[0].children[0].checked = true;
    rows[0].children[0].dispatch('change');
    assert.equal(h.api.getSelected()[0], names.slice().sort()[0]);
});

test('multiple hosts and repeat initialization share selections without duplicate UI or callbacks', async () => {
    const h = await fixture();
    await h.api.init({containerId: 'secondary', onFilterChange: h.callback});
    await h.api.init({containerId: 'secondary', onFilterChange: h.callback});
    assert.equal(h.container.children.length, 2);
    assert.equal(h.secondary.children.length, 2);
    const calls = h.visible.length;
    h.api.toggle('B');
    assert.equal(h.view().count.textContent, '2/6');
    assert.equal(h.view(h.secondary).count.textContent, '2/6');
    assert.notEqual(h.view().panel.id, h.view(h.secondary).panel.id);
    assert.equal(h.visible.at(-1), 2);
    assert.equal(h.visible.length, calls + 1);
});

test('native open resets search, focuses it, positions the panel and tracks expanded state', async () => {
    const h = await fixture(), v = h.view();
    v.search.value = 'old search';
    v.panel.dispatch('toggle', {newState: 'open'});
    assert.equal(v.search.value, '');
    assert.equal(h.document.activeElement, v.search);
    assert.equal(v.button.attributes['aria-expanded'], 'true');
    assert.equal(v.panel.style.left, '1090px');
    assert.equal(v.panel.style.top, '76px');
    h.events.resize();
    h.events.pagehide();
    assert.equal(v.panel.open, false);
    assert.equal(v.button.attributes['aria-expanded'], 'false');
});

test('panels near a desktop edge keep their bottom attached as search results shrink', async () => {
    const h = await fixture(), v = h.view();
    v.button.getBoundingClientRect = () => ({right: 1900, top: 1100, bottom: 1120});
    v.panel.dispatch('toggle', {newState: 'open'});
    assert.equal(v.panel.style.left, '1518px');
    assert.equal(v.panel.style.top, '734px');
    v.panel.getBoundingClientRect = () => ({width: 280, height: 200});
    v.search.value = 'A';
    v.search.dispatch('input');
    assert.equal(v.panel.style.top, '894px');
});

test('search cannot flip an above-button panel below it or detach its bottom edge', async () => {
    const h = await fixture(), v = h.view();
    v.button.getBoundingClientRect = () => ({right: 1793, top: 870, bottom: 894});
    v.panel.dispatch('toggle', {newState: 'open'});
    assert.equal(v.panel.style.top, '504px');
    let height = 200;
    v.panel.getBoundingClientRect = () => ({width: 280, height});
    for (const term of ['d', 'data', 'nothing matches', '']) {
        v.search.value = term;
        v.search.dispatch('input');
        assert.equal(v.panel.style.top, '664px');
        assert.equal(Number.parseFloat(v.panel.style.top) + height, 864);
        assert.equal(v.panel.style.left, '1513px');
    }
    height = 360;
    v.search.dispatch('input');
    assert.equal(v.panel.style.top, '504px');
});

test('reopening and desktop resize recalculate placement while feedback remains bounded', async () => {
    const h = await fixture(), v = h.view();
    v.panel.dispatch('toggle', {newState: 'open'});
    v.panel.getBoundingClientRect = () => ({width: 280, height: 1150});
    h.api.toggle('B');
    assert.equal(v.panel.style.top, '9px');
    v.panel.getBoundingClientRect = () => ({width: 280, height: 360});
    h.api.toggle('B');
    assert.equal(v.panel.style.top, '76px');
    v.panel.hidePopover();
    v.panel.dispatch('toggle', {newState: 'open'});
    assert.equal(v.panel.style.top, '76px');
    v.button.getBoundingClientRect = () => ({right: 1370, top: 1100, bottom: 1120});
    h.events.resize();
    assert.equal(v.panel.style.top, '734px');
});

test('Escape closes only this popover and restores its invoker rather than reaching parent handlers', async () => {
    const h = await fixture(), v = h.view();
    v.panel.dispatch('toggle', {newState: 'open'});
    let prevented = false, stopped = false;
    h.events.keydown({key: 'Escape',
        preventDefault: () => { prevented = true; },
        stopImmediatePropagation: () => { stopped = true; }});
    assert.equal(v.panel.open, false);
    assert.equal(h.document.activeElement, v.button);
    assert.ok(prevented && stopped);
});

test('valid empty pages are explicit instead of presenting a checked Select all', async () => {
    const h = await fixture({buckets: [], saved: '[]'}), v = h.view();
    assert.equal(v.selectAll.checked, false);
    assert.equal(v.empty.textContent, 'No buckets on this page.');
    assert.equal(v.empty.hidden, false);
    assert.equal(h.visible.at(-1), 0);
});

test('changed taxonomy invalidates stale local selection and reads the saved server fallback', async () => {
    const h = await fixture({replies: {
        '/api/revenue/sync/status': {ok: true, json: async () => ({bucket_taxonomy_version: 2})},
        '/api/revenue/compensated-buckets': {ok: true, json: async () => ['B', 'C']},
    }});
    assert.equal(h.storage.get(versionKey), '2');
    assert.deepEqual(JSON.parse(h.storage.get(key)), ['B', 'C']);
    assert.equal(h.visible.at(-1), 2);
});

test('a missing version marker retains the legacy zero-version selection', async () => {
    const h = await fixture({version: null});
    assert.deepEqual(Array.from(h.api.getSelected()), ['A']);
    assert.equal(h.requests.length, 1);
    assert.equal(h.storage.get(key), '["A"]');
});

test('late taxonomy and fallback responses cannot overwrite a newer user selection', async () => {
    const h = await fixture({deferred: true});
    h.api.toggle('D');
    h.reply(0, {bucket_taxonomy_version: 2});
    await h.pending;
    assert.deepEqual(Array.from(h.api.getSelected()), ['A', 'D']);
    assert.equal(h.requests.length, 1);
    const empty = await fixture({deferred: true, saved: '[]'});
    empty.reply(0, {bucket_taxonomy_version: 0});
    await settle();
    empty.api.toggle('E');
    empty.reply(1, ['B']);
    await empty.pending;
    assert.deepEqual(Array.from(empty.api.getSelected()), ['E']);
});

test('a superseded fallback failure is logged but cannot leave an irrelevant sticky warning', async () => {
    const h = await fixture({deferred: true, saved: '[]'});
    h.reply(0, {bucket_taxonomy_version: 0});
    await settle();
    h.api.toggle('E');
    h.requests[1].reject(new Error('Offline'));
    await h.pending;
    assert.deepEqual(Array.from(h.api.getSelected()), ['E']);
    assert.equal(h.errors.length, 1);
    assert.equal(h.view().status.textContent, '');
});

test('pending hydration is coalesced across multiple hosts', async () => {
    const h = await fixture({deferred: true});
    const other = h.api.init({containerId: 'secondary'});
    assert.equal(h.requests.length, 1);
    h.reply(0, {bucket_taxonomy_version: 0});
    await Promise.all([h.pending, other]);
    assert.equal(h.view(h.secondary).count.textContent, '1/6');
});

test('taxonomy HTTP/network/malformed failures are visible and Retry recovers', async () => {
    for (const failure of [
        new Error('Offline'), {ok: false, status: 503},
        {ok: true, json: async () => ({})},
        {ok: true, json: async () => { throw new Error('Invalid JSON'); }},
    ]) {
        const h = await fixture({replies: {'/api/revenue/sync/status': failure}}), v = h.view();
        assert.match(v.status.textContent, /Could not check bucket changes/);
        assert.equal(v.status.attributes.role, 'alert');
        assert.equal(v.retry.hidden, false);
        assert.deepEqual(Array.from(h.api.getSelected()), ['A']);
        assert.equal(h.errors.length, 1);
        h.setReplies({});
        await v.retry.dispatch('click');
        assert.equal(v.status.textContent, '');
        assert.equal(v.retry.hidden, true);
    }
});

test('fallback failures are visible; a confirmed empty fallback is not an error', async () => {
    const h = await fixture({saved: '[]', replies: {
        '/api/revenue/compensated-buckets': {ok: true, json: async () => ({buckets: ['A']})},
    }});
    assert.match(h.view().status.textContent, /Could not load saved buckets/);
    assert.ok(h.rows.every(row => row.style.display === ''));
    h.setReplies({});
    await h.view().retry.dispatch('click');
    assert.equal(h.view().status.textContent, '');
});

test('invalid local JSON and blocked persistence are explicit and remain retryable', async () => {
    const h = await fixture({saved: '{bad'});
    assert.match(h.view().status.textContent, /Saved bucket selection is unavailable/);
    h.storage.set(key, '["B"]');
    await h.view().retry.dispatch('click');
    assert.deepEqual(Array.from(h.api.getSelected()), ['B']);
    assert.equal(h.view().status.textContent, '');
    h.faults.write = true;
    h.api.toggle('C');
    assert.match(h.view().status.textContent, /applies on this page only/);
    assert.equal(h.visible.at(-1), 2);
    h.faults.write = false;
    await h.view().retry.dispatch('click');
    assert.deepEqual(JSON.parse(h.storage.get(key)), ['B', 'C']);
    assert.equal(h.view().status.textContent, '');
});

test('taxonomy storage failures do not erase the current selection or misreport a network failure', async () => {
    const h = await fixture({deferred: true});
    h.faults.write = true;
    h.reply(0, {bucket_taxonomy_version: 2});
    await h.pending;
    assert.deepEqual(Array.from(h.api.getSelected()), ['A']);
    assert.match(h.view().status.textContent, /Could not check saved bucket version/);
    assert.doesNotMatch(h.view().status.textContent, /Could not check bucket changes/);
    assert.equal(h.storage.get(versionKey), '0');
});

test('null initialization and changing discovered rows preserve the public API across all hosts', async () => {
    const h = await fixture();
    await h.api.init({containerId: 'secondary'});
    const row = new h.rows[0].constructor();
    row.dataset.bucket = 'G';
    h.rows.push(row);
    await h.api.init(null);
    assert.equal(h.view().list.children.length, 7);
    assert.equal(h.view(h.secondary).list.children.length, 7);
    const copy = h.api.getAllBuckets();
    copy.pop();
    assert.equal(h.api.getAllBuckets().length, 7);
    assert.ok(h.api.isSelected('A'));
});
