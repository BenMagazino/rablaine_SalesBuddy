const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('AI inspections retain individual Back state without changing other history owners', () => {
    const logs = ['10', '11'].map((id, index) => ({
        dataset: {sbLogId: id}, open: index === 0,
        addEventListener(name, handler) { this[name] = handler; },
    }));
    const history = {
        state: {sbAiLogInspections: {'10': false, '11': true}, unrelated: 'retained'},
        replaceState(value) { this.state = value; },
    };
    const source = fs.readFileSync(
        path.join(__dirname, '../../static/js/ui-admin-logs.js'), 'utf8');
    vm.runInNewContext(source, {
        document: {querySelectorAll: () => logs}, history,
    });
    assert.equal(logs[0].open, false);
    assert.equal(logs[1].open, true);
    logs[1].open = false;
    logs[1].toggle();
    assert.equal(history.state.sbAiLogInspections['11'], false);
    assert.equal(history.state.unrelated, 'retained');
});
