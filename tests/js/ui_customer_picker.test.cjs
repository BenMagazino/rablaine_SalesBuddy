const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const template = fs.readFileSync(path.join(__dirname, '../../templates/base.html'), 'utf8');
const section = template.slice(template.indexOf('<!-- Shared customer picker initialization -->'),
    template.indexOf('<!-- Navbar Inline Customer Search -->'));
const inline = section.match(/<script defer>([\s\S]+?)<\/script>/)[1];
const source = inline.slice(inline.indexOf('function setupCustomerSearchModal'));
const customers = [
    {id: 7, name: 'Alpha & Co', nickname: 'First', tpid: 12345},
    {id: 8, name: 'Beta', nickname: null, tpid: '67890'},
];

test('native picker pins its top, sizes results naturally and indicates focus on the field only', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-dialog.css'), 'utf8');
    const dialog = css.match(/\.sb-dialog-picker\s*\{([^}]+)\}/)[1];
    const results = css.match(/\.sb-picker-results\s*\{([^}]+)\}/)[1];
    assert.match(dialog, /margin:\s*48px auto auto;/);
    assert.doesNotMatch(results, /(?:^|;)\s*height:/);
    assert.match(results, /flex:\s*0 1 auto;/);
    assert.match(results, /min-height:\s*0;/);
    assert.match(results, /max-height:\s*400px;/);
    assert.match(css, /\.sb-dialog \.sb-picker-input:focus-visible\s*\{\s*outline:\s*none;/);
    assert.match(css, /\.sb-picker-field:focus-within\s*\{\s*border-color:/);
});

function picker({native = true, general = true, response, suffix = () => ''} = {}) {
    const document = {activeElement: null};
    class Element {
        constructor(tag) {
            this.tagName = tag.toUpperCase();
            this.children = [];
            this.dataset = {};
            this.handlers = new Map();
            this.attributes = new Map();
            this.value = '';
        }
        append(...children) {
            children.forEach(child => { child.parent = this; this.children.push(child); });
        }
        replaceChildren(...children) { this.children = []; this.append(...children); }
        setAttribute(name, value) { this.attributes.set(name, value); }
        addEventListener(name, callback) { this.handlers.set(name, callback); }
        focus() { document.activeElement = this; }
        click() { this.clicked = true; return this.handlers.get('click')?.({target: this}); }
        querySelectorAll(selector) {
            const descendants = this.children.flatMap(child => [
                child, ...child.querySelectorAll('*'),
            ]);
            if (selector === '*') return descendants;
            return descendants.filter(child => child.tagName === 'A' &&
                (selector === 'a[data-sb-picker-link]' ? child.dataset.sbPickerLink :
                    child.dataset.sbCustomerId !== undefined));
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    }
    const modal = new Element(native ? 'dialog' : 'div');
    const input = new Element('input');
    const results = new Element('div');
    const records = new Map([['picker', modal], ['query', input], ['choices', results]]);
    document.getElementById = id => records.get(id);
    document.createElement = tag => new Element(tag);
    document.createTextNode = text => {
        const node = new Element('#text');
        node.textContent = text;
        return node;
    };
    const errors = [];
    let requests = 0;
    let nextResponse = response;
    const context = {
        document, console: {error: (...args) => errors.push(args)},
        fetch: async () => {
            requests++;
            return typeof nextResponse === 'function' ? nextResponse() :
                nextResponse || {ok: true, json: async () => customers};
        },
    };
    vm.runInNewContext(source, context);
    context.setupCustomerSearchModal('picker', 'query', 'choices',
        general ? '/note/new?customer_id=' : '/customer/',
        general ? '/note/new' : null, suffix);
    function key(target, key) {
        const event = {target, key, prevented: false,
            preventDefault() { this.prevented = true; }};
        target.handlers.get('keydown').call(target, event);
        return event;
    }
    function links() { return results.querySelectorAll('a[data-sb-picker-link]'); }
    return {
        document, modal, input, results, errors, context, links, key,
        requests: () => requests,
        setResponse(value) { nextResponse = value; },
        open() {
            return modal.handlers.get(native ? 'sb:dialog-opened' : 'shown.bs.modal')({target: modal});
        },
        close() {
            modal.handlers.get(native ? 'sb:dialog-closed' : 'hidden.bs.modal')({target: modal});
        },
        query(value) { input.value = value; input.handlers.get('input').call(input); },
    };
}

test('native note picker preserves general option, customer URLs, labels and TPID', async () => {
    const h = picker();
    await h.open();
    assert.equal(h.document.activeElement, h.input);
    assert.deepEqual(h.links().map(link => link.href),
        ['/note/new', '/note/new?customer_id=7', '/note/new?customer_id=8']);
    assert.equal(h.links()[0].children[1].textContent, 'Not Customer Associated');
    assert.equal(h.links()[0].children[2].textContent, 'General Note');
    assert.equal(h.links()[1].children[1].textContent, 'Alpha & Co (First)');
    assert.equal(h.links()[1].children[2].textContent, 'TPID: 12345');
    assert.equal(h.results.attributes.get('aria-busy'), 'false');
});

test('engagement picker requires a customer and preserves the create-form destination', async () => {
    const h = picker({general: false, suffix: () => '/engagement/new'});
    await h.open();
    assert.deepEqual(h.links().map(link => link.href),
        ['/customer/7/engagement/new', '/customer/8/engagement/new']);
    h.query('nothing matches');
    assert.equal(h.links().length, 0);
    assert.equal(h.results.children[0].children[0].textContent, 'No customers found');
});

test('name, nickname and TPID filtering keeps the general note and Enter skips it', async () => {
    const h = picker();
    await h.open();
    for (const query of ['ALPHA', 'first', '12345']) {
        h.query(query);
        assert.equal(h.links().length, 2);
        assert.match(h.links()[1].className, /enter-target/);
        h.key(h.input, 'Enter');
        assert.equal(h.links()[1].clicked, true);
        assert.equal(h.links()[0].clicked, undefined);
    }
    h.query('not found');
    assert.equal(h.links().length, 1);
    h.key(h.input, 'Enter');
    assert.equal(h.links()[0].clicked, undefined);
    h.query('');
    assert.equal(h.links().length, 3);
    assert.doesNotMatch(h.links()[1].className, /enter-target/);
});

test('arrows move through links and back to search; Space activates a focused result', async () => {
    const h = picker();
    await h.open();
    h.key(h.input, 'ArrowDown');
    assert.equal(h.document.activeElement, h.links()[0]);
    h.key(h.results, 'ArrowDown');
    assert.equal(h.document.activeElement, h.links()[1]);
    h.key(h.results, ' ');
    assert.equal(h.links()[1].clicked, true);
    h.key(h.results, 'ArrowUp');
    h.key(h.results, 'ArrowUp');
    assert.equal(h.document.activeElement, h.input);
    h.key(h.input, 'ArrowUp');
    assert.equal(h.document.activeElement, h.links().at(-1));
    h.key(h.results, 'ArrowDown');
    assert.equal(h.document.activeElement, h.links().at(-1));
});

test('close clears search/results, and reopen uses the cached data', async () => {
    const h = picker();
    await h.open();
    h.query('Beta');
    h.close();
    assert.equal(h.input.value, '');
    assert.equal(h.links().length, 0);
    await h.open();
    assert.equal(h.links().length, 3);
    assert.equal(h.requests(), 1);
});

test('late requests cannot repopulate a closed picker and rapid reopen shares one request', async () => {
    let finish;
    const h = picker({response: () => new Promise(resolve => { finish = resolve; })});
    const first = h.open();
    h.close();
    const second = h.open();
    h.query('Beta');
    finish({ok: true, json: async () => customers});
    await Promise.all([first, second]);
    assert.equal(h.requests(), 1);
    assert.equal(h.links().length, 2);
    assert.equal(h.links()[1].dataset.sbCustomerId, '8');
    let finishClosed;
    const closed = picker({response: () => new Promise(resolve => { finishClosed = resolve; })});
    const pending = closed.open();
    closed.close();
    finishClosed({ok: true, json: async () => customers});
    await pending;
    assert.equal(closed.links().length, 0);
});

test('HTTP, malformed arrays and network errors are logged, visible and retryable', async () => {
    for (const response of [
        {ok: false, status: 503},
        {ok: true, json: async () => ({error: 'Unavailable'})},
        {ok: true, json: async () => [{id: 1}]},
        () => { throw new Error('Network unavailable'); },
    ]) {
        const h = picker({response});
        await h.open();
        const state = h.results.children[0];
        assert.equal(state.attributes.get('role'), 'alert');
        assert.match(state.children[0].textContent, /Error loading customers/);
        assert.equal(h.errors.length, 1);
        h.setResponse({ok: true, json: async () => customers});
        state.children[1].focus();
        await state.children[1].click();
        assert.equal(h.links().length, 3);
        assert.equal(h.document.activeElement, h.input);
    }
});

test('loading uses the current query, and names/nicknames/TPIDs remain plain text', async () => {
    let finish;
    const h = picker({response: () => new Promise(resolve => { finish = resolve; })});
    const pending = h.open();
    assert.equal(h.results.attributes.get('aria-busy'), 'true');
    assert.match(h.results.children[0].children[0].textContent, /Loading/);
    h.query('test');
    finish({ok: true, json: async () => [
        {id: 1, name: '<Test>', nickname: '<Nickname>', tpid: '<TPID>'},
    ]});
    await pending;
    assert.equal(h.links()[1].children[1].textContent, '<Test> (<Nickname>)');
    assert.equal(h.links()[1].children[2].textContent, 'TPID: <TPID>');
});

test('legacy calendar picker retains styling and customer/general dates across cached reopen', async () => {
    let date = '&date=2026-10-09';
    const h = picker({native: false, suffix: () => date});
    await h.open();
    assert.deepEqual(h.links().map(link => link.href),
        ['/note/new?date=2026-10-09', '/note/new?customer_id=7&date=2026-10-09',
            '/note/new?customer_id=8&date=2026-10-09']);
    assert.match(h.links()[0].className, /list-group-item-light/);
    h.close();
    date = '&date=2026-10-12';
    await h.open();
    assert.equal(h.links()[0].href, '/note/new?date=2026-10-12');
    assert.equal(h.links()[1].href, '/note/new?customer_id=7&date=2026-10-12');
    assert.equal(h.requests(), 1);
});

test('missing required markup throws, while the absent calendar host is explicitly optional', () => {
    const h = picker();
    assert.throws(() => h.context.setupCustomerSearchModal('missing', 'missing', 'missing'),
        /Customer picker markup is incomplete/);
    assert.doesNotThrow(() =>
        h.context.setupCustomerSearchModal('absent', 'absent', 'absent', '', null, null, true));
});
