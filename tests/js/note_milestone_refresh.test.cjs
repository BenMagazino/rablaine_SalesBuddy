const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const template = fs.readFileSync('templates/note_form.html', 'utf8');
const source = template.slice(
    template.indexOf('// Load milestones when customer is selected'),
    template.indexOf('// Inline TPID lookup'),
);

function harness(hasUI = true) {
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            style: {}, dataset: {}, attributes: {}, value: '', disabled: false,
            textContent: '', innerHTML: '', events: [],
            setAttribute(key, value) { this.attributes[key] = value; },
            querySelector(selector) { return element(`${id}/${selector}`); },
            dispatchEvent(event) { this.events.push(event.type); },
        });
        return elements.get(id);
    }
    const requests = [];
    const timers = new Map();
    const errors = [];
    let now = 0;
    let timerId = 0;
    const context = {
        document: {getElementById: element},
        _hasMilestoneUI: hasUI,
        allMilestones: [],
        selectedMilestones: [{id: 'selected'}],
        currentMilestoneMatches: [],
        selectedMilestoneIndex: -1,
        customerData: {'1': {tpid: 12345}},
        milestoneSearch: element('milestone_search'),
        milestoneDropdown: element('milestone_dropdown'),
        milestoneLoading: element('milestone_loading'),
        milestoneHelpText: element('milestone_help_text'),
        window: {SBJobs: {message: job => job.progress.message}},
        selectMilestone: milestone => context.selectedMilestones.push(milestone),
        console: {error: (...args) => errors.push(args)},
        Event: class { constructor(type) { this.type = type; } },
        setTimeout(callback, delay) {
            timers.set(++timerId, {at: now + delay, callback});
            return timerId;
        },
        clearTimeout(id) { timers.delete(id); },
        fetch(url, options) {
            return new Promise((resolve, reject) => requests.push({
                url, options, reject,
                reply(data, ok = true) { resolve({ok, json: async () => data}); },
                badJSON() {
                    resolve({ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); }});
                },
            }));
        },
    };
    vm.createContext(context);
    vm.runInContext(source + '\nthis.load = loadMilestonesForCustomer;', context);
    return {
        context, element, requests, errors, timers,
        load: context.load,
        state: () => element('refreshMilestonesBtn').dataset.state,
        tick(ms) {
            now += ms;
            for (const [id, timer] of timers) {
                if (timer.at <= now) { timers.delete(id); timer.callback(); }
            }
        },
    };
}

test('refresh waits for actual choices, holds success for 1000ms, and preserves work', async () => {
    const h = harness();
    const initial = h.load('1');
    assert.equal(h.requests[0].options.method, 'POST');
    h.requests[0].reply({success: true, milestones: [{id: 'old'}]});
    await initial;
    assert.equal(h.state(), 'idle');
    assert.equal(h.timers.size, 0);
    const selected = h.context.selectedMilestones;
    const note = h.element('content');
    const task = h.element('task_description');
    note.value = '<p>Unsaved call notes</p>';
    task.value = 'Unsaved task';
    h.context.milestoneSearch.value = 'new';
    const refresh = h.load('1', true);
    assert.equal(h.state(), 'working');
    assert.equal(h.element('refreshMilestonesBtn').disabled, true);
    assert.equal(h.element('refreshMilestonesBtn').attributes['aria-busy'], 'true');
    h.requests[1].options.onJobProgress({progress: {message: 'Waiting for another sync.'}});
    assert.equal(h.context.milestoneHelpText.textContent, 'Waiting for another sync.');
    await h.load('1', true);
    assert.equal(h.requests.length, 2);
    h.tick(5000);
    assert.equal(h.state(), 'working');
    h.requests[1].reply({success: true, milestones: [{id: 'old'}, {id: 'new'}]});
    await refresh;
    assert.equal(h.context.allMilestones[1].id, 'new');
    assert.equal(h.context.milestoneSearch.value, 'new');
    assert.deepEqual(h.context.milestoneSearch.events, ['input']);
    assert.equal(h.context.selectedMilestones, selected);
    assert.equal(note.value, '<p>Unsaved call notes</p>');
    assert.equal(task.value, 'Unsaved task');
    assert.equal(h.state(), 'success');
    assert.equal(h.element('refreshMilestonesBtn').attributes['aria-busy'], 'false');
    h.tick(999);
    assert.equal(h.state(), 'success');
    h.tick(1);
    assert.equal(h.state(), 'idle');
    assert.equal(h.element('refreshMilestonesBtn').disabled, false);
});

for (const failure of ['remote', 'network', 'malformed', 'http', 'json']) {
    test(`${failure} failure stays retryable without reporting success or losing choices`, async () => {
        const h = harness();
        const initial = h.load('1');
        h.requests[0].reply({success: true, milestones: [{id: 'old'}]});
        await initial;
        const refresh = h.load('1', true);
        const request = h.requests[1];
        if (failure === 'network') request.reject(new Error('Offline'));
        else if (failure === 'json') request.badJSON();
        else request.reply(failure === 'remote' ? {success: false, error: '<MSX offline>'} :
            {success: true, milestones: failure === 'malformed' ? null : []}, failure !== 'http');
        await refresh;
        assert.equal(h.state(), 'error');
        assert.equal(h.context.allMilestones[0].id, 'old');
        assert.equal(h.context.milestoneSearch.disabled, false);
        assert.equal(h.element('refreshMilestonesBtn').disabled, false);
        assert.match(h.context.milestoneHelpText.textContent, /Retry refresh/);
        if (failure === 'remote') {
            assert.match(h.context.milestoneHelpText.textContent, /<MSX offline>/);
            assert.equal(h.context.milestoneHelpText.innerHTML, '');
        }
        assert.equal(h.timers.size, 0);
        assert.equal(h.errors.length, 1);
        const retry = h.load('1', true);
        h.requests[2].reply({success: true, milestones: []});
        await retry;
        assert.equal(h.state(), 'success');
        assert.equal(h.element('aiMatchMilestoneBtn').style.display, 'none');
    });
}

test('old customer results, errors, progress and timers cannot replace current choices', async () => {
    const h = harness();
    const first = h.load('1', true);
    const second = h.load('2');
    h.requests[0].options.onJobProgress({progress: {message: 'Stale progress'}});
    assert.notEqual(h.context.milestoneHelpText.textContent, 'Stale progress');
    h.requests[1].reply({success: true, milestones: [{id: 'second'}]});
    await second;
    h.requests[0].reply({success: true, milestones: [{id: 'first'}]});
    await first;
    assert.equal(h.context.allMilestones[0].id, 'second');
    assert.equal(h.state(), 'idle');
    const refresh = h.load('2', true);
    h.requests[2].reply({success: true, milestones: []});
    await refresh;
    assert.equal(h.timers.size, 1);
    const third = h.load('3', true);
    assert.equal(h.timers.size, 0);
    h.tick(1000);
    assert.equal(h.state(), 'working');
    const fourth = h.load('4', true);
    h.requests[3].reject(new Error('Stale error'));
    await third;
    assert.equal(h.state(), 'working');
    h.requests[4].reply({success: true, milestones: []});
    await fourth;
    assert.equal(h.state(), 'success');
});

test('no customer invalidates pending work and missing link keeps the inline setup flow', async () => {
    const h = harness();
    const pending = h.load('1');
    await h.load('');
    h.requests[0].reply({success: true, milestones: [{id: 'stale'}]});
    await pending;
    assert.equal(h.context.allMilestones.length, 0);
    assert.equal(h.element('refreshMilestonesBtn').disabled, true);
    assert.equal(h.context.milestoneLoading.style.display, 'none');
    const missing = h.load('1');
    h.requests[1].reply({success: false, needs_tpid: true});
    await missing;
    assert.equal(h.element('inline_tpid_link').style.display, 'block');
    assert.equal(h.element('refreshMilestonesBtn').disabled, true);
    assert.equal(h.context.milestoneSearch.disabled, true);
});

test('general notes do not fetch choices, and query-param preselection runs only once', async () => {
    const absent = harness(false);
    await absent.load('1');
    assert.equal(absent.requests.length, 0);
    const h = harness();
    h.context.window._preselectMilestoneId = 42;
    const load = h.load('1');
    h.requests[0].reply({success: true, milestones: [{id: 'linked', local_milestone_id: 42}]});
    await load;
    assert.equal(h.context.selectedMilestones.length, 2);
    const refresh = h.load('1', true);
    h.requests[1].reply({success: true, milestones: [{id: 'linked', local_milestone_id: 42}]});
    await refresh;
    assert.equal(h.context.selectedMilestones.length, 2);
});
