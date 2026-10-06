const test = require('node:test');
const assert = require('node:assert/strict');
const coverage = require('../../static/js/ui-activity-coverage.js');

test('defaults preserve the existing meeting audit entry view', () => {
    assert.deepEqual(coverage.validatePreferences({}),
        {lens: 'meetings', meetingView: 'weekly', filter: 'all'});
});

test('all existing lens, meeting view and filter choices remain valid', () => {
    for (const lens of ['meetings', 'milestones']) {
        for (const meetingView of ['weekly', 'full']) {
            for (const filter of ['all', 'open', 'prepared', 'failed', 'logged']) {
                const value = {lens, meetingView, filter};
                assert.deepEqual(coverage.validatePreferences(value), value);
            }
        }
    }
});

test('corrupt preferences cannot introduce a redirect loop', () => {
    for (const value of [null, [], 'meetings', {lens: 'bad'}, {meetingView: 'all'},
        {filter: 'ready'}]) {
        assert.throws(() => coverage.validatePreferences(value), /Invalid coverage/);
    }
});

test('preferred milestone navigation retains scope and embedded ownership', () => {
    const url = coverage.preferredUrl(
        'http://localhost/reports/activity-coverage?scope=fy27-data&embed=1',
        {lens: 'milestones'}
    );
    assert.equal(url.searchParams.get('scope'), 'fy27-data');
    assert.equal(url.searchParams.get('embed'), '1');
    assert.equal(url.searchParams.get('lens'), 'milestones');
});

test('preferred full-year navigation removes incompatible lens filters only', () => {
    const url = coverage.preferredUrl(
        'http://localhost/reports/activity-coverage?lens=milestones&coverage=caip' +
        '&covered=1&inactive=1&week=2026-10-05&milestone=1&scope=fy27-data&embed=1#anchor',
        {meetingView: 'full'}
    );
    assert.equal(url.searchParams.get('view'), 'all');
    assert.equal(url.searchParams.get('scope'), 'fy27-data');
    assert.equal(url.searchParams.get('embed'), '1');
    assert.equal(url.hash, '#anchor');
    for (const key of ['lens', 'coverage', 'covered', 'inactive', 'week', 'milestone']) {
        assert.equal(url.searchParams.has(key), false);
    }
});

test('weekly preferences do not silently select a full-year view', () => {
    assert.equal(coverage.preferredUrl(
        'http://localhost/reports/activity-coverage?view=all', {}
    ).searchParams.has('view'), false);
});

test('reading state retains row identities and de-duplicates expansions', () => {
    assert.deepEqual(coverage.validateReadingState(
        {scroll: 412.5, expanded: ['meeting:7', 'milestone:12', 'meeting:7']}
    ), {scroll: 412.5, expanded: ['meeting:7', 'milestone:12']});
});

test('invalid reading offsets and identities are explicitly rejected', () => {
    for (const value of [null, {}, {scroll: -1, expanded: []},
        {scroll: Infinity, expanded: []}, {scroll: '12', expanded: []},
        {scroll: 0, expanded: ['meeting:0']}, {scroll: 0, expanded: ['meeting:1"']},
        {scroll: 0, expanded: [4]}, {scroll: 0, expanded: 'meeting:1'}]) {
        assert.throws(() => coverage.validateReadingState(value), /Invalid coverage reading/);
    }
});

function pickerStyle(field, bounds) {
    const original = global.document;
    global.document = {
        getElementById: () => ({getBoundingClientRect: () => bounds})
    };
    const results = {
        style: {},
        getBoundingClientRect() {
            return {height: Math.min(256, parseFloat(this.style.maxHeight))};
        }
    };
    try {
        coverage.positionPicker(results, {getBoundingClientRect: () => field});
        return results.style;
    } finally {
        if (original === undefined) delete global.document;
        else global.document = original;
    }
}

test('picker uses the field width and fits below when there is reading room', () => {
    assert.deepEqual(pickerStyle(
        {top: 300, bottom: 330, left: 100, width: 240}, {top: 200, bottom: 1100}
    ), {width: '240px', maxHeight: '256px', left: '100px', top: '334px'});
});

test('picker flips above near the footer instead of being clipped', () => {
    assert.deepEqual(pickerStyle(
        {top: 1050, bottom: 1080, left: 100, width: 240}, {top: 200, bottom: 1100}
    ), {width: '240px', maxHeight: '256px', left: '100px', top: '790px'});
});

test('picker height is constrained to the available reading area', () => {
    assert.deepEqual(pickerStyle(
        {top: 300, bottom: 330, left: 100, width: 240}, {top: 200, bottom: 400}
    ), {width: '240px', maxHeight: '92px', left: '100px', top: '204px'});
});
