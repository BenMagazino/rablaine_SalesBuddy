const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-preferences.js'), 'utf8');

function fixture(saved = null, failure = false) {
    const notice = {hidden: true, textContent: ''};
    const errors = [];
    let value = saved;
    const context = {
        window: {}, console: {error: (...args) => errors.push(args)},
        localStorage: {
            getItem() { if (failure) throw Error('Storage blocked'); return value; },
            setItem(key, next) { if (failure) throw Error('Storage blocked'); value = next; },
            removeItem() { value = null; },
        },
    };
    vm.runInNewContext(source, context);
    return {
        preference: context.window.SBFabricPreferences.customerSelection(notice),
        notice, errors, value: () => value,
    };
}

test('successful customer viewing saves an ID and restores only an existing customer', () => {
    const h = fixture();
    assert.equal(h.preference.restore([{id: 307}]), null);
    h.preference.save(307);
    assert.equal(h.value(), '307');
    assert.equal(h.preference.restore([{id: 307}]), '307');
    assert.equal(h.notice.hidden, true);
});

test('deleted customer is cleared with an explicit notice rather than a failing detail request', () => {
    const h = fixture('307');
    assert.equal(h.preference.restore([{id: 121}]), null);
    assert.equal(h.value(), null);
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /no longer available/);
});

test('invalid preference and blocked storage expose errors', () => {
    for (const h of [fixture('undefined'), fixture('307', true)]) {
        assert.equal(h.preference.restore([{id: 307}]), null);
        assert.equal(h.notice.hidden, false);
        assert.equal(h.errors.length, 1);
    }
    const h = fixture(null, true);
    h.preference.save(307);
    assert.match(h.notice.textContent, /Could not save/);
    assert.equal(h.errors.length, 1);
});

function modeFixture(saved = null, failure = false) {
    const buttons = ['all', 'capacities', 'trials', 'p'].map(mode => ({
        dataset: {mode}, pressed: String(mode === 'capacities'), events: {},
        getAttribute() { return this.pressed; },
        setAttribute(name, value) { this.pressed = value; },
        addEventListener(name, handler) { this.events[name] = handler; },
    }));
    const notice = {hidden: true, setAttribute() {}};
    const errors = [];
    let stored = saved;
    let changes = 0;
    const context = {window: {}, document: {createElement: () => notice},
        console: {error: (...args) => errors.push(args)}, localStorage: {
            getItem() { if (failure) throw Error('Blocked'); return stored; },
            setItem(key, value) { if (failure) throw Error('Blocked'); stored = value; },
        }};
    vm.runInNewContext(source, context);
    const preference = context.window.SBFabricPreferences.bindMode({
        querySelectorAll: () => buttons, after() {},
    }, 'mode', () => changes++);
    return {preference, buttons, notice, errors, stored: () => stored, changes: () => changes};
}

test('view modes default to capacities, restore, and select exactly one audit at a time', () => {
    assert.equal(modeFixture().preference.value, 'capacities');
    const h = modeFixture('trials');
    assert.equal(h.preference.value, 'trials');
    assert.equal(h.changes(), 0);
    for (const mode of ['p', 'all', 'capacities', 'trials']) {
        h.buttons.find(button => button.dataset.mode === mode).events.click();
        assert.equal(h.preference.value, mode);
        assert.equal(h.stored(), mode);
        assert.equal(h.buttons.filter(button => button.pressed === 'true').length, 1);
    }
    assert.equal(h.changes(), 4);
});

test('invalid or blocked view mode preferences show explicit errors without blocking selection', () => {
    const invalid = modeFixture('both');
    assert.equal(invalid.preference.value, 'capacities');
    assert.equal(invalid.notice.hidden, false);
    assert.equal(invalid.errors.length, 1);
    const blocked = modeFixture(null, true);
    blocked.buttons[3].events.click();
    assert.equal(blocked.preference.value, 'p');
    assert.equal(blocked.changes(), 1);
    assert.match(blocked.notice.textContent, /Could not save/);
});
