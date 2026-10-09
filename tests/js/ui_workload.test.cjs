const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-workload.js'), 'utf8');
const {validateFilter, summarize, rollingFilter} = require('../../static/js/ui-workload.js');
const all = {from: '', to: '', preset: 'all'};
const rows = [
    {name: 'Same customer', date: '2026-07-01', acr: 10.25, ids: ['1']},
    {name: 'Another', date: '2026-09-30', acr: -2.5, ids: ['2']},
    {name: 'Missing date', date: '', acr: 0, ids: []},
];
const groups = [
    {id: '1', entries: rows},
    {id: '2', entries: [{...rows[0]}]},
];
const map = {'1': 10.25, '2': -2.5};

test('All restores empty bounds, and old manual filters without preset remain valid', () => {
    assert.deepEqual(validateFilter(all), all);
    assert.deepEqual(validateFilter({from: '2024-02-29', to: ''}),
        {from: '2024-02-29', to: '', preset: ''});
});

test('invalid shapes, dates, presets and inverted ranges are rejected explicitly', () => {
    for (const value of [null, [], {}, 'scope', {from: 3, to: ''},
        {from: '2026-02-29', to: ''}, {from: '2026-13-01', to: ''},
        {from: '2026-07-1', to: ''}, {from: '2026-09-30', to: '2026-07-01'},
        {from: '0000-01-01', to: ''},
        {...all, preset: 'unknown'}, {...all, preset: null},
        {...all, from: '2026-07-01'}]) {
        assert.throws(() => validateFilter(value), /Invalid workload date filter/);
    }
});

test('total deduplicates IDs, unique customers deduplicate names, entries do not', () => {
    const result = summarize(groups, map, all);
    assert.equal(result.total, 7.75);
    assert.equal(result.customers, 3);
    assert.equal(result.entries, 4);
    assert.equal(result.workloads, 2);
    assert.equal(result.groups[0].acr, 7.75);
    assert.equal(result.groups[1].acr, 10.25);
    assert.equal(result.groups[0].rows[0], rows[0]);
});

test('latest note bounds are inclusive and missing dates only qualify for All', () => {
    for (const [filter, entries] of [
        [{from: '2026-07-01', to: '2026-09-30', preset: ''}, 3],
        [{from: '', to: '2026-07-01', preset: ''}, 2],
        [{from: '2026-09-30', to: '', preset: ''}, 1],
        [{from: '2026-10-01', to: '2026-12-31', preset: 'fq'}, 0],
    ]) assert.equal(summarize(groups, map, filter).entries, entries);
    assert.equal(summarize(groups, map, all).entries, 4);
});

test('financial precision, zeros and negative values survive filtering', () => {
    const result = summarize(groups, map,
        {from: '2026-09-30', to: '2026-09-30', preset: ''});
    assert.equal(result.total, -2.5);
    assert.equal(result.groups[0].acr, -2.5);
    assert.equal(result.groups[1].count, 0);
});

test('unique names retain original trimming and case-sensitive counting', () => {
    const entries = ['Same customer', '  Same customer  ', 'same customer'].map(name => ({
        name, date: '', acr: 0, ids: [],
    }));
    const result = summarize([{id: '1', entries}], {}, all);
    assert.equal(result.customers, 2);
    assert.equal(result.entries, 3);
});

test('missing or malformed milestone values never become a successful zero', () => {
    for (const invalid of [{}, {'1': '10.25', '2': -2.5}, {'1': null, '2': 0},
        {'1': NaN, '2': 0}, {'1': Infinity, '2': 0}]) {
        assert.throws(() => summarize(groups, invalid, all), /Invalid workload milestone ACR/);
    }
    for (const row of [{...rows[0], acr: NaN}, {...rows[0], date: '2026-02-30'},
        {...rows[0], name: undefined}, {...rows[0], ids: null}]) {
        assert.throws(() => summarize([{id: '1', entries: [row]}], map, all),
            /Invalid workload customer data/);
    }
});

test('overflow is a visible failure, not a formatted Infinity', () => {
    const entries = [1, 2].map(id => ({name: String(id), date: '', acr: 1e308,
        ids: [String(id)]}));
    assert.throws(() => summarize([{id: '1', entries}], {'1': 1e308, '2': 1e308}, all),
        /supported numeric range/);
});

test('rolling presets retain the original local subtraction and UTC serialization', () => {
    const now = new Date('2026-10-06T01:00:00Z');
    for (const days of [30, 90]) {
        const expected = new Date(now);
        expected.setDate(expected.getDate() - days);
        assert.deepEqual(rollingFilter(days, now), {
            from: expected.toISOString().slice(0, 10),
            to: '2026-10-06', preset: days + 'd',
        });
    }
});

function fixture({saved = null, state = null, embedded = false, readError = false,
    writeError = false, historyError = false} = {}) {
    function node(extra = {}) {
        return {dataset: {}, style: {}, hidden: false, textContent: '', scrollTop: 0,
            handlers: {}, attrs: {}, addEventListener(type, fn) { this.handlers[type] = fn; },
            setAttribute(key, value) { this.attrs[key] = value; }, ...extra};
    }
    const errors = [], writes = [], listeners = {}, restores = [];
    const presetNodes = ['fq', 'prev_fq', '30d', '90d', 'all'].map(preset => node({
        dataset: {preset, from: '2026-10-01', to: '2026-12-31'},
    }));
    const panels = groups.map(group => {
        const count = node(), acr = node(), table = node();
        const button = node(), navCount = node(), navAcr = node();
        const nav = node({cells: [{textContent: 'Topic ' + group.id}],
            querySelector: selector => ({button, '[data-sb-topic-count]': navCount,
                '[data-sb-topic-acr]': navAcr})[selector]});
        const elements = group.entries.map(row => node({
            cells: [{dataset: {sbSortValue: row.name}}],
            dataset: {noteDate: row.date, acr: String(row.acr), milestoneIds: row.ids.join(',')},
        }));
        const panel = node({dataset: {topicId: group.id},
            querySelector: selector => ({table, '.group-count': count, '.group-acr': acr})[selector],
            querySelectorAll: () => elements});
        return {panel, table, nav, button, elements, navCount, navAcr};
    });
    const nodes = Object.fromEntries(['#dateFrom', '#dateTo', '[data-sb-workload-notice]',
        '[data-sb-workload-error]', '[data-sb-workload-retry]', '.sb-workload-topic-reading',
        '.sb-workload-customers', '#statUniqueCustomers', '#statWorkloads', '#statCustomers',
        '#statAcr', '#emptyState', '[data-sb-workload-scope]', '[data-sb-workload-selected]']
        .map(key => [key, node()]));
    nodes['[data-sb-workload-data]'] = {textContent: JSON.stringify(map)};
    const root = {dataset: {embedded: String(embedded)},
        querySelector: selector => {
            const match = selector.match(/^\[data-sb-topic-row="(\d+)"\]$/);
            return match ? embedded ? null : panels.find(p => p.panel.dataset.topicId === match[1]).nav :
                nodes[selector];
        },
        querySelectorAll: selector => ({
            '[data-preset]': presetNodes, '.sb-workload-group': panels.map(p => p.panel),
            '[data-sb-sortable]': panels.map(p => p.table),
        })[selector]};
    const storage = {saved, getItem() {
        if (readError) throw new Error('Read blocked');
        return this.saved;
    }, setItem(key, value) {
        if (writeError) throw new Error('Write blocked');
        this.saved = value; writes.push([key, value]);
    }};
    const window = {localStorage: storage, history: {state, replaceState(value) {
        if (historyError) throw new Error('History blocked');
        this.state = value;
    }}, addEventListener(type, fn) { listeners[type] = fn; },
        SBTableSort: {create: () => ({state: {column: 2, direction: 'descending'},
            restore(value) { restores.push(value); }})}};
    const document = {readyState: 'complete',
        querySelector: selector => selector === '[data-sb-workload]' ? root : nodes[selector]};
    return {nodes, panels, window, storage, writes, errors, restores,
        run() { vm.runInNewContext(source, {document, window, console: {
            error: (...args) => errors.push(args)}}); },
        preset(value) { presetNodes.find(n => n.dataset.preset === value).handlers.click(); },
        manual(from, to) {
            nodes['#dateFrom'].value = from; nodes['#dateTo'].value = to;
            nodes['#dateFrom'].handlers.change();
        },
        fire(type) { listeners[type]?.(); },
        recoverRead() { readError = false; },
        recoverWrite() { writeError = false; },
        clickRetry() { nodes['[data-sb-workload-retry]'].handlers.click(); },
        presetNodes,
    };
}

test('mount defaults to FQ without writing preferences, and All persists across visits', () => {
    const h = fixture(); h.run();
    assert.equal(h.nodes['#statCustomers'].textContent, '0');
    assert.equal(h.writes.length, 0);
    h.preset('all');
    assert.equal(h.nodes['#statCustomers'].textContent, '4');
    assert.equal(h.panels[0].table.dataset.workloadVisible, 'true');
    assert.equal(h.panels[1].table.dataset.workloadVisible, 'true');
    assert.equal(h.panels[1].panel.hidden, true);
    assert.equal(h.panels[0].elements[2].style.display, '');
    assert.equal(h.writes[0][0], 'salesbuddy_workload_filter');
    const next = fixture({saved: h.storage.saved}); next.run();
    assert.equal(next.nodes['#statCustomers'].textContent, '4');
    assert.equal(next.presetNodes[4].attrs['aria-pressed'], 'true');
    assert.equal(next.writes.length, 0);
});

test('display rounding retains the original negative-half locale convention', () => {
    const h = fixture({saved: JSON.stringify(all)});
    h.nodes['[data-sb-workload-data]'].textContent = JSON.stringify({'1': -0.5, '2': 0});
    h.panels.forEach(panel => panel.elements.forEach(row => {
        row.dataset.acr = row.dataset.milestoneIds === '1' ? '-0.5' : '0';
    }));
    h.run();
    assert.equal(h.nodes['#statAcr'].textContent, '$-1');
    assert.equal(h.panels[0].navAcr.dataset.sbSortValue, '-0.5');
});

test('manual dates clear presets and update raw sort keys and all-table export flags', () => {
    const h = fixture({saved: JSON.stringify(all)}); h.run();
    h.manual('2026-09-30', '2026-09-30');
    assert.ok(h.presetNodes.every(n => n.attrs['aria-pressed'] === 'false'));
    assert.equal(h.panels[0].navAcr.dataset.sbSortValue, '-2.5');
    assert.equal(h.panels[0].navCount.dataset.sbSortValue, '1');
    assert.equal(h.panels[1].table.dataset.workloadVisible, 'false');
    assert.equal(h.panels[0].elements[0].style.display, 'none');
    assert.equal(h.panels[0].elements[1].style.display, '');
    assert.ok(h.restores.length > 0);
});

test('invalid ranges preserve previous data and preferences, preset repairs invalid markers', () => {
    const h = fixture({saved: JSON.stringify(all)}); h.run();
    h.manual('2026-10-01', '2026-07-01');
    assert.equal(h.nodes['#statCustomers'].textContent, '4');
    assert.equal(h.nodes['#dateFrom'].attrs['aria-invalid'], 'true');
    assert.equal(h.writes.length, 0);
    assert.match(h.nodes['[data-sb-workload-error]'].textContent, /Previous valid scope/);
    h.preset('all');
    assert.equal(h.nodes['#dateFrom'].attrs['aria-invalid'], 'false');
    assert.equal(h.nodes['[data-sb-workload-notice]'].hidden, true);
});

test('failed storage reads, malformed JSON and valid retry remain explicit', () => {
    for (const saved of ['broken JSON', '{}', '[]']) {
        const h = fixture({saved}); h.run();
        assert.match(h.nodes['[data-sb-workload-error]'].textContent, /could not be restored/);
        assert.equal(h.errors.length, 1);
        h.preset('all');
        assert.equal(h.nodes['[data-sb-workload-notice]'].hidden, true);
    }
    const h = fixture({saved: JSON.stringify(all), readError: true}); h.run();
    h.recoverRead(); h.clickRetry();
    assert.equal(h.nodes['#statCustomers'].textContent, '4');
    assert.equal(h.writes.length, 0);
});

test('failed saves keep local scope, and Retry saves the latest scope, not stale preferences', () => {
    const h = fixture({writeError: true}); h.run(); h.preset('all');
    assert.equal(h.nodes['#statCustomers'].textContent, '4');
    assert.match(h.nodes['[data-sb-workload-error]'].textContent, /could not be saved/);
    h.manual('2026-07-01', '2026-07-01');
    h.recoverWrite(); h.clickRetry();
    assert.deepEqual(JSON.parse(h.storage.saved),
        {from: '2026-07-01', to: '2026-07-01', preset: ''});
    assert.equal(h.nodes['[data-sb-workload-notice]'].hidden, true);
});

test('Back restores scope, topic and each independent offset without a preference write', () => {
    const other = {sbTableSort: {other: 'preserved'}, draft: 'protected'};
    const owned = {filter: all, topic: '2', topicsScroll: 64, customersScroll: {'2': 140}};
    const h = fixture({state: {...other, sbWorkload: owned}}); h.run();
    assert.equal(h.panels[1].panel.hidden, false);
    assert.equal(h.nodes['.sb-workload-customers'].scrollTop, 140);
    assert.equal(h.nodes['.sb-workload-topic-reading'].scrollTop, 64);
    h.panels[0].button.handlers.click();
    assert.equal(h.window.history.state.draft, 'protected');
    assert.equal(h.window.history.state.sbTableSort, other.sbTableSort);
    h.nodes['.sb-workload-topic-reading'].scrollTop = 200;
    h.nodes['.sb-workload-customers'].scrollTop = 80;
    h.fire('pagehide');
    assert.equal(h.window.history.state.sbWorkload.topicsScroll, 200);
    assert.equal(h.window.history.state.sbWorkload.customersScroll['1'], 80);
    h.window.history.state = {...other, sbWorkload: owned};
    h.fire('popstate');
    assert.equal(h.nodes['.sb-workload-customers'].scrollTop, 140);
    assert.equal(h.panels[1].panel.hidden, false);
    assert.equal(h.writes.length, 0);
});

test('embedded groups never access parent history and retain all matching tables', () => {
    const state = {sbWorkload: 'bad parent history'};
    const h = fixture({embedded: true, saved: JSON.stringify(all), state}); h.run();
    h.preset('all'); h.fire('pagehide'); h.fire('pageshow');
    assert.equal(h.window.history.state, state);
    assert.ok(h.panels.every(p => !p.panel.hidden && p.table.dataset.workloadVisible === 'true'));
    assert.equal(h.errors.length, 0);
});

test('history corruption and blocked writes are visible, while selection still works', () => {
    for (const state of [{sbWorkload: 'bad'}, {sbWorkload: {filter: all, topic: '1',
        topicsScroll: -1, customersScroll: {}}}]) {
        const h = fixture({state, saved: JSON.stringify(all)}); h.run();
        assert.match(h.nodes['[data-sb-workload-error]'].textContent, /Saved view/);
        h.panels[1].button.handlers.click();
        assert.equal(h.window.history.state.sbWorkload.topic, '2');
        assert.equal(h.nodes['[data-sb-workload-notice]'].hidden, true);
    }
    const h = fixture({historyError: true, saved: JSON.stringify(all)}); h.run();
    h.panels[1].button.handlers.click();
    assert.equal(h.panels[1].panel.hidden, false);
    assert.match(h.nodes['[data-sb-workload-error]'].textContent, /could not be saved/);
});
