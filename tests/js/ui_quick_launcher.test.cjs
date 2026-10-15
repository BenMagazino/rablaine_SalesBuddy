const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {matchingPages} = require('../../static/js/ui-quick-launcher.js');

const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-quick-launcher.js'), 'utf8');

function launcher({embedded = false} = {}) {
    const document = {activeElement: null};
    class Element {
        constructor(tag, text = '') {
            this.tagName = tag.toUpperCase();
            this.textContent = text;
            this.children = [];
            this.handlers = new Map();
            this.attributes = new Map();
            this.value = '';
            this.open = false;
        }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        setAttribute(name, value) { this.attributes.set(name, value); }
        addEventListener(name, handler) { this.handlers.set(name, handler); }
        querySelectorAll() { return this.children.filter(child => child.tagName === 'A'); }
        querySelector(selector) { return this.records?.[selector] || null; }
        focus() { document.activeElement = this; }
        select() { this.selected = true; }
        click() { this.clicked = true; }
    }
    function link(title, href) {
        const element = new Element('a', title);
        element.setAttribute('href', href);
        return element;
    }
    const nav = {
        '#reportsMenu a[href]': [
            link('Whitespace Analysis', '/reports/whitespace'),
            link('Workload Report', '/reports/workload'),
            link('Milestone Tracker', '/reports/milestone-tracker'),
        ],
        '#browseMenu a[href]': [
            link('Milestones', '/reports/milestone-tracker'),
            link('External', 'https://example.com'),
            link('Network URL', '//example.com'),
            link('Action', '#'),
        ],
        '#settingsMenu a[href]': [link('Admin Panel Update', '/admin')],
        '#navCustomers a[href]': [link('', '/customers')],
    };
    nav['#settingsMenu a[href]'][0].records = {
        '.sb-update-label': new Element('span', 'Update'),
    };
    nav['#navCustomers a[href]'][0].setAttribute('aria-label', 'Customers');
    const extras = new Element('template');
    extras.content = new Element('div');
    extras.content.append(link('Home', '/'), link('Sync Status', '/admin/sync-console'));
    const dialog = new Element('dialog');
    const input = new Element('input');
    const results = new Element('div');
    const count = new Element('p');
    dialog.records = {'#quickLauncherSearch': input, '#quickLauncherResults': results,
        '#quickLauncherCount': count, template: extras};
    let shortcut;
    document.getElementById = () => embedded ? null : dialog;
    document.createElement = tag => new Element(tag);
    document.querySelectorAll = selector => nav[selector] || [];
    document.addEventListener = (name, handler, capture) => {
        assert.equal(name, 'keydown');
        assert.equal(capture, true);
        shortcut = handler;
    };
    let openings = 0;
    let forwarded = 0;
    const window = {};
    window.parent = embedded ? {SBQuickLauncher: {open() { forwarded++; }}} : window;
    vm.runInNewContext(source, {window, document, SBDialog: {
        open(element) {
            openings++;
            element.open = true;
            element.handlers.get('sb:dialog-opened')();
        },
    }});
    function key(target, key, options = {}) {
        const event = {key, ctrlKey: false, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this.stopped = true; }, ...options};
        (target ? target.handlers.get('keydown') : shortcut)(event);
        return event;
    }
    return {
        window, document, dialog, input, results, count, key, nav,
        links: () => results.querySelectorAll('a[href]'),
        openings: () => openings, forwarded: () => forwarded,
        open() { window.SBQuickLauncher.open(); },
        query(value) { input.value = value; input.handlers.get('input')(); },
    };
}

test('matching is case-insensitive anywhere in a title or navigation alias', () => {
    const pages = [
        {title: 'Whitespace Analysis', aliases: []},
        {title: 'Milestone Tracker', aliases: ['Milestones']},
        {title: 'Revenue Analyzer', aliases: []},
    ];
    assert.deepEqual(matchingPages(pages, '  SPACE '), [pages[0]]);
    assert.deepEqual(matchingPages(pages, 'analy'), [pages[2], pages[0]]);
    assert.deepEqual(matchingPages(pages, 'milestones'), [pages[1]]);
    assert.deepEqual(matchingPages(pages, 'missing'), []);
    assert.equal(pages[0].title, 'Whitespace Analysis');
});

test('catalog reuses navigation, deduplicates destinations and skips non-page URLs', () => {
    const ui = launcher();
    ui.open();
    assert.equal(ui.links().length, 7);
    ui.query('milestones');
    assert.equal(ui.links().length, 1);
    assert.equal(ui.links()[0].children[1].textContent, 'Milestone Tracker');
    assert.equal(ui.links()[0].href, '/reports/milestone-tracker');
    ui.query('admin');
    assert.equal(ui.links()[0].children[1].textContent, 'Admin Panel');
    ui.query('Update');
    assert.equal(ui.links().length, 0);
    ui.query('customers');
    assert.equal(ui.links()[0].href, '/customers');
});

test('Ctrl+Space opens from typing contexts and works before modal bubbling handlers', () => {
    const ui = launcher();
    const event = ui.key(null, ' ', {ctrlKey: true, target: {tagName: 'TEXTAREA'}});
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.stopped, true);
    assert.equal(ui.openings(), 1);
    assert.equal(ui.document.activeElement, ui.input);
    ui.key(null, ' ', {ctrlKey: true, repeat: true});
    assert.equal(ui.openings(), 1);
});

test('plain Space, modified shortcuts and composition retain their original ownership', () => {
    const ui = launcher();
    for (const options of [{}, {ctrlKey: true, altKey: true},
        {ctrlKey: true, shiftKey: true}, {ctrlKey: true, metaKey: true},
        {ctrlKey: true, isComposing: true}, {ctrlKey: true, defaultPrevented: true}]) {
        ui.key(null, ' ', options);
    }
    assert.equal(ui.openings(), 0);
});

test('Enter opens the first match, arrows move through links, and Tab remains native', () => {
    const ui = launcher();
    ui.open();
    ui.query('whit');
    ui.key(ui.input, 'Enter');
    assert.equal(ui.links()[0].clicked, true);
    ui.query('');
    ui.key(ui.input, 'ArrowDown');
    assert.equal(ui.document.activeElement, ui.links()[0]);
    ui.key(ui.results, 'ArrowDown');
    assert.equal(ui.document.activeElement, ui.links()[1]);
    ui.key(ui.results, 'ArrowUp');
    assert.equal(ui.document.activeElement, ui.links()[0]);
    ui.key(ui.results, 'ArrowUp');
    assert.equal(ui.document.activeElement, ui.input);
    ui.key(ui.input, 'ArrowUp');
    assert.equal(ui.document.activeElement, ui.links().at(-1));
    ui.key(ui.results, ' ');
    assert.equal(ui.links().at(-1).clicked, true);
    assert.equal(ui.key(ui.input, 'Tab').defaultPrevented, false);
});

test('no matches remain safe, and composition Enter does not navigate', () => {
    const ui = launcher();
    ui.open();
    ui.query('not a page');
    assert.equal(ui.count.textContent, '0 pages');
    assert.equal(ui.results.children[0].textContent, 'No pages match your search.');
    ui.key(ui.input, 'Enter');
    ui.query('whit');
    ui.key(ui.input, 'Enter', {isComposing: true});
    assert.equal(ui.links()[0].clicked, undefined);
});

test('reopening resets search; invoking an open launcher selects the existing query', () => {
    const ui = launcher();
    ui.open();
    ui.query('whit');
    ui.open();
    assert.equal(ui.input.value, 'whit');
    assert.equal(ui.input.selected, true);
    assert.equal(ui.openings(), 1);
    ui.dialog.open = false;
    ui.open();
    assert.equal(ui.input.value, '');
    assert.equal(ui.links().length, 7);
});

test('embedded pages forward the shortcut to their parent launcher', () => {
    const ui = launcher({embedded: true});
    ui.key(null, ' ', {ctrlKey: true});
    assert.equal(ui.forwarded(), 1);
    assert.equal(ui.openings(), 0);
});
