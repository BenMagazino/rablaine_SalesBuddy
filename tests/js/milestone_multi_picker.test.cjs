const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,
    '../../static/js/milestone-multi-picker.js'), 'utf8');

function deferred() {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return {promise, resolve, reject};
}
function fixture(native = true) {
    class Element {
        constructor(tag = 'div') {
            this.tag = tag; this.children = []; this.attrs = {}; this.dataset = {};
            this.style = {}; this.handlers = {}; this.value = ''; this.className = '';
            this.classList = {toggle() {}};
        }
        appendChild(child) { this.children.push(child); return child; }
        replaceChildren(...children) { this.children = children; }
        setAttribute(key, value) { this.attrs[key] = value; }
        removeAttribute(key) { delete this.attrs[key]; }
        addEventListener(type, fn) { this.handlers[type] = fn; }
        querySelectorAll(tag) {
            return this.children.flatMap(child =>
                [...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag)]);
        }
        blur() { this.blurred = true; this.handlers.blur?.(); }
        scrollIntoView() { this.scrolled = true; }
    }
    const elements = Object.fromEntries(['search', 'results', 'selected', 'help'].map(key =>
        [key, new Element(key === 'search' ? 'input' : 'div')]));
    const root = {id: 'fixture', querySelector: selector =>
        elements[selector.match(/picker-(\w+)/)[1]]};
    const requests = [], timers = [], events = {};
    const window = {addEventListener(type, fn) { events[type] = fn; },
        setTimeout(fn) { timers.push(fn); }};
    const context = {window, AbortController, DOMException,
        document: {createElement: tag => new Element(tag),
            createTextNode: text => Object.assign(new Element('text'), {textContent: text})},
        fetch: (url, options) => {
            const request = deferred();
            requests.push({url, options, ...request}); return request.promise;
        }};
    vm.runInNewContext(source, context);
    let changes = 0;
    const picker = new window.SalesBuddyMilestoneMultiPicker(root,
        {native, onSelectionChange: () => { changes++; }});
    const respond = (request, data, extra = {}) => request.resolve({
        ok: true, headers: {get: () => 'application/json'}, json: async () => data, ...extra,
    });
    return {picker, elements, requests, timers, events, respond, changes: () => changes};
}
const milestone = (id, name = 'Milestone') => ({
    id: 'remote-' + id, local_milestone_id: id, name, status: 'On Track',
    number: '7-123', opportunity_name: 'Opportunity', workload: 'SQL',
});

test('native seed renders immediately, survives failed optional reads and can be removed', async () => {
    const h = fixture(), seed = milestone(1, '<img onerror=attack>');
    const loading = h.picker.load(5, [1], [seed]);
    assert.equal(h.elements.selected.children.length, 1);
    assert.equal(h.changes(), 1);
    assert.deepEqual([...h.picker.getSelectedIds()], [1]);
    h.requests[0].reject(new Error('Offline'));
    await assert.rejects(loading, /Offline/);
    assert.equal(h.picker.getSelectedMilestones()[0], seed);
    assert.equal(h.elements.help.textContent, 'Offline');
    h.elements.selected.querySelectorAll('button')[0].handlers.click();
    assert.equal(h.elements.selected.children.length, 0);
    assert.equal(h.changes(), 2);
});
test('native loading deduplicates the local seed and keeps complete literal metadata', async () => {
    const h = fixture(), seed = milestone(1);
    const loading = h.picker.load(5, [1], [seed]);
    h.respond(h.requests[0], {success: true, milestones: [milestone(1, 'Updated'), milestone(2)]});
    await loading;
    assert.equal(h.picker.selected.length, 1);
    assert.equal(h.picker.selected[0].name, 'Updated');
    assert.equal(h.elements.search.disabled, false);
    h.picker.renderResults();
    assert.equal(h.elements.results.children[0].className, 'sb-ms-option');
    assert.equal(h.elements.results.children[0].attrs.role, 'option');
    h.elements.results.children[0].handlers.mousedown({preventDefault() {}});
    assert.deepEqual([...h.picker.getSelectedIds()], [1, 2]);
    assert.equal(h.elements.results.style.display, 'none');
    assert.equal(h.elements.search.blurred, true);
});
test('native keyboard and no-result searches maintain valid combobox state', async () => {
    const h = fixture(); const loading = h.picker.load(5);
    h.respond(h.requests[0], {success: true, milestones: [milestone(1), milestone(2)]});
    await loading; h.picker.renderResults();
    assert.equal(h.elements.search.attrs['aria-expanded'], 'true');
    h.elements.search.handlers.keydown({key: 'ArrowDown', preventDefault() {}});
    assert.equal(h.elements.search.attrs['aria-activedescendant'], 'fixtureResults-1');
    assert.equal(h.elements.results.children[1].scrolled, true);
    h.elements.search.value = 'No such milestone'; h.elements.search.handlers.input();
    assert.equal(h.elements.search.attrs['aria-activedescendant'], undefined);
    h.elements.search.value = '*'; h.elements.search.handlers.input();
    h.elements.search.handlers.keydown({key: 'Enter', preventDefault() {}});
    assert.deepEqual([...h.picker.getSelectedIds()], [1]);
    assert.equal(h.elements.search.attrs['aria-expanded'], 'false');
});
test('native requests abort and ignore obsolete success responses', async () => {
    const h = fixture(), first = h.picker.load(1);
    const rejected = assert.rejects(first, error => error.name === 'AbortError');
    const second = h.picker.load(2);
    assert.equal(h.requests[0].options.signal.aborted, true);
    h.respond(h.requests[1], {success: true, milestones: [milestone(2)]});
    await second;
    h.respond(h.requests[0], {success: true, milestones: [milestone(1)]});
    await rejected;
    assert.equal(h.picker.milestones[0].local_milestone_id, 2);
    assert.equal(h.elements.help.textContent, 'Select one or more milestones for this customer.');
});
test('closing a picker invalidates pending reads without replacing its seed', async () => {
    const h = fixture(); const loading = h.picker.load(1, [1], [milestone(1)]);
    const rejected = assert.rejects(loading, error => error.name === 'AbortError');
    h.picker.cancelLoad();
    h.respond(h.requests[0], {success: true, milestones: [milestone(2)]});
    await rejected;
    assert.deepEqual([...h.picker.getSelectedIds()], [1]);
    assert.equal(h.requests[0].options.signal.aborted, true);
});
test('native HTTP, content type and response identities fail visibly', async () => {
    for (const [data, extra, message] of [
        [{success: true, milestones: []}, {ok: false, status: 503}, /HTTP 503/],
        [{success: true, milestones: []}, {headers: {get: () => 'text/html'}}, /Expected JSON/],
        [null, {}, /Could not load/], [{success: 'true', milestones: []}, {}, /Invalid/],
        [{success: true, milestones: [{id: {}}]}, {}, /Invalid/],
        [{success: true, milestones: [milestone(-1)]}, {}, /Invalid/],
    ]) {
        const h = fixture(), loading = h.picker.load(1);
        h.respond(h.requests[0], data, extra);
        await assert.rejects(loading, message);
        assert.equal(h.elements.search.disabled, true);
        assert.match(h.elements.help.textContent, message);
    }
});
test('default consumers keep Bootstrap rendering and legacy request behavior', async () => {
    const h = fixture(false), loading = h.picker.load(1, [1]);
    assert.equal(h.requests[0].options, undefined);
    h.respond(h.requests[0], {success: true, milestones: [milestone(1), milestone(2)]});
    await loading; h.picker.renderResults();
    assert.equal(h.elements.selected.children[0].className, 'card border-success mb-2');
    assert.equal(h.elements.results.children[0].className,
        'list-group-item list-group-item-action text-start');
    assert.equal(h.elements.search.attrs.role, undefined);
    assert.match(h.elements.results.children[0].children[0].children[0].className, /bg-success/);
});
test('pointer scrollbar use prevents blur from closing picker results', () => {
    const h = fixture(); h.picker.renderResults();
    h.elements.results.handlers.pointerdown(); h.elements.search.handlers.blur();
    h.timers.shift()();
    assert.equal(h.elements.results.style.display, 'block');
    h.events.pointerup(); h.timers.shift()();
    h.elements.search.handlers.blur(); h.timers.shift()();
    assert.equal(h.elements.results.style.display, 'none');
});
test('empty native results consume Enter and Escape without submitting or closing the repair', () => {
    const h = fixture(); h.picker.renderResults();
    let prevented = 0, stopped = 0;
    const key = key => h.elements.search.handlers.keydown({
        key, preventDefault() { prevented++; }, stopPropagation() { stopped++; },
    });
    key('Enter');
    assert.equal(prevented, 1);
    key('Escape');
    assert.equal(prevented, 2);
    assert.equal(stopped, 1);
    assert.equal(h.elements.search.attrs['aria-expanded'], 'false');
    key('Escape');
    assert.equal(stopped, 1);
});
