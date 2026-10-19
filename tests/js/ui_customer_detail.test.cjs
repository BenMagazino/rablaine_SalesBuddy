const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname,
    '../../static/js/ui-customer-detail.js'), 'utf8');
const {validateHistory} = require('../../static/js/ui-customer-detail.js');
const saved = () => ({id: 12, tab: 'cdNotes', context: 27, work: 180,
    scrolls: {cdNotes: 180}, search: 'fabric', fields: [['contextTextarea', 'draft']],
    removed: [], newContacts: [], contextOpen: true, contactsOpen: false});

function harness(history, fabric = false, contactValues = []) {
    function element(extra = {}) {
        return {events: {}, attrs: {}, style: {}, scrollTop: 0, hidden: false,
            value: '', defaultValue: '', dataset: {}, isConnected: true,
            addEventListener(type, callback) {
                (this.events[type] ||= []).push(callback);
            },
            emit(type, event = {}) {
                return Promise.all((this.events[type] || []).map(callback => callback(event)));
            },
            setAttribute(key, value) { this.attrs[key] = value; },
            hasAttribute(key) { return Object.hasOwn(this.attrs, key); },
            getAttribute(key) { return this.attrs[key]; },
            removeAttribute(key) { delete this.attrs[key]; },
            querySelector() { return null; }, querySelectorAll() { return []; },
            append() {}, prepend() {}, after() {}, focus() {}, replaceChildren() {},
            ...extra};
    }
    const context = element(), reading = element(), input = element({id: 'contextTextarea'});
    const panels = ['cdWorkstreams', 'cdNotes', 'cdPipeline', 'cdRevenue',
        ...(fabric ? ['cdFabric'] : [])]
        .map(id => element({id, attrs: id === 'cdFabric' ? {'data-cd-lazy': ''} : {}}));
    const tabs = panels.map(panel => element({attrs: {'aria-controls': panel.id}}));
    const form = element({style: {display: 'none'}, action: '/customer/12/overview'});
    const submit = element();
    const display = element();
    form.querySelector = () => submit;
    reading.querySelectorAll = () => panels;
    const discard = element({open: false}), confirm = element(), description = element();
    const notice = element();
    const search = element();
    const contactFields = contactValues.map((value, index) => element({
        value, defaultValue: value, dataset: {field: ['name', 'title', 'email'][index % 3]},
        closest: () => ({id: 'contact-edit-' + (index < 3 ? 7 : 17)}),
    }));
    const newRows = element({rows: [], replaceChildren() { this.rows = []; }});
    function addNewContact(values = ['', '', '']) {
        const inputs = values.map(value => element({value}));
        const row = element({
            querySelector: () => inputs[0],
            querySelectorAll: () => inputs,
        });
        newRows.rows.push(row);
        return row;
    }
    const ids = {
        '.cd-context': context, '.cd-reading': reading, '.cd-header': element(),
        '#contextTextarea': input, '#contextForm': form,
        '#contextDisplay p': display, '#contactsEditMode': element({style: {display: 'none'}}),
        '#contactsNewRows': newRows, '#cdEssentials': element(), '#cdPipelineSearch': search,
    };
    const actions = {deletedContacts: () => [], clearDeletedContacts() {},
        toggleContextEdit() { form.style.display = 'block'; },
        cancelContextEdit() { form.style.display = 'none'; input.value = input.defaultValue; },
        toggleContactEdit() { ids['#contactsEditMode'].style.display = 'block'; },
        cancelContactEdit() {
            ids['#contactsEditMode'].style.display = 'none';
            contactFields.forEach(field => { field.value = field.defaultValue; });
            newRows.replaceChildren();
        },
        addContactEditRow: addNewContact,
    };
    const root = element({dataset: {sbCustomerDetail: '12'}, _customerActions: actions,
        querySelector: key => key === '#contactsNewRows > div:last-child'
            ? newRows.rows.at(-1) : ids[key], querySelectorAll(key) {
            if (key === '#cdPipeline, #cdRevenue') return panels.slice(2);
            if (key === '[role="tab"]') return tabs;
            if (key === '#contactsEditList input') return contactFields;
            if (key === '#contactsNewRows > div') return newRows.rows;
            return [];
        }});
    const document = {
        createElement: () => notice,
        getElementById: id => ({recordDiscardDialog: discard,
            recordDiscardConfirm: confirm, recordDiscardDescription: description})[id],
    };
    const requests = [], destinations = [], events = {};
    const window = {document, history: {state: {unrelatedDraft: 'protected',
        ...(history ? {sbCustomerDetail: history} : {})},
        replaceState(value) { this.state = value; }},
        location: {href: 'http://localhost/customer/12',
            assign(value) { destinations.push(value); }, reload() { destinations.push('reload'); }},
        console, addEventListener(type, callback) { events[type] = callback; },
        fetch: async (url, options) => {
            requests.push({url, options});
            return {ok: false, status: 500, json: async () => ({error: 'Isolated failure'})};
        }};
    const SBDialog = {open(dialog) { dialog.open = true; },
        close(dialog) { dialog.open = false; }};
    vm.runInNewContext(source, {window, document, SBDialog, URL, FormData: class {}});
    const api = window.SBCustomerDetail.mount(root);
    return {window, root, api, input, reading, context, panels, tabs, form, submit,
        discard, confirm, description, notice, search, requests, destinations, events,
        actions, contactFields, newRows, addNewContact, contactsMode: ids['#contactsEditMode']};
}

test('Done closes contact editing before recording history and reloading', () => {
    const h = harness(undefined, false, ['Original', 'Role', 'person@example.com']);
    h.actions.toggleContactEdit();
    h.contactFields[0].value = 'Updated';
    h.api.contactsSaved();
    assert.equal(h.contactsMode.style.display, 'none');
    assert.equal(h.window.history.state.sbCustomerDetail.contactsOpen, false);
    assert.equal(h.contactFields[0].value, 'Updated');
    assert.equal(h.contactFields[0].defaultValue, 'Updated');
    assert.equal(h.api.isDirty(), false);
    h.api.reload();
    assert.deepEqual(h.destinations, ['reload']);
    const reloaded = harness(h.window.history.state.sbCustomerDetail,
        false, ['Updated', 'Role', 'person@example.com']);
    assert.equal(reloaded.contactsMode.style.display, 'none');
    assert.equal(reloaded.api.isDirty(), false);
    assert.equal(reloaded.window.history.state.unrelatedDraft, 'protected');
});

test('Done exits an unchanged empty contact editor instead of reopening it on reload', () => {
    const h = harness();
    h.actions.toggleContactEdit();
    h.api.contactsSaved();
    h.api.reload();
    assert.equal(h.window.history.state.sbCustomerDetail.contactsOpen, false);
    assert.deepEqual(h.destinations, ['reload']);
});

test('Done only closes the editor after its contact writes succeed', async () => {
    const template = fs.readFileSync(path.resolve(__dirname,
        '../../templates/partials/customer_view_content.html'), 'utf8');
    const saveAll = template.slice(template.indexOf('async function saveAllContacts('),
        template.indexOf('// ---- Customer Contact Scrape')).replace('{{ customer.id }}', '12');
    for (const success of [false, true]) {
        const h = harness(undefined, false, ['Original', 'Role', 'person@example.com']);
        h.actions.toggleContactEdit();
        h.contactFields[0].value = 'Updated';
        h.root.emit('input');
        const button = {disabled: false};
        const row = {id: 'contact-edit-7', style: {}, querySelector(selector) {
            const field = selector.match(/data-field="(\w+)"/)[1];
            return h.contactFields.find(input => input.dataset.field === field);
        }};
        if (success) h.window.fetch = async (url, options) => {
            h.requests.push({url, options});
            return {ok: true, clone: () => ({text: async () => '{}'})};
        };
        const context = {root: h.root, contactsToDelete: [],
            SBCustomerDetail: h.window.SBCustomerDetail,
            fetch: (url, options) => h.window.SBCustomerDetail.request(h.root, url, options),
            document: {querySelector: () => button,
                querySelectorAll: selector => selector.startsWith('#contactsEditList') ? [row] : []},
        };
        vm.runInNewContext(saveAll, context);
        if (success) {
            await context.saveAllContacts();
            assert.equal(h.contactsMode.style.display, 'none');
            assert.equal(h.window.history.state.sbCustomerDetail.contactsOpen, false);
            assert.deepEqual(h.destinations, ['reload']);
        } else {
            await assert.rejects(context.saveAllContacts(), /Isolated failure/);
            assert.equal(h.contactsMode.style.display, 'block');
            assert.equal(h.window.history.state.sbCustomerDetail.contactsOpen, true);
            assert.equal(h.notice.textContent, 'Isolated failure');
            assert.deepEqual(h.destinations, []);
        }
        assert.equal(h.contactFields[0].value, 'Updated');
        assert.equal(button.disabled, false);
        assert.equal(JSON.parse(h.requests[0].options.body).name, 'Updated');
    }
});

test('individual contact Save forgets the created draft without accepting other unsaved edits',
    () => {
        const h = harness(undefined, false, ['Original', '', '']);
        h.actions.toggleContactEdit();
        h.input.value = 'Unsaved account context';
        h.contactFields[0].value = 'Unsaved existing contact';
        h.addNewContact(['Saved person', 'Role', 'saved@example.com']);
        h.root.emit('input');
        assert.equal(h.window.history.state.sbCustomerDetail.newContacts.length, 1);
        h.newRows.replaceChildren();
        const created = ['Saved person', 'Role', 'saved@example.com'].map((value, index) => ({
            value, dataset: {field: ['name', 'title', 'email'][index]},
            closest: () => ({id: 'contact-edit-17'}),
        }));
        h.contactFields.push(...created);
        h.api.contactCreated({querySelectorAll: () => created});
        const history = h.window.history.state.sbCustomerDetail;
        assert.equal(history.contactsOpen, true);
        assert.deepEqual(Array.from(history.newContacts), []);
        assert.equal(h.api.isDirty(), true);
        assert.equal(h.input.value, 'Unsaved account context');
        assert.equal(h.contactFields[0].defaultValue, 'Original');
        const back = harness(history, false,
            ['Original', '', '', 'Saved person', 'Role', 'saved@example.com']);
        assert.equal(back.newRows.rows.length, 0);
        assert.equal(back.contactFields[0].value, 'Unsaved existing contact');
        assert.equal(back.input.value, 'Unsaved account context');
        assert.equal(back.contactFields[3].value, 'Saved person');
        assert.equal(created[0].defaultValue, 'Saved person');
    });

test('a saved new contact is copied to read-only display before its history is remembered', () => {
    const template = fs.readFileSync(path.resolve(__dirname,
        '../../templates/partials/customer_view_content.html'), 'utf8');
    const render = template.slice(template.indexOf('function renderSavedNewContact('),
        template.indexOf('function _escContactHtml('));
    const appended = [], order = [], attributes = {};
    const inputs = ['name', 'title', 'email'].map(field => ({dataset: {field}}));
    const photo = {};
    const card = {querySelector(selector) {
        if (selector === '.cd-section-header') return {prepend(node) {
            assert.equal(node, photo);
        }};
        if (selector === '.cd-danger') return {setAttribute(key, value) {
            attributes[key] = value;
        }};
        assert.equal(selector, '.cd-contact');
        const html = card.innerHTML;
        return {cloneNode(deep) {
            assert.equal(deep, true);
            return {html};
        }, querySelector: () => photo};
    }, querySelectorAll: () => inputs};
    const context = {
        document: {getElementById(id) {
            if (id === 'contactsEmpty') return {remove() { order.push('remove-empty'); }};
            if (id === 'contactsEditList') return {appendChild(node) {
                assert.equal(node, card);
                order.push('editor');
            }};
            assert.equal(id, 'contactsDisplay');
            return {appendChild(node) { appended.push(node); order.push('display'); }};
        }},
        root: {_customerDetail: {contactCreated(row) {
            assert.equal(row, card);
            order.push('history');
        }}},
        _escContactHtml: value => value,
    };
    vm.runInNewContext(render, context);
    context.renderSavedNewContact(card, {
        id: 17, name: 'Saved person', title: 'Role', email: 'saved@example.com',
    });
    assert.deepEqual(order, ['remove-empty', 'display', 'editor', 'history']);
    assert.equal(appended.length, 1);
    assert.match(appended[0].html, /Saved person/);
    assert.match(appended[0].html, /data-contact-id="17"/);
    assert.match(appended[0].html, /mailto:saved@example.com/);
    assert.equal(card.id, 'contact-edit-17');
    assert.deepEqual(inputs.map(field => field.value),
        ['Saved person', 'Role', 'saved@example.com']);
    assert.equal(attributes.onclick, 'deleteContactEdit(17)');
});

test('history rejects invalid raw coordinates and draft/output shapes', () => {
    assert.equal(validateHistory(saved(), 12).tab, 'cdNotes');
    assert.equal(validateHistory({...saved(), tab: 'cdFabric',
        scrolls: {cdFabric: 240}}, 12).scrolls.cdFabric, 240);
    for (const change of [
        {id: 99}, {fields: [['missing']]}, {removed: ['7']},
        {newContacts: [['name']]}, {work: NaN}, {context: -1},
        {scrolls: {cdNotes: Infinity}}, {scrolls: {other: 10}},
    ]) assert.throws(() => validateHistory({...saved(), ...change}, 12));
});
test('lazy Fabric content restores scroll after loading without moving an inactive tab', async () => {
    const h = harness({...saved(), tab: 'cdFabric', work: 240,
        scrolls: {cdFabric: 240}}, true);
    h.reading.scrollTop = 0;
    await h.reading.emit('scroll');
    assert.equal(h.window.history.state.sbCustomerDetail.work, 240);
    h.api.contentReady('cdFabric');
    assert.equal(h.reading.scrollTop, 240);
    h.reading.scrollTop = 360;
    await h.reading.emit('scroll');
    h.api.contentReady('cdFabric');
    assert.equal(h.reading.scrollTop, 360);
    await h.tabs[1].emit('click');
    h.reading.scrollTop = 80;
    h.api.contentReady('cdFabric');
    assert.equal(h.reading.scrollTop, 80);
});
test('tabs own one visible region and retain independent reading positions', async () => {
    const h = harness();
    assert.deepEqual(h.panels.map(panel => panel.hidden), [false, true, true, true]);
    h.reading.scrollTop = 55;
    await h.tabs[1].emit('click');
    assert.equal(h.reading.scrollTop, 0);
    h.reading.scrollTop = 120;
    await h.tabs[0].emit('click');
    assert.equal(h.reading.scrollTop, 55);
    await h.tabs[1].emit('click');
    assert.equal(h.reading.scrollTop, 120);
    assert.equal(h.window.history.state.unrelatedDraft, 'protected');
    assert.equal(h.requests.length, 0);
});
test('Back restores actual tab, draft, filter and reading without autosaving', () => {
    const h = harness(saved());
    assert.equal(h.input.value, 'draft');
    assert.equal(h.form.style.display, 'block');
    assert.equal(h.context.scrollTop, 27);
    assert.equal(h.reading.scrollTop, 180);
    assert.equal(h.search.value, 'fabric');
    assert.equal(h.api.isDirty(), true);
    assert.equal(h.requests.length, 0);
});
test('native discard keeps draft until confirmation and preserves the exact destination', async () => {
    const h = harness();
    h.input.value = 'unsaved';
    assert.equal(h.api.navigate(() => h.destinations.push('/customer/12/edit')), false);
    assert.equal(h.discard.open, true);
    assert.equal(h.input.value, 'unsaved');
    await h.confirm.emit('click');
    assert.deepEqual(h.destinations, ['/customer/12/edit']);
    assert.equal(h.input.value, '');
    assert.equal(h.window.history.state.unrelatedDraft, 'protected');
});
test('failed context save retains exact input, reports failure and does not navigate', async () => {
    const h = harness();
    h.input.value = 'retained draft';
    await h.form.emit('submit', {preventDefault() {}, currentTarget: h.form});
    assert.equal(h.input.value, 'retained draft');
    assert.equal(h.api.isDirty(), true);
    assert.equal(h.notice.textContent, 'Isolated failure');
    assert.equal(h.submit.disabled, false);
    assert.equal(h.requests[0].options.method, 'POST');
    assert.equal(h.requests[0].options.headers['X-Requested-With'], 'XMLHttpRequest');
    assert.deepEqual(h.destinations, []);
});
test('pending requests guard navigation and reject a duplicate write', async () => {
    const h = harness();
    let finish;
    h.window.fetch = () => new Promise(resolve => { finish = resolve; });
    const first = h.window.SBCustomerDetail.request(h.root, '/contacts', {method: 'POST'});
    assert.equal(h.api.isBusy(), true);
    assert.equal(h.api.navigate(() => h.destinations.push('unsafe')), false);
    await assert.rejects(h.window.SBCustomerDetail.request(h.root, '/contacts',
        {method: 'POST'}), /still saving/);
    finish({ok: true, clone: () => ({text: async () => ''})});
    await first;
    assert.equal(h.api.isBusy(), false);
    assert.deepEqual(h.destinations, []);
});
test('write guards remain active while the successful response body is pending', async () => {
    const h = harness();
    let finishBody;
    h.window.fetch = async () => ({
        ok: true, clone: () => ({
            text: () => new Promise(resolve => { finishBody = resolve; }),
        }),
    });
    const first = h.window.SBCustomerDetail.request(h.root, '/contacts', {method: 'POST'});
    await Promise.resolve();
    assert.equal(h.api.isBusy(), true);
    assert.equal(h.api.navigate(() => h.destinations.push('unsafe')), false);
    await assert.rejects(h.window.SBCustomerDetail.request(h.root, '/contacts',
        {method: 'POST'}), /still saving/);
    finishBody('{}');
    await first;
    assert.equal(h.api.isBusy(), false);
    assert.deepEqual(h.destinations, []);
});
