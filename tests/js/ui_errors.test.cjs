const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-errors.js'), 'utf8');

function harness({ retryAvailable = true, historyLength = 1 } = {}) {
  let reloads = 0;
  let backs = 0;
  const root = { dataset: {} };
  const controls = {
    'error-back': { hidden: true },
    'error-retry': retryAvailable ? { disabled: false } : null,
  };
  for (const control of Object.values(controls)) {
    if (control) control.addEventListener = (_event, handler) => { control.click = handler; };
  }
  vm.runInNewContext(source, {
    document: { documentElement: root, getElementById: (id) => controls[id] },
    matchMedia: () => ({ matches: true }),
    history: { length: historyLength, back: () => { backs++; } },
    location: { reload: () => { reloads++; } },
  });
  return { root, controls, reloads: () => reloads, backs: () => backs };
}

test('safe retry disables immediately and ignores duplicate clicks', () => {
  const h = harness();
  h.controls['error-retry'].click();
  h.controls['error-retry'].click();
  assert.equal(h.reloads(), 1);
  assert.equal(h.controls['error-retry'].disabled, true);
  assert.equal(h.controls['error-retry'].textContent, 'Trying again...');
});

test('unavailable retry and unavailable history remain absent or hidden', () => {
  const h = harness({ retryAvailable: false });
  assert.equal(h.controls['error-back'].hidden, true);
  assert.equal(h.reloads(), 0);
  assert.equal(h.root.dataset.sbMode, 'dark');
});

test('Back uses actual browser history rather than a guessed parent URL', () => {
  const h = harness({ historyLength: 2 });
  assert.equal(h.controls['error-back'].hidden, false);
  h.controls['error-back'].click();
  assert.equal(h.backs(), 1);
});
