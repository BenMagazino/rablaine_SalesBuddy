const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
    const nodes = new Map(), requests = [], replies = [], errors = [], events = {};
    function node(id = '') {
        const n = {id, value: '', style: {display: ''}, dataset: {}, handlers: {},
            className: '', disabled: false, hidden: false, innerHTML: '', textContent: '',
            options: [], selectedIndex: 0, scrollTop: 0, scrollLeft: 0, open: false,
            addEventListener(type, fn, opts) {
                (this.handlers[type] ||= []).push({fn, once: opts?.once});
            },
            removeEventListener(type, fn) {
                this.handlers[type] = (this.handlers[type] || []).filter(h => h.fn !== fn);
            },
            fire(type, event = {}) {
                for (const h of [...this.handlers[type] || []]) {
                    h.fn({target: this, ...event});
                    if (h.once) this.removeEventListener(type, h.fn);
                }
            },
            setAttribute(name, value) { this[name] = value; },
            appendChild(child) { this.options.push(child); },
            querySelectorAll() { return []; },
            querySelector() { return node(); },
            before() {},
        };
        n.classList = {
            add(...classes) { n.className = [...new Set([...n.className.split(' '), ...classes])].join(' '); },
            remove(...classes) { n.className = n.className.split(' ').filter(c => !classes.includes(c)).join(' '); },
            contains(c) { return n.className.split(' ').includes(c); },
            toggle(c) { this.contains(c) ? this.remove(c) : this.add(c); },
        };
        return n;
    }
    const get = id => {
        if (!nodes.has(id)) nodes.set(id, node(id));
        return nodes.get(id);
    };
    const root = node('root'), reading = node('reading');
    root.querySelector = () => reading;
    const document = {
        getElementById: get,
        querySelector(selector) { return selector === '.fill-workbench' ? root :
            selector === '.fill-reading' ? reading : null; },
        createElement() {
            const n = node();
            Object.defineProperty(n, 'textContent', {set(value) {
                this.innerHTML = String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
                    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
            }});
            return n;
        },
    };
    const window = {
        document, history: {state: {keep: 7}, replaceState(value) { this.state = value; }},
        console: {error(...args) { errors.push(args); }},
        setTimeout(fn) { fn(); },
        clearTimeout() {},
        addEventListener(type, fn) { (events[type] ||= []).push(fn); },
        SBTableSort: {mount() {}},
        SBDialog: {
            open(dialog) { dialog.open = true; },
            close(dialog) { dialog.open = false; dialog.fire('sb:dialog-closed'); },
        },
    };
    const fetch = async (url, options = {}) => {
        requests.push({url, ...options, payload: options.body && JSON.parse(options.body)});
        const reply = replies.shift();
        if (reply instanceof Error) throw reply;
        if (!reply) throw Error(`Unexpected request: ${url}`);
        return {ok: reply.ok !== false, json: async () => reply.data ?? reply};
    };
    const context = vm.createContext({window, document, fetch, console: window.console,
        setTimeout: window.setTimeout, Date, Promise});
    const template = fs.readFileSync('templates/fill_my_day.html', 'utf8');
    const source = template.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
    vm.runInContext(source, context);
    vm.runInContext(fs.readFileSync('static/js/ui-fill-day.js', 'utf8'), context);
    function run(code) { return vm.runInContext(code, context); }
    return {nodes, get, root, reading, window, requests, replies, errors, events, run};
}

test('loading and Back request nothing, retains exact date and other history state', () => {
    const h = harness();
    h.get('fillDate').value = '2026-10-07';
    h.reading.scrollTop = 400;
    h.reading.scrollLeft = 12;
    h.run('rememberFillReview()');
    h.get('fillDate').value = '';
    h.reading.scrollTop = 0;
    h.run('restoreFillReview()');
    assert.equal(h.get('fillDate').value, '2026-10-07');
    assert.equal(h.reading.scrollTop, 400);
    assert.equal(h.reading.scrollLeft, 12);
    assert.equal(h.window.history.state.keep, 7);
    assert.equal(h.requests.length, 0);
});

test('initial fetch cancellation never calls calendar, summaries, AI or writes', async () => {
    const h = harness();
    h.get('fillDate').value = '2026-10-07';
    const pending = h.run('startFillMyDay()');
    assert.equal(h.get('fillGuard').open, true);
    h.window.SBDialog.close(h.get('fillGuard'));
    await pending;
    assert.equal(h.requests.length, 0);
    assert.equal(h.get('startBtn').disabled, false);
});

test('date validation, empty result, failed fetch and explicit retry', async () => {
    const h = harness();
    await h.run('startFillMyDay()');
    assert.match(h.get('errorText').textContent, /select a date/);
    h.get('fillDate').value = '2026-10-07';
    h.replies.push({ok: false, data: {error: 'WorkIQ unavailable'}});
    let pending = h.run('startFillMyDay()');
    h.get('fillGuardConfirm').fire('click');
    await pending;
    assert.match(h.get('errorText').textContent, /WorkIQ unavailable/);
    assert.equal(h.get('fillDate').disabled, false);
    h.replies.push({meetings: []});
    pending = h.run('startFillMyDay()');
    h.get('fillGuardConfirm').fire('click');
    await pending;
    assert.equal(h.get('noMeetingsMsg').style.display, 'block');
    assert.equal(h.requests[0].url, '/api/meetings?date=2026-10-07');
    assert.equal(h.requests.length, 2);
});

test('customer ranking retains suffixes, nickname, threshold, ties and no false word overlap', async () => {
    const h = harness();
    h.replies.push([{id: 1, name: 'Acme Corporation', nickname: 'Rocket', tpid_url: 'url'},
        {id: 2, name: 'Acme Corporation'}]);
    await h.run("matchCustomers([{customer:'Rocket',title:'Review'},{customer:'Acme Inc',title:''},{customer:'Unrelated',title:'Unknown'}])");
    assert.equal(h.run('customerMap[0].customer_id'), 1);
    assert.equal(h.run('customerMap[1].customer_id'), 1);
    assert.equal(h.run('customerMap[2]'), undefined);
    assert.equal(h.run("fuzzyScore('CDP EHS','McLeod Health')"), 0);
    assert.equal(h.run("fuzzyScore('Acme Inc','Acme Corp')"), .9);
});

test('sequential enrichment uses exact date/customer and preserves visible failures', async () => {
    const h = harness();
    h.run("meetings=[{title:'First'},{title:'Second'},{title:'Third'}]; customerMap={0:{customer_id:7},1:{customer_id:8},2:{customer_id:9}}");
    h.replies.push({success: true, content_html: '<p>Summary</p>', topics: [{id: 1}]},
        {success: false, error: '<failed>'}, new Error('Network'));
    await h.run("enrichMeetings('2026-10-07')");
    assert.equal(h.requests.length, 3);
    assert.deepEqual(h.requests.map(r => r.payload.customer_id), [7, 8, 9]);
    assert.ok(h.requests.every(r => r.url === '/api/fill-my-day/process' && r.method === 'POST'));
    assert.ok(h.requests.every(r => r.payload.date === '2026-10-07'));
    assert.match(h.run('enrichedData[1].content_html'), /&lt;failed&gt;/);
    assert.match(h.run('enrichedData[2].content_html'), /Enrichment failed/);
});

test('HTML editing done/cancel, topic toggles and milestone removal remain local', () => {
    const h = harness();
    h.get('meetingCard-0').dataset.contentHtml = '<p>Original</p>';
    h.get('overviewTextarea-0').value = '<p>Edited</p>';
    h.run('saveCardEdit(0)');
    assert.equal(h.get('meetingCard-0').dataset.contentHtml, '<p>Edited</p>');
    h.get('overviewTextarea-0').value = 'Discard';
    h.run('cancelCardEdit(0)');
    assert.equal(h.get('overviewTextarea-0').value, '<p>Edited</p>');
    h.get('meetingCard-0').dataset.milestone = '{"msx_milestone_id":"ms"}';
    h.run('removeCardMilestone(0)');
    assert.equal(h.get('meetingCard-0').dataset.milestone, 'null');
    assert.equal(h.get('taskSection-0').style.display, 'none');
    assert.equal(h.requests.length, 0);
});

function taskHarness() {
    const h = harness();
    h.get('meetingCard-0').dataset = {milestone: '{"msx_milestone_id":"ms"}'};
    h.get('taskSubject-0').value = ' Title ';
    h.get('taskCategory-0').value = 'Workshop';
    h.get('taskCategory-0').options = [{dataset: {isHva: '1'}}];
    h.get('taskDuration-0').value = '90';
    h.get('taskDesc-0').value = ' Description ';
    h.get('taskDueDate-0').value = '2026-10-08';
    return h;
}

test('remote task exact scheduling/completion payload, error retry and no duplicate creation', async () => {
    const h = taskHarness();
    h.replies.push({success: false, error: 'Denied'}, {
        success: true, task_id: 'created', task_url: 'https://example.com/task'});
    await h.run('createCardTask(0)');
    assert.equal(h.get('createTaskBtn-0').disabled, false);
    assert.equal(h.get('taskError-0').textContent, 'Denied');
    await h.run('createCardTask(0)');
    assert.deepEqual(h.requests[1].payload, {
        milestone_id: 'ms', subject: 'Title', category: 'Workshop', duration: 90,
        description: 'Description', due_date: '2026-10-08T23:59:59Z', complete_on_create: true,
    });
    assert.equal(h.get('meetingCard-0').dataset.createdTaskIsHva, '1');
    assert.equal(h.get('taskForm-0').style.display, 'none');
    await h.run('createCardTask(0)');
    assert.equal(h.requests.length, 2);
});

test('task validation and category failures stay visible and retryable', async () => {
    const h = taskHarness();
    h.get('taskSubject-0').value = '';
    await h.run('createCardTask(0)');
    assert.match(h.get('taskError-0').textContent, /title is required/);
    h.replies.push({ok: false});
    await h.run('populateCardTaskCategories(0)');
    assert.match(h.get('taskError-0').textContent, /Could not load/);
    assert.equal(typeof h.get('taskCategory-0').onfocus, 'function');
    h.replies.push([{name: 'Workshop', is_hva: true}]);
    await h.run('populateCardTaskCategories(0)');
    assert.equal(h.get('taskCategory-0').options.at(-1).dataset.isHva, '1');
});

test('save exact metadata, retains input on failure and completes only after retry success', async () => {
    const h = taskHarness();
    Object.assign(h.get('meetingCard-0').dataset, {
        contentHtml: '<p>Edited</p>', customerId: '7', topicIds: '[1,2]',
        createdTaskId: 'created', createdTaskUrl: 'url',
        createdTaskCategoryName: 'Workshop', createdTaskIsHva: '1',
    });
    h.run("meetings=[{title:'Review'}];totalCards=1");
    h.replies.push(new Error('Offline'), {success: true, view_url: '/note/42'});
    await h.run("saveNote(0,'2026-10-07','14:15')");
    assert.equal(h.get('saveBtn-0').disabled, false);
    assert.equal(h.get('meetingCard-0').dataset.contentHtml, '<p>Edited</p>');
    assert.equal(h.run('savedCount'), 0);
    await h.run("saveNote(0,'2026-10-07','14:15')");
    assert.equal(h.requests[1].url, '/api/fill-my-day/save');
    assert.deepEqual(h.requests[1].payload, {
        customer_id: 7, call_date: '2026-10-07', call_time: '14:15',
        content: '<p>Edited</p>', topic_ids: [1,2], milestone: {msx_milestone_id: 'ms'},
        task_subject: ' Title ', task_description: ' Description ',
        created_task_id: 'created', created_task_url: 'url',
        created_task_category_name: 'Workshop', created_task_is_hva: '1',
        task_due_date: '2026-10-08',
    });
    assert.equal(h.run('savedCount'), 1);
    assert.equal(h.get('completionSummary').style.display, 'block');
    assert.match(h.get('saveBtn-0').outerHTML, /\/note\/42/);
});

test('generated review preserves every field, association, full editor and native actions', () => {
    const h = harness();
    const card = h.run(`createMeetingCard(0,
        {title:'Review <title>',start_time:'2026-10-07T14:15:00',start_time_display:'2:15 PM'},
        {customer_id:7,customer_name:'Acme',nickname:'AC',score:.9},
        {content_html:'<p>Summary</p>',topics:[{id:1,name:'Azure'}],
         task_subject:'Task',task_description:'Details',
         milestone:{msx_milestone_id:'ms',name:'Milestone',status:'On Track',
         number:'7-42',opportunity_name:'Opportunity',workload:'Azure',monthly_usage:'123',
         url:'https://example.com/ms'}}, '2026-10-07', 0)`);
    assert.equal(card.dataset.customerId, 7);
    assert.equal(card.dataset.topicIds, '[1]');
    assert.match(card.innerHTML, /Review &lt;title&gt;/);
    for (const field of ['overviewTextarea', 'taskSubject', 'taskCategory', 'taskDuration',
        'taskDueDate', 'taskDesc', 'taskError', 'saveBtn', 'createTaskBtn']) {
        assert.ok(card.innerHTML.includes(`id="${field}-0"`), field);
    }
    assert.match(card.innerHTML, /\/note\/new\?customer_id=7&date=2026-10-07/);
    assert.match(card.innerHTML, /value="60" min="15" step="15"/);
    assert.match(card.innerHTML, /aria-pressed="true"/);
    assert.ok(!/class="(?:card|btn|form-control)\b/.test(card.innerHTML));
    assert.equal(h.requests.length, 0, 'categories load only after card is attached');
});

test('topic selection retains only active IDs without issuing requests', () => {
    const h = harness();
    const tag = h.get('tag');
    tag.dataset = {card: '0', topicId: '1'};
    h.get('meetingCard-0').querySelectorAll = () =>
        tag.classList.contains('deselected') ? [] : [tag];
    h.run('window.testTag = document.getElementById("tag"); toggleTopic(window.testTag)');
    assert.equal(h.get('meetingCard-0').dataset.topicIds, '[]');
    assert.equal(tag['aria-pressed'], 'false');
    h.run('toggleTopic(window.testTag)');
    assert.equal(h.get('meetingCard-0').dataset.topicIds, '[1]');
    assert.equal(h.requests.length, 0);
});

test('pending operations freeze review, prevent competing writes and guard navigation', async () => {
    const h = taskHarness();
    h.run('setFillPending(true)');
    assert.equal(h.get('meetingCards').inert, true);
    assert.equal(h.get('fillDate').disabled, true);
    await h.run('createCardTask(0)');
    await h.run("saveNote(0,'2026-10-07','')");
    assert.equal(h.requests.length, 0);
    let blocked = false;
    h.root.fire('click', {target: {closest: () => ({})},
        preventDefault() { blocked = true; }});
    assert.equal(blocked, true);
    const event = {preventDefault() { blocked = true; }};
    h.events.beforeunload[0](event);
    assert.equal(event.returnValue, '');
    h.run('setFillPending(false)');
    assert.equal(h.get('meetingCards').inert, false);
});

test('complete fill pipeline renders matched and unmatched original results without saving', async () => {
    const h = harness();
    h.get('fillDate').value = '2026-10-07';
    h.replies.push({meetings: [
        {title: 'Acme Review', customer: 'Acme', start_time: '2026-10-07T14:00:00'},
        {title: 'Other Review', customer: 'Unmatched', start_time: null},
    ]}, [{id: 7, name: 'Acme Corporation'}],
    {success: true, summary_ok: false, content_html: '<p>Fallback</p>', topics: [],
        milestone: {msx_milestone_id: 'ms', name: 'Milestone', status: 'On Track'}},
    [{name: 'Workshop', is_hva: true}]);
    const pending = h.run('startFillMyDay()');
    h.get('fillGuardConfirm').fire('click');
    await pending;
    await new Promise(setImmediate);
    assert.deepEqual(h.requests.map(r => r.url), [
        '/api/meetings?date=2026-10-07', '/api/customers',
        '/api/fill-my-day/process', '/api/msx/task-categories',
    ]);
    assert.equal(h.run('totalCards'), 1);
    assert.equal(h.run('savedCount'), 0);
    assert.equal(h.get('meetingCards').options[0].dataset.customerId, 7);
    const unmatched = h.get('meetingCards').options[1].innerHTML;
    assert.match(unmatched, /<details id="unmatchedMeetings">/);
    assert.match(unmatched, /data-sb-sort-key="fill-unmatched"/);
    assert.match(unmatched, /data-sb-sort-type="number">Time/);
    assert.match(unmatched, /data-sb-sort-value=""/);
    assert.doesNotMatch(unmatched, /data-bs-toggle|class="collapse"/);
    assert.equal(h.get('taskCategory-0').options[0].value, 'Workshop');
    assert.equal(h.get('fillDate').disabled, false);
    assert.ok(!h.requests.some(r => r.url.includes('/save') || r.url === '/api/msx/tasks'));
});

test('Back restores unsaved HTML/task controls, error panels, associations and progress without requests', () => {
    const h = harness();
    h.get('fillDate').value = '2026-10-07';
    h.run("meetings=[{title:'Review'}];customerMap={0:{customer_id:7}};totalCards=1");
    h.get('meetingCards').innerHTML = '<div data-original-review>Review</div>';
    const fields = ['overviewTextarea-0', 'taskSubject-0', 'taskDueDate-0'].map(h.get);
    const values = ['<p>Unapplied HTML</p>', 'Unsaved task', '2026-10-09'];
    fields.forEach((field, index) => { field.value = values[index]; });
    h.root.querySelectorAll = () => fields;
    h.get('errorArea').style.display = 'block';
    h.get('errorText').textContent = 'Retry after offline';
    h.run('rememberFillReview()');
    fields.forEach(field => { field.value = ''; });
    h.get('meetingCards').innerHTML = '';
    h.get('errorArea').style.display = 'none';
    h.run('restoreFillReview()');
    assert.deepEqual(fields.map(field => field.value), values);
    assert.match(h.get('meetingCards').innerHTML, /data-original-review/);
    assert.equal(h.get('errorArea').style.display, 'block');
    assert.equal(h.get('errorText').textContent, 'Retry after offline');
    assert.equal(h.run('customerMap[0].customer_id'), 7);
    assert.equal(h.requests.length, 0);
});

test('malformed history and customer availability failures surface explicitly', async () => {
    const h = harness();
    h.window.history.state.sbFillDay = {top: -1};
    h.run('restoreFillReview()');
    assert.match(h.get('errorText').textContent, /Could not restore/);
    h.replies.push({ok: false});
    await assert.rejects(h.run("matchCustomers([{title:'Review',customer:'Acme'}])"),
        /Could not load customers/);
    assert.equal(h.run('Object.keys(customerMap).length'), 0);
});
