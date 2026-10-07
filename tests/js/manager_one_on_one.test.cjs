const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('a failed workspace flush protects the existing detail from replacement', async () => {
    const h = harness();
    let disposed = false;
    h.window.SBOneOnOneWorkspace = {
        root: {isConnected: true}, flush: async () => { throw new Error('Offline'); },
        dispose() { disposed = true; },
    };
    h.sellerNotes();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.requests.length, 0);
    assert.equal(disposed, false);
});

test('successful workspace flush disposes old editor timers before a new detail read', async () => {
    const h = harness();
    const sequence = [];
    h.window.SBOneOnOneWorkspace = {
        root: {isConnected: true}, flush: async () => { sequence.push('flush'); },
        dispose() { sequence.push('dispose'); },
    };
    h.sellerNotes();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(sequence, ['flush', 'dispose']);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, '/api/seller/12/one-on-one/detail');
});

function classes(initial = []) {
    const values = new Set(initial);
    return {
        add: value => values.add(value),
        remove: value => values.delete(value),
        contains: value => values.has(value),
        toggle(value, enabled) {
            if (enabled) values.add(value);
            else values.delete(value);
        },
    };
}

function node(tag) {
    return {
        tag, classList: classes(), style: {}, textContent: '', children: [], attributes: {},
        append(...children) { this.children.push(...children); },
        replaceChildren() { this.children = []; },
        setAttribute(name, value) { this.attributes[name] = value; },
        insertCell() { const child = node('td'); this.append(child); return child; },
        insertRow() { const child = node('tr'); this.append(child); return child; },
        createCaption() { const child = node('caption'); this.append(child); return child; },
        createTHead() { const child = node('thead'); this.append(child); return child; },
        createTBody() { const child = node('tbody'); this.append(child); return child; },
    };
}

function harness(workloadFilter = null) {
    const events = {};
    const windowEvents = {};
    const activePickers = [];
    const timers = new Map();
    const requests = [];
    const dialogs = [];
    const navigations = [];
    const sortMounts = [];
    let nextTimer = 0;
    const field = {dataset: {itemId: '7'}};
    const input = {
        value: '',
        disabled: false,
        classList: classes(),
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute(name) { delete this.attributes[name]; },
        closest: selector => selector === '.talking-points-field' ? field : null,
        focus() {},
    };
    field.querySelector = () => input;
    const elements = {};
    for (const name of [
        'reportError', 'reportErrorMessage', 'retryTalkingPoints', 'talkingPointsState',
        'pointsModalError', 'pointsModalState', 'discussPoints', 'pointsCreatedAt',
        'managerPointsTitle', 'managerPointsContext', 'pointsHistory', 'pointsHistoryCount',
        'managerPointsModal', 'managerWorkModal', 'managerWorkTitle', 'managerWorkFullLink',
        'managerWorkBody',
    ]) {
        elements[name] = {
            dataset: {}, classList: classes(['d-none']), textContent: '', focus() {},
            children: [],
            replaceChildren() { this.children = []; },
            append(...children) { this.children.push(...children); },
            addEventListener(name, callback) { this[name] = callback; },
            querySelectorAll: () => [],
        };
    }
    const errorText = {textContent: ''};
    const errorRetry = {classList: classes()};
    elements.pointsModalError.querySelector = selector => selector === 'span'
        ? errorText : errorRetry;
    elements.managerPointsField = field;
    elements.managerPointsText = input;
    const pointsButtons = new Map();
    function pointsButton(itemId = '7') {
        if (pointsButtons.has(itemId)) return pointsButtons.get(itemId);
        const icon = {};
        const button = {
            dataset: {action: 'open-points', itemId},
            classList: classes(), disabled: false, children: [],
            closest: selector => selector === '[data-action]' ? button : null,
            querySelector: selector => selector === 'i' ? icon : null,
            append(child) { this.children.push(child); },
        };
        pointsButtons.set(itemId, button);
        return button;
    }
    const root = {
        addEventListener: (name, callback) => {
            const previous = events[name];
            events[name] = previous ? event => { previous(event); callback(event); } : callback;
        },
        querySelector(selector) {
            if (selector === '.talking-points.is-invalid') {
                return input.classList.contains('is-invalid') ? input : null;
            }
            if (selector.startsWith('.points-button')) {
                return pointsButton(selector.match(/data-item-id="(\d+)"/)[1]);
            }
            return field.dataset.dirty === 'true' ? field : null;
        },
        querySelectorAll: selector => selector === '.work-picker:not(.d-none)'
            ? activePickers : field.dataset.dirty === 'true' ? [field] : [],
    };
    const context = {
        document: {
            getElementById: name => name === 'managerReport' ? root : elements[name],
            querySelectorAll: () => [],
            createElement(tag) {
                return node(tag);
            },
        },
        SBDialog: {
            open(dialog) { dialogs.push({action: 'open', dialog}); },
            close(dialog) { dialogs.push({action: 'close', dialog}); },
        },
        console: {error() {}},
        AbortController,
        URLSearchParams,
        Intl,
        window: {
            SBTableSort: {mount(root) { sortMounts.push(root); }},
            location: {assign(href) { navigations.push(href); }},
            addEventListener(name, callback) { windowEvents[name] = callback; },
            getSelection: () => ({toString: () => ''}),
        },
        localStorage: {
            getItem(key) { return key === 'u2c_workload_filter' ? workloadFilter : null; },
        },
        setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
        clearTimeout: id => timers.delete(id),
        fetch(url, options) {
            let resolve;
            const promise = new Promise(done => { resolve = done; });
            requests.push({
                url, options,
                finish(ok = true, item, extra = {}) {
                    resolve({
                        ok,
                        json: async () => ({
                            success: ok, error: ok ? undefined : 'Database unavailable',
                            item,
                            ...extra,
                        }),
                        text: async () => '<div>Complete seller workspace</div>',
                    });
                },
            });
            return promise;
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(
        __dirname, '..', '..', 'static', 'js', 'manager_one_on_one.js',
    ), 'utf8'), context);
    return {
        field, input, requests, elements, dialogs, navigations, sortMounts,
        fullPage() {
            const event = {
                currentTarget: {href: '/one-on-one/42'}, prevented: false,
                preventDefault() { this.prevented = true; },
            };
            const pending = elements.managerWorkFullLink.click(event);
            return {event, pending};
        },
        edit(value) { input.value = value; events.input({target: input}); },
        blur() { events.focusout({target: input}); },
        fireTimers() {
            const callbacks = [...timers.values()];
            timers.clear();
            for (const callback of callbacks) callback();
        },
        retry() {
            const button = {
                dataset: {action: 'retry-points'},
                closest: selector => selector === '[data-action]' ? button : null,
            };
            events.click({target: button});
        },
        openPoints(itemId = '7') { events.click({target: pointsButton(itemId)}); },
        discuss() {
            const button = {
                dataset: {action: 'discuss-points'},
                closest: selector => selector === '[data-action]' ? button : null,
            };
            events.click({target: button});
        },
        closePoints() {
            const event = {
                target: elements.managerPointsModal, prevented: false,
                preventDefault() { this.prevented = true; },
            };
            elements.managerPointsModal['sb:dialog-before-close'](event);
            return event;
        },
        window: context.window,
        changeSavedWorkload(value) {
            workloadFilter = value;
            windowEvents.storage({key: 'u2c_workload_filter'});
        },
        picker() {
            const parts = {
                '.candidate-search': {elements: {type: {value: 'milestone'}, q: {value: ''}}},
                '.picker-status': node('div'), '.candidate-results': node('div'),
                '.milestone-source': node('div'), '.selected-count': node('span'),
                '[data-action="add-items"]': node('button'),
            };
            let checked = [];
            const picker = {
                dataset: {sectionId: '2'},
                querySelector: selector => parts[selector],
                querySelectorAll: selector => selector.includes('picker-source') ? buttons : checked,
            };
            activePickers.push(picker);
            const buttons = ['search', 'u2c'].map(source => {
                const button = node('button');
                button.dataset = {action: 'picker-source', source};
                button.closest = selector => selector === '[data-action]' ? button
                    : selector === '.work-picker' ? picker : null;
                return button;
            });
            return {
                parts, buttons, dataset: picker.dataset,
                source(source) { events.click({target: buttons.find(b=>b.dataset.source===source)}); },
                type(type) {
                    parts['.candidate-search'].elements.type.value = type;
                    events.change({target: {name: 'type', closest: () => picker}});
                },
                selection(count) {
                    checked = Array.from({length: count}, () => node('input'));
                    events.change({target: {name: 'selection', closest: () => picker}});
                },
            };
        },
        sellerNotes(modified = false) {
            const link = {
                dataset: {action: 'open-seller-notes', sellerId: '12', sellerName: 'Seller Name'},
                href: '/seller/12/one-on-one',
                closest: selector => selector === '[data-action]' ? link : null,
            };
            const event = {
                target: link, ctrlKey: modified, prevented: false,
                preventDefault() { this.prevented = true; },
            };
            events.click(event);
            return event;
        },
        projectRow() {
            const row = {
                dataset: {itemType: 'project', entityId: '3', title: 'Certification plan'},
                querySelector: () => ({href: '/project/3'}),
            };
            const target = {
                closest: selector => selector === '.manager-work-row[data-entity-id]' ? row : null,
            };
            const event = {target, preventDefault() {}};
            events.click(event);
        },
        workModalEvent(name, targetId) {
            elements.managerWorkModal[name]({target: {id: targetId}});
        },
    };
}

async function settle() {
    for (let count = 0; count < 20; count++) await Promise.resolve();
}

test('native Points close waits for the pending save before closing', async () => {
    const ui = harness();
    ui.edit('Pending conversation');
    assert.equal(ui.closePoints().prevented, true);
    assert.equal(ui.dialogs.length, 0);
    ui.requests[0].finish();
    await settle();
    assert.equal(ui.dialogs.at(-1).action, 'close');
    assert.equal(ui.dialogs.at(-1).dialog, ui.elements.managerPointsModal);
    assert.equal(ui.field.dataset.dirty, 'false');
});

test('Full Page waits for workspace edits and preserves the inline workspace on failure', async () => {
    const ui = harness();
    ui.window.SBOneOnOneWorkspace = {
        root: {isConnected: true}, hasPendingEdits: () => true,
        async flush() { throw Error('Save failed'); },
    };
    const failed = ui.fullPage();
    await failed.pending;
    assert.equal(failed.event.prevented, true);
    assert.equal(ui.navigations.length, 0);
    assert.equal(ui.elements.reportError.classList.contains('d-none'), false);
    ui.window.SBOneOnOneWorkspace.flush = async () => {};
    await ui.fullPage().pending;
    assert.deepEqual(ui.navigations, ['/one-on-one/42']);
});

test('initiative writes protect unrelated form drafts and retain failed submitted edits', async () => {
    const full = fs.readFileSync(path.join(
        __dirname, '..', '..', 'static', 'js', 'manager_one_on_one.js',
    ), 'utf8');
    const source = 'async function mutate(button, action) {' +
        full.split('async function mutate(button, action) {')[1].split('function cell(')[0];
    const form = {};
    const control = {disabled: false};
    const drafts = new Set([form]);
    const errors = [];
    let reloads = 0, actions = 0;
    const history = {state: {sbTableSort: {keep: true}}, replaceState(state) {
        assert.equal(state, this.state);
    }};
    const context = {
        saving: false, formDrafts: drafts, history,
        root: {querySelectorAll: () => [control], querySelector: () => null},
        errorBox: {classList: classes()}, flushTalkingPoints: async () => {},
        window: {}, showError(error) { errors.push(error.message); },
        location: {reload() { reloads++; }},
    };
    vm.runInNewContext(source, context);
    const button = {disabled: false, closest: selector => selector === '.section-form'
        ? form : {id: 'section-1'}};
    const unrelated = {};
    drafts.add(unrelated);
    await context.mutate(button, async () => { actions++; });
    assert.equal(actions, 0);
    assert.match(errors.at(-1), /other initiative edits/);
    assert.equal(control.disabled, false);
    drafts.delete(unrelated);
    await context.mutate(button, async () => { throw Error('Database unavailable'); });
    assert.equal(drafts.has(form), true);
    assert.equal(reloads, 0);
    await context.mutate(button, async () => { actions++; });
    assert.equal(drafts.has(form), false);
    assert.equal(reloads, 1);
    assert.equal(control.disabled, false);
});

test('native work close restores the parent context and aborts a pending detail read', () => {
    const ui = harness();
    const original = {page: 'initiative_tracker'};
    ui.window.copilotContext = original;
    ui.projectRow();
    ui.window.copilotContext = {page: 'project'};
    ui.workModalEvent('sb:dialog-closed', 'managerWorkModal');
    assert.equal(ui.window.copilotContext, original);
    assert.equal(ui.requests[0].options.signal.aborted, true);
});

test('candidate sorters exclude selection and use raw ISO dates and unrounded ACR', async () => {
    const ui = harness();
    const picker = ui.picker();
    picker.type('milestone');
    ui.requests[0].finish(true, undefined, {results: [{
        id: 8, title: 'Quarter work', customer_name: 'Customer', status: 'On Track',
        commitment: 'Uncommitted', due_date: '2026-12-15', acr: 1234.56,
    }]});
    await settle();
    const table = picker.parts['.candidate-results'].children[0];
    assert.equal(ui.sortMounts.length, 1);
    assert.equal(table.attributes['data-sb-sort-key'], 'initiative-candidates-2');
    const headers = table.children[1].children[0].children;
    assert.deepEqual(headers.map(th => th.attributes['data-sb-sort-type']),
        [undefined, 'text', 'text', 'text', 'date', 'number']);
    const cells = table.children[2].children[0].children;
    assert.equal(cells[4].attributes['data-sb-sort-value'], '2026-12-15');
    assert.equal(cells[5].attributes['data-sb-sort-value'], '1234.56');
});

test('embedded workspace native host waits for saves and retains drafts on failure', async () => {
    const source = fs.readFileSync(path.join(
        __dirname, '..', '..', 'templates', 'partials', 'one_on_one_workspace_content.html',
    ), 'utf8').split('let closingWorkspace = false;')[1].split('{% endif %}')[0];
    function host(failure) {
        const listeners = {};
        const parent = {addEventListener: (name, callback) => { listeners[name] = callback; }};
        const calls = [];
        vm.runInNewContext(`let closingWorkspace = false;${source}`, {
            parentModal: parent, nativeParent: true,
            parentClosingEvent: 'sb:dialog-before-close', parentClosedEvent: 'sb:dialog-closed',
            workspaceRoot: {isConnected: true}, hasPendingEdits: () => true,
            workspaceController: {dispose() { calls.push('dispose'); }},
            flushEdits: async () => { calls.push('flush'); if (failure) throw Error('Offline'); },
            SBDialog: {close(dialog, reason) {
                assert.equal(dialog, parent); assert.equal(reason, 'saved'); calls.push('close');
            }},
            alert() { calls.push('notice'); },
        });
        const event = {target: parent, preventDefault() { calls.push('prevent'); }};
        listeners['sb:dialog-before-close'](event);
        return {calls, closed() { listeners['sb:dialog-closed'](event); }};
    }
    const success = host(false);
    const failed = host(true);
    await settle();
    assert.deepEqual(success.calls, ['prevent', 'flush', 'close']);
    success.closed();
    assert.equal(success.calls.at(-1), 'dispose');
    assert.deepEqual(failed.calls, ['prevent', 'flush', 'notice']);
});

test('Back waits for picker results before restoring scroll and never overwrites saved context', async () => {
    const full = fs.readFileSync(path.join(
        __dirname, '..', '..', 'static', 'js', 'manager_one_on_one.js',
    ), 'utf8');
    const source = 'const reading = document.getElementById(\'initiativeReading\');' +
        full.split("const reading = document.getElementById('initiativeReading');")[1]
            .split('})();')[0];
    const events = {};
    const pending = [];
    const reading = {scrollTop: 0, addEventListener() {}};
    const type = {value: ''}, query = {value: ''};
    const picker = {
        id: 'picker-1', dataset: {}, classList: classes(['d-none']),
        matches: selector => ['.it-editor', '.work-picker'].includes(selector),
        querySelector: selector => selector.startsWith('select') ? type
            : selector.startsWith('input') ? query : {scrollTop: 0},
        querySelectorAll: () => [],
    };
    const history = {state: {sbInitiatives: {
        top: 120, editors: ['picker-1'], pickers: [{
            id: 'picker-1', source: 'u2c', type: 'milestone', q: 'SQL', selected: [], top: 0,
        }],
    }}, replaceState(value) { this.state = value; }};
    const context = {
        document: {getElementById: id => id === 'initiativeReading' ? reading : picker},
        root: {querySelectorAll: selector => selector.startsWith('[aria-controls')
            ? [{setAttribute() {}}] : [picker]},
        history, window: {addEventListener(name, callback) { events[name] = callback; }},
        showError(error) { throw error; },
        search() {
            context.saveReading();
            return new Promise(resolve => pending.push(resolve));
        },
    };
    vm.runInNewContext(source, context);
    events.pageshow();
    assert.equal(history.state.sbInitiatives.top, 120);
    assert.equal(query.value, 'SQL');
    assert.equal(type.value, 'milestone');
    assert.equal(picker.dataset.source, 'u2c');
    assert.equal(pending.length, 2);
    pending[1]();
    await settle();
    assert.equal(reading.scrollTop, 120);
    pending[0]();
    await settle();
    assert.equal(reading.scrollTop, 120);
    context.saveReading();
    assert.equal(history.state.sbInitiatives.top, 120);
});

test('typing is debounced and a successful autosave clears pending state', async () => {
    const ui = harness();
    ui.edit('Progress');
    ui.edit('Progress and blockers');
    assert.equal(ui.requests.length, 0);
    ui.fireTimers();
    assert.equal(ui.requests.length, 1);
    assert.equal(JSON.parse(ui.requests[0].options.body).talking_points, 'Progress and blockers');
    ui.requests[0].finish();
    await settle();
    assert.equal(ui.field.dataset.dirty, 'false');
    assert.equal(ui.elements.talkingPointsState.textContent, 'Points save automatically');
});

test('edits during an in-flight save are serialized and the latest value wins', async () => {
    const ui = harness();
    ui.edit('Older edit');
    ui.fireTimers();
    ui.edit('Newer edit');
    ui.fireTimers();
    assert.equal(ui.requests.length, 1);
    ui.requests[0].finish();
    await settle();
    assert.equal(ui.requests.length, 2);
    assert.equal(JSON.parse(ui.requests[1].options.body).talking_points, 'Newer edit');
    ui.requests[1].finish();
    await settle();
    assert.equal(ui.field.dataset.dirty, 'false');
    assert.equal(ui.input.value, 'Newer edit');
});

test('a failed save stays dirty and exposes a retry that clears the error on success', async () => {
    const ui = harness();
    ui.edit('Keep this note');
    ui.fireTimers();
    ui.requests[0].finish(false);
    await settle();
    assert.equal(ui.field.dataset.dirty, 'true');
    assert.equal(ui.input.attributes['aria-invalid'], 'true');
    assert.equal(ui.elements.reportError.classList.contains('d-none'), false);
    assert.equal(ui.elements.retryTalkingPoints.classList.contains('d-none'), false);
    ui.retry();
    assert.equal(ui.requests.length, 2);
    ui.requests[1].finish();
    await settle();
    assert.equal(ui.field.dataset.dirty, 'false');
    assert.equal(ui.input.attributes['aria-invalid'], undefined);
    assert.equal(ui.elements.reportError.classList.contains('d-none'), true);
});

test('leaving a field saves immediately without a duplicate debounce request', async () => {
    const ui = harness();
    ui.edit('Save on blur');
    ui.blur();
    assert.equal(ui.requests.length, 1);
    ui.fireTimers();
    assert.equal(ui.requests.length, 1);
    ui.requests[0].finish();
    await settle();
    assert.equal(ui.field.dataset.dirty, 'false');
});

function agendaItem(text = '', id = 7) {
    return {
        id, title: `Work ${id}`, customer_name: 'Test customer',
        talking_points: text,
        points_created_at: text ? '2026-09-30T17:00:00+00:00' : null,
        discussed_points: [],
    };
}

test('opening Points loads the latest block and renders dated history as text', async () => {
    const ui = harness();
    ui.openPoints();
    await settle();
    assert.equal(ui.requests[0].url, '/api/reports/manager-one-on-one/items/7');
    assert.equal(ui.requests[0].options.method, 'GET');
    const item = agendaItem('Next meeting');
    item.discussed_points = [{
        id: 1, text: '<script>not executable</script>\nPrior meeting',
        created_at: '2026-09-29T17:00:00+00:00',
        discussed_at: '2026-09-30T17:00:00+00:00',
    }];
    ui.requests[0].finish(true, item);
    await settle();
    assert.equal(ui.input.value, 'Next meeting');
    assert.equal(ui.field.dataset.dirty, 'false');
    const entry = ui.elements.pointsHistory.children[0];
    assert.equal(entry.children[1].textContent, item.discussed_points[0].text);
    assert.equal(entry.children[0].children[0].children[1].dateTime, item.discussed_points[0].created_at);
    assert.equal(ui.elements.pointsHistoryCount.textContent, 1);
});

test('marking discussed waits for autosave, archives once, and clears the editor', async () => {
    const ui = harness();
    ui.edit('Meeting agenda');
    ui.fireTimers();
    ui.discuss();
    ui.discuss();
    assert.equal(ui.requests.length, 1);
    assert.equal(ui.input.disabled, true);
    ui.requests[0].finish(true, agendaItem('Meeting agenda'));
    await settle();
    assert.equal(ui.requests.length, 2);
    assert.equal(ui.requests[1].url, '/api/reports/manager-one-on-one/items/7/discuss');
    assert.equal(JSON.parse(ui.requests[1].options.body).talking_points, 'Meeting agenda');
    const archived = agendaItem();
    archived.discussed_points = [{
        id: 1, text: 'Meeting agenda', created_at: '2026-09-30T17:00:00+00:00',
        discussed_at: '2026-09-30T17:01:00+00:00',
    }];
    ui.requests[1].finish(true, archived);
    await settle();
    assert.equal(ui.input.value, '');
    assert.equal(ui.input.disabled, false);
    assert.equal(ui.field.dataset.dirty, 'false');
    assert.equal(ui.elements.discussPoints.disabled, true);
    assert.equal(ui.elements.pointsHistoryCount.textContent, 1);
});

test('a failed archive keeps the saved current block and exposes its error in the modal', async () => {
    const ui = harness();
    ui.edit('Keep this agenda');
    ui.blur();
    ui.requests[0].finish();
    await settle();
    ui.discuss();
    await settle();
    ui.requests[1].finish(false);
    await settle();
    assert.equal(ui.input.value, 'Keep this agenda');
    assert.equal(ui.input.disabled, false);
    assert.equal(ui.elements.pointsModalError.classList.contains('d-none'), false);
    assert.equal(ui.elements.discussPoints.disabled, false);
});

test('closing with unsaved points flushes immediately and stays open on failure', async () => {
    const ui = harness();
    ui.edit('Do not lose this');
    const close = ui.closePoints();
    assert.equal(close.prevented, true);
    assert.equal(ui.requests.length, 1);
    ui.requests[0].finish(false);
    await settle();
    assert.equal(ui.field.dataset.dirty, 'true');
    assert.equal(ui.input.value, 'Do not lose this');
    assert.equal(ui.elements.pointsModalError.classList.contains('d-none'), false);
});

test('a nested work modal closing does not reset the visible detail context', () => {
    const ui = harness();
    ui.window.copilotContext = {page: 'engagement_view'};
    ui.workModalEvent('sb:dialog-closed', 'taskEditModal');
    assert.equal(ui.window.copilotContext.page, 'engagement_view');
});

test('seller notes fetch the shared workspace fragment without navigation', async () => {
    const ui = harness();
    const click = ui.sellerNotes();
    assert.equal(click.prevented, true);
    assert.equal(ui.requests[0].url, '/api/seller/12/one-on-one/detail');
    assert.equal(ui.elements.managerWorkTitle.textContent, '1:1 notes: Seller Name');
    assert.equal(ui.elements.managerWorkFullLink.href, '/seller/12/one-on-one');
    ui.requests[0].finish();
    await settle();
    assert.equal(ui.elements.managerWorkBody.innerHTML, '<div>Complete seller workspace</div>');
});

test('modified seller notes clicks keep the original link behavior', () => {
    const ui = harness();
    const click = ui.sellerNotes(true);
    assert.equal(click.prevented, false);
    assert.equal(ui.requests.length, 0);
});

test('project rows open the shared work modal using the project fragment', async () => {
    const ui = harness();
    ui.projectRow();
    assert.equal(ui.requests[0].url, '/api/project/3/detail');
    assert.equal(ui.elements.managerWorkTitle.textContent, 'Certification plan');
    assert.equal(ui.elements.managerWorkFullLink.href, '/project/3');
    ui.requests[0].finish();
    await settle();
    assert.equal(ui.elements.managerWorkBody.innerHTML, '<div>Complete seller workspace</div>');
});

test('native project task dialogs restore the parent, including close during its transition', () => {
    function modal(initialClasses) {
        const listeners = new Map();
        return {
            classList: classes(initialClasses), isConnected: true, dataset: {},
            addEventListener(name, callback, options = {}) {
                const entries = listeners.get(name) || [];
                listeners.set(name, [...entries, {callback, once: options.once}]);
            },
            removeEventListener(name, callback) {
                listeners.set(name, (listeners.get(name) || []).filter(
                    entry => entry.callback !== callback,
                ));
            },
            emit(name, event = {}) {
                for (const entry of [...(listeners.get(name) || [])]) {
                    if (entry.once) this.removeEventListener(name, entry.callback);
                    entry.callback(event);
                }
            },
        };
    }
    const parent = modal(['show']);
    parent.id = 'managerWorkModal';
    const task = modal([]);
    const discard = modal([]);
    const appended = [];
    parent.querySelector = selector => selector === '#actionItemDetailModal' ? task : discard;
    let transitioning = true;
    let hideCount = 0;
    let parentShowCount = 0;
    const source = fs.readFileSync(path.join(
        __dirname, '..', '..', 'templates', 'partials', 'project_view_content.html',
    ), 'utf8').split('{% if parent_modal_id is defined %}')[1].split('{% endif %}')[0]
        .replace('{{ parent_modal_id|tojson }}', '"managerWorkModal"');
    vm.runInNewContext(source, {
        document: {
            getElementById: id => id === parent.id ? parent : task,
            body: {appendChild(element) { appended.push(element); }},
        },
        HTMLDialogElement: class {},
        bootstrap: {Modal: {
            getOrCreateInstance: element => {
                assert.equal(element, parent);
                return {
                hide() { hideCount++; if (!transitioning) parent.classList.remove('show'); },
                show() { parentShowCount++; parent.classList.add('show'); },
                };
            },
        }},
    });

    assert.deepEqual(appended, [task, discard]);
    assert.equal(discard.dataset.workspaceParentModal, parent.id);
    task.emit('sb:dialog-opening');
    task.emit('sb:dialog-closed');
    assert.equal(parentShowCount, 0);
    transitioning = false;
    parent.emit('shown.bs.modal');
    assert.equal(hideCount, 2);
    assert.equal(parent.classList.contains('show'), false);
    parent.emit('hidden.bs.modal');
    assert.equal(parentShowCount, 1);
    assert.equal(parent.classList.contains('show'), true);
    parent.emit('shown.bs.modal');
    assert.equal(hideCount, 2);
    task.emit('sb:dialog-opening');
    parent.emit('hidden.bs.modal');
    task.emit('sb:dialog-closed');
    assert.equal(parentShowCount, 2);
    assert.equal(parent.classList.contains('show'), true);
});

test('native project task dialogs keep the native parent open without invoking Bootstrap', () => {
    const listeners = {};
    const task = {dataset: {}, addEventListener(name, callback) { listeners[name] = callback; }};
    const discard = {dataset: {}};
    class NativeParent {
        constructor() { this.id = 'managerWorkModal'; this.isConnected = true; this.open = true; }
        querySelector(selector) { return selector === '#actionItemDetailModal' ? task : discard; }
    }
    const parent = new NativeParent();
    const source = fs.readFileSync(path.join(
        __dirname, '..', '..', 'templates', 'partials', 'project_view_content.html',
    ), 'utf8').split('{% if parent_modal_id is defined %}')[1].split('{% endif %}')[0]
        .replace('{{ parent_modal_id|tojson }}', '"managerWorkModal"');
    const appended = [];
    vm.runInNewContext(source, {
        HTMLDialogElement: NativeParent,
        document: {getElementById: () => parent, body: {appendChild(el) { appended.push(el); }}},
        bootstrap: {Modal: {getOrCreateInstance() { throw Error('Native parent used Bootstrap'); }}},
    });
    listeners['sb:dialog-opening']();
    listeners['sb:dialog-closed']();
    assert.equal(parent.open, true);
    assert.deepEqual(appended, [task, discard]);
    assert.equal(task.dataset.workspaceParentModal, parent.id);
});

test('project selection resets U2C source and displays projects without customer or ACR', async () => {
    const ui = harness();
    const picker = ui.picker();
    picker.source('u2c');
    picker.type('project');
    assert.equal(picker.dataset.source, 'search');
    assert.equal(picker.parts['.milestone-source'].classList.contains('d-none'), true);
    assert.match(ui.requests[1].url, /type=project&source=search/);
    assert.equal(
        picker.parts['.candidate-search'].elements.q.placeholder,
        'Search title, description, or project type',
    );
    ui.requests[1].finish(true, undefined, {results: [{
        id: 3, title: 'Certification plan', customer_name: 'Internal project',
        customer_id: null, status: 'Completed', due_date: null, acr: null, detail: 'Training',
    }]});
    await settle();
    const table = picker.parts['.candidate-results'].children[0];
    assert.equal(table.children.find(child => child.tag === 'caption').textContent, 'Available projects');
    const row = table.children.find(child => child.tag === 'tbody').children[0];
    assert.equal(row.children[0].children[0].disabled, false);
    assert.equal(row.children[2].textContent, 'Internal project');
    assert.equal(row.children[5].textContent, '-');
});

function u2cPayload(results = []) {
    return {
        snapshot: {
            fiscal_quarter: 'FY27 Q1', version_date: '2026-09-22',
            snapshot_date: '2026-09-29T00:00:00+00:00',
        },
        results,
    };
}

test('From U2C shows provenance and disables already-added and unsynced rows', async () => {
    const ui = harness();
    const picker = ui.picker();
    picker.source('u2c');
    assert.match(ui.requests[0].url, /type=milestone&source=u2c/);
    const base = {
        id: 1, title: 'SQL milestone', customer_name: 'Customer', status: 'On Track',
        commitment: 'Uncommitted', due_date: '2026-09-30', acr: 1000, detail: 'SQL',
    };
    ui.requests[0].finish(true, undefined, u2cPayload([
        {...base, available: true, selectable: true, already_added: false},
        {...base, id: 2, available: true, selectable: false, already_added: true, reason: 'Already added'},
        {...base, id: null, available: false, selectable: false, already_added: false, reason: 'Not synced locally'},
    ]));
    await settle();
    const status = picker.parts['.picker-status'].textContent;
    assert.match(status, /FY27 Q1.*Snapshot 2026-09-22.*1 available.*1 already added.*1 not synced/);
    const body = picker.parts['.candidate-results'].children[0].children.find(n=>n.tag==='tbody');
    assert.deepEqual(body.children.map(row=>row.children[0].children[0].disabled), [false, true, true]);
    assert.equal(picker.buttons[1].attributes['aria-pressed'], 'true');
});

test('a late assisted response cannot overwrite a subsequent engagement search', async () => {
    const ui = harness();
    const picker = ui.picker();
    picker.source('u2c');
    picker.type('engagement');
    assert.equal(picker.dataset.source, 'search');
    assert.match(ui.requests[1].url, /type=engagement&source=search/);
    ui.requests[1].finish(true, undefined, {results: []});
    await settle();
    const message = picker.parts['.picker-status'].textContent;
    ui.requests[0].finish(true, undefined, u2cPayload());
    await settle();
    assert.equal(picker.parts['.picker-status'].textContent, message);
    assert.equal(picker.parts['.milestone-source'].classList.contains('d-none'), true);
});

test('missing snapshots show their explicit message, without a results table', async () => {
    const ui = harness();
    const picker = ui.picker();
    picker.source('u2c');
    ui.requests[0].finish(true, undefined, {
        snapshot: null, results: [], message: 'No FY27 Q1 U2C snapshot is available.',
    });
    await settle();
    assert.equal(picker.parts['.picker-status'].textContent, 'No FY27 Q1 U2C snapshot is available.');
    assert.equal(picker.parts['.candidate-results'].children.length, 0);
});

test('the picker enforces the exact 75-item selection limit', () => {
    const ui = harness();
    const picker = ui.picker();
    for (const [count, disabled] of [[0, true], [1, false], [75, false], [76, true]]) {
        picker.selection(count);
        assert.equal(picker.parts['[data-action="add-items"]'].disabled, disabled);
    }
    assert.match(picker.parts['.selected-count'].textContent, /76 selected.*75/);
});

test('From U2C sends the workload saved by the U2C page and names that scope', async () => {
    const ui = harness('Data');
    const picker = ui.picker();
    picker.source('u2c');
    assert.match(ui.requests[0].url, /workload_prefix=Data/);
    ui.requests[0].finish(true, undefined, {...u2cPayload(), workload_prefix: 'Data'});
    await settle();
    assert.match(picker.parts['.picker-status'].textContent, /Data workloads \(U2C filter\)/);
});

test('All workloads stays unfiltered, and regular search ignores the U2C selection', () => {
    const ui = harness('Data');
    const picker = ui.picker();
    picker.source('search');
    assert.doesNotMatch(ui.requests[0].url, /workload_prefix/);
    picker.source('u2c');
    assert.match(ui.requests[1].url, /workload_prefix=Data/);
    ui.changeSavedWorkload(null);
    assert.doesNotMatch(ui.requests[2].url, /workload_prefix/);
    assert.match(ui.requests[2].url, /source=u2c/);
});

test('changing the U2C filter in another tab refreshes an open assisted picker', () => {
    const ui = harness('Data');
    const picker = ui.picker();
    picker.source('u2c');
    ui.changeSavedWorkload('Infra');
    assert.equal(ui.requests.length, 2);
    assert.match(ui.requests[1].url, /workload_prefix=Infra/);
    assert.equal(ui.requests[0].options.signal.aborted, true);
});
