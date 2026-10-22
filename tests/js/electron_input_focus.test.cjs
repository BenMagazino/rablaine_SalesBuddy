const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {
  CHANNEL, SNAPSHOT_CHANNEL, MAX_LOG_BYTES, LOG_FILES, TARGET_IDS, cleanBatch,
  createRotatingLog, createNativeProbe, createInputFocusDiagnostics,
} = require('../../electron/input-focus');

function target(id = 'task_subject') {
  return {tag: 'INPUT', type: 'text', area: 'milestone-task', id, name: id,
    editable: false, disabled: false, readOnly: false};
}

function batch() {
  return {focused: true, visibility: 'visible', active: target(), dropped: 0, maxDelayMs: 0,
    events: [{type: 'keydown', at: 1000, count: 1, target: target()}]};
}

function fixture() {
  let clock = 1000;
  let heartbeat;
  let cancelled = false;
  const app = new EventEmitter();
  const records = [], logs = [], captures = [], messages = [], saved = [];
  const win = Object.assign(new EventEmitter(), {
    id: 1, isDestroyed: () => false, isVisible: () => true, isFocused: () => true,
    isEnabled: () => true, isMinimized: () => false,
  });
  win.webContents = Object.assign(new EventEmitter(), {
    mainFrame: {url: 'http://127.0.0.1:5000/note/new?customer_id=123'},
    ipc: new EventEmitter(), isDestroyed: () => false, isFocused: () => true,
    send: (...args) => messages.push(args),
  });
  const diagnostics = createInputFocusDiagnostics({
    app, port: 5000, logDir: 'unused', log: message => logs.push(message),
    writer: {write: record => { records.push(record); return true; },
      save: file => saved.push(file)},
    nativeFactory: () => ({
      capture: (window, event) => captures.push({id: window.id, event}),
      stop: () => captures.push('stopped'),
    }),
    schedule: callback => { heartbeat = callback; return 1; },
    cancel: () => { cancelled = true; }, now: () => clock,
  });
  diagnostics.attach(win);
  return {
    app, win, diagnostics, records, logs, captures, messages, saved,
    tick: () => heartbeat(), advance: () => { clock += 1000; },
    cancelled: () => cancelled,
    send: (payload = batch(), senderFrame = win.webContents.mainFrame) =>
      win.webContents.ipc.emit(CHANNEL, {senderFrame}, payload),
  };
}

test('renderer IPC reconstructs only safe metadata and rejects arbitrary strings', () => {
  const value = batch();
  value.active.id = value.active.name = 'private-customer-name';
  value.events[0].key = value.events[0].data = 'private-typed-text';
  value.events[0].target.value = 'private-note-content';
  value.url = 'https://private.example/customer';
  const result = cleanBatch(value);
  assert.equal(result.active.id, '');
  assert.equal(result.active.name, '');
  assert.doesNotMatch(JSON.stringify(result), /private/);
  for (const invalid of [
    null, {}, {...batch(), events: Array(65).fill(batch().events[0])},
    {...batch(), maxDelayMs: NaN}, {...batch(), visibility: 'private'},
    {...batch(), active: {...target(), type: 'private'}},
    {...batch(), events: [{...batch().events[0], type: 'private'}]},
    {...batch(), events: [{...batch().events[0], at: Infinity}]},
  ]) assert.equal(cleanBatch(invalid), null);
});

test('only the trusted local main frame can send diagnostic batches', () => {
  const h = fixture();
  for (const url of [
    'https://evil.example/', 'http://localhost:5151/', 'http://user@localhost:5000/',
    'http://localhost.evil:5000/', 'file:///C:/private',
  ]) {
    h.win.webContents.mainFrame.url = url;
    h.send();
    h.advance();
  }
  h.win.webContents.mainFrame.url = 'http://localhost:5000/';
  h.send(batch(), {url: 'http://localhost:5000/'});
  h.advance();
  assert.equal(h.records.filter(r => r.source === 'renderer').length, 0);
  h.send();
  assert.equal(h.records.filter(r => r.source === 'renderer').length, 1);
  assert.equal(h.logs.length, 6);
});

test('rate limiting bounds IPC records and reports rejection without payload contents', () => {
  const h = fixture();
  for (let index = 0; index < 100; index++) h.send();
  assert.equal(h.records.filter(r => r.source === 'renderer').length, 4);
  assert.deepEqual(h.logs, ['Input focus diagnostic IPC rate limit reached.']);
  h.advance();
  h.send();
  assert.equal(h.records.filter(r => r.source === 'renderer').length, 5);
});

test('window and app lifecycle, native routing counts and renderer age are correlated', () => {
  const h = fixture();
  for (const event of ['focus', 'blur', 'show', 'hide', 'minimize', 'restore',
    'unresponsive', 'responsive']) h.win.emit(event);
  h.app.emit('browser-window-focus', {}, h.win);
  h.app.emit('browser-window-blur', {}, h.win);
  h.app.emit('activate', {}, 'private-arguments');
  h.app.emit('second-instance', {}, ['private-command-line']);
  h.app.emit('child-process-gone', {}, {
    type: 'GPU', reason: 'crashed', exitCode: 9, name: 'private-process-name',
  });
  h.win.webContents.emit('render-process-gone', {}, {reason: 'oom', exitCode: 1});
  h.win.webContents.emit('before-input-event', {}, {key: 'private'});
  h.win.webContents.emit('before-mouse-event', {}, {type: 'mouseMove'});
  h.win.webContents.emit('before-mouse-event', {}, {type: 'mouseDown'});
  h.send();
  h.advance();
  h.tick();
  const heartbeat = h.records.find(r => r.event === 'heartbeat');
  assert.equal(heartbeat.keyboardEvents, 1);
  assert.equal(heartbeat.pointerEvents, 1);
  assert.equal(heartbeat.rendererAgeMs, 1000);
  assert.deepEqual(h.captures, [{id: 1, event: 'focus'}, {id: 1, event: 'blur'}]);
  assert.doesNotMatch(JSON.stringify(h.records), /private/);
  h.tick();
  assert.equal(h.records.at(-1).keyboardEvents, 0);
});

test('incident capture snapshots every window and never changes focus', () => {
  const h = fixture();
  h.win.focus = () => assert.fail('Diagnostics must not change focus.');
  h.diagnostics.markIncident();
  assert.deepEqual(h.messages, [[SNAPSHOT_CHANNEL]]);
  assert.deepEqual(h.captures, [{id: 1, event: 'incident'}]);
  assert.ok(h.records.some(r => r.event === 'incident-marker'));
  h.diagnostics.save('chosen.jsonl');
  assert.deepEqual(h.saved, ['chosen.jsonl']);
});

test('closed windows and shutdown release listeners and timers', () => {
  const h = fixture();
  h.win.emit('closed');
  const count = h.records.length;
  h.win.emit('focus');
  h.send();
  h.tick();
  assert.equal(h.records.length, count);
  assert.equal(h.win.webContents.ipc.listenerCount(CHANNEL), 0);
  h.diagnostics.shutdown();
  h.diagnostics.shutdown();
  assert.equal(h.app.listenerCount('browser-window-focus'), 0);
  assert.equal(h.cancelled(), true);
  assert.equal(h.captures.at(-1), 'stopped');
  assert.equal(h.records.filter(r => r.event === 'session-end').length, 1);
});

test('rotating logs stay bounded and export retained records in chronological order', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-input-focus-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const logger = createRotatingLog(directory, assert.fail, fs, 240);
  for (let index = 0; index < 100; index++) {
    assert.equal(logger.write({source: 'main', event: 'test', index}), true);
  }
  const files = fs.readdirSync(directory);
  assert.equal(files.length, LOG_FILES);
  for (const file of files) assert.ok(fs.statSync(path.join(directory, file)).size <= 240);
  const destination = path.join(directory, 'export.jsonl');
  logger.save(destination);
  const rows = fs.readFileSync(destination, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows.at(-1).index, 99);
  assert.deepEqual(rows.map(row => row.index), rows.map(row => row.index).sort((a, b) => a - b));
  assert.ok(rows.every(row => /^\d{4}-.*Z$/.test(row.at)));
  assert.throws(() => logger.save(logger.files[0]), /outside the rotating/);
});

test('log failures are explicit, bounded and recoverable', () => {
  const logs = [];
  let fail = true;
  const io = {
    mkdirSync() {}, existsSync: () => false,
    appendFileSync() { if (fail) throw new Error('disk unavailable'); },
  };
  const logger = createRotatingLog('unused', message => logs.push(message), io);
  assert.equal(logger.write({event: 'test'}), false);
  assert.equal(logger.write({event: 'test'}), false);
  assert.equal(logs.length, 1);
  fail = false;
  assert.equal(logger.write({event: 'test'}), true);
  assert.match(logs[1], /recovered/);
});

test('production rotation enforces the actual 2 MiB per-file and 6 MiB total limits', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-input-focus-limit-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const logger = createRotatingLog(directory, assert.fail);
  assert.equal(MAX_LOG_BYTES, 2 * 1024 * 1024);
  assert.equal(LOG_FILES, 3);
  const payload = 'x'.repeat(32000);
  for (let index = 0; index < 300; index++) {
    assert.equal(logger.write({event: 'test', index, payload}), true);
  }
  const sizes = logger.files.map(file => fs.statSync(file).size);
  assert.ok(sizes.every(size => size <= 2 * 1024 * 1024));
  assert.ok(sizes.reduce((total, size) => total + size, 0) <= 6 * 1024 * 1024);
});

function nativeFixture() {
  const records = [], logs = [], requests = [], timers = new Map();
  let kills = 0;
  const child = Object.assign(new EventEmitter(), {
    stdin: Object.assign(new EventEmitter(), {
      write: line => requests.push(JSON.parse(line)),
    }), stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => { kills++; },
  });
  const probe = createNativeProbe(value => records.push(value), value => logs.push(value), {
    platform: 'win32',
    launch: (executable, args, options) => {
      assert.equal(executable, 'powershell.exe');
      assert.ok(args.at(-1).endsWith('input-focus.ps1'));
      assert.equal(options.windowsHide, true);
      return child;
    },
    schedule: callback => { const token = {}; timers.set(token, callback); return token; },
    cancel: token => timers.delete(token),
  });
  const handle = Buffer.alloc(8);
  handle.writeBigUInt64LE(1234n);
  const win = {id: 1, isDestroyed: () => false, getNativeWindowHandle: () => handle};
  return {probe, win, child, records, logs, requests, timers, kills: () => kills};
}

test('Windows snapshots correlate native foreground, enabled state and owner without titles', () => {
  const h = nativeFixture();
  h.probe.capture(h.win, 'focus');
  assert.equal(h.requests[0].hwnd, '1234');
  const response = JSON.stringify({
    id: h.requests[0].id, capturedAt: 1000, windowHandle: '1234',
    foregroundHandle: '999', ownerHandle: '456', foregroundPid: 42, enabled: false,
    foregroundIsSelf: false, title: 'private title',
  }) + '\n';
  h.child.stdout.emit('data', Buffer.from(response.slice(0, 20)));
  h.child.stdout.emit('data', Buffer.from(response.slice(20)));
  assert.equal(h.records[0].foregroundPid, 42);
  assert.equal(h.records[0].ownerHandle, '456');
  assert.equal(h.records[0].enabled, false);
  assert.doesNotMatch(JSON.stringify(h.records), /private/);
  assert.equal(h.timers.size, 0);
  h.probe.stop();
  assert.equal(h.kills(), 1);
});

test('probe timeouts and process errors are logged once and release pending requests', () => {
  for (const failure of ['timeout', 'error', 'stderr', 'exit', 'oversized']) {
    const h = nativeFixture();
    h.probe.capture(h.win, 'blur');
    if (failure === 'timeout') [...h.timers.values()][0]();
    if (failure === 'error') h.child.emit('error', new Error('probe unavailable'));
    if (failure === 'stderr') h.child.stderr.emit('data', Buffer.from('private details'));
    if (failure === 'exit') h.child.emit('exit', 1);
    if (failure === 'oversized') h.child.stdout.emit('data', Buffer.alloc(16385));
    h.child.emit('exit', 1);
    assert.equal(h.logs.length, 1);
    assert.equal(h.timers.size, 0);
    assert.equal(h.kills(), 1);
    assert.doesNotMatch(JSON.stringify(h.logs), /private/);
    assert.equal(h.records[0].event, 'unavailable');
  }
});

test('non-Windows diagnostics do not start a native helper', () => {
  const probe = createNativeProbe(assert.fail, assert.fail, {
    platform: 'darwin', launch: () => assert.fail('Unexpected helper'),
  });
  probe.capture({}, 'focus');
  probe.stop();
});

test('a native helper launch failure cannot prevent the shell from starting', () => {
  const logs = [], records = [];
  const probe = createNativeProbe(value => records.push(value), value => logs.push(value), {
    platform: 'win32', launch: () => { throw new Error('Process creation failed'); },
  });
  probe.capture({}, 'focus');
  probe.stop();
  assert.equal(logs.length, 1);
  assert.equal(records[0].failure, 'launch');
});

function rendererFixture({subframe = false} = {}) {
  let clock = 0;
  let interval;
  let cleared = false;
  const messages = [], errors = [];
  function eventTarget(extra = {}) {
    const emitter = new EventEmitter();
    return Object.assign(emitter, {
      addEventListener: (name, callback) => emitter.on(name, callback),
      removeEventListener: (name, callback) => emitter.removeListener(name, callback),
    }, extra);
  }
  const document = eventTarget({
    activeElement: null, visibilityState: 'visible', hasFocus: () => true,
  });
  const window = eventTarget();
  window.top = subframe ? {} : window;
  const ipcRenderer = Object.assign(new EventEmitter(), {
    send: (channel, value) => messages.push({channel, value: JSON.parse(JSON.stringify(value))}),
  });
  const source = fs.readFileSync(path.join(__dirname, '../../electron/preload.js'), 'utf8');
  const start = source.indexOf('function startInputFocusDiagnostics()');
  const end = source.indexOf('\nipcRenderer.on(\'shell:loading\'');
  vm.runInNewContext(source.slice(start, end), {
    window, document, ipcRenderer, performance: {now: () => clock},
    Date: {now: () => clock}, console: {error: message => errors.push(message)},
    setInterval: callback => { interval = callback; return 1; },
    clearInterval: () => { cleared = true; },
  });
  function element(id = 'task_subject') {
    return {id, name: id, tagName: 'INPUT', type: 'text', isContentEditable: false,
      disabled: false, readOnly: false, closest: () => null,
      get value() { assert.fail('Diagnostics read a field value.'); },
      get textContent() { assert.fail('Diagnostics read field contents.'); }};
  }
  return {
    window, document, ipcRenderer, messages, errors, element,
    tick: (ms = 1000) => { clock += ms; interval(); },
    cleared: () => cleared,
    event(type, target = element()) {
      document.activeElement = target;
      document.emit(type, {type, target,
        get key() { assert.fail('Diagnostics read a typed key.'); },
        get data() { assert.fail('Diagnostics read input text.'); }});
    },
  };
}

test('renderer captures editor-to-task transitions without reading keys or contents', () => {
  const h = rendererFixture();
  const editor = h.element('editor');
  Object.assign(editor, {tagName: 'DIV', isContentEditable: true,
    closest: selector => selector.includes('.ql-editor') ? {} : null});
  const task = h.element();
  h.event('focusout', editor);
  h.event('pointerdown', task);
  h.event('focusin', task);
  for (let index = 0; index < 100; index++) {
    h.event('keydown', task);
    h.event('beforeinput', task);
    h.event('input', task);
  }
  h.tick();
  const result = h.messages.at(-1).value;
  assert.equal(result.events.length, 6);
  assert.equal(result.events[0].target.area, 'note-editor');
  assert.equal(result.active.area, 'milestone-task');
  assert.equal(result.events.find(e => e.type === 'keydown').count, 100);
  assert.ok(cleanBatch(result));
  assert.equal(result.dropped, 0);
});

test('renderer buffers, IPC batches, heartbeat delays and page lifecycle remain bounded', () => {
  const h = rendererFixture();
  for (let index = 0; index < 200; index++) h.event('pointerdown');
  assert.equal(h.messages.length, 1, 'Events must be batched instead of sent per key or click.');
  h.tick();
  let result = h.messages.at(-1).value;
  assert.equal(result.events.length, 64);
  assert.equal(result.dropped, 136);
  h.tick(21000);
  result = h.messages.at(-1).value;
  assert.equal(result.maxDelayMs, 20000);
  assert.equal(result.events[0].type, 'heartbeat');
  h.ipcRenderer.emit(SNAPSHOT_CHANNEL);
  assert.equal(h.messages.at(-1).value.events[0].type, 'snapshot');
  h.window.emit('pagehide');
  assert.equal(h.cleared(), true);
  assert.equal(h.document.listenerCount('keydown'), 0);
  assert.equal(h.ipcRenderer.listenerCount(SNAPSHOT_CHANNEL), 0);
  h.window.emit('pageshow', {persisted: true});
  assert.equal(h.document.listenerCount('keydown'), 1);
  assert.equal(h.ipcRenderer.listenerCount(SNAPSHOT_CHANNEL), 1);
});

test('renderer and main allowlists match and subframes are not instrumented', () => {
  const h = rendererFixture();
  for (const id of TARGET_IDS) {
    h.event('focusin', h.element(id));
    h.tick();
    assert.equal(h.messages.at(-1).value.active.id, id);
  }
  const subframe = rendererFixture({subframe: true});
  assert.equal(subframe.messages.length, 0);
  assert.equal(subframe.document.listenerCount('keydown'), 0);
});

test('diagnostic modules and Windows probe are packaged with the shell', () => {
  const files = require('../../electron/package.json').build.files;
  assert.ok(files.includes('input-focus.js'));
  assert.ok(files.includes('input-focus.ps1'));
  assert.ok(require('../../electron/package.json').build.asarUnpack.includes('input-focus.ps1'));
});
