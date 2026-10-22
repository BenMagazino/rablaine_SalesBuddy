const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-navigation.js'), 'utf8');

test('header customer search keeps one field focus indicator without an inner input outline', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-navigation.css'), 'utf8');
    assert.match(css, /\.sb-search-field:focus-within\s*\{[^}]*border-color:\s*var\(--sb-ui-accent\)/);
    assert.match(css, /\.sb-app-bar \.sb-search-field input:focus-visible\s*\{\s*outline:\s*none/);
    assert.match(css, /\.sb-app-bar :is\(button, a, input\):focus-visible\s*\{[^}]*outline:\s*2px/);
});

function navigation({
    embedded = false, missingMenu = false, pageMenu = false, headerBottom = 46,
    diagnostics = false,
} = {}) {
    const listeners = new Map();
    const windowListeners = new Map();
    const properties = new Map();
    const observers = {};
    const timers = new Map();
    let timerId = 0;
    const document = {
        activeElement: null, body: {},
        documentElement: {style: {setProperty: (key, value) => properties.set(key, value)}},
    };
    function element(kind) {
        const attributes = new Map();
        const handlers = new Map();
        return {
            kind, attributes, handlers, style: {}, dataset: {},
            setAttribute: (name, value) => attributes.set(name, value),
            addEventListener: (name, callback) => handlers.set(name, callback),
            getBoundingClientRect: () => ({left: 100, bottom: 38, width: 250}),
            focus(options) { this.focusOptions = options; document.activeElement = this; },
            contains(target) { return target === this || this.links?.includes(target); },
            closest(selector) {
                if (selector === '[data-sb-menu]' && kind === 'trigger') return this;
                if (selector === 'a[href]' && kind === 'link') return this;
                return null;
            },
            showPopover() { this.open = true; },
            hidePopover() { this.open = false; },
            emit(name, event = {}) { this.handlers.get(name)?.(event); },
        };
    }
    const triggers = [element('trigger'), element('trigger')];
    const menus = [element('menu'), element('menu')];
    menus.forEach(menu => {
        menu.links = [element('link'), element('link'), element('link')];
        menu.querySelectorAll = selector => selector === 'a[href]' ? menu.links : [];
    });
    triggers.forEach((trigger, index) => { trigger.dataset.sbMenu = `menu-${index}`; });
    if (pageMenu) triggers[1].dataset.sbMenuAnchor = 'trigger';
    const bar = element('bar');
    bar.getBoundingClientRect = () => ({bottom: headerBottom});
    bar.querySelectorAll = () => triggers;
    document.querySelector = () => embedded ? null : bar;
    document.querySelectorAll = () => embedded && !pageMenu ? [] : triggers;
    document.getElementById = id => missingMenu ? null : menus[Number(id.slice(-1))];
    document.addEventListener = (name, callback) => listeners.set(name, callback);
    const window = {innerWidth: 1000, innerHeight: 800,
        addEventListener(name, callback) {
            if (!windowListeners.has(name)) windowListeners.set(name, []);
            windowListeners.get(name).push(callback);
        },
    };
    const diagnosticEvents = [];
    if (diagnostics) window.SBNavDiagnostics = {
        menu(action, trigger, reason) { diagnosticEvents.push({action, trigger, reason}); },
    };
    vm.runInNewContext(script, {
        document, window,
        MutationObserver: class {
            constructor(callback) { observers.chrome = callback; }
            observe() {}
        },
        ResizeObserver: class {
            constructor(callback) { observers.size = callback; }
            observe() {}
        },
        setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
        clearTimeout: id => timers.delete(id),
    });
    function emit(name, target, key) {
        const event = {target, key, prevented: false, stopped: false,
            preventDefault() { this.prevented = true; },
            stopImmediatePropagation() { this.stopped = true; }};
        listeners.get(name)?.(event);
        return event;
    }
    return {document, triggers, menus, emit, properties, observers, diagnosticEvents,
        moveHeader(bottom) { headerBottom = bottom; },
        windowEvent(name) { windowListeners.get(name)?.forEach(callback => callback()); },
        flushTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); }};
}

test('diagnostic hooks identify hover and link close without canceling the click or moving focus', () => {
    const nav = navigation({diagnostics: true});
    nav.triggers[0].emit('pointerenter');
    assert.equal(nav.menus[0].open, undefined);
    nav.flushTimers();
    assert.equal(nav.diagnosticEvents[0].reason, 'hover');
    const event = {target: nav.menus[0].links[1],
        preventDefault() { assert.fail('Navigation must not be canceled by diagnostics'); }};
    nav.menus[0].emit('click', event);
    assert.equal(nav.menus[0].open, false);
    assert.equal(nav.document.activeElement, null);
    assert.equal(nav.diagnosticEvents.at(-1).reason, 'link-click');
});

test('diagnostic close reasons preserve escape focus and outside dismissal behavior', () => {
    const nav = navigation({diagnostics: true});
    nav.emit('keydown', nav.triggers[0], 'ArrowDown');
    assert.equal(nav.diagnosticEvents.at(-1).reason, 'keyboard');
    nav.emit('keydown', nav.document.activeElement, 'Escape');
    assert.equal(nav.diagnosticEvents.at(-1).reason, 'escape');
    assert.equal(nav.document.activeElement, nav.triggers[0]);
    nav.triggers[0].emit('click');
    nav.emit('pointerdown', {});
    assert.equal(nav.diagnosticEvents.at(-1).reason, 'outside-pointer');
});

test('flyouts use the actual navbar bottom including desktop title and menu chrome', () => {
    const nav = navigation({headerBottom: 106});
    assert.equal(nav.properties.get('--sb-ui-flyout-top'), '106px');
    nav.triggers[0].emit('click');
    assert.equal(nav.menus[0].style.top, '106px');
});

test('flyout docking follows chrome insertion, header resizing, window resizing and scrolling', () => {
    const nav = navigation();
    assert.equal(nav.properties.get('--sb-ui-flyout-top'), '46px');
    for (const [bottom, refresh] of [
        [106, nav.observers.chrome], [116, nav.observers.size],
        [120, () => nav.windowEvent('resize')], [46, () => nav.windowEvent('scroll')],
        [-10, () => nav.windowEvent('scroll')],
    ]) {
        nav.moveHeader(bottom);
        refresh();
        assert.equal(nav.properties.get('--sb-ui-flyout-top'), `${Math.max(0, bottom)}px`);
    }
});

test('headerless embeds do not reserve navbar space for flyouts', () => {
    const nav = navigation({embedded: true});
    assert.equal(nav.properties.get('--sb-ui-flyout-top'), '0px');
    assert.deepEqual(nav.observers, {});
});

test('click opens only one native menu and positions it below the header', () => {
    const nav = navigation();
    nav.triggers[0].emit('click');
    assert.equal(nav.menus[0].open, true);
    assert.equal(nav.triggers[0].attributes.get('aria-expanded'), 'true');
    assert.equal(nav.menus[0].style.top, '46px');
    assert.equal(nav.menus[0].style.maxHeight, '746px');
    nav.triggers[1].emit('click');
    assert.equal(nav.menus[0].open, false);
    assert.equal(nav.menus[1].open, true);
    nav.triggers[1].emit('click');
    assert.equal(nav.menus[1].open, false);
    assert.equal(nav.document.activeElement, nav.triggers[1]);
});

test('page menus anchor to their command while retaining shared keyboard and focus behavior', () => {
    for (const embedded of [false, true]) {
        const nav = navigation({pageMenu: true, embedded});
        nav.emit('keydown', nav.triggers[1], 'ArrowDown');
        assert.equal(nav.menus[1].style.top, '38px');
        assert.equal(nav.menus[1].style.maxHeight, '754px');
        assert.equal(nav.document.activeElement, nav.menus[1].links[0]);
        nav.emit('keydown', nav.document.activeElement, 'Escape');
        assert.equal(nav.menus[1].open, false);
        assert.equal(nav.document.activeElement, nav.triggers[1]);
    }
});

test('page scrolling dismisses command menus without a focus jump; menu scrolling and header menus stay open', () => {
    const nav = navigation({pageMenu: true});
    nav.emit('keydown', nav.triggers[1], 'ArrowDown');
    nav.emit('scroll', nav.menus[1]);
    assert.equal(nav.menus[1].open, true);
    nav.emit('scroll', {});
    assert.equal(nav.menus[1].open, false);
    assert.equal(nav.document.activeElement, nav.triggers[1]);
    assert.equal(nav.triggers[1].focusOptions.preventScroll, true);
    nav.triggers[0].emit('click');
    nav.emit('scroll', {});
    assert.equal(nav.menus[0].open, true);
});

test('keyboard supports first/last, wrapping and Home/End navigation', () => {
    const nav = navigation();
    nav.emit('keydown', nav.triggers[0], 'ArrowUp');
    assert.equal(nav.document.activeElement, nav.menus[0].links[2]);
    nav.emit('keydown', nav.document.activeElement, 'ArrowDown');
    assert.equal(nav.document.activeElement, nav.menus[0].links[0]);
    nav.emit('keydown', nav.document.activeElement, 'End');
    assert.equal(nav.document.activeElement, nav.menus[0].links[2]);
    nav.emit('keydown', nav.document.activeElement, 'Home');
    assert.equal(nav.document.activeElement, nav.menus[0].links[0]);
    for (const link of nav.menus[0].links) {
        assert.equal(link.attributes.get('role'), 'menuitem');
        assert.equal(link.attributes.get('tabindex'), '-1');
    }
});

test('Escape consumes the event before page-level cancel and restores trigger focus', () => {
    const nav = navigation();
    nav.emit('keydown', nav.triggers[0], 'ArrowDown');
    const event = nav.emit('keydown', nav.document.activeElement, 'Escape');
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.equal(nav.menus[0].open, false);
    assert.equal(nav.document.activeElement, nav.triggers[0]);
});

test('Tab closes without preventing the normal focus transition', () => {
    const nav = navigation();
    nav.emit('keydown', nav.triggers[0], 'ArrowDown');
    const event = nav.emit('keydown', nav.document.activeElement, 'Tab');
    assert.equal(event.prevented, false);
    assert.equal(nav.document.activeElement, nav.triggers[0]);
    assert.equal(nav.menus[0].open, false);
});

test('outside pointer/focus and opening native dialogs dismiss menus', () => {
    for (const name of ['pointerdown', 'focusin', 'sb:dialog-opening']) {
        const nav = navigation();
        nav.triggers[0].emit('click');
        nav.emit(name, {});
        assert.equal(nav.menus[0].open, false, name);
    }
});

test('dialog opening restores a focused menu trigger without stealing outside focus', () => {
    const nav = navigation();
    nav.emit('keydown', nav.triggers[0], 'ArrowDown');
    nav.emit('sb:dialog-opening', {});
    assert.equal(nav.document.activeElement, nav.triggers[0]);
    const external = {kind: 'input'};
    nav.document.activeElement = external;
    nav.triggers[0].emit('pointerenter');
    nav.flushTimers();
    nav.emit('sb:dialog-opening', {});
    assert.equal(nav.document.activeElement, external);
});

test('hover crosses from trigger to menu without premature dismissal', () => {
    const nav = navigation();
    nav.triggers[0].emit('pointerenter');
    nav.flushTimers();
    assert.equal(nav.menus[0].open, true);
    nav.triggers[0].emit('pointerleave');
    nav.menus[0].emit('pointerenter');
    nav.flushTimers();
    assert.equal(nav.menus[0].open, true);
    nav.menus[0].emit('pointerleave');
    nav.flushTimers();
    assert.equal(nav.menus[0].open, false);
});

test('native link click closes without replacing navigation behavior', () => {
    const nav = navigation();
    nav.triggers[0].emit('click');
    nav.menus[0].emit('click', {target: nav.menus[0].links[0]});
    assert.equal(nav.menus[0].open, false);
});

test('embedded pages need no navigation and missing menu configuration fails explicitly', () => {
    assert.doesNotThrow(() => navigation({embedded: true}));
    assert.throws(() => navigation({missingMenu: true}), /Navigation menu is missing/);
});

async function customerSearch(response) {
    const template = fs.readFileSync(path.join(__dirname, '../../templates/base.html'), 'utf8');
    const section = template.slice(template.indexOf('<!-- Navbar Inline Customer Search -->'),
        template.indexOf('<!-- Global Keyboard Shortcuts -->'));
    const source = section.match(/<script defer>([\s\S]+?)<\/script>/)[1];
    function element() {
        return {style: {}, dataset: {}, handlers: new Map(), value: '', children: [],
            addEventListener(name, callback) { this.handlers.set(name, callback); },
            querySelector() { return null; },
            setAttribute() {},
            append(...children) { this.children.push(...children); },
            replaceChildren(...children) { this.children = children; }};
    }
    const search = element();
    const results = element();
    const errors = [];
    let onLoad;
    vm.runInNewContext(source, {
        window: {addEventListener: (_name, handler) => { onLoad = handler; }},
        document: {
            getElementById: id => id === 'navCustomerSearch' ? search : results,
            createElement: element, body: {appendChild() {}}, addEventListener() {},
        },
        console: {error: (...args) => errors.push(args)},
        fetch: async () => response,
    });
    onLoad();
    await search.handlers.get('focus').call(search);
    return {search, results, errors};
}

test('customer search exposes HTTP and malformed responses without null-array crashes', async () => {
    for (const response of [
        {ok: false, status: 503},
        {ok: true, json: async () => ({error: 'Unavailable'})},
    ]) {
        const result = await customerSearch(response);
        assert.match(result.results.innerHTML, /Error loading customers/);
        assert.equal(result.results.style.display, 'block');
        assert.equal(result.errors.length, 1);
    }
});

test('customer search renders names and TPID as text, not interpreted HTML', async () => {
    const result = await customerSearch({ok: true, json: async () => [
        {id: 1, name: '<Test>', nickname: 'Nickname', tpid: '<TPID>'},
    ]});
    const link = result.results.children[0];
    assert.equal(link.children[1].textContent, '<Test> (Nickname)');
    assert.equal(link.children[2].textContent, 'TPID: <TPID>');
    assert.equal(link.dataset.index, '0');
    assert.equal(result.errors.length, 0);
});

test('customer search Escape does not reach the page-level Cancel shortcut', async () => {
    const result = await customerSearch({ok: true, json: async () => []});
    result.search.blur = () => {};
    const event = {key: 'Escape', prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; }};
    result.search.handlers.get('keydown')(event);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.equal(result.results.style.display, 'none');
});

test('customer details highlight the correct direct or Browse destination by role', () => {
    const template = fs.readFileSync(path.join(__dirname, '../../templates/base.html'), 'utf8');
    const section = template.slice(template.indexOf('<!-- Navbar active state highlighting -->'),
        template.indexOf('<!-- Seller Mode Scripts -->'));
    const source = section.match(/<script>([\s\S]+?)<\/script>/)[1];
    for (const dss of [false, true]) {
        function item(href) {
            return {active: false, classList: {add() { this.owner.active = true; }},
                getAttribute: () => href, querySelectorAll: () => []};
        }
        const direct = item('/customers');
        const browse = item('#');
        const customerLink = item('/customers');
        for (const element of [direct, browse, customerLink]) element.classList.owner = element;
        browse.querySelectorAll = () => [customerLink];
        vm.runInNewContext(source, {
            window: {location: {pathname: '/customer/123'}},
            document: {
                getElementById: id => id === 'navBrowse' ? browse :
                    id === 'navCustomers' && dss ? direct : null,
                querySelector: () => customerLink,
            },
        });
        assert.equal(direct.active, dss);
        assert.equal(browse.active, !dss);
        assert.equal(customerLink.active, !dss);
    }
});
