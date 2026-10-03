const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-image-viewer.js'), 'utf8');

test('viewer sizing preserves aspect ratio and image controls sit above clickable note rows', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-dialog.css'), 'utf8');
    const template = fs.readFileSync(path.join(__dirname, '../../templates/base.html'), 'utf8');
    assert.match(css, /\.sb-image-preview img\s*\{[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/);
    assert.match(css, /\.sb-dialog-image \[hidden\]\s*\{\s*display:\s*none;/);
    assert.match(template, /\.row-link \.call-content img\[role="button"\]\s*\{\s*position:\s*relative;\s*z-index:\s*2;/);
    assert.doesNotMatch(source, /bootstrap/);
});

function viewer({missing = false} = {}) {
    const listeners = new Map();
    const document = {
        activeElement: null,
        addEventListener: (type, handler) => listeners.set(type, handler),
        getElementById: id => records.get(id),
        querySelectorAll: () => content,
        body: {},
    };
    class Element {
        constructor(id) {
            this.id = id;
            this.attributes = new Map();
            this.handlers = new Map();
            this.children = [];
            this.hidden = true;
        }
        setAttribute(name, value) { this.attributes.set(name, value); }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        hasAttribute(name) { return this.attributes.has(name); }
        removeAttribute(name) { this.attributes.delete(name); if (name === 'src') this.src = ''; }
        addEventListener(type, handler) { this.handlers.set(type, handler); }
        closest(selector) {
            if (selector === '.call-content') return this.content ? {} : null;
            if (selector === 'a[href]') return this.linked ? {} : null;
            return null;
        }
        querySelectorAll() { return this.children.filter(child => child.content); }
        querySelector() { return closeButton; }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
    }
    class Image extends Element {
        constructor(id, url = '', alt = '') {
            super(id);
            this.src = url;
            this.alt = alt;
            this.complete = false;
            this.naturalWidth = 0;
            if (url) this.setAttribute('src', url);
        }
    }
    const records = new Map(['imageZoomModal', 'imageZoomStage', 'imageZoomStatus',
        'imageZoomPreview', 'imageZoomError', 'imageZoomRetry']
        .map(id => [id, new Element(id)]));
    const image = new Image('imageZoomImg');
    records.set(image.id, image);
    const dialog = records.get('imageZoomModal');
    dialog.open = false;
    const closeButton = new Element('close');
    const original = new Image('original', '/static/test-image.png', 'Diagram <example>');
    original.content = true;
    const content = [original];
    const errors = [];
    let observer;
    let opens = 0;
    let opener;
    const SBDialog = {
        open() {
            if (dialog.open) return;
            opener = document.activeElement;
            dialog.open = true;
            closeButton.focus();
            opens++;
        },
    };
    class MutationObserver {
        constructor(callback) { observer = callback; }
        observe(target, options) { this.options = options; }
    }
    if (missing) records.delete('imageZoomStage');
    vm.runInNewContext(source, {
        document, Element, HTMLImageElement: Image, MutationObserver, SBDialog,
        console: {error: (...args) => errors.push(args)},
    });
    function emit(type, target = original, key, extra = {}) {
        const event = {target, key, prevented: false,
            preventDefault() { this.prevented = true; }, ...extra};
        listeners.get(type)?.(event);
        return event;
    }
    function finish(success = true) {
        image.complete = true;
        image.naturalWidth = success ? 100 : 0;
        image.handlers.get(success ? 'load' : 'error')();
    }
    function close() {
        dialog.open = false;
        opener.focus();
        dialog.handlers.get('sb:dialog-closed')({target: dialog});
    }
    return {
        document, records, image, dialog, original, closeButton, Element, Image,
        errors, emit, finish, close, opens: () => opens,
        insert(node) { observer([{addedNodes: [node]}]); },
    };
}

test('content images gain keyboard controls without rewriting their source or existing labels', () => {
    const h = viewer();
    assert.equal(h.original.getAttribute('tabindex'), '0');
    assert.equal(h.original.getAttribute('role'), 'button');
    assert.equal(h.original.getAttribute('aria-label'), 'View image: Diagram <example>');
    assert.equal(h.original.getAttribute('aria-controls'), 'imageZoomModal');
    assert.equal(h.original.src, '/static/test-image.png');
    const inserted = new h.Image('inserted', '/other.png');
    inserted.content = true;
    inserted.setAttribute('tabindex', '2');
    inserted.setAttribute('aria-label', 'Existing label');
    h.insert(inserted);
    assert.equal(inserted.getAttribute('tabindex'), '2');
    assert.equal(inserted.getAttribute('aria-label'), 'Existing label');
    assert.equal(inserted.getAttribute('aria-haspopup'), 'dialog');
});

test('images in injected containers work without a second initialization', () => {
    const h = viewer();
    const container = new h.Element('partial');
    const inserted = new h.Image('inserted', '/injected.png');
    inserted.content = true;
    container.children.push(inserted);
    h.insert(container);
    h.emit('click', inserted);
    assert.equal(inserted.getAttribute('role'), 'button');
    assert.equal(h.image.src, '/injected.png');
    assert.equal(h.opens(), 1);
});

test('click opens the native viewer, copies source/alt and restores image focus on close', () => {
    const h = viewer();
    h.original.currentSrc = '/selected-resolution.png';
    assert.equal(h.emit('click').prevented, true);
    assert.equal(h.image.src, '/selected-resolution.png');
    assert.equal(h.image.alt, 'Diagram <example>');
    assert.equal(h.records.get('imageZoomStage').getAttribute('aria-busy'), 'true');
    assert.equal(h.records.get('imageZoomStatus').hidden, false);
    h.finish();
    assert.equal(h.records.get('imageZoomPreview').hidden, false);
    assert.equal(h.records.get('imageZoomStatus').hidden, true);
    assert.equal(h.records.get('imageZoomStage').getAttribute('aria-busy'), 'false');
    h.close();
    assert.equal(h.document.activeElement, h.original);
    assert.equal(h.image.src, '');
    assert.equal(h.image.alt, '');
});

test('Enter and Space activate images, but modified keys and unrelated elements do not', () => {
    for (const key of ['Enter', ' ']) {
        const h = viewer();
        assert.equal(h.emit('keydown', h.original, key).prevented, true);
        assert.equal(h.opens(), 1);
    }
    const h = viewer();
    h.emit('keydown', h.original, 'Enter', {ctrlKey: true});
    h.emit('keydown', h.original, 'Escape');
    h.emit('click', new h.Element('unrelated'));
    h.emit('click', new h.Image('outside', '/logo.png'));
    assert.equal(h.opens(), 0);
});

test('modified clicks on linked images retain ordinary link navigation', () => {
    const h = viewer();
    h.original.linked = true;
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
        assert.equal(h.emit('click', h.original, undefined, {[modifier]: true}).prevented, false);
    }
    assert.equal(h.opens(), 0);
    assert.equal(h.emit('click').prevented, true);
    assert.equal(h.opens(), 1);
});

test('image errors are visible, logged and retryable without leaving focus on hidden controls', () => {
    const h = viewer();
    h.emit('click');
    h.finish(false);
    assert.equal(h.errors.length, 1);
    assert.equal(h.records.get('imageZoomError').hidden, false);
    assert.equal(h.records.get('imageZoomPreview').hidden, true);
    h.records.get('imageZoomRetry').focus();
    h.image.complete = false;
    h.records.get('imageZoomRetry').handlers.get('click')();
    assert.equal(h.document.activeElement, h.closeButton);
    assert.equal(h.records.get('imageZoomError').hidden, true);
    h.finish();
    assert.equal(h.records.get('imageZoomPreview').hidden, false);
});

test('closed viewers ignore late image events and nested close events do not clear the selection', () => {
    const h = viewer();
    h.emit('click');
    h.dialog.handlers.get('sb:dialog-closed')({target: new h.Element('help')});
    assert.equal(h.image.src, h.original.src);
    h.close();
    h.finish();
    assert.equal(h.records.get('imageZoomPreview').hidden, true);
    h.finish(false);
    assert.equal(h.errors.length, 0);
    assert.equal(h.records.get('imageZoomError').hidden, true);
});

test('cached images display immediately, while old events cannot expose a pending image', () => {
    const h = viewer();
    h.image.complete = true;
    h.image.naturalWidth = 100;
    h.emit('click');
    assert.equal(h.records.get('imageZoomPreview').hidden, false);
    h.image.complete = false;
    h.image.naturalWidth = 0;
    h.emit('click');
    h.image.handlers.get('load')();
    h.image.handlers.get('error')();
    assert.equal(h.records.get('imageZoomPreview').hidden, true);
    assert.equal(h.records.get('imageZoomStatus').hidden, false);
    assert.equal(h.errors.length, 0);
    h.finish();
    assert.equal(h.records.get('imageZoomPreview').hidden, false);
});

test('repeated selection replaces the image without opening duplicate native dialogs', () => {
    const h = viewer();
    h.emit('click');
    const second = new h.Image('second', '/second.png');
    second.content = true;
    h.emit('click', second);
    assert.equal(h.image.src, '/second.png');
    assert.equal(h.image.alt, 'Enlarged note image');
    assert.equal(h.opens(), 1);
});

test('missing source is reported and incomplete required markup throws explicitly', () => {
    const h = viewer();
    const empty = new h.Image('empty');
    empty.content = true;
    h.emit('click', empty);
    assert.equal(h.errors.length, 1);
    assert.equal(h.records.get('imageZoomError').hidden, false);
    assert.throws(() => viewer({missing: true}), /Image viewer markup is incomplete/);
});
