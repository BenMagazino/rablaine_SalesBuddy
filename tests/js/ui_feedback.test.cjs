const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-feedback.js'), 'utf8');

function notifications({count = 1, mainPresent = true} = {}) {
    let click;
    const document = {
        addEventListener(type, handler) { if (type === 'click') click = handler; },
        getElementById() { return mainPresent ? main : null; },
    };
    class Element {
        constructor(kind = '') {
            this.kind = kind;
            this.children = [];
        }
        closest(selector) {
            for (let node = this; node; node = node.parent) {
                if (selector === '.sb-notice' && node.kind === 'notice') return node;
                if (selector === '[data-sb-notice-dismiss]' && node.kind === 'button') return node;
            }
            return null;
        }
        contains(target) {
            for (let node = target; node; node = node.parent) if (node === this) return true;
            return false;
        }
        querySelector() { return this.children.find(child => child.kind === 'button'); }
        get nextElementSibling() {
            return this.parent.children[this.parent.children.indexOf(this) + 1];
        }
        get previousElementSibling() {
            return this.parent.children[this.parent.children.indexOf(this) - 1];
        }
        remove() {
            this.parent.children.splice(this.parent.children.indexOf(this), 1);
            this.removed = true;
        }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
    }
    const main = new Element('main');
    const stack = new Element('stack');
    function add() {
        const notice = new Element('notice');
        const button = new Element('button');
        const icon = new Element('icon');
        notice.parent = stack;
        button.parent = notice;
        icon.parent = button;
        button.children.push(icon);
        notice.children.push(button);
        stack.children.push(notice);
        return {notice, button, icon};
    }
    const notices = Array.from({length: count}, add);
    main.focus();
    vm.runInNewContext(source, {document, Element});
    function emit(target) {
        const event = {target, prevented: false, preventDefault() { this.prevented = true; }};
        click(event);
        return event;
    }
    return {document, main, stack, notices, add, emit, Element};
}

test('nested close icons dismiss only their notice and return keyboard focus to the main landmark', () => {
    const h = notifications();
    const {notice, button, icon} = h.notices[0];
    button.focus();
    assert.equal(h.emit(icon).prevented, true);
    assert.equal(notice.removed, true);
    assert.equal(h.document.activeElement, h.main);
    assert.equal(h.main.focusOptions.preventScroll, true);
});

test('keyboard dismissal moves forward through messages, then back if only earlier messages remain', () => {
    const h = notifications({count: 3});
    h.notices[1].button.focus();
    h.emit(h.notices[1].button);
    assert.equal(h.document.activeElement, h.notices[2].button);
    h.emit(h.notices[2].button);
    assert.equal(h.document.activeElement, h.notices[0].button);
    h.emit(h.notices[0].button);
    assert.equal(h.document.activeElement, h.main);
    assert.equal(h.stack.children.length, 0);
});

test('programmatic dismissal does not steal focus from an unrelated field or dialog', () => {
    const h = notifications();
    const field = new h.Element('field');
    field.focus();
    h.emit(h.notices[0].button);
    assert.equal(h.document.activeElement, field);
    assert.equal(h.notices[0].notice.removed, true);
});

test('unrelated clicks and non-element targets remain untouched', () => {
    const h = notifications();
    assert.equal(h.emit(new h.Element()).prevented, false);
    assert.equal(h.emit(null).prevented, false);
    assert.equal(h.notices[0].notice.removed, undefined);
});

test('newly inserted notices reuse the delegated handler without reinitialization', () => {
    const h = notifications({count: 0});
    const inserted = h.add();
    inserted.button.focus();
    h.emit(inserted.button);
    assert.equal(inserted.notice.removed, true);
    assert.equal(h.document.activeElement, h.main);
});

test('malformed dismiss controls and missing focus destinations fail before removing content', () => {
    const h = notifications({mainPresent: false});
    h.notices[0].button.focus();
    assert.throws(() => h.emit(h.notices[0].button), /no valid focus destination/);
    assert.equal(h.notices[0].notice.removed, undefined);
    assert.throws(() => h.emit(new h.Element('button')), /has no notification/);
});

test('notice styles are scoped and full message text can wrap without Bootstrap behavior', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-feedback.css'), 'utf8');
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(css, /text-overflow:\s*ellipsis|white-space:\s*nowrap/);
    assert.doesNotMatch(css, /\.alert\b|\.btn-close\b|(?:^|\})\s*body\b/);
    assert.match(css, /\.sb-notice-dismiss:focus-visible/);
    assert.match(css, /\.sb-page-focus-target:focus-visible\s*\{[^}]*var\(--sb-ui-accent\)/);
    assert.doesNotMatch(source, /bootstrap|localStorage|fetch\(/);
});
