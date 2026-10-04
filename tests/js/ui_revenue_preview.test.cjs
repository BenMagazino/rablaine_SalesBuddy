const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-preview.js'), 'utf8');

function fixture() {
    class Element {
        constructor() { this.handlers = {}; this.dispatched = []; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        dispatchEvent(event) { this.dispatched.push(event.type); }
        emit(type, target = this) {
            if (type === 'sb:dialog-closed' && target === this) this.open = false;
            for (const fn of this.handlers[type] || []) fn({target});
        }
        closest(selector) {
            assert.equal(selector, '#homeAlertDetailModal .review-action-btn');
            return this.inPreview ? this : null;
        }
    }
    const dialog = new Element(), document = new Element(), review = {open: false};
    document.getElementById = id => {
        if (id === 'homeAlertDetailModal') return dialog;
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
    const button = new Element(); button.inPreview = true;
    return {dialog, document, review, button, Element, selections,
        api: window.SBRevenueAlertPreview, options: () => options,
        creates: () => creates, reloads: () => reloads};
}

test('Home preview reuses the identity-checked record loader and literal selection title', () => {
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

test('only confirmed reviews from this preview refresh Home when its parent closes', () => {
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
