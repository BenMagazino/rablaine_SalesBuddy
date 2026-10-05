const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-customer.js'), 'utf8');

function fixture({emptyData = false, embedded = false, hash = '', overview = true} = {}) {
    class Element {
        constructor(dataset = {}, attributes = {}) {
            this.dataset = dataset; this.attributes = attributes; this.hidden = false;
            this.style = {display: ''}; this.children = []; this.scrollTop = 0;
            this.listeners = {}; this.textContent = '';
        }
        getAttribute(name) { return this.attributes[name] ?? null; }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this.attributes[name]; }
        addEventListener(name, handler) { this.listeners[name] = handler; }
        contains(item) { return this === item || this.children.includes(item); }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
        closest() { return this; }
    }
    const analyses = emptyData ? [] : [new Element({bucket: 'Databases'})];
    const histories = emptyData ? [] : [
        new Element({bucket: 'Databases'}), new Element({bucket: 'Fabric'}),
    ];
    if (histories[1]) histories[1].style.display = 'none';
    const links = emptyData ? [] : ['Databases', 'Fabric'].map(name =>
        new Element({sbCustomerBucket: name}, {href: '#bucket-' + name.toLowerCase()}));
    const status = {value: '', writes: 0,
        get textContent() { return this.value; },
        set textContent(value) { this.value = value; this.writes++; }};
    const empty = new Element(), heading = emptyData ? null : new Element();
    const analysisGroup = emptyData ? null : new Element();
    const nav = new Element(), options = new Element(), returnLink = new Element();
    const overviewPanel = overview && !emptyData ? new Element() : null;
    const overviewLink = overviewPanel ? new Element({}, {href: '#bucket-total'}) : null;
    const overviewContext = new Element(), noAnalysis = new Element(), contextTitle = new Element();
    const noHistory = new Element(), historyArea = new Element(), notice = new Element();
    const title = new Element(), noData = emptyData ? new Element() : null;
    const nodes = {
        '[data-sb-customer-filter-empty]': empty, '#customerAnalysesTitle': heading,
        '.sb-revenue-customer-analyses': analysisGroup,
        '[data-sb-customer-nav]': nav, '[data-sb-customer-overview-link]': overviewLink,
        '#bucket-total': overviewPanel, '[data-sb-customer-overview-context]': overviewContext,
        '[data-sb-customer-bucket-options]': options, '[data-sb-customer-return]': returnLink,
        '[data-sb-customer-no-analysis]': noAnalysis, '[data-sb-customer-context-title]': contextTitle,
        '[data-sb-customer-no-history]': noHistory, '[data-sb-customer-no-data]': noData,
        '.sb-revenue-customer-history-area': historyArea, '[data-sb-customer-view-notice]': notice,
        '.sb-revenue-page-header h1': title,
    };
    const root = new Element({embedded: String(embedded)});
    root.children = [...analyses, ...histories, ...links, returnLink, overviewLink];
    root.querySelector = selector => nodes[selector];
    root.querySelectorAll = selector => ({
        '[data-sb-customer-analysis]': analyses, '[data-sb-customer-history]': histories,
        '[data-sb-customer-bucket]': links,
    })[selector];
    const review = {open: false};
    const document = {
        activeElement: null, listeners: {},
        querySelector: selector => selector === '[data-sb-revenue-page="customer"]' ?
            root : embedded ? null : status,
        getElementById: () => review,
        addEventListener(name, handler) { this.listeners[name] = handler; },
    };
    const window = {
        location: {hash, pathname: '/revenue/customer/7', search: ''}, listeners: {},
        addEventListener(name, handler) { this.listeners[name] = handler; },
        history: {state: {}, pushes: [], replacements: [],
            pushState(state, unused, url) {
                this.pushes.push(url); window.location.hash = url.startsWith('#') ? url : '';
            },
            replaceState(state, unused, url) {
                this.replacements.push(url); window.location.hash = url.startsWith('#') ? url : '';
            }},
    };
    let filterOptions, initializations = 0;
    const context = {
        document, window,
        RevenueBucketFilter: {init(value) {
            initializations++; filterOptions = value; value.onFilterChange(999);
        }},
    };
    return {root, analyses, histories, links, status, empty, heading, analysisGroup, nav, options, returnLink,
        overviewPanel, overviewLink, overviewContext, noAnalysis, contextTitle, noHistory,
        historyArea, notice, title, noData, review, document, window,
        run: () => vm.runInNewContext(source, context),
        api: () => window.SBCustomerRevenue.create(root),
        change: () => filterOptions.onFilterChange(999),
        initCount: () => initializations,
        click(link, modifiers = {}) {
            const event = {target: link, button: 0, preventDefault() { this.prevented = true; },
                ...modifiers};
            root.listeners.click(event); return event;
        }};
}

test('single-bucket context narrows history without a redundant chooser or filter writes', () => {
    const h = fixture(); h.run();
    assert.equal(h.api().selected, 'Databases');
    assert.equal(h.root.dataset.sbCustomerEnhanced, 'true');
    assert.equal(h.status.textContent, '1 of 2 history buckets in scope, 1 of 1 analyses');
    assert.equal(h.histories[0].hidden, false);
    assert.equal(h.histories[1].hidden, true);
    assert.equal(h.options.hidden, true);
    assert.equal(h.overviewPanel.hidden, true);
    assert.equal(h.initCount(), 1);
    assert.equal(h.window.history.pushes.length, 0);
    assert.equal(h.api().show('Fabric', true), false);
    assert.equal(h.api().selected, 'Databases');
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /not available in the current scope/);
    assert.equal(h.window.history.pushes.length, 0);
    h.api().show('Databases');
    assert.equal(h.notice.hidden, true);
});

test('navigation changes active context/history, not filter scope, and scroll resets only on change', () => {
    const h = fixture(); h.run();
    h.histories[1].style.display = ''; h.change();
    assert.equal(h.options.hidden, false);
    assert.equal(h.api().selected, 'Databases');
    const event = h.click(h.links[1]);
    assert.equal(event.prevented, true);
    assert.equal(h.api().selected, 'Fabric');
    assert.equal(h.histories[0].hidden, true);
    assert.equal(h.histories[1].hidden, false);
    assert.equal(h.noAnalysis.hidden, false);
    assert.equal(h.contextTitle.textContent, 'Fabric');
    assert.equal(h.status.textContent, '2 of 2 history buckets in scope, 1 of 1 analyses');
    assert.deepEqual(h.window.history.pushes, ['#bucket-fabric']);
    h.historyArea.scrollTop = 100; h.change(); h.click(h.links[1]);
    assert.equal(h.historyArea.scrollTop, 100);
    assert.equal(h.window.history.pushes.length, 1);
    assert.equal(h.initCount(), 1);
});

test('Overview retains all-bucket scope and offers a single-bucket return', () => {
    const h = fixture(); h.run();
    h.click(h.overviewLink);
    assert.equal(h.api().selected, '#overview');
    assert.equal(h.overviewPanel.hidden, false);
    assert.equal(h.overviewContext.hidden, false);
    assert.equal(h.analyses[0].hidden, true);
    assert.equal(h.analysisGroup.hidden, true);
    assert.equal(h.returnLink.hidden, false);
    assert.equal(h.returnLink.textContent, 'View Databases');
    assert.equal(h.returnLink.getAttribute('href'), '#bucket-databases');
    assert.equal(h.overviewLink.getAttribute('aria-current'), 'true');
    h.document.activeElement = h.returnLink;
    h.click(h.returnLink);
    assert.equal(h.api().selected, 'Databases');
    assert.equal(h.returnLink.hidden, true);
    assert.equal(h.document.activeElement, h.nav);
    assert.equal(h.nav.focusOptions.preventScroll, true);
});

test('filters advance excluded selection, retain Overview and clear zero-result content', () => {
    const h = fixture(); h.run();
    h.histories[1].style.display = ''; h.click(h.links[1]); h.change();
    h.histories[1].style.display = 'none'; h.change();
    assert.equal(h.api().selected, 'Databases');
    assert.equal(h.window.location.hash, '#bucket-databases');
    assert.equal(h.links[1].hidden, true);
    h.histories[0].style.display = 'none'; h.analyses[0].style.display = 'none'; h.change();
    assert.equal(h.api().selected, null);
    assert.equal(h.empty.hidden, false);
    assert.equal(h.overviewPanel.hidden, true);
    assert.equal(h.status.textContent, '0 of 2 history buckets in scope, 0 of 1 analyses');
    h.click(h.overviewLink); h.change();
    assert.equal(h.api().selected, '#overview');
    assert.equal(h.overviewPanel.hidden, false);
    assert.equal(h.empty.hidden, true);
});

test('initial fragments, Back/Forward and modified links retain native navigation semantics', () => {
    const h = fixture({hash: '#bucket-total'}); h.run();
    assert.equal(h.api().selected, '#overview');
    h.window.location.hash = '#bucket-databases'; h.window.listeners.popstate();
    assert.equal(h.api().selected, 'Databases');
    h.window.location.hash = '#bucket-fabric'; h.window.listeners.hashchange();
    assert.equal(h.api().selected, 'Databases');
    assert.equal(h.window.location.hash, '#bucket-databases');
    assert.equal(h.click(h.overviewLink, {ctrlKey: true}).prevented, undefined);
    assert.equal(h.api().selected, 'Databases');
});

test('Review blocks context replacement and applies a deferred filter after close', () => {
    const h = fixture(); h.run();
    h.review.open = true;
    assert.equal(h.api().show('#overview'), false);
    assert.equal(h.api().selected, 'Databases');
    assert.equal(h.notice.hidden, false);
    h.analyses[0].style.display = 'none'; h.histories[0].style.display = 'none';
    h.histories[1].style.display = ''; h.change();
    assert.equal(h.api().selected, 'Databases');
    h.review.open = false;
    h.document.listeners['sb:dialog-closed']({target: {id: 'reviewActionModal'}});
    assert.equal(h.api().selected, 'Fabric');
    assert.equal(h.notice.hidden, true);
});

test('analysis-only/history-only states are distinct, and focus leaves hidden content safely', () => {
    const h = fixture({overview: false}); h.histories[0].style.display = 'none'; h.run();
    assert.equal(h.api().selected, 'Databases');
    assert.equal(h.noHistory.hidden, false);
    h.histories[1].style.display = '';
    h.document.activeElement = h.analyses[0];
    h.analyses[0].style.display = 'none'; h.change();
    assert.equal(h.api().selected, 'Fabric');
    assert.equal(h.noHistory.hidden, true);
    assert.equal(h.noAnalysis.hidden, false);
    assert.equal(h.document.activeElement, h.title);
});

test('embedded/no-data views retain stacked fallback without acquiring a two-pane shell', () => {
    const empty = fixture({emptyData: true}); empty.run();
    assert.equal(empty.root.dataset.sbCustomerEnhanced, undefined);
    assert.equal(empty.status.textContent, '0 of 0 history buckets in scope, 0 of 0 analyses');
    assert.equal(empty.empty.hidden, true);
    const embed = fixture({embedded: true}); embed.run();
    assert.equal(embed.root.dataset.sbCustomerEnhanced, undefined);
    assert.equal(embed.analyses[0].hidden, false);
    assert.equal(embed.histories[1].hidden, false);
});

test('unchanged scope does not repeat live announcements, and repeated mounts are idempotent', () => {
    const h = fixture(); h.run();
    const writes = h.status.writes, api = h.api(); h.change();
    assert.equal(h.status.writes, writes);
    assert.equal(h.api(), api);
    assert.equal(h.initCount(), 1);
});

test('invalid navigation fails visibly before replacing the stacked reading view', () => {
    const h = fixture();
    h.links[1].setAttribute('href', '#bucket-databases');
    assert.throws(h.run, /navigation does not match/);
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /reading view remains available/);
    assert.equal(h.root.dataset.sbCustomerEnhanced, undefined);
});

test('other pages do not initialize customer controls', () => {
    vm.runInNewContext(source, {window: {}, document: {querySelector: () => null}});
});

test('customer help matches both aliases without claiming legacy product-history routes', () => {
    const helpSource = fs.readFileSync(path.join(__dirname, '../../static/js/page-help.js'), 'utf8');
    for (const pathname of ['/revenue/customer/456', '/customer/456/revenue',
        '/customer/456/revenue/bucket/Databases']) {
        const title = {}, body = {};
        let opened;
        vm.runInNewContext(helpSource + '\nPageHelp.show();', {
            window: {location: {pathname}},
            document: {getElementById: id => id === 'pageHelpModalLabel' ? title : body},
            SBDialog: {toggle: id => { opened = id; }},
        });
        assert.equal(opened, 'pageHelpModal');
        if (pathname.endsWith('/Databases')) {
            assert.notEqual(title.textContent, 'Customer Revenue');
        } else {
            assert.equal(title.textContent, 'Customer Revenue');
            assert.match(body.innerHTML, /includes hidden buckets/);
            assert.match(body.innerHTML, /all imported months/);
        }
    }
});
