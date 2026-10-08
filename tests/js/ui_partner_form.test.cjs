const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const lifecycle = fs.readFileSync(require.resolve('../../static/js/ui-milestone-form.js'), 'utf8');
const selection = fs.readFileSync(require.resolve('../../static/js/ui-partner-form.js'), 'utf8');
function harness({posted = false, saved, response, key = 'edit-6'} = {}) {
    const nodes = new Map();
    function node(tag = 'div', extra = {}) {
        return {tag, events: {}, children: [], dataset: {}, attrs: {}, value: '', hidden: true,
            disabled: false, scrollTop: 0, innerHTML: 'Save Changes', validity: {valid: true},
            addEventListener(type, fn) { (this.events[type] ??= []).push(fn); },
            dispatchEvent(e) { e.target ??= this; (this.events[e.type] ?? []).forEach(fn => fn(e)); },
            setAttribute(k, v) { this.attrs[k] = v; },
            removeAttribute(k) { delete this.attrs[k]; },
            toggleAttribute(k, enabled) { if (enabled) this.attrs[k] = ''; else delete this.attrs[k]; },
            append(...items) { items.forEach(item => { item.parent = this; this.children.push(item); }); },
            replaceChildren() { this.children = []; },
            focus() { this.focused = true; },
            contains(target) { return target === this || this.children.some(c => c.contains(target)); },
            remove() { this.parent.children = this.parent.children.filter(c => c !== this); },
            closest(selector) {
                if (selector === '[data-remove-specialty]' && this.dataset.removeSpecialty) return this;
                if (selector === '[data-specialty-id]' && this.dataset.specialtyId) return this;
                return this.parent?.closest(selector) ?? null;
            },
            querySelector(s) { return s === 'i' ? this.icon : this.querySelectorAll(s)[0]; },
            querySelectorAll(s) { return this.children.flatMap(c =>
                [...(s === '[name="specialty_ids"]' && c.name === 'specialty_ids' ? [c] : []),
                    ...c.querySelectorAll(s)]); },
            ...extra};
    }
    ['specialty_search', 'specialty_dropdown', 'selected_specialties', 'rating',
        'clear-rating', 'partnerFormSave', 'partnerFormState', 'partnerFormNotice',
        'partnerFormDiscard', 'partnerFormDiscardConfirm'].forEach(id => nodes.set(id, node()));
    nodes.set('partnerSpecialtyData', node('script', {textContent: JSON.stringify([
        {id: 1, name: 'Existing <tag>', description: 'Context'},
        {id: 2, name: 'Other', description: ''}])}));
    const fields = {name: node('input', {value: 'Original'}), website: node('input'),
        overview: node('textarea'), rating: nodes.get('rating'),
        specialty_search: nodes.get('specialty_search')};
    const stars = [1, 2, 3, 4, 5].map(value =>
        node('button', {dataset: {value: String(value)}, icon: node('i')}));
    const reading = node(), cancel = node('a');
    const form = node('form', {elements: fields, dataset: {formKey: key, posted: String(posted)},
        querySelector: s => s === '[data-partner-cancel]' ? cancel : reading,
        querySelectorAll: s => s === '.partf-star' ? stars : []});
    nodes.set('partnerForm', form);
    const requests = [], destinations = [], errors = [], docEvents = {}, rootEvents = {};
    const root = {document: {getElementById: id => nodes.get(id), querySelector: () => null,
        createElement: tag => node(tag),
        addEventListener(type, fn) { (docEvents[type] ??= []).push(fn); }},
        Event: class { constructor(type) { this.type = type; } },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        history: {state: {unrelated: 9, ...(saved ? {sbPartnerForm: saved} : {})},
            replaceState(value) { this.state = value; }},
        addEventListener(type, fn) { rootEvents[type] = fn; },
        SBDialog: {open(d) { d.open = true; }, close(d) { d.open = false; }},
        location: {assign(url) { destinations.push(url); }},
        console: {error(...args) { errors.push(args); }},
        fetch(url, options) { requests.push({url, options}); return response(); }};
    vm.runInNewContext(selection, {window: root});
    vm.runInNewContext(lifecycle, {window: root});
    const fire = (element, type, extra = {}) => {
        const e = {type, target: element, button: 0, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...extra};
        element.dispatchEvent(e); return e;
    };
    const leave = () => {
        const e = {button: 0, target: {closest: () => ({href: '/partners', target: '',
            hasAttribute: () => false, getAttribute: () => '/partners'})},
            preventDefault() { this.defaultPrevented = true; }};
        docEvents.click.forEach(fn => fn(e)); return e;
    };
    return {root, form, fields, nodes, reading, stars, requests, destinations, errors,
        rootEvents, fire, leave};
}
test('rating, plain fields and selected associations restore with entry-local Back state', () => {
    const h = harness();
    h.fields.overview.value = ' Raw\nnotes '; h.fire(h.form, 'input');
    h.fire(h.stars[3], 'click');
    h.fields.specialty_search.value = 'Existing'; h.fire(h.fields.specialty_search, 'input');
    h.fire(h.fields.specialty_search, 'keydown', {key: 'Enter'});
    h.reading.scrollTop = 64; h.fire(h.reading, 'scroll');
    h.fields.overview.value = ''; h.root.SBPartnerSpecialties.restore([]);
    h.rootEvents.pageshow();
    assert.equal(h.fields.overview.value, ' Raw\nnotes ');
    assert.equal(h.fields.rating.value, '4');
    assert.deepEqual([...h.root.SBPartnerSpecialties.ids()], ['1']);
    assert.equal(h.reading.scrollTop, 64);
    assert.equal(h.root.history.state.unrelated, 9);
    assert.equal(h.requests.length, 0);
});
test('existing selection, removal, rating clear and hover are local and keyboard accessible', () => {
    const h = harness(), search = h.fields.specialty_search;
    search.value = 'Existing'; h.fire(search, 'input');
    const option = h.nodes.get('specialty_dropdown').children[0];
    assert.equal(option.textContent, 'Existing <tag>');
    h.fire(option, 'click');
    const tag = h.nodes.get('selected_specialties').children[0];
    assert.equal(tag.children[0].textContent, 'Existing <tag>');
    h.fire(h.nodes.get('selected_specialties'), 'click', {target: tag.children[1]});
    assert.equal(h.root.SBPartnerSpecialties.ids().length, 0);
    h.fire(h.stars[4], 'click'); h.fire(h.nodes.get('clear-rating'), 'click');
    assert.equal(h.fields.rating.value, ''); assert.equal(h.nodes.get('clear-rating').hidden, true);
    h.fire(h.stars[2], 'mouseenter'); assert.equal(h.fields.rating.value, '');
    h.fire(h.stars[2], 'mouseleave');
    search.value = 'Other'; h.fire(search, 'input');
    assert.equal(h.fire(search, 'keydown', {key: 'Escape'}).defaultPrevented, true);
    assert.equal(h.nodes.get('specialty_dropdown').hidden, true);
    assert.equal(h.requests.length, 0);
});
test('manual draft Cancel keeps input then discard clears only this entry', () => {
    const h = harness();
    h.fields.name.value = 'Draft'; h.fire(h.form, 'input');
    assert.equal(h.leave().defaultPrevented, true);
    assert.equal(h.nodes.get('partnerFormDiscard').open, true);
    h.root.SBDialog.close(h.nodes.get('partnerFormDiscard'));
    assert.equal(h.fields.name.value, 'Draft');
    h.leave(); h.fire(h.nodes.get('partnerFormDiscardConfirm'), 'click');
    assert.equal(h.fields.name.value, 'Original');
    assert.deepEqual(h.destinations, ['/partners']);
    assert.equal(h.root.history.state.sbPartnerForm, undefined);
});
test('manual pending guards duplicate POST and navigation without disabling payload inputs', () => {
    const h = harness(); h.fire(h.form, 'submit');
    assert.equal(h.form.inert, true);
    assert.equal(h.nodes.get('partnerFormSave').disabled, true);
    assert.equal(h.fields.name.disabled, false);
    assert.equal(h.fire(h.form, 'submit').defaultPrevented, true);
    assert.equal(h.leave().defaultPrevented, true);
    h.rootEvents.pageshow();
    assert.equal(h.form.inert, false);
    assert.equal(h.nodes.get('partnerFormSave').disabled, false);
});
test('immediate create has exact payload, pending guards and retained HTTP failure retry', async () => {
    let resolve;
    const h = harness({response: () => new Promise(r => { resolve = r; })});
    const search = h.fields.specialty_search;
    search.value = ' New expertise '; h.fire(search, 'input');
    h.fire(search, 'keydown', {key: 'ArrowDown'});
    h.fire(search, 'keydown', {key: 'Enter'});
    assert.equal(h.requests[0].url, '/api/specialties/create');
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {name: 'New expertise'});
    assert.equal(h.form.inert, true); assert.equal(h.leave().defaultPrevented, true);
    assert.equal(h.fire(h.form, 'submit').defaultPrevented, true);
    h.fire(search, 'keydown', {key: 'Enter'}); assert.equal(h.requests.length, 1);
    resolve({ok: false, json: async () => ({error: 'Real failure'})});
    await new Promise(r => setImmediate(r));
    assert.equal(search.value, ' New expertise ');
    assert.equal(h.nodes.get('partnerFormNotice').textContent, 'Real failure');
    assert.equal(h.form.inert, false); assert.equal(h.errors.length, 1);
    h.fire(search, 'keydown', {key: 'Enter'});
    resolve({ok: true, json: async () => ({id: 3, name: 'New expertise', existed: false})});
    await new Promise(r => setImmediate(r));
    assert.deepEqual([...h.root.SBPartnerSpecialties.ids()], ['3']);
    assert.equal(search.value, ''); assert.equal(h.form.inert, false);
    assert.equal(h.nodes.get('partnerFormState').textContent, 'Unsaved changes');
});
test('malformed/network failures stay visible and retain specialty query', async () => {
    for (const response of [
        async () => ({ok: true, json: async () => ({})}),
        async () => { throw new Error('Network failed'); },
        async () => ({ok: true, json: async () => { throw new SyntaxError('Bad JSON'); }}),
    ]) {
        const h = harness({response});
        h.fields.specialty_search.value = 'New';
        h.fire(h.fields.specialty_search, 'input');
        h.fire(h.fields.specialty_search, 'keydown', {key: 'Enter'});
        await new Promise(r => setImmediate(r));
        assert.equal(h.fields.specialty_search.value, 'New');
        assert.equal(h.nodes.get('partnerFormNotice').hidden, false);
        assert.equal(h.root.SBPartnerSpecialties.ids().length, 0);
        assert.equal(h.form.inert, false);
    }
});
test('posted entries win over history; unavailable associations surface recovery failure', () => {
    const h = harness(); h.fields.name.value = 'Stale'; h.fire(h.form, 'input');
    const failed = harness({posted: true, saved: h.root.history.state.sbPartnerForm});
    assert.equal(failed.fields.name.value, 'Original');
    assert.equal(failed.leave().defaultPrevented, true);
    const saved = h.root.history.state.sbPartnerForm;
    saved.checked = ['999'];
    const invalid = harness({saved});
    assert.match(invalid.nodes.get('partnerFormNotice').textContent, /Could not restore/);
    const fresh = harness({key: 'new'});
    assert.equal(fresh.nodes.get('partnerFormState').textContent, 'New partner');
    assert.equal(fresh.leave().defaultPrevented, undefined);
});
