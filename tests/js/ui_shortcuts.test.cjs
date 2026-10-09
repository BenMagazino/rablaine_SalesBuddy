const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-shortcuts.js'), 'utf8');

function shortcuts({dialog = false, form = null, cancel = null, note = false} = {}) {
    const calls = [];
    let load;
    let keydown;
    const search = {focus() { calls.push('focus'); }, select() { calls.push('select'); }};
    vm.runInNewContext(source, {
        window: {
            addEventListener(name, callback) { assert.equal(name, 'load'); load = callback; },
        },
        PageHelp: {show() { calls.push('help'); }},
        document: {
            addEventListener(name, callback) { assert.equal(name, 'keydown'); keydown = callback; },
            querySelector(selector) {
                return selector === '.sb-dialog[open]:not([data-sb-nonmodal="true"])' ?
                    dialog : cancel;
            },
            getElementById(id) { return id === 'noteForm' ? note : search; },
        },
        SBDialog: {
            open(id) { calls.push(id); },
            toggle(id) { calls.push(id); },
        },
    });
    load();
    function press(key, options = {}) {
        const event = {
            key, ctrlKey: false, metaKey: false, defaultPrevented: false,
            target: {tagName: 'DIV', closest() { return form; }},
            preventDefault() { this.defaultPrevented = true; },
            ...options,
        };
        keydown(event);
        return event;
    }
    return {calls, press};
}

test('help, quick note and search preserve global desktop shortcuts', () => {
    const ui = shortcuts();
    ui.press('F1', {target: {tagName: 'TEXTAREA'}});
    ui.press('K', {ctrlKey: true});
    ui.press('/');
    ui.press('?');
    assert.deepEqual(ui.calls, ['help', 'quickNoteModal', 'focus', 'select',
        'keyboardShortcutsModal']);
});

test('typing suppresses slash and help punctuation but not explicit quick note', () => {
    const ui = shortcuts();
    const target = {tagName: 'INPUT'};
    ui.press('/', {target});
    ui.press('?', {target});
    ui.press('k', {target, metaKey: true});
    assert.deepEqual(ui.calls, ['quickNoteModal']);
});

test('local editor handlers and native dialogs keep shortcut ownership', () => {
    const ui = shortcuts();
    ui.press('Enter', {ctrlKey: true, defaultPrevented: true});
    ui.press('Escape', {defaultPrevented: true});
    assert.deepEqual(ui.calls, []);
    const overlay = shortcuts({dialog: true});
    overlay.press('k', {ctrlKey: true});
    overlay.press('Enter', {ctrlKey: true});
    overlay.press('Escape');
    assert.deepEqual(overlay.calls, []);
    overlay.press('?');
    assert.deepEqual(overlay.calls, ['keyboardShortcutsModal']);
});

test('Ctrl+Enter never bypasses a disabled or pending submit control', () => {
    let submissions = 0;
    const form = {
        querySelector() { return {disabled: true, click() { submissions += 1; }}; },
        requestSubmit() { submissions += 1; },
        submit() { throw new Error('raw submit bypasses validation'); },
    };
    const ui = shortcuts({form});
    assert.equal(ui.press('Enter', {ctrlKey: true}).defaultPrevented, true);
    assert.equal(submissions, 0);
});

test('Ctrl+Enter clicks existing submit actions or uses validated requestSubmit', () => {
    const calls = [];
    const form = {
        querySelector() { return {click() { calls.push('click'); }}; },
        requestSubmit() { calls.push('requestSubmit'); },
    };
    shortcuts({form}).press('Enter', {ctrlKey: true});
    form.querySelector = () => null;
    shortcuts({form}).press('Enter', {metaKey: true});
    assert.deepEqual(calls, ['click', 'requestSubmit']);
});

test('Escape uses explicit native cancellation and leaves note editors alone', () => {
    let cancellations = 0;
    const cancel = {click() { cancellations += 1; }};
    shortcuts({cancel}).press('Escape');
    shortcuts({cancel, note: true}).press('Escape');
    cancel.disabled = true;
    shortcuts({cancel}).press('Escape');
    assert.equal(cancellations, 1);
});
