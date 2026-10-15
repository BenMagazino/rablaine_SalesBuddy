const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const {layoutEvents} = require('../../static/js/ui-customer-timeline.js');

const event = at => ({at, title: 'Customer history'});

test('same-day events stay individually selectable without artificial long gaps', () => {
    const result = layoutEvents([
        event('2026-10-15T13:00:00Z'), event('2026-10-15T12:00:00Z'),
    ]);
    assert.equal(result[0].year, true);
    assert.equal(result[0].showDate, true);
    assert.equal(result[1].year, false);
    assert.equal(result[1].showDate, false);
    assert.equal(result[0].gap, 0);
});

test('elapsed spacing grows with days and caps long gaps, preserving honest day labels', () => {
    const result = layoutEvents([
        event('2026-10-15T12:00:00Z'), event('2026-10-01T12:00:00Z'),
        event('2025-01-01T12:00:00Z'),
    ]);
    assert.equal(result[0].days, 14);
    assert.equal(result[0].gap, 42);
    assert.equal(result[1].gap, 112);
    assert.ok(result[1].days > 300);
    assert.equal(result[2].year, true);
    assert.equal(result[2].gap, 0);
});

test('invalid dates fail explicitly instead of producing a misleading timeline', () => {
    assert.throws(() => layoutEvents([event('bad date')]), /Invalid customer history date/);
    assert.deepEqual(layoutEvents([]), []);
});

test('breakpoint keeps the existing dossier width and adds only the measured rail and gutters', () => {
    const css = fs.readFileSync('static/css/ui-customer-timeline.css', 'utf8');
    const js = fs.readFileSync('static/js/ui-customer-timeline.js', 'utf8');
    assert.ok(css.includes('@media (min-width: 1712px)'));
    assert.ok(js.includes("matchMedia('(min-width: 1712px)')"));
    assert.ok(css.includes('max-width: 1664px'));
    assert.ok(css.includes('grid-template-columns: 360px minmax(0, 1fr) 320px'));
    assert.ok(js.includes('if (media.matches) load()'));
    assert.equal(1344 + 320 + 2 * 24, 1712);
});
