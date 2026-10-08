const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('../../static/js/ui-seller-detail.js');
const engagements = require('../../static/js/ui-engagements-directory.js');
const source = fs.readFileSync(require.resolve('../../static/js/ui-seller-detail.js'), 'utf8');

test('seller history preserves every owned scroll region and valid tab', () => {
    for (const tab of ['sdMilestones', 'sdRevenue', 'sdEngagements']) {
        const value = {id: 14, tab, scrolls: {
            customers: 105, milestones: 50, revenue: 88, engagements: 42,
        }};
        assert.equal(api.validateHistory(value, 14), value);
    }
});
test('invalid identity, tab, fields and offsets cannot corrupt reading history', () => {
    const value = {id: 14, tab: 'sdMilestones', scrolls: {customers: 5}};
    for (const changed of [{id: 9}, {tab: 'invented'}, {scrolls: []},
        {scrolls: {unknown: 1}}, {scrolls: {customers: -1}},
        {scrolls: {customers: NaN}}, {scrolls: {customers: '4'}}, {scrolls: null}]) {
        assert.throws(() => api.validateHistory({...value, ...changed}, 14));
    }
});
test('actual seller engagement renderer omits unavailable Tasks without changing directory', () => {
    const item = {id: 7, customer_id: 2, customer_name: 'Account', title: 'Story',
        status: 'Active', story_completeness: 14, estimated_acr: 1234.56,
        target_date: '2027-01-02', latest_note_date: '2026-10-07T11:40:00',
        linked_note_count: 2, opportunity_count: 3, milestone_count: 4};
    const groups = engagements.groupItems([item], true, false);
    const html = engagements.tableHtml(groups, 'seller-group', true);
    assert.equal((html.match(/data-sb-sort-type=/g) || []).length, 10);
    assert.equal((html.match(/data-export-label=/g) || []).length, 11);
    assert.match(html, /colspan="11"/);
    assert.match(html, /data-export-label="Customer"/);
    assert.ok(!html.includes('data-export-label="Tasks"'));
    for (const value of ['1234.56', '2027-01-02', '2', '3', '4']) {
        assert.ok(html.includes(`data-sb-sort-value="${value}"`));
    }
    assert.ok(engagements.tableHtml(groups, 'directory').includes('data-export-label="Tasks"'));
    assert.match(html, /href="\/engagement\/7"/);
    assert.match(html, /data-eng-favorite="7"/);
});
test('launcher, reading and confirmation lifecycle use shared native helpers', () => {
    for (const signature of ['window.openStandaloneMilestoneDetail',
        'window.openMilestoneDetail', 'SBMilestonePreview.open', 'SBRevenueAlertPreview.open',
        'SBTableSort.mount', 'RevenueBucketFilter.init', 'sb:dialog-before-close',
        "window.addEventListener('pagehide'", "window.addEventListener('pageshow'"]) {
        assert.ok(source.includes(signature), signature);
    }
    assert.ok(!source.includes('bootstrap.'));
    assert.ok(!source.includes('fetch('));
});

function fixture(saved = null, oldSort = null) {
    const events = {}, rootEvents = {}, calls = [], errors = [], preferences = [];
    const history = {state: {unrelated: 7, ...(saved ? {sbSellerDetail: saved} : {})},
        replaceState(value) { this.state = value; }};
    const tabs = ['sdMilestones', 'sdRevenue', 'sdEngagements'].map(id => ({
        id, attributes: {'aria-controls': id}, handlers: {}, tabIndex: 0,
        getAttribute(key) { return this.attributes[key]; },
        setAttribute(key, value) { this.attributes[key] = value; },
        addEventListener(key, handler) { this.handlers[key] = handler; },
        focus() { calls.push(['focus', this.id]); },
    }));
    const panels = tabs.map(tab => ({id: tab.id, hidden: tab.id !== 'sdMilestones'}));
    const regions = ['customers', 'milestones', 'revenue', 'engagements'].map((key, index) => ({
        dataset: {sdScroll: key}, scrollTop: 0, handlers: {},
        closest() { return index && panels[index - 1].hidden ? panels[index - 1] : null; },
        addEventListener(key, handler) { this.handlers[key] = handler; },
    }));
    const submit = {disabled: false}, status = {textContent: ''};
    const dialog = {handlers: {}, addEventListener(key, handler) { this.handlers[key] = handler; }};
    const form = {handlers: {},
        addEventListener(key, handler) { this.handlers[key] = handler; },
        closest() { return dialog; },
        querySelector(selector) { return selector === '[type="submit"]' ? submit : status; },
    };
    const table = {dataset: {sbSortKey: 'seller-14-customers'}, handlers: {},
        addEventListener(key, handler) { this.handlers[key] = handler; }};
    const sorter = {state: {column: 1, direction: 'descending'},
        restore(value) { this.state = value; calls.push(['sort-restore', value]); }};
    const notice = {textContent: '', hidden: true};
    const root = {dataset: {sbSellerDetail: '14'},
        querySelectorAll(selector) { return {'[role="tab"]': tabs,
            '.sd-panel': panels, '[data-sd-scroll]': regions}[selector] || []; },
        querySelector(selector) {
            if (selector === '#customerTableBody') return {closest() { return table; }};
            if (selector === '#sellerDeleteDialog form') return form;
            if (selector === '[data-sd-notice]') return notice;
            return null;
        },
        addEventListener(key, handler) { rootEvents[key] = handler; },
    };
    const document = {readyState: 'complete',
        querySelector() { return root; }};
    const window = {document, addEventListener(key, handler) { events[key] = handler; },
    };
    const context = {window, document, history,
        console: {error(...args) { errors.push(args); }},
        localStorage: {getItem() { return oldSort; },
            setItem(key, value) { preferences.push([key, value]); }},
        SBTableSort: {mount() { calls.push(['sort-mount']); },
            create() { return sorter; }},
        SBMilestonePreview: {open(...args) { calls.push(['milestone', ...args]); }},
        SBRevenueAlertPreview: {open(...args) { calls.push(['alert', ...args]); }},
    };
    vm.runInNewContext(source, context);
    return {events, rootEvents, calls, errors, history, tabs, panels, regions,
        root, form, dialog, submit, status, notice, preferences, table, sorter};
}

test('actual controller restores tab and independent reading with unrelated history retained', () => {
    const f = fixture({id: 14, tab: 'sdRevenue', scrolls: {
        customers: 120, milestones: 40, revenue: 66, engagements: 70,
    }});
    assert.equal(f.panels[1].hidden, false);
    assert.equal(f.regions[0].scrollTop, 120);
    assert.equal(f.regions[2].scrollTop, 66);
    f.regions[2].scrollTop = 99;
    f.tabs[2].handlers.click();
    assert.equal(f.regions[3].scrollTop, 70);
    assert.equal(f.history.state.sbSellerDetail.scrolls.revenue, 99);
    assert.equal(f.history.state.unrelated, 7);
    f.regions[3].scrollTop = 88;
    f.events.pagehide();
    f.regions[3].scrollTop = 0;
    f.events.pageshow();
    assert.equal(f.regions[3].scrollTop, 88);
    assert.equal(f.history.state.sbSellerDetail.tab, 'sdEngagements');
});
test('keyboard tabs use native selection, roving focus and preserve hidden scrolls', () => {
    const f = fixture();
    let prevented = false;
    f.tabs[0].handlers.keydown({key: 'End', preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    assert.equal(f.tabs[2].attributes['aria-selected'], 'true');
    assert.equal(f.tabs[2].tabIndex, 0);
    assert.equal(f.tabs[0].tabIndex, -1);
    assert.deepEqual(f.calls.at(-1), ['focus', 'sdEngagements']);
    f.tabs[2].handlers.keydown({key: 'ArrowRight', preventDefault() {}});
    assert.equal(f.panels[0].hidden, false);
    assert.equal(f.history.state.sbSellerDetail.tab, 'sdMilestones');
});
test('preview launchers retain exact identities, quote-safe titles and skip independent links', () => {
    const f = fixture();
    const milestone = {dataset: {sdMilestone: '1905', title: 'Quoted "milestone"',
        status: 'On Track', url: 'https://example.com/source'}};
    f.rootEvents.click({target: {closest(selector) {
        return selector === '[data-sd-milestone]' ? milestone : null;
    }}});
    assert.deepEqual(f.calls.at(-1), ['milestone', 1905, 'Quoted "milestone"',
        'On Track', 'https://example.com/source']);
    const alert = {dataset: {sdAlert: '1069', customer: 'Account', bucket: 'Data'}};
    const event = {target: {closest(selector) {
        return selector === '[data-sd-alert]' ? alert : null;
    }}};
    f.rootEvents.click(event);
    assert.equal(f.calls.at(-1)[0], 'alert');
    assert.deepEqual(f.calls.at(-1).slice(1), [1069, 'Account', 'Data']);
});
test('pending deletion suppresses duplicate submits and prevents dialog dismissal', () => {
    const f = fixture();
    let prevented = false;
    const event = {preventDefault() { prevented = true; }};
    f.form.handlers.submit(event);
    assert.equal(f.submit.disabled, true);
    assert.equal(f.status.textContent, 'Deleting seller...');
    assert.equal(prevented, false);
    f.form.handlers.submit(event);
    assert.equal(prevented, true);
    prevented = false;
    f.dialog.handlers['sb:dialog-before-close'](event);
    assert.equal(prevented, true);
});
test('legacy customer preference initializes the sorter and invalid history is visible', () => {
    const f = fixture({id: 14, tab: 'invalid', scrolls: {}}, 'name');
    assert.equal(f.errors.length, 1);
    assert.equal(f.notice.hidden, false);
    assert.match(f.notice.textContent, /Could not restore/);
    assert.equal(f.calls.find(call => call[0] === 'sort-restore')[1].column, 0);
    assert.equal(f.panels[0].hidden, false);
});
test('customer header choices retain the original cross-seller sort preference only on intent', () => {
    const f = fixture(null, 'name');
    assert.deepEqual(f.preferences, []);
    const event = {target: {closest() { return true; }}};
    f.table.handlers.click(event);
    assert.deepEqual(f.preferences.at(-1), ['salesbuddy_seller_customer_sort', 'name']);
    f.sorter.state.column = 1;
    f.table.handlers.click(event);
    assert.deepEqual(f.preferences.at(-1), ['salesbuddy_seller_customer_sort', 'date']);
});
