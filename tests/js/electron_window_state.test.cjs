const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const test = require('node:test');
const {createWindowState, windowPlacement} = require('../../electron/window-state');

const primary = {id: 1, bounds: {x: 0, y: 0, width: 1920, height: 1080},
  workArea: {x: 0, y: 0, width: 1920, height: 1040}};
const left = {id: 2, bounds: {x: -1920, y: 0, width: 1920, height: 1080},
  workArea: {x: -1920, y: 0, width: 1920, height: 1040}};
const bounds = {x: 80, y: 60, width: 1200, height: 740};
const saved = (normalBounds = bounds, maximized = false) =>
  ({version: 1, normalBounds, maximized});

function fixture(value) {
  const file = 'C:\\profile\\window-state\\state.json';
  const files = new Map(value === undefined ? [] : [[file, value]]);
  const logs = [];
  const timers = new Map();
  let nextTimer = 0;
  let writes = 0;
  const screen = new EventEmitter();
  screen.displays = [primary, left];
  screen.getPrimaryDisplay = () => screen.displays[0];
  screen.getAllDisplays = () => screen.displays;
  screen.getCursorScreenPoint = () => ({x: 100, y: 100});
  screen.getDisplayNearestPoint = () => screen.displays[0];
  const fs = {
    readFileSync: name => {
      if (!files.has(name)) throw Object.assign(new Error('not found'), {code: 'ENOENT'});
      return files.get(name);
    },
    mkdirSync() {},
    writeFileSync: (name, content) => {
      if (fs.failWrite) throw new Error('write denied');
      writes++;
      files.set(name, content);
    },
    renameSync: (from, to) => {
      if (fs.failRename) throw new Error('rename denied');
      files.set(to, files.get(from));
      files.delete(from);
    },
    unlinkSync: name => files.delete(name),
  };
  const manager = createWindowState({file, fs, screen, log: line => logs.push(line),
    schedule: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    cancel: id => timers.delete(id)});
  return {manager, screen, fs, logs, timers, files, file,
    read: () => JSON.parse(files.get(file)),
    writes: () => writes,
    tick: () => {
      for (const [id, callback] of [...timers]) {
        if (timers.delete(id)) callback();
      }
    }};
}

function window(normal = bounds) {
  const win = new EventEmitter();
  win.normal = {...normal};
  win.maximized = false;
  win.minimized = false;
  win.destroyed = false;
  win.fullScreen = false;
  win.isDestroyed = () => win.destroyed;
  win.isMinimized = () => win.minimized;
  win.isFullScreen = () => win.fullScreen;
  win.isMaximized = () => !win.minimized && win.maximized;
  win.getNormalBounds = () => ({...win.normal});
  win.setBounds = value => { win.normal = {...value}; win.emit('resize'); };
  win.setMinimumSize = (width, height) => { win.minimum = {width, height}; };
  win.maximize = () => { win.maximized = true; win.emit('maximize'); };
  win.unmaximize = () => { win.maximized = false; win.emit('unmaximize'); };
  return win;
}

test('first launch uses a centered 1600 by 1000 DIP target near the cursor', () => {
  const h = fixture();
  assert.deepEqual(h.manager.placement(), {x: 160, y: 20, width: 1600, height: 1000,
    minWidth: 900, minHeight: 600, maximized: false});
  h.screen.getDisplayNearestPoint = () => left;
  assert.equal(h.manager.placement().x, -1760);
  assert.ok(!h.logs.some(line => line.includes('Could not read')));
});

test('small and scaled work areas cap both the default dimensions and native minimum', () => {
  const h = fixture();
  h.screen.displays = [{bounds: {x: 10, y: 20, width: 800, height: 500},
    workArea: {x: 10, y: 20, width: 800, height: 460}}];
  assert.deepEqual(h.manager.placement(), {x: 10, y: 20, width: 800, height: 460,
    minWidth: 800, minHeight: 460, maximized: false});
});

test('valid negative coordinates and maximized state survive without recentering', () => {
  const normal = {x: -1600, y: 80, width: 1100, height: 800};
  const h = fixture(JSON.stringify(saved(normal, true)));
  assert.deepEqual(h.manager.placement(), {...normal,
    minWidth: 900, minHeight: 600, maximized: true});
});

test('disconnected displays relocate to primary and oversized bounds fit its work area', () => {
  const h = fixture();
  assert.deepEqual(windowPlacement(saved({x: -5000, y: 3000, width: 3000, height: 2000}),
    h.screen), {x: 0, y: 0, width: 1920, height: 1040,
    minWidth: 900, minHeight: 600, maximized: false});
});

test('the display with greatest rectangle overlap is selected', () => {
  const h = fixture();
  const result = windowPlacement(saved({x: -1000, y: 20, width: 1200, height: 800}), h.screen);
  assert.equal(result.x, -1200);
});

test('additional windows cascade but remain inside the selected work area', () => {
  const h = fixture(JSON.stringify(saved()));
  assert.deepEqual(h.manager.placement(true), {...bounds, x: 112, y: 92,
    minWidth: 900, minHeight: 600, maximized: false});
  const fitted = windowPlacement(saved({...bounds, x: 720, y: 300}), h.screen, true);
  assert.equal(fitted.x, 720);
  assert.equal(fitted.y, 300);
});

test('malformed, unknown-version and unsafe geometry are logged and use first-launch placement', () => {
  for (const value of ['broken JSON', 'null', '{}',
    JSON.stringify({...saved(), version: 2}),
    JSON.stringify({...saved(), maximized: 'yes'}),
    ...[{...bounds, width: 0}, {...bounds, x: 0.5},
      {...bounds, x: Number.MAX_SAFE_INTEGER}, {...bounds, height: -5}]
      .map(normal => JSON.stringify(saved(normal)))]) {
    const h = fixture(value);
    assert.equal(h.manager.placement().width, 1600);
    assert.ok(h.logs.some(line => line.includes(`Could not read window state at ${h.file}`)));
  }
});

test('move and resize are debounced and save only the final normal rectangle atomically', () => {
  const h = fixture();
  const win = window();
  h.manager.track(win);
  for (let x = 100; x < 200; x++) {
    win.normal.x = x;
    win.emit('move');
  }
  assert.equal(h.writes(), 0);
  assert.equal(h.timers.size, 1);
  h.tick();
  assert.deepEqual(h.read(), saved({...bounds, x: 199}));
  assert.equal(h.writes(), 1);
  assert.equal(h.files.has(`${h.file}.tmp`), false);
  win.emit('resize');
  h.tick();
  assert.equal(h.writes(), 1);
});

test('maximized normal bounds and flag survive minimizing and a fresh manager', () => {
  const h = fixture();
  const win = window();
  h.manager.track(win);
  win.maximize();
  win.minimized = true;
  win.normal = {x: 0, y: 0, width: 1, height: 1};
  win.emit('resize');
  h.manager.shutdown();
  assert.deepEqual(h.read(), saved(bounds, true));
  assert.equal(fixture(h.files.get(h.file)).manager.placement().maximized, true);
});

test('full-screen geometry never replaces the ordinary restore state', () => {
  const h = fixture();
  const win = window();
  h.manager.track(win);
  win.fullScreen = true;
  win.normal = {x: 0, y: 0, width: 1920, height: 1080};
  win.emit('resize');
  h.manager.flush();
  assert.deepEqual(h.read(), saved());
});

test('background window close and quit event ordering cannot overwrite the last-focused state', () => {
  const h = fixture();
  const first = window();
  const second = window({...bounds, x: 400});
  h.manager.track(first);
  h.manager.track(second);
  second.emit('focus');
  first.emit('resize');
  first.emit('close');
  first.destroyed = true;
  first.emit('closed');
  h.manager.shutdown();
  second.normal.x = 900;
  second.emit('resize');
  first.emit('focus');
  second.emit('close');
  assert.deepEqual(h.read(), saved({...bounds, x: 400}));
  assert.equal(h.timers.size, 0);
});

test('closing the selected window retains its state until another window receives focus', () => {
  const h = fixture();
  const first = window();
  const second = window({...bounds, x: 300});
  h.manager.track(first);
  h.manager.track(second);
  first.emit('close');
  first.destroyed = true;
  first.emit('closed');
  second.emit('resize');
  h.manager.flush();
  assert.deepEqual(h.read(), saved());
  second.emit('focus');
  h.tick();
  assert.deepEqual(h.read(), saved({...bounds, x: 300}));
});

test('display changes fit live windows, preserve maximization and avoid moving valid windows', () => {
  const h = fixture();
  const win = window({x: -1600, y: 80, width: 1200, height: 800});
  let moves = 0;
  win.on('resize', () => moves++);
  win.maximize();
  h.manager.track(win);
  h.manager.watchDisplays();
  h.screen.emit('display-metrics-changed');
  assert.equal(moves, 0);
  h.screen.displays = [{...primary, workArea: {x: 0, y: 0, width: 800, height: 500}}];
  h.screen.emit('display-removed');
  assert.deepEqual(win.normal, {x: 0, y: 0, width: 800, height: 500});
  assert.equal(win.maximized, true);
  assert.deepEqual(win.minimum, {width: 800, height: 500});
  h.manager.flush();
  assert.deepEqual(h.read(), saved(win.normal, true));
});

test('minimized windows are fitted when restored without being brought forward by display events', () => {
  const h = fixture();
  const win = window({x: -1600, y: 80, width: 1200, height: 800});
  h.manager.track(win);
  h.manager.watchDisplays();
  win.minimized = true;
  h.screen.displays = [primary];
  h.screen.emit('display-removed');
  assert.equal(win.normal.x, -1600);
  win.minimized = false;
  win.emit('restore');
  assert.equal(win.normal.x, 0);
});

test('failed writes retain the prior valid file, log errors and can retry on quit', () => {
  for (const failure of ['failWrite', 'failRename']) {
    const h = fixture(JSON.stringify(saved()));
    const win = window({...bounds, x: 300});
    h.manager.track(win);
    h.fs[failure] = true;
    h.tick();
    assert.deepEqual(h.read(), saved());
    assert.equal(h.files.has(`${h.file}.tmp`), false);
    assert.ok(h.logs.some(line => line.includes('Could not save window state')));
    h.fs[failure] = false;
    h.manager.shutdown();
    assert.deepEqual(h.read(), saved({...bounds, x: 300}));
  }
});

test('window state helper is included in the packaged desktop shell', () => {
  assert.ok(require('../../electron/package.json').build.files.includes('window-state.js'));
});
