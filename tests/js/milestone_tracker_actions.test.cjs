const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-milestone-tracker-actions.js'), 'utf8'
);

function action(onTeam, result, confirmed = true) {
    const calls = [], alerts = [];
    const row = {setAttribute(name, value) { this[name] = value; }};
    const cell = {closest: () => row, innerHTML: '',
        setAttribute(name, value) { this[name] = value; }};
    const btn = {dataset: {onTeam}, innerHTML: 'original icons', disabled: false,
        closest: () => cell};
    const context = {
        window: {}, confirm: () => confirmed, alert: text => alerts.push(text),
        fetch: async (url, options) => {
            calls.push({url, ...options});
            if (result instanceof Error) throw result;
            return {json: async () => result};
        },
    };
    vm.runInNewContext(source, context);
    return {context, calls, alerts, row, cell, btn};
}

for (const [onTeam, endpoint, expected] of [
    ['0', 'join', 'true'], ['1', 'leave', 'false'],
]) {
    test(`${endpoint} keeps exact MSX payload and updates membership plus native replacement`, async () => {
        const t = action(onTeam, {success: true});
        await t.context.toggleTrackerTeam(t.btn, 42);
        assert.equal(t.calls[0].url, `/api/msx/${endpoint}-milestone-team`);
        assert.equal(t.calls[0].method, 'POST');
        assert.equal(t.calls[0].headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(t.calls[0].body), {milestone_id: 42});
        assert.equal(t.row['data-on-my-team'], expected);
        assert.equal(t.cell['data-sb-sort-value'], expected === 'true' ? '1' : '0');
        assert.match(t.cell.innerHTML, /class="mt-command team-toggle/);
        assert.match(t.cell.innerHTML, /onclick="toggleTrackerTeam\(this, 42\)"/);
        assert.equal(t.alerts.length, 0);
    });
}

test('Cancel never sends a membership request or disables the opener', async () => {
    const t = action('1', {success: true}, false);
    await t.context.toggleTrackerTeam(t.btn, 42);
    assert.equal(t.calls.length, 0);
    assert.equal(t.btn.disabled, false);
});

for (const result of [{success: false, error: 'Denied'}, new Error('Offline')]) {
    test(`failed membership action remains retryable: ${result.error || result.message}`, async () => {
        const t = action('0', result);
        await t.context.toggleTrackerTeam(t.btn, 42);
        assert.equal(t.btn.disabled, false);
        assert.equal(t.btn.innerHTML, 'original icons');
        assert.equal(t.row['data-on-my-team'], undefined);
        assert.equal(t.alerts.length, 1);
        await t.context.toggleTrackerTeam(t.btn, 42);
        assert.equal(t.calls.length, 2);
    });
}

test('VPN block prevents the original membership write', async () => {
    const t = action('0', {success: true});
    let shown = false;
    t.context.window.isVpnBlocked = () => true;
    t.context.window.showVpnBanner = () => { shown = true; };
    await t.context.toggleTrackerTeam(t.btn, 42);
    assert.equal(shown, true);
    assert.equal(t.calls.length, 0);
});

test('calendar entry and scroll history preserve applied filters and independent sorter state', () => {
    const template = fs.readFileSync(
        path.join(__dirname, '../../templates/milestone_tracker.html'), 'utf8'
    );
    const source = template.slice(template.indexOf('function saveReading()'),
        template.indexOf("reading.addEventListener('scroll'"));
    let entry = {sbTableSort: {'milestone-tracker-all': {column: 6, direction: 'descending'}},
        milestoneTracker: {filters: {search: 'pilot'}}};
    const context = {year: 2027, month: 1, calendarIsActive: true,
        reading: {scrollTop: 487, scrollLeft: 18},
        window: {history: {get state() { return entry; }, replaceState(next) { entry = next; }}},
    };
    vm.runInNewContext(source + '\nsaveReading();', context);
    assert.equal(entry.milestoneTracker.filters.search, 'pilot');
    assert.equal(entry.milestoneTracker.view, 'calendar');
    assert.equal(entry.milestoneTracker.month, 1);
    assert.equal(entry.milestoneTracker.scrollTop, 487);
    assert.equal(entry.milestoneTracker.scrollLeft, 18);
    assert.equal(entry.sbTableSort['milestone-tracker-all'].direction, 'descending');
});
