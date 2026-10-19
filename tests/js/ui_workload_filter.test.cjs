const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {validate, matches} = require('../../static/js/ui-workload-filter.js');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-workload-filter.js'), 'utf8');
const KEY = 'salesbuddy_u2c_workload_prefixes';
const OTHER_KEY = 'salesbuddy_msx_workspace_workload_prefixes';
const workloads = ['Apps: App Service (Modernize)', 'Data: SQL', 'Sec: Defender for Cloud'];

function fixture(storage = new Map(), choices = workloads,
    {readError, writeError, storageKey = KEY} = {}) {
    const events = {}, errors = [], changes = [];
    class Node {
        constructor(tag) {
            this.tag = tag; this.children = []; this.events = {}; this.attributes = {};
            this.style = {}; this.value = ''; this.hidden = false; this.text = '';
            this.offsetWidth = 280; this.offsetHeight = 350;
        }
        set textContent(value) { this.text = value; this.children = []; }
        get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        setAttribute(key, value) { this.attributes[key] = value; }
        addEventListener(type, callback) { this.events[type] = callback; }
        fire(type, event = {}) { this.events[type]?.(event); }
        focus() { this.focused = true; document.activeElement = this; }
        matches() { return Boolean(this.open); }
        hidePopover() { this.open = false; }
        getBoundingClientRect() { return {left: 30, bottom: 80}; }
    }
    const document = {createElement: tag => new Node(tag), activeElement: null};
    const root = {
        localStorage: {
            getItem(key) { if (readError) throw Error('Unreadable'); return storage.get(key) ?? null; },
            setItem(key, value) { if (writeError) throw Error('Unwritable'); storage.set(key, value); },
        },
        document,
        console: {error: (...args) => errors.push(args)}, innerWidth: 1686, innerHeight: 1000,
        addEventListener(type, callback) { events[type] = callback; },
    };
    vm.runInNewContext(source, {window: root});
    const host = new Node('div'); host.id = 'test';
    const picker = root.SBWorkloadFilter.create(host, {
        storageKey, choices, onChange: value => changes.push(Array.from(value)),
    });
    const [button, panel, status] = host.children;
    const [, search, clear, list, empty] = panel.children;
    return {picker, button, panel, status, search, clear, list, empty, errors, changes, events,
        document,
        checkbox: value => list.children.find(label => label.children[0].value === value).children[0]};
}

test('prefix OR selections are trimmed, delimiter-aware, and include missing classifications', () => {
    assert.deepEqual(validate(['Data: SQL ', 'Data: SQL', 'Sec: Defender for Cloud']),
        ['Data', 'Sec']);
    assert.equal(matches(' Data: SQL ', ['Data']), true);
    assert.equal(matches('Data: SQL Database', ['Data']), true);
    assert.equal(matches('Database: Other', ['Data']), false);
    assert.equal(matches('Data', ['Data']), true);
    assert.equal(matches('Infra: Networking', ['Apps', 'Data', 'Sec']), false);
    assert.equal(matches(null, []), true);
    assert.equal(matches(null, ['']), true);
    assert.equal(matches('Data: SQL', ['']), false);
    for (const invalid of [null, {}, 'Infra', [null], [1], ['x'.repeat(1001)]]) {
        assert.throws(() => validate(invalid), /Invalid saved/);
    }
});

test('defaults to all and remembers multiple prefixes for the same report only', () => {
    const storage = new Map(), first = fixture(storage);
    assert.deepEqual(Array.from(first.picker.getSelected()), []);
    assert.equal(first.button.textContent, 'Workloads: All');
    for (const value of ['Apps', 'Sec']) {
        const input = first.checkbox(value); input.checked = true; input.fire('change');
    }
    assert.equal(first.button.textContent, 'Workloads: 2 selected');
    const second = fixture(storage);
    assert.deepEqual(Array.from(second.picker.getSelected()), ['Apps', 'Sec']);
    assert.deepEqual(JSON.parse(storage.get(KEY)), ['Apps', 'Sec']);
    const other = fixture(storage, workloads, {storageKey: OTHER_KEY});
    assert.deepEqual(Array.from(other.picker.getSelected()), []);
    other.picker.setSelected(['Data']);
    assert.deepEqual(JSON.parse(storage.get(KEY)), ['Apps', 'Sec']);
    first.events.storage({key: OTHER_KEY});
    assert.deepEqual(Array.from(first.picker.getSelected()), ['Apps', 'Sec']);
    second.clear.fire('click');
    assert.deepEqual(JSON.parse(storage.get(KEY)), []);
    first.events.storage({key: KEY});
    assert.deepEqual(Array.from(first.picker.getSelected()), []);
    assert.deepEqual(first.changes.at(-1), []);
});

test('no matching workload on a new view stays selected instead of widening to all', () => {
    const h = fixture(new Map([[KEY, JSON.stringify(['Apps'])]]), ['Data: SQL']);
    assert.equal(h.button.textContent, 'Workloads: 1 selected');
    assert.equal(h.checkbox('Apps').checked, true);
    assert.match(h.list.textContent, /not in this view/);
    assert.equal(matches('Data: SQL', Array.from(h.picker.getSelected())), false);
    h.picker.setChoices(workloads);
    assert.equal(h.checkbox('Apps').checked, true);
    assert.doesNotMatch(h.list.textContent, /not in this view/);
});

test('search is literal, selections survive search, and Escape returns focus to the control', () => {
    const h = fixture();
    h.search.value = 'sec'; h.search.fire('input');
    assert.equal(h.list.children.filter(row => !row.hidden).length, 1);
    h.search.value = '<script>'; h.search.fire('input');
    assert.equal(h.empty.hidden, false);
    h.panel.fire('toggle', {newState: 'open'});
    assert.equal(h.search.value, '');
    assert.equal(h.search.focused, true);
    assert.equal(h.button.attributes['aria-expanded'], 'true');
    let stopped = false;
    h.panel.fire('keydown', {key: 'Escape', preventDefault() {}, stopPropagation() { stopped = true; }});
    assert.equal(stopped, true);
    assert.equal(h.button.focused, true);
});

test('storage failures are logged and visible while current controls keep working', () => {
    for (const options of [{readError: true}, {writeError: true}]) {
        const h = fixture(new Map(), workloads, options);
        if (options.readError) assert.match(h.status.textContent, /Could not restore/);
        h.picker.setSelected([workloads[1]]);
        assert.deepEqual(Array.from(h.picker.getSelected()), ['Data']);
        assert.equal(h.errors.length, 1);
        if (options.writeError) assert.match(h.status.textContent, /Could not remember/);
    }
    const bad = fixture(new Map([[KEY, '{"invalid":"selection"}']]));
    assert.match(bad.status.textContent, /Could not restore/);
    assert.equal(bad.errors.length, 1);
    bad.picker.setSelected([workloads[1]]);
    assert.equal(bad.status.textContent, '');
});

test('Back and same-report cross-window changes restore only that report selection', () => {
    const storage = new Map(), h = fixture(storage);
    storage.set(KEY, JSON.stringify(['Sec']));
    h.events.storage({key: 'unrelated'});
    assert.deepEqual(Array.from(h.picker.getSelected()), []);
    h.events.pageshow();
    assert.deepEqual(Array.from(h.picker.getSelected()), ['Sec']);
    assert.deepEqual(h.changes, [['Sec']]);
    storage.delete(KEY);
    h.events.storage({key: null});
    assert.deepEqual(Array.from(h.picker.getSelected()), []);
});

test('choices are deduplicated prefixes, never the detailed workload items', () => {
    const h = fixture(new Map(), [...workloads, 'Apps: Functions', 'Data: Cosmos DB']);
    assert.deepEqual(h.list.children.map(label => label.children[0].value), ['Apps', 'Data', 'Sec']);
    assert.doesNotMatch(h.list.textContent, /App Service|SQL|Cosmos|Defender/);
    assert.match(h.panel.textContent, /Remembered for this report only/);
});

test('the separate Workload report date preference never initializes or changes this filter', () => {
    const saved = JSON.stringify({from: '', to: '', preset: 'all'});
    const storage = new Map([['salesbuddy_workload_filter', saved]]);
    const h = fixture(storage);
    assert.deepEqual(Array.from(h.picker.getSelected()), []);
    h.picker.setSelected(['Data']);
    assert.equal(storage.get('salesbuddy_workload_filter'), saved);
});

test('changing a checkbox keeps focus on its replacement so keyboard actions stay in the picker',
    () => {
        const h = fixture();
        const input = h.checkbox('Apps');
        input.focus();
        input.checked = true;
        input.fire('change');
        assert.equal(h.document.activeElement, h.checkbox('Apps'));
        assert.notEqual(h.document.activeElement, input);
    });

test('a picker cannot silently use a global or missing storage key', () => {
    for (const storageKey of ['', null, 1]) {
        assert.throws(() => fixture(new Map(), workloads, {storageKey}), /report-specific/);
    }
});
