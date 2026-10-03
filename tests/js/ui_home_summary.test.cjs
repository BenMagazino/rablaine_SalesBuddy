const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-home-summary.js'), 'utf8');
const notesSelector = '.calendar-entries > [data-general-note], ' +
    '.calendar-entries > [data-customer-id]:not([data-ghost-id])';

function fixture(options = {}) {
    const summary = {textContent: '', title: ''};
    const today = {textContent: '', dateTime: ''};
    let selected = options.selected === null ? null : {id: options.selected || 'calendar-tab'};
    let localDay = 3;
    const events = {};
    const documentEvents = {};
    const timers = new Map();
    let nextTimer = 0;
    const bodies = new Map();
    for (const [selector, items, counts] of [
        ['#calendarBody', notesSelector, 3],
        ['#engagementsListBody', '[data-engagement-id]', 4],
        ['#projectsList', 'a[href^="/project/"]', 2],
        ['#tasksCalendarBody', '[data-action-item-id]', 1],
    ]) {
        const body = {childElementCount: 1, state: 'ready',
            counts: new Map([[items, counts], ['.cal-ghost[data-ghost-id]', 2]]),
            querySelector: selector => {
                if (body.state === 'loading' && selector.includes('.spinner-border')) return {};
                if (body.state === 'error' && selector.includes('.text-danger')) return {};
                if (body.daySpinner && !selector.includes(':scope')) return {};
                return null;
            },
            querySelectorAll: selector => Array(body.counts.get(selector) || 0)};
        bodies.set(selector, body);
    }
    const tabs = {querySelector: () => selected};
    const content = {querySelector: selector => bodies.get(selector)};
    const elements = {homeViewSummary: summary, homeCurrentDate: today,
        noteViewTabs: tabs, noteViewTabContent: content};
    const document = {hidden: false, getElementById: id =>
        options.missing === id ? null : elements[id],
    addEventListener: (type, handler) => { documentEvents[type] = handler; }};
    const window = {addEventListener: (type, handler) => { events[type] = handler; }};
    let observer;
    class LocalDate extends Date {
        constructor() { super('2026-10-04T00:30:00Z'); }
        getFullYear() { return 2026; }
        getMonth() { return 9; }
        getDate() { return localDay; }
        toLocaleDateString(locale, format) {
            return new Date(2026, 9, localDay).toLocaleDateString(locale, format);
        }
    }
    vm.runInNewContext(source, {document, window, Date: LocalDate,
        MutationObserver: class {
            constructor(handler) { observer = this; this.update = handler; this.targets = []; }
            observe(target, config) { this.targets.push({target, config}); this.active = true; }
            disconnect() { this.active = false; }
        },
        setInterval: (handler, delay) => {
            assert.equal(delay, 60000);
            timers.set(++nextTimer, handler);
            return nextTimer;
        },
        clearInterval: id => timers.delete(id),
    });
    return {summary, today, bodies, tabs, content, events, documentEvents, document,
        timers, observer, setDay: day => { localDay = day; },
        select: id => { selected = {id}; observer.update(); }};
}

test('calendar summary distinguishes saved notes from ghost meetings', () => {
    const {summary, today} = fixture();
    assert.equal(summary.textContent, '3 notes / 2 meetings');
    assert.equal(summary.title, 'Saved notes and cached meetings in the displayed month');
    assert.equal(today.dateTime, '2026-10-03');
    assert.equal(today.textContent, 'Sat, Oct 3');
});

test('calendar month renders and surgical ghost changes update the summary', () => {
    const {summary, bodies, observer} = fixture();
    const body = bodies.get('#calendarBody');
    body.counts.set(notesSelector, 1);
    body.counts.set('.cal-ghost[data-ghost-id]', 1);
    observer.update();
    assert.equal(summary.textContent, '1 note / 1 meeting');
    body.counts.set('.cal-ghost[data-ghost-id]', 0);
    observer.update();
    assert.equal(summary.textContent, '1 note / 0 meetings');
});

test('empty months and filtered lists show honest zero counts', () => {
    const {summary, bodies, observer, select} = fixture();
    for (const body of bodies.values()) {
        for (const key of body.counts.keys()) body.counts.set(key, 0);
    }
    observer.update();
    assert.equal(summary.textContent, '0 notes / 0 meetings');
    select('engagements-tab');
    assert.equal(summary.textContent, '0 engagements');
    select('projects-tab');
    assert.equal(summary.textContent, '0 projects');
    select('tasks-tab');
    assert.equal(summary.textContent, '0 action items');
});

test('conditional views and engagement filters count rendered items rather than tab totals', () => {
    const {summary, select, bodies, observer} = fixture();
    select('engagements-tab');
    assert.equal(summary.textContent, '4 engagements');
    bodies.get('#engagementsListBody').counts.set('[data-engagement-id]', 1);
    observer.update();
    assert.equal(summary.textContent, '1 engagement');
    select('projects-tab');
    assert.equal(summary.textContent, '2 projects');
    select('tasks-tab');
    assert.equal(summary.textContent, '1 action item');
    assert.match(summary.title, /displayed month; excludes the overdue summary/);
});

test('each loader distinguishes loading and failed reads from empty success', () => {
    const {summary, bodies, select, observer} = fixture();
    for (const [tab, selector, label] of [
        ['calendar-tab', '#calendarBody', 'Calendar'],
        ['engagements-tab', '#engagementsListBody', 'Engagements'],
        ['projects-tab', '#projectsList', 'Projects'],
        ['tasks-tab', '#tasksCalendarBody', 'Action items'],
    ]) {
        const body = bodies.get(selector);
        body.state = 'loading';
        select(tab);
        assert.equal(summary.textContent, label + ': loading...');
        body.state = 'error';
        observer.update();
        assert.equal(summary.textContent, label + ': unavailable');
        body.state = 'ready';
        observer.update();
        assert.doesNotMatch(summary.textContent, /unavailable|loading/);
    }
});

test('an unpopulated lazy body is loading, not a completed zero count', () => {
    const {bodies, select, summary} = fixture();
    bodies.get('#projectsList').childElementCount = 0;
    select('projects-tab');
    assert.equal(summary.textContent, 'Projects: loading...');
});

test('a day-refresh spinner does not hide the already rendered calendar counts', () => {
    const {summary, bodies, observer} = fixture();
    bodies.get('#calendarBody').daySpinner = true;
    observer.update();
    assert.equal(summary.textContent, '3 notes / 2 meetings');
});

test('observer scopes exclude the summary itself and include tab selection and list replacement', () => {
    const {observer, tabs, content} = fixture();
    assert.equal(observer.targets[0].target, tabs);
    assert.equal(observer.targets[0].config.attributeFilter.join(), 'aria-selected');
    assert.equal(observer.targets[1].target, content);
    assert.equal(observer.targets[1].config.childList, true);
    assert.equal(observer.targets[1].config.characterData, true);
    assert.equal(observer.targets[1].config.subtree, true);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test('date uses local calendar fields, updates after midnight and on visibility return', () => {
    const {setDay, timers, today, document, documentEvents} = fixture();
    setDay(4);
    for (const tick of timers.values()) tick();
    assert.equal(today.dateTime, '2026-10-04');
    assert.equal(today.textContent, 'Sun, Oct 4');
    setDay(5);
    document.hidden = true;
    documentEvents.visibilitychange();
    assert.equal(today.dateTime, '2026-10-04');
    document.hidden = false;
    documentEvents.visibilitychange();
    assert.equal(today.dateTime, '2026-10-05');
});

test('page exit disposes observers and timers; back-cache return reconnects without duplicate clocks', () => {
    const {events, timers, observer, today, setDay} = fixture();
    assert.equal(timers.size, 1);
    events.pagehide();
    assert.equal(timers.size, 0);
    assert.equal(observer.active, false);
    setDay(6);
    events.pageshow();
    events.pageshow();
    assert.equal(timers.size, 1);
    assert.equal(observer.active, true);
    assert.equal(today.dateTime, '2026-10-06');
});

test('missing markup, selected tab, unknown source and missing list fail explicitly', () => {
    assert.throws(() => fixture({missing: 'homeCurrentDate'}), /incomplete markup/);
    assert.throws(() => fixture({selected: null}), /no selected activity tab/);
    assert.throws(() => fixture({selected: 'missing-tab'}), /Unknown Home summary source/);
    const {bodies, select} = fixture();
    bodies.delete('#projectsList');
    assert.throws(() => select('projects-tab'), /Missing Home summary body/);
});
