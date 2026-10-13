const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {attachShellTheme, validTheme, trustedThemeFrame, readShellTheme} =
  require('../../electron/shell-theme');

function fixture() {
  const frame = {url: 'http://127.0.0.1:5000/preferences'};
  const overlays = [], backgrounds = [], logs = [];
  const win = {
    webContents: {mainFrame: frame, ipc: new EventEmitter()},
    isDestroyed: () => false,
    setTitleBarOverlay: value => overlays.push(value),
    setBackgroundColor: value => backgrounds.push(value),
  };
  attachShellTheme(win, 5000, value => logs.push(value));
  return {win, frame, overlays, backgrounds, logs,
    send: (theme, senderFrame = frame) => win.webContents.ipc.emit(
      'shell:theme', {senderFrame}, theme
    )};
}
const theme = {
  family: 'harbor', mode: 'dark', color: '#213034',
  symbolColor: '#e5ecee', backgroundColor: '#101b1e',
};

test('all eight theme choices update caption controls, background and recovery snapshot', () => {
  const h = fixture();
  for (const mode of ['light', 'dark']) {
    for (const family of ['graphite', 'midnight', 'harbor', 'carbon']) {
      h.send({...theme, family, mode});
      assert.deepEqual(h.win._sbTheme, {family, mode});
      assert.deepEqual(h.overlays.at(-1),
        {color: theme.color, symbolColor: theme.symbolColor, height: 32});
      assert.equal(h.backgrounds.at(-1), theme.backgroundColor);
    }
  }
  assert.equal(h.overlays.length, 8);
  assert.equal(h.logs.length, 0);
});

test('only the exact local app port and shell-owned status main frame are trusted', () => {
  const h = fixture();
  for (const url of ['https://evil.example', 'http://localhost:5151/',
    'http://localhost.evil:5000/', 'http://user@localhost:5000/', 'file:///C:/secret',
    'data:text/html,untrusted']) {
    h.frame.url = url;
    h.send(theme);
  }
  h.frame.url = 'http://localhost:5000/';
  h.send(theme, {url: h.frame.url});
  assert.equal(h.overlays.length, 0);
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    h.frame.url = `http://${host}:5000/preferences`;
    assert.equal(trustedThemeFrame(h.win, h.frame, 5000), true);
  }
  h.frame.url = h.win._sbStatusUrl = 'data:text/html,owned-status';
  h.send(theme);
  assert.equal(h.overlays.length, 1);
});

test('malformed themes are rejected without changing the current chrome', () => {
  const h = fixture();
  for (const value of [null, {}, {...theme, mode: 'system'}, {...theme, family: 'invalid'},
    {...theme, color: 'red'}, {...theme, symbolColor: '#123'},
    {...theme, backgroundColor: 'url(https://evil.example)'}]) {
    assert.ok(!validTheme(value));
    h.send(value);
  }
  assert.equal(h.overlays.length, 0);
  assert.equal(h.logs.length, 7);
});

test('destroyed windows are ignored and native failures are logged', () => {
  const h = fixture();
  h.win.isDestroyed = () => true;
  h.send(theme);
  assert.equal(h.overlays.length, 0);
  h.win.isDestroyed = () => false;
  h.win.setTitleBarOverlay = () => {throw new Error('native failure');};
  h.send(theme);
  assert.match(h.logs[0], /Could not apply shell theme: native failure/);
});

test('shell helper is packaged and preload observes only theme attributes for color changes', () => {
  assert.ok(require('../../electron/package.json').build.files.includes('shell-theme.js'));
  const source = fs.readFileSync(path.join(__dirname, '../../electron/preload.js'), 'utf8');
  assert.match(source, /attributeFilter: \['data-sb-mode', 'data-sb-family'\]/);
  assert.match(source, /-webkit-app-region: drag/);
  assert.match(source, /document\.body\.prepend\(bar\)/);
  assert.match(source, /color\('--sb-ui-header'\)/);
});

test('startup restores a valid cached palette and reports corrupted caches', () => {
  const logs = [];
  assert.deepEqual(readShellTheme('theme.json', {
    readFileSync: () => JSON.stringify(theme),
  }, message => logs.push(message)), theme);
  assert.equal(readShellTheme('missing.json', {
    readFileSync: () => {throw Object.assign(new Error('missing'), {code: 'ENOENT'});},
  }, message => logs.push(message)), null);
  assert.equal(logs.length, 0);
  assert.equal(readShellTheme('broken.json', {
    readFileSync: () => '{"family":"invalid"}',
  }, message => logs.push(message)), null);
  assert.match(logs[0], /Could not read saved shell theme/);
});

function chromeBootstrap({bodyReady = true, platform = 'win32', subframe = false} = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../electron/preload.js'), 'utf8');
  const bootstrap = source.slice(source.indexOf('function startShellChrome()'),
    source.indexOf('\nstartShellChrome();')) + '\nstartShellChrome();';
  let mounts = 0;
  const observers = [];
  const window = {};
  window.top = subframe ? {} : window;
  const document = {head: {}, body: bodyReady ? {} : null, readyState: 'loading'};
  vm.runInNewContext(bootstrap, {
    window, document, process: {platform},
    mountShellTitleBar: () => { mounts++; },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(target, options) { this.target = target; this.options = options; }
      disconnect() { this.disconnected = true; }
    },
  });
  return {document,observers,mounts:()=>mounts};
}

test('shell chrome mounts while the document is still loading, not at DOMContentLoaded', () => {
  const h = chromeBootstrap();
  assert.equal(h.document.readyState,'loading');
  assert.equal(h.mounts(),1);
  assert.equal(h.observers.length,0);
});

test('shell chrome mounts as soon as the parser creates the body', () => {
  const h = chromeBootstrap({bodyReady:false});
  assert.equal(h.mounts(),0);
  const observer = h.observers[0];
  assert.equal(observer.target,h.document);
  h.document.body = {};
  observer.callback();
  assert.equal(h.mounts(),1);
  assert.equal(observer.disconnected,true);
});

test('early chrome bootstrap preserves non-Windows and subframe behavior', () => {
  for (const options of [{platform:'darwin'},{subframe:true}]) {
    const h = chromeBootstrap(options);
    assert.equal(h.mounts(),0);
    assert.equal(h.observers.length,0);
  }
});
