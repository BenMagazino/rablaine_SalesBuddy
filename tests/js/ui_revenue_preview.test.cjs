const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-preview.js'), 'utf8');

function fixture({withParent = false} = {}) {
    class Element {
        constructor() { this.handlers = {}; this.dispatched = []; this.dataset = {}; }
        addEventListener(type, fn, options) {
            (this.handlers[type] ||= []).push({fn, once: options?.once});
        }
        dispatchEvent(event) { this.dispatched.push(event.type); }
        emit(type, target = this) {
            if (type === 'sb:dialog-closed' && target === this) this.open = false;
            const event = {target, preventDefault() { this.defaultPrevented = true; }};
            for (const handler of [...(this.handlers[type] || [])]) {
                if (handler.once) this.handlers[type].splice(this.handlers[type].indexOf(handler), 1);
                handler.fn(event);
            }
            return event;
        }
        contains(target) { return target.host === this; }
        closest(selector) {
            if (selector === '.review-action-btn') return this.isReviewButton ? this : null;
            assert.equal(selector, 'a, button');
            return this.interactive ? this : null;
        }
    }
    const dialog = new Element(), document = new Element(), review = {open: false};
    const parent = withParent ? new Element() : null;
    const parentStatus = {textContent: 'Review changes save when you submit them.'};
    if (parent) {
        dialog.dataset.sbRevenueParent = 'revenueModal';
        parent.open = false;
        parent.querySelector = selector => {
            assert.equal(selector, '[data-sb-revenue-status]');
            return parentStatus;
        };
    }
    document.querySelector = selector => {
        assert.equal(selector, '[data-sb-revenue-preview]');
        return dialog;
    };
    document.getElementById = id => {
        if (id === 'revenueModal') return parent;
        if (id === 'reviewActionModal') return review;
        throw Error('Unexpected id ' + id);
    };
    let options, creates = 0, reloads = 0;
    const selections = [], window = {};
    vm.runInNewContext(source, {window, document, Element,
        CustomEvent: class { constructor(type) { this.type = type; } },
        location: {reload: () => reloads++},
        SBRecordDialog: {create(target, configuration) {
            assert.equal(target, dialog); creates++; options = configuration;
            return {open(snapshot) {
                options.onSelection(snapshot);
                dialog.open = true;
                selections.push(snapshot);
                return snapshot.id;
            }};
        }},
    });
    const button = new Element(); button.host = dialog; button.isReviewButton = true;
    const parentButton = new Element(); parentButton.host = parent; parentButton.isReviewButton = true;
    return {dialog, document, review, button, parent, parentStatus, parentButton, Element, selections, window,
        api: window.SBRevenueAlertPreview, options: () => options,
        creates: () => creates, reloads: () => reloads};
}

test('all previews reuse the identity-checked record loader and literal selection title', () => {
    const h = fixture();
    assert.equal(h.api.open('7', '<Customer>', 'Data & DBs'), 7);
    assert.equal(h.selections[0].id, 7);
    assert.equal(h.selections[0].title, '<Customer> - Data & DBs');
    assert.equal(h.options().loadUrl(7), '/api/revenue/analysis/7/detail');
    assert.equal(h.options().fullUrl(7), '/reports/revenue');
    assert.equal(h.options().fragmentSelector, '[data-sb-revenue-detail]');
    assert.equal(h.options().identityAttribute, 'data-sb-revenue-id');
    assert.match(h.options().errorText, /Retry/);
    h.api.open(8, 'Other', 'Fabric');
    assert.equal(h.creates(), 1);
    assert.equal(h.selections.length, 2);
});

test('reviewing blocks parent transitions, without treating a read-only body as a draft', () => {
    const h = fixture(); h.api.open(7, 'Customer', 'Databases');
    const mounted = h.options().mount();
    assert.equal(mounted.isBusy(), false);
    assert.equal(mounted.isDirty(), false);
    h.review.open = true;
    assert.equal(mounted.isBusy(), true);
    assert.match(h.options().busyText, /Close Review Alert/);
    h.review.open = false;
    assert.equal(mounted.isBusy(), false);
    mounted.dispose();
    assert.equal(h.options().stateEvent, 'sb:revenue-preview-state');
    const child = new h.Element(); child.id = 'reviewActionModal';
    h.document.emit('sb:dialog-closed', child);
    assert.deepEqual(h.dialog.dispatched, ['sb:revenue-preview-state']);
    h.document.emit('sb:dialog-closed', new h.Element());
    assert.equal(h.dialog.dispatched.length, 1);
});

test('only confirmed reviews from this preview refresh its page when the preview closes', () => {
    const h = fixture(); h.api.open(7, 'Customer', 'Databases');
    h.dialog.emit('sb:dialog-closed');
    assert.equal(h.reloads(), 0);
    h.api.open(7, 'Customer', 'Databases');
    h.document.emit('sb:revenue-review-saved', {});
    h.document.emit('sb:revenue-review-saved', new h.Element());
    h.document.emit('sb:revenue-review-saved', h.button);
    h.api.open(8, 'Other', 'Fabric');
    h.dialog.emit('sb:dialog-closed', new h.Element());
    assert.equal(h.reloads(), 0);
    h.dialog.emit('sb:dialog-closed');
    assert.equal(h.reloads(), 1);
    h.api.open(9, 'Third', 'Databases');
    h.dialog.emit('sb:dialog-closed');
    assert.equal(h.reloads(), 1);
});

test('public row launchers retain link/button guards and share the controller', () => {
    const h = fixture();
    assert.equal(h.window.openHomeAlertDetail, h.window.openAlertDetail);
    const link = new h.Element(); link.interactive = true;
    h.window.openAlertDetail({target: link}, 7, 'Customer', 'Data');
    assert.equal(h.creates(), 0);
    h.window.openHomeAlertDetail({target: new h.Element()}, 7, 'Customer', 'Data');
    assert.equal(h.selections[0].id, 7);
});

test('native Seller Full View remains open beneath the drilldown and newer selections', () => {
    const h = fixture({withParent: true}); h.parent.open = true;
    h.api.open(7, 'First', 'Data');
    h.api.open(8, 'Second', 'Fabric');
    assert.equal(h.parent.open, true);
    assert.deepEqual(h.selections.map(s => s.id), [7, 8]);
    h.dialog.emit('sb:dialog-closed', new h.Element());
    assert.equal(h.dialog.open, true);
    h.dialog.emit('sb:dialog-closed');
    assert.equal(h.parent.open, true);
    assert.equal(h.reloads(), 0);
    assert.equal(h.selections.length, 2);
});

test('confirmed drilldown reviews refresh only after final Full View close, across drilldowns', () => {
    const h = fixture({withParent: true}); h.parent.open = true;
    h.api.open(7, 'First', 'Data');
    h.document.emit('sb:revenue-review-saved', h.button);
    h.api.open(8, 'Second', 'Fabric');
    h.dialog.emit('sb:dialog-closed');
    assert.equal(h.parent.open, true);
    assert.equal(h.reloads(), 0);
    h.api.open(9, 'Third', 'Data');
    assert.equal(h.reloads(), 0);
    h.dialog.emit('sb:dialog-closed');
    assert.equal(h.parent.open, true);
    h.parent.emit('sb:dialog-closed', new h.Element());
    assert.equal(h.reloads(), 0);
    h.parent.emit('sb:dialog-closed');
    assert.equal(h.reloads(), 1);
});

test('direct Full View reviews also wait through drilldown restoration before refreshing', () => {
    const h = fixture({withParent: true}); h.parent.open = true;
    h.document.emit('sb:revenue-review-saved', h.parentButton);
    h.api.open(7, 'Customer', 'Data');
    assert.equal(h.reloads(), 0);
    h.dialog.emit('sb:dialog-closed');
    assert.equal(h.reloads(), 0);
    h.parent.emit('sb:dialog-closed');
    assert.equal(h.reloads(), 1);
});

test('a standalone Seller preview reloads on confirmation without opening Full View', () => {
    const h = fixture({withParent: true});
    h.api.open(7, 'Customer', 'Data');
    h.document.emit('sb:revenue-review-saved', h.button);
    h.dialog.emit('sb:dialog-closed');
    assert.equal(h.reloads(), 1);
    assert.equal(h.parent.open, false);
});

test('invalid selections do not close Full View', () => {
    const h = fixture({withParent: true}); h.parent.open = true;
    for (const id of [0, -1, 'invalid', 1.5]) {
        assert.throws(() => h.api.open(id, 'Customer', 'Data'), /Invalid revenue alert selection/);
    }
    assert.equal(h.parent.open, true);
    assert.equal(h.creates(), 0);
});

test('Full View guards underlying close during preview or Review and restores status afterward', () => {
    const h = fixture({withParent: true}); h.parent.open = true;
    h.api.open(7, 'Customer', 'Data');
    assert.equal(h.parent.emit('sb:dialog-before-close').defaultPrevented, true);
    assert.match(h.parentStatus.textContent, /Close the alert preview/);
    assert.equal(h.parent.emit('sb:dialog-before-close', h.dialog).defaultPrevented, undefined);
    h.dialog.emit('sb:dialog-closed');
    h.document.emit('sb:dialog-closed', h.dialog);
    assert.equal(h.parentStatus.textContent, 'Review changes save when you submit them.');
    h.review.open = true;
    assert.equal(h.parent.emit('sb:dialog-before-close').defaultPrevented, true);
    h.review.open = false;
    const review = new h.Element(); review.id = 'reviewActionModal';
    h.document.emit('sb:dialog-closed', review);
    assert.equal(h.parentStatus.textContent, 'Review changes save when you submit them.');
    assert.equal(h.parent.emit('sb:dialog-before-close').defaultPrevented, undefined);
});
