const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-dialog.js'), 'utf8');

function dialogs() {
    const listeners = new Map();
    const pending = [];
    const events = [];
    const document = {
        addEventListener: (type, handler) => listeners.set(type, handler),
        getElementById: id => records.get(id),
    };
    class Element {
        constructor() {
            this.dataset = {};
            this.handlers = new Map();
            this.isConnected = true;
        }
        addEventListener(type, handler) { this.handlers.set(type, handler); }
        focus() { document.activeElement = this; }
        closest(selector) {
            if (selector === '[data-sb-dialog-escape-owner][aria-expanded="true"]') {
                return this.dataset.sbDialogEscapeOwner !== undefined && this.expanded ? this : null;
            }
            if (selector === '[inert]') return this.inert ? this : null;
            if (selector === '.sb-dialog') return this.parent;
            if (selector === '[data-sb-dialog]' && this.dataset.sbDialog) return this;
            if (selector === '[data-sb-dialog-close]' && this.dismiss) return this;
            return null;
        }
        dispatchEvent(event) {
            event.target ||= this;
            events.push(event);
            this.handlers.get(event.type)?.(event);
            if (event.bubbles && !event.stopped) listeners.get(event.type)?.(event);
            return !event.defaultPrevented;
        }
    }
    class Dialog extends Element {
        constructor(id) {
            super();
            this.id = id;
            this.classList = {contains: name => name === 'sb-dialog'};
            this.open = false;
            this.button = new Element();
            this.button.parent = this;
        }
        showModal() { this.open = true; this.button.focus(); }
        close(reason) { this.open = false; this.returnValue = reason; pending.push(this); }
        contains(element) { return element === this || element?.parent === this; }
        querySelector() { return this.button; }
        getBoundingClientRect() { return {left: 100, top: 100, right: 500, bottom: 500}; }
    }
    const records = new Map([['first', new Dialog('first')], ['second', new Dialog('second')]]);
    const opener = new Element();
    opener.focus();
    const window = {};
    class CustomEvent {
        constructor(type, options) { this.type = type; Object.assign(this, options); }
        preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
    }
    vm.runInNewContext(source, {document, window, Element, HTMLDialogElement: Dialog, CustomEvent});
    function emit(type, target = document.activeElement, key) {
        const event = {target, key, prevented: false, stopped: false,
            preventDefault() { this.prevented = true; },
            stopImmediatePropagation() { this.stopped = true; }};
        listeners.get(type)?.(event);
        return event;
    }
    function flush() {
        for (const dialog of pending.splice(0)) dialog.dispatchEvent({type: 'close'});
    }
    return {api: window.SBDialog, document, opener, records, events, emit, flush, Element};
}

test('native show/close is idempotent, emits lifecycle and restores its opener', () => {
    const h = dialogs();
    h.api.open('first');
    h.api.open('first');
    assert.equal(h.records.get('first').open, true);
    assert.equal(h.events.filter(e => e.type === 'sb:dialog-opened').length, 1);
    h.api.close('first', 'button');
    assert.equal(h.document.activeElement, h.opener);
    h.flush();
    assert.equal(h.events.filter(e => e.type === 'sb:dialog-closed').length, 1);
    assert.equal(h.events.find(e => e.type === 'sb:dialog-closed').detail.reason, 'button');
});

test('opener is captured after opening handlers dismiss a previous menu', () => {
    const h = dialogs();
    const menuTrigger = new h.Element();
    h.document.addEventListener('sb:dialog-opening', () => menuTrigger.focus());
    h.api.open('first');
    h.api.close('first');
    assert.equal(h.document.activeElement, menuTrigger);
});

test('Escape closes only the top dialog without reaching background Cancel', () => {
    const h = dialogs();
    h.api.open('first');
    h.api.open('second');
    const event = h.emit('keydown', h.document.activeElement, 'Escape');
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.equal(h.records.get('second').open, false);
    assert.equal(h.records.get('first').open, true);
    assert.equal(h.document.activeElement, h.records.get('first').button);
    h.emit('keydown', h.document.activeElement, 'Escape');
    assert.equal(h.document.activeElement, h.opener);
});

test('Escape policy blocks both keyboard and native cancellation', () => {
    const h = dialogs();
    const dialog = h.records.get('first');
    dialog.dataset.sbEscapeClose = 'false';
    h.api.open(dialog);
    assert.equal(h.emit('keydown', dialog.button, 'Escape').stopped, true);
    dialog.dispatchEvent({type: 'cancel', preventDefault() {}});
    assert.equal(dialog.open, true);
});
test('expanded owned popups handle Escape before their enclosing dialog closes', () => {
    const h = dialogs();
    h.api.open('first');
    const popup = new h.Element();
    popup.parent = h.records.get('first');
    popup.dataset.sbDialogEscapeOwner = '';
    popup.expanded = true;
    const owned = h.emit('keydown', popup, 'Escape');
    assert.equal(owned.prevented, false);
    assert.equal(owned.stopped, false);
    assert.equal(h.records.get('first').open, true);
    popup.expanded = false;
    h.emit('keydown', popup, 'Escape');
    assert.equal(h.records.get('first').open, false);
});

test('cancelable before-close guards protect button, Escape and backdrop dismissal', () => {
    const h = dialogs();
    const dialog = h.records.get('first');
    dialog.dataset.sbBackdropClose = 'true';
    dialog.addEventListener('sb:dialog-before-close', event => event.preventDefault());
    h.api.open(dialog);
    h.api.close(dialog, 'button');
    h.emit('keydown', dialog.button, 'Escape');
    dialog.dispatchEvent({type: 'pointerdown', target: dialog, clientX: 10, clientY: 10});
    dialog.dispatchEvent({type: 'click', target: dialog, clientX: 10, clientY: 10});
    assert.equal(dialog.open, true);
    assert.deepEqual(h.events.filter(e => e.type === 'sb:dialog-before-close')
        .map(e => e.detail.reason), ['button', 'escape', 'backdrop']);
    dialog.handlers.delete('sb:dialog-before-close');
    h.api.close(dialog);
    assert.equal(dialog.open, false);
    assert.equal(h.document.activeElement, h.opener);
});

test('closing an underlying dialog keeps child focus and hands off the original opener', () => {
    const h = dialogs();
    h.api.open('first');
    h.api.open('second');
    h.api.close('first');
    assert.equal(h.document.activeElement, h.records.get('second').button);
    h.api.close('second');
    assert.equal(h.document.activeElement, h.opener);
});

test('backdrop dismissal is opt-in, requires outside press and does not close on drags', () => {
    const h = dialogs();
    const dialog = h.records.get('first');
    function pointer(type, x, y) {
        dialog.dispatchEvent({type, target: dialog, clientX: x, clientY: y});
    }
    h.api.open(dialog);
    pointer('pointerdown', 10, 10);
    pointer('click', 10, 10);
    assert.equal(dialog.open, true);
    dialog.dataset.sbBackdropClose = 'true';
    pointer('pointerdown', 150, 150);
    pointer('click', 10, 10);
    assert.equal(dialog.open, true);
    pointer('pointerdown', 10, 10);
    pointer('click', 10, 10);
    assert.equal(dialog.open, false);
    assert.equal(dialog.returnValue, 'backdrop');
});

test('declarative buttons open and close, and missing targets fail explicitly', () => {
    const h = dialogs();
    const trigger = new h.Element();
    trigger.dataset.sbDialog = 'first';
    trigger.focus();
    assert.equal(h.emit('click', trigger).prevented, true);
    const dismiss = h.records.get('first').button;
    dismiss.dismiss = true;
    h.emit('click', dismiss);
    assert.equal(h.document.activeElement, trigger);
    assert.throws(() => h.api.open('missing'), /App dialog is missing or invalid/);
});

test('rapid close/reopen ignores queued old close events and disconnected focus targets', () => {
    const h = dialogs();
    h.api.open('first');
    h.api.toggle('first');
    h.api.toggle('first');
    h.flush();
    assert.equal(h.records.get('first').open, true);
    h.opener.isConnected = false;
    h.emit('keydown', h.document.activeElement, 'Escape');
    assert.equal(h.records.get('first').open, false);
});

test('dialog keyboard events stay local, while F1 and question-mark help can reach the shell', () => {
    const h = dialogs();
    const dialog = h.records.get('first');
    h.api.open(dialog);
    for (const key of ['Enter', 'k', 'Tab', 'F1', '?']) {
        const event = {type: 'keydown', key, ctrlKey: true, target: dialog.button,
            stopped: false, prevented: false,
            stopPropagation() { this.stopped = true; },
            preventDefault() { this.prevented = true; }};
        dialog.dispatchEvent(event);
        assert.equal(event.stopped, !['F1', '?'].includes(key));
        assert.equal(event.prevented, ['Enter', 'k'].includes(key));
    }
});

function pageHelp(pathname) {
    const source = fs.readFileSync(path.join(__dirname, '../../static/js/page-help.js'), 'utf8');
    const title = {}, body = {}, calls = [];
    const context = {
        window: {location: {pathname}},
        document: {getElementById: id => id === 'pageHelpModalLabel' ? title : body},
        SBDialog: {toggle: id => calls.push(id)},
    };
    const exposed = source.replace('return { show };', 'return { show, helpMap, fallbackHelp };');
    vm.runInNewContext(exposed + ';globalThis.help = PageHelp;', context);
    return {...context.help, title, body, calls};
}

test('contextual entries have unique routes, valid content and the current Hygiene help contract', () => {
    const help = pageHelp('/');
    assert.equal(help.helpMap.length, 55);
    assert.equal(new Set(help.helpMap.map(entry => String(entry.pattern))).size, 55);
    for (const entry of [...help.helpMap, help.fallbackHelp]) {
        assert.equal(typeof entry.title, 'string');
        assert.ok(entry.title.trim().length > 0);
        assert.equal(typeof entry.content, 'string');
        assert.ok(entry.content.trim().length > 0);
    }
    const hygiene = pageHelp('/reports/hygiene');
    hygiene.show();
    assert.equal(hygiene.title.textContent, 'Engagement / Milestone Hygiene');
    assert.match(hygiene.body.innerHTML, /both queues/);
    assert.match(hygiene.body.innerHTML, /creation cannot be confirmed/);
    assert.match(hygiene.body.innerHTML, /Only confirmed notes/);
});

test('contextual and fallback help use native dialogs without Bootstrap markup or APIs', () => {
    for (const [pathname, title] of [['/', 'Dashboard'], ['/unknown', 'Sales Buddy Help']]) {
        const help = pageHelp(pathname);
        help.show();
        assert.equal(help.title.textContent, title);
        assert.deepEqual(help.calls, ['pageHelpModal']);
        assert.match(help.body.innerHTML, /Calendar|Keyboard|calendar/);
        assert.doesNotMatch(help.body.innerHTML, /class="[^"]*\b(?:badge|table-sm|bg-\w+|text-muted)\b/);
    }
});
