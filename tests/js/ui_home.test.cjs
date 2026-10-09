const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-home.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-home.css'), 'utf8');

function fixture(count = 4, missingPanel = false) {
    const ids = ['calendar', 'engagements', 'projects', 'tasks'].slice(0, count);
    const classes = () => {
        const values = new Set();
        return {toggle: (name, state) => state ? values.add(name) : values.delete(name),
            contains: name => values.has(name)};
    };
    let focused;
    const panels = ids.map((name, index) => ({
        id: name + '-view', hidden: index !== 0, classList: classes(),
    }));
    const tabs = ids.map((name, index) => {
        const attributes = {'aria-controls': name + '-view', 'aria-selected': String(index === 0)};
        const listeners = new Map();
        const tab = {id: name + '-tab', tabIndex: index === 0 ? 0 : -1,
            classList: classes(), events: [],
            getAttribute: key => attributes[key],
            setAttribute: (key, value) => { attributes[key] = value; },
            addEventListener: (type, handler) => listeners.set(type, handler),
            dispatchEvent: event => tab.events.push(event),
            focus: () => { focused = tab.id; },
            click: () => listeners.get('click')(),
            key: event => listeners.get('keydown')(event)};
        return tab;
    });
    const list = {querySelectorAll: () => tabs};
    let rowKey;
    const styles = new Map();
    const root = {addEventListener: (type, handler) => { rowKey = handler; },
        style: {getPropertyValue: key => styles.get(key),
            setProperty: (key, value) => styles.set(key, value)}};
    let top = 80;
    const workspace = {getBoundingClientRect: () => ({top})};
    const status = {getBoundingClientRect: () => ({height: 24})};
    const chrome = new Map([
        ['.sb-home-activity-header', 62], ['#calendarTable', 100], ['#calendarBody', 62],
        ['.sb-home-legend', 40],
    ]);
    const document = {
        body: {},
        getElementById: id => id === 'noteViewTabs' ? list :
            (missingPanel ? null : panels.find(panel => panel.id === id)),
        querySelector: selector => selector === '[data-sb-home]' ? root :
            (selector === '.sb-home-workspace' ? workspace :
                (selector === '.sb-home-status' ? status :
                    (chrome.has(selector) ?
                        {getBoundingClientRect: () => ({height: chrome.get(selector)})} : null))),
    };
    let resize;
    const window = {innerHeight: 1174,
        addEventListener: (type, handler) => { resize = handler; }};
    let observer;
    vm.runInNewContext(source, {window, document,
        ResizeObserver: class {
            constructor(handler) { observer = handler; }
            observe(target) { assert.ok(target); }
        },
        CustomEvent: class {
            constructor(type, options) { this.type = type; this.bubbles = options.bubbles; }
        }});
    return {tabs, panels, styles, window, chrome, api: window.SBHomeTabs, focused: () => focused,
        moveWorkspace: value => { top = value; observer(); }, resize: () => resize(),
        rowKey: event => rowKey(event)};
}

test('each selection updates exactly one panel, ARIA state and tab stop', () => {
    const {api, tabs, panels} = fixture();
    for (let index = 1; index < tabs.length; index++) {
        api.select(tabs[index].id);
        for (let position = 0; position < tabs.length; position++) {
            assert.equal(tabs[position].getAttribute('aria-selected'), String(position === index));
            assert.equal(tabs[position].tabIndex, position === index ? 0 : -1);
            assert.equal(panels[position].hidden, position !== index);
            assert.equal(panels[position].classList.contains('active'), position === index);
        }
        assert.equal(tabs[index].events[0].type, 'sb:home-tab-selected');
        assert.equal(tabs[index].events[0].bubbles, true);
        assert.equal(tabs[index].events[0].relatedTarget, tabs[index - 1]);
    }
});

test('clicks share the controller and selected-tab clicks do not duplicate lazy-load events', () => {
    const {tabs} = fixture();
    tabs[1].click();
    tabs[1].click();
    assert.equal(tabs[1].events.length, 1);
});

test('arrow keys wrap, Home and End select and focus the appropriate native tab', () => {
    const {tabs, focused} = fixture();
    for (const [from, key, expected] of [
        [0, 'ArrowLeft', 3], [3, 'ArrowRight', 0], [0, 'End', 3], [3, 'Home', 0],
    ]) {
        let prevented = false;
        tabs[from].key({key, preventDefault: () => { prevented = true; }});
        assert.equal(prevented, true);
        assert.equal(focused(), tabs[expected].id);
        assert.equal(tabs[expected].getAttribute('aria-selected'), 'true');
    }
});

test('modified shortcuts and unrelated keys are not consumed', () => {
    const {tabs, focused} = fixture();
    for (const event of [{key: 'Tab'}, {key: 'ArrowRight', ctrlKey: true},
        {key: 'Home', altKey: true}, {key: 'End', metaKey: true}]) {
        tabs[0].key({...event, preventDefault: () => assert.fail('shortcut consumed')});
    }
    assert.equal(focused(), undefined);
});

test('one-tab and reduced conditional tab sets work without unavailable targets', () => {
    for (const count of [1, 2, 3]) {
        const {tabs, api} = fixture(count);
        tabs[0].key({key: 'End', preventDefault() {}});
        api.select(tabs[0].id);
        assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
    }
});

test('unavailable tabs and missing panel markup fail explicitly', () => {
    const {api} = fixture(1);
    assert.throws(() => api.select('tasks-tab'), /Unknown Home activity tab/);
    assert.throws(() => fixture(1, true), /Home activity tab has no panel/);
});

test('keyboard activation calls the original preview launcher only on the row itself', () => {
    const {rowKey} = fixture();
    let clicks = 0;
    const row = {matches: () => true, click: () => { clicks++; }};
    for (const key of ['Enter', ' ']) {
        let prevented = false;
        rowKey({key, target: row, preventDefault: () => { prevented = true; }});
        assert.equal(prevented, true);
    }
    assert.equal(clicks, 2);
    rowKey({key: 'Enter', target: {matches: () => false},
        preventDefault: () => assert.fail('child link consumed')});
    rowKey({key: 'ArrowDown', target: row});
    rowKey({key: 'Enter', target: row, repeat: true});
    rowKey({key: 'Enter', target: row, ctrlKey: true});
    assert.equal(clicks, 2);
});

test('real context, notices and freshness strip reduce available workspace height', () => {
    const {styles, moveWorkspace} = fixture();
    assert.equal(styles.get('--sb-home-height'), '1070px');
    moveWorkspace(260);
    assert.equal(styles.get('--sb-home-height'), '890px');
});

test('desktop height changes use the full available space without a large-window cap', () => {
    const {window, styles, resize} = fixture();
    window.innerHeight = 600;
    resize();
    assert.equal(styles.get('--sb-home-height'), '496px');
    window.innerHeight = 1600;
    resize();
    assert.equal(styles.get('--sb-home-height'), '1496px');
    window.innerHeight = 350;
    resize();
    assert.equal(styles.get('--sb-home-height'), '400px');
});

test('calendar reserves measured toolbar, weekday and legend space when chrome changes', () => {
    const {styles, chrome, resize} = fixture();
    assert.equal(styles.get('--sb-home-calendar-chrome'), '140px');
    chrome.set('.sb-home-activity-header', 90);
    resize();
    assert.equal(styles.get('--sb-home-calendar-chrome'), '168px');
});

test('semantic ink overrides the neutral default independently of high-specificity geometry', () => {
    const geometry = css.match(
        /\.sb-home-page\[data-sb-home\] \.sb-home-panel \.sb-hn-badge \{([^}]+)\}/)[1];
    assert.doesNotMatch(geometry, /--sb-home-tag-ink:/);
    for (const [kind, token] of [
        ['success', 'milestone-rail'], ['warning', 'warning'], ['danger', 'danger'],
    ]) {
        assert.ok(css.includes(`.sb-home-panel .sb-hn-badge.sb-hn-bg-${kind} { ` +
            `--sb-home-tag-ink: var(--sb-ui-${token}); }`));
    }
    assert.match(css, /\.sb-home-panel \.sb-hn-badge\.sb-hn-bg-primary, \.sb-home-panel \.sb-hn-badge\.sb-hn-bg-info/);
});

test('approved Home composition uses a flush dock with dividers instead of isolated cards', () => {
    const rule = selector => css.slice(css.indexOf(selector + ' {'))
        .split('}')[0];
    assert.match(rule('#main-content:has(> .sb-home-page)'), /padding: 0;/);
    assert.match(rule('.sb-home-workspace'), /gap: 0;/);
    assert.match(rule('.sb-home-rail'), /gap: 0;/);
    assert.match(rule('.sb-home-rail'), /border-left: 1px solid var\(--sb-ui-line\)/);
    for (const selector of ['.sb-home-panel', '.sb-home-calendar']) {
        assert.match(rule(selector), /border: 0;/);
        assert.match(rule(selector), /border-radius: 0;/);
    }
    assert.match(rule('.sb-home-panel + .sb-home-panel'), /border-top:/);
});

test('freshness details use an on-demand surface instead of another dense footer row', () => {
    const rule = selector => css.slice(css.indexOf(selector + ' {')).split('}')[0];
    assert.match(rule('.sb-home-status'), /font-weight: 400;/);
    assert.match(rule('.sb-home-status a'), /color: inherit;/);
    assert.match(rule('.sb-home-freshness'), /flex-direction: column;/);
    assert.match(rule('.sb-home-freshness-popover'), /position: fixed;/);
    assert.match(rule('.sb-home-freshness-popover'), /background: var\(--sb-ui-surface\);/);
    assert.match(rule('.sb-home-status > button'), /justify-self: end;/);
    assert.match(css, /\.sb-home-status \[data-state="warning"\] \{ color: var\(--sb-ui-warning\); \}/);
    assert.match(css, /\.sb-home-status \[data-state="error"\] \{ color: var\(--sb-ui-danger\); \}/);
});

test('status grid centers the local date between equal side tracks and retains footer heights', () => {
    const rule = selector => css.slice(css.indexOf(selector + ' {')).split('}')[0];
    assert.match(rule('.sb-home-status'), /display: grid;/);
    assert.match(rule('.sb-home-status'),
        /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);/);
    assert.match(rule('.sb-home-status'), /height: 24px;/);
    assert.match(rule('.sb-home-panel-footer'), /min-height: 35px;/);
    assert.match(rule('.sb-home-legend'), /min-height: 40px;/);
    assert.match(rule('.sb-home-status-summary'), /text-overflow: ellipsis;/);
    assert.match(rule('.sb-home-status-date'), /justify-self: center;/);
});

test('Home owns a readable rem-based type scale without changing global tokens', () => {
    const rule = selector => css.slice(css.indexOf(selector + ' {')).split('}')[0];
    for (const [token, value] of Object.entries({
        heading: '1.1375', panel: '.75', row: '.8125', meta: '.75',
        weekday: '.75', legend: '.6875', status: '.6875',
    })) {
        assert.ok(rule('.sb-home-page').includes(`--sb-home-type-${token}: ${value}rem;`));
    }
    assert.match(rule('.sb-home-panel-footer'), /font-size: var\(--sb-home-type-legend\);/);
    assert.match(rule('.sb-home-panel-header h2'), /line-height: normal;/);
    assert.match(rule('.sb-home-calendar thead th'), /font-weight: 400;/);
    assert.doesNotMatch(css, /^:root\s*\{/m);
});

const template = fs.readFileSync(path.join(__dirname, '../../templates/index.html'), 'utf8');
const draftSource = template.slice(template.indexOf('    const DRAFT_KEY_PREFIX'),
    template.indexOf('    // Load drafts when page loads'));

function draftFixture(saved = {}) {
    const store = new Map(Object.entries(saved));
    const localStorage = {
        get length() { return store.size; },
        key: index => [...store.keys()][index],
        getItem: key => store.get(key) ?? null,
        removeItem: key => store.delete(key),
    };
    const element = () => ({
        hidden: false, textContent: '', style: {}, children: [], listeners: new Map(),
        setAttribute(name, value) { this[name] = value; },
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; },
        addEventListener(type, handler) { this.listeners.set(type, handler); },
    });
    const nodes = new Map();
    const document = {
        createElement: () => element(),
        getElementById: id => {
            if (!nodes.has(id)) nodes.set(id, element());
            return nodes.get(id);
        },
    };
    const errors = [];
    let confirmed = false;
    const context = {document, localStorage, Date,
        console: {error: (...args) => errors.push(args)},
        confirm: () => confirmed};
    vm.createContext(context);
    vm.runInContext(draftSource, context);
    return {context, nodes, store, errors,
        load: () => context.loadDrafts(), confirm: value => { confirmed = value; }};
}

test('drafts remain visible through a counted control and render literal customer names safely', () => {
    const first = {customer_name: '<Customer "A">', timestamp: 1, topics: [1, 2]};
    const second = {customer_name: 'Recent customer', timestamp: 2};
    const {load, nodes, store} = draftFixture({
        salesbuddy_draft_11: JSON.stringify(first), salesbuddy_draft_12: JSON.stringify(second),
        unrelated: 'keep',
    });
    load();
    assert.equal(nodes.get('homeDraftsButton').hidden, false);
    assert.equal(nodes.get('homeDraftsEmpty').hidden, true);
    assert.equal(nodes.get('draftCount').textContent, 2);
    const rows = nodes.get('draftsList').children;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].children[0].children[0].textContent, 'Recent customer');
    assert.equal(rows[1].children[0].children[0].textContent, '<Customer "A">');
    assert.match(rows[1].children[0].href, /customer_id=11$/);
    assert.equal(rows[1].children[1]['aria-label'], 'Delete draft for <Customer "A">');
    assert.equal(store.size, 3);
});

test('deleting the last draft requires confirmation and updates the button and open-dialog empty state', () => {
    const {load, context, nodes, confirm, store} = draftFixture({
        salesbuddy_draft_11: JSON.stringify({customer_name: 'Keep me', timestamp: 1}),
    });
    load();
    const event = {preventDefault() {}, stopPropagation() {}};
    const remove = nodes.get('draftsList').children[0].children[1];
    remove.listeners.get('click')(event);
    assert.equal(store.size, 1);
    confirm(true);
    remove.listeners.get('click')(event);
    assert.equal(store.size, 0);
    assert.equal(nodes.get('homeDraftsButton').hidden, true);
    assert.equal(nodes.get('homeClearDraftsButton').hidden, true);
    assert.equal(nodes.get('homeDraftsEmpty').hidden, false);
    assert.equal(nodes.get('draftsList').children.length, 0);
    context.loadDrafts();
    assert.equal(nodes.get('draftCount').textContent, 0);
});

test('clear-all preserves unrelated storage and cancel keeps every draft', () => {
    const {load, context, confirm, store} = draftFixture({
        salesbuddy_draft_11: JSON.stringify({customer_name: 'One'}),
        salesbuddy_draft_12: JSON.stringify({customer_name: 'Two'}),
        salesbuddy_home_tab: 'calendar',
    });
    load();
    context.clearAllDrafts();
    assert.equal(store.size, 3);
    confirm(true);
    context.clearAllDrafts();
    assert.equal(store.size, 1);
    assert.equal(store.get('salesbuddy_home_tab'), 'calendar');
});

test('malformed drafts follow the existing explicit logging and cleanup behavior', () => {
    const {load, errors, store, nodes} = draftFixture({salesbuddy_draft_11: '{invalid'});
    load();
    assert.equal(errors.length, 1);
    assert.equal(store.size, 0);
    assert.equal(nodes.get('homeDraftsEmpty').hidden, false);
});
