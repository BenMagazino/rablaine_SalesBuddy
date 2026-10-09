const assert = require('node:assert/strict');
const test = require('node:test');
const {matches, validateView} = require('../../static/js/ui-marketing.js');

test('customer filtering preserves the original case-insensitive display-name substring', () => {
    assert.equal(matches('Full Account (Alias)', 'ALIAS'), true);
    assert.equal(matches('Full Account', 'account'), true);
    assert.equal(matches('Full Account', ''), true);
    assert.equal(matches('Full Account', 'absent'), false);
    assert.equal(matches('Full Account', ' full '), false);
});

test('Back state retains selected customer, filter and independent reading positions', () => {
    const saved = {query: 'Alias', selected: '12', listScroll: 300, detailScroll: 500};
    assert.equal(validateView(saved), saved);
    assert.equal(validateView({...saved, selected: null}).selected, null);
    for (const value of [null, [], {...saved, selected: 12}, {...saved, selected: '0'},
        {...saved, query: null}, {...saved, listScroll: -1},
        {...saved, detailScroll: Infinity}, {...saved, listScroll: '300'}]) {
        assert.throws(() => validateView(value), /Invalid saved marketing view/);
    }
});
