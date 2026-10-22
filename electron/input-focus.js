const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');
const {trustedThemeFrame} = require('./shell-theme');

const CHANNEL = 'shell:input-focus';
const SNAPSHOT_CHANNEL = 'shell:input-focus-snapshot';
const MAX_LOG_BYTES = 2 * 1024 * 1024;
const LOG_FILES = 3;
const MAX_EVENTS = 64;
const TARGET_IDS = new Set([
  'editor', 'content', 'task_subject', 'task_description', 'task_category', 'task_due_date',
  'engTaskTitle', 'engTaskDescription', 'salesbuddy-find-bar', 'sb-shell-menubar',
]);
const EVENT_TYPES = new Set([
  'focus', 'blur', 'focusin', 'focusout', 'pointerdown', 'keydown', 'beforeinput', 'input',
  'compositionstart', 'compositionend', 'visibilitychange', 'heartbeat', 'snapshot', 'pagehide',
]);
const TAGS = new Set([
  'INPUT', 'TEXTAREA', 'SELECT', 'DIV', 'BUTTON', 'BODY', 'A', 'IFRAME', 'HTML',
  'DOCUMENT', 'WINDOW', 'OTHER',
]);
const INPUT_TYPES = new Set([
  '', 'text', 'search', 'email', 'password', 'url', 'tel', 'number', 'date', 'time',
  'datetime-local', 'checkbox', 'radio', 'file', 'submit', 'button', 'hidden', 'range',
  'color', 'month', 'week', 'reset',
]);
const AREAS = new Set(['note-editor', 'milestone-task', 'shell-find', 'shell-menu', 'other']);

function cleanTarget(target) {
  if (!target || !TAGS.has(target.tag) || !INPUT_TYPES.has(target.type)
      || !AREAS.has(target.area)
      || ['editable', 'disabled', 'readOnly'].some(key => typeof target[key] !== 'boolean')) {
    return null;
  }
  return {
    tag: target.tag, type: target.type, area: target.area,
    id: TARGET_IDS.has(target.id) ? target.id : '',
    name: TARGET_IDS.has(target.name) ? target.name : '',
    editable: target.editable, disabled: target.disabled, readOnly: target.readOnly,
  };
}

function cleanBatch(batch) {
  if (!batch || !Array.isArray(batch.events) || batch.events.length > MAX_EVENTS
      || typeof batch.focused !== 'boolean'
      || !['visible', 'hidden', 'prerender'].includes(batch.visibility)
      || !Number.isSafeInteger(batch.dropped) || batch.dropped < 0
      || !Number.isFinite(batch.maxDelayMs) || batch.maxDelayMs < 0) return null;
  const active = cleanTarget(batch.active);
  if (!active) return null;
  const events = [];
  for (const event of batch.events) {
    const target = cleanTarget(event?.target);
    if (!target || !EVENT_TYPES.has(event.type) || !Number.isSafeInteger(event.at)
        || event.at < 0 || !Number.isSafeInteger(event.count) || event.count < 1
        || event.count > 1000000) return null;
    events.push({type: event.type, at: event.at, count: event.count, target});
  }
  return {
    focused: batch.focused, visibility: batch.visibility, active, events,
    dropped: Math.min(batch.dropped, 1000000),
    maxDelayMs: Math.min(Math.round(batch.maxDelayMs), 86400000),
  };
}

function createRotatingLog(directory, log, io = fs, maxBytes = MAX_LOG_BYTES) {
  const files = Array.from({length: LOG_FILES}, (_, index) => path.join(directory,
    `electron-input-focus${index ? '.' + index : ''}.jsonl`));
  let failed = false;
  let size = null;
  function write(record) {
    try {
      io.mkdirSync(directory, {recursive: true});
      if (size === null) size = io.existsSync(files[0]) ? io.statSync(files[0]).size : 0;
      const line = JSON.stringify({at: new Date().toISOString(), ...record}) + '\n';
      const bytes = Buffer.byteLength(line);
      if (bytes > maxBytes) throw new Error('Diagnostic entry exceeds the log size limit.');
      if (size + bytes > maxBytes) {
        for (let index = files.length - 1; index > 0; index--) {
          if (io.existsSync(files[index])) io.unlinkSync(files[index]);
          if (io.existsSync(files[index - 1])) io.renameSync(files[index - 1], files[index]);
        }
        size = 0;
      }
      io.appendFileSync(files[0], line, 'utf8');
      size += bytes;
      if (failed) log('Input focus diagnostic logging recovered.');
      failed = false;
      return true;
    } catch (error) {
      size = null;
      if (!failed) log(`Could not write input focus diagnostics: ${error.message}`);
      failed = true;
      return false;
    }
  }
  function save(destination) {
    if (files.some(file => path.resolve(file).toLowerCase()
        === path.resolve(destination).toLowerCase())) {
      throw new Error('Choose a destination outside the rotating diagnostic log files.');
    }
    const contents = files.slice().reverse().filter(file => io.existsSync(file))
      .map(file => io.readFileSync(file, 'utf8')).join('');
    if (!contents) throw new Error('No input focus diagnostics are available.');
    io.writeFileSync(destination, contents, 'utf8');
  }
  return {write, save, files};
}

function createNativeProbe(record, log, {
  platform = process.platform, launch = spawn, schedule = setTimeout, cancel = clearTimeout,
} = {}) {
  if (platform !== 'win32') return {capture() {}, stop() {}};
  const pending = new Map();
  let sequence = 0;
  let output = '';
  let stopped = false;
  let unavailable = false;
  let child;
  try {
    child = launch('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(__dirname.replace(/\.asar$/, '.asar.unpacked'), 'input-focus.ps1'),
    ], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
  } catch (error) {
    log(`Windows input focus probe unavailable: ${error.message}`);
    record({source: 'native', event: 'unavailable', failure: 'launch'});
    return {capture() {}, stop() {}};
  }
  function fail(reason, failure = 'protocol') {
    if (stopped || unavailable) return;
    unavailable = true;
    for (const item of pending.values()) cancel(item.timer);
    pending.clear();
    log(`Windows input focus probe unavailable: ${reason}`);
    record({source: 'native', event: 'unavailable', failure});
    child.kill();
  }
  child.on('error', error => fail(error.message, 'process'));
  child.on('exit', code => fail(`process exited (${code})`, 'exit'));
  child.stdin.on('error', error => fail(error.message, 'stdin'));
  child.stderr.on('data', () => fail('PowerShell reported an error', 'stderr'));
  child.stdout.on('data', chunk => {
    output += chunk.toString('utf8');
    if (output.length > 16384) { fail('oversized probe response'); return; }
    let end;
    while ((end = output.indexOf('\n')) >= 0) {
      const line = output.slice(0, end);
      output = output.slice(end + 1);
      try {
        const data = JSON.parse(line);
        const request = pending.get(data.id);
        if (!request) throw new Error('unexpected probe response');
        if (!['windowHandle', 'foregroundHandle', 'ownerHandle'].every(
          key => typeof data[key] === 'string' && /^\d{1,20}$/.test(data[key]))
          || !['enabled', 'foregroundIsSelf'].every(key => typeof data[key] === 'boolean')
          || !Number.isSafeInteger(data.foregroundPid) || data.foregroundPid < 0
          || !Number.isSafeInteger(data.capturedAt) || data.capturedAt < 0) {
          throw new Error('invalid probe response');
        }
        cancel(request.timer);
        pending.delete(data.id);
        record({
          source: 'native', event: request.event, window: request.window,
          requestedAt: request.at, capturedAt: data.capturedAt,
          windowHandle: data.windowHandle, foregroundHandle: data.foregroundHandle,
          ownerHandle: data.ownerHandle, foregroundPid: data.foregroundPid,
          enabled: data.enabled, foregroundIsSelf: data.foregroundIsSelf,
        });
      } catch (error) { fail(error.message); }
    }
  });
  function capture(win, event) {
    if (stopped || unavailable || win.isDestroyed()) return;
    if (pending.size >= 32) { fail('probe request limit reached'); return; }
    const handle = win.getNativeWindowHandle();
    const hwnd = (handle.length === 8 ? handle.readBigUInt64LE() : handle.readUInt32LE()).toString();
    const id = ++sequence;
    const at = Date.now();
    const timer = schedule(() => fail('probe response timed out', 'timeout'), 5000);
    timer.unref?.();
    pending.set(id, {window: win.id, event, at, timer});
    child.stdin.write(JSON.stringify({id, hwnd}) + '\n');
  }
  function stop() {
    stopped = true;
    for (const request of pending.values()) cancel(request.timer);
    pending.clear();
    child.kill();
  }
  return {capture, stop};
}

function createInputFocusDiagnostics({
  app, port, logDir, log, versions = process.versions, gpuRendering,
  writer = createRotatingLog(logDir, log), nativeFactory = createNativeProbe,
  schedule = setInterval, cancel = clearInterval, now = Date.now,
}) {
  const tracked = new Map();
  const subscriptions = [];
  let stopped = false;
  const record = entry => writer.write(entry);
  const native = nativeFactory(record, log);
  function state(win) {
    if (win.isDestroyed()) return {destroyed: true};
    const wc = win.webContents;
    return {
      visible: win.isVisible(), focused: win.isFocused(), enabled: win.isEnabled(),
      minimized: win.isMinimized(), webFocused: !wc.isDestroyed() && wc.isFocused(),
    };
  }
  function listen(emitter, event, handler, removals = subscriptions) {
    emitter.on(event, handler);
    removals.push(() => emitter.removeListener(event, handler));
  }
  record({
    source: 'main', event: 'session-start', pid: process.pid, gpuRendering,
    electron: versions.electron, chrome: versions.chrome, node: versions.node,
  });
  for (const event of ['browser-window-focus', 'browser-window-blur']) {
    listen(app, event, (_event, win) => record({
      source: 'app', event, window: win.id, state: state(win),
    }));
  }
  for (const event of ['activate', 'second-instance']) {
    listen(app, event, () => record({source: 'app', event}));
  }
  listen(app, 'child-process-gone', (_event, details) => record({
    source: 'app', event: 'child-process-gone',
    processType: ['GPU', 'Utility', 'Renderer', 'Zygote', 'Sandbox helper']
      .includes(details.type) ? details.type : 'other',
    reason: ['clean-exit', 'abnormal-exit', 'killed', 'crashed', 'oom', 'launch-failed',
      'integrity-failure'].includes(details.reason) ? details.reason : 'other',
    exitCode: Number.isInteger(details.exitCode) ? details.exitCode : null,
  }));

  function attach(win) {
    if (stopped || tracked.has(win.id)) return;
    const wc = win.webContents;
    const removals = [];
    const on = (emitter, event, handler) => listen(emitter, event, handler, removals);
    const dispose = () => {
      for (const remove of removals) remove();
      removals.length = 0;
      tracked.delete(win.id);
    };
    const item = {
      win, dispose, keyboard: 0, pointer: 0, lastRendererAt: null, rateAt: now(), rate: 0,
    };
    tracked.set(win.id, item);
    record({source: 'main', event: 'window-created', window: win.id, state: state(win)});
    for (const event of ['focus', 'blur', 'show', 'hide', 'minimize', 'restore']) {
      on(win, event, () => {
        record({source: 'window', event, window: win.id, state: state(win)});
        if (event === 'focus' || event === 'blur') native.capture(win, event);
      });
    }
    on(win, 'closed', () => {
      record({source: 'window', event: 'closed', window: win.id});
      dispose();
    });
    for (const event of ['unresponsive', 'responsive']) {
      on(win, event, () => record({
        source: 'window', event, window: win.id, state: state(win),
      }));
    }
    for (const event of [
      'focus', 'blur', 'did-focus', 'did-blur', 'dom-ready', 'unresponsive', 'responsive',
    ]) {
      on(wc, event, () => record({
        source: 'webcontents', event, window: win.id, state: state(win),
      }));
    }
    on(wc, 'render-process-gone', (_event, details) => record({
      source: 'webcontents', event: 'render-process-gone', window: win.id,
      reason: ['clean-exit', 'abnormal-exit', 'killed', 'crashed', 'oom', 'launch-failed',
        'integrity-failure'].includes(details.reason) ? details.reason : 'other',
      exitCode: Number.isInteger(details.exitCode) ? details.exitCode : null,
    }));
    on(wc, 'before-input-event', () => { item.keyboard++; });
    on(wc, 'before-mouse-event', (_event, input) => {
      if (input.type === 'mouseDown') item.pointer++;
    });
    on(wc.ipc, CHANNEL, (event, payload) => {
      if (win.isDestroyed()) return;
      const time = now();
      if (time - item.rateAt >= 1000) { item.rateAt = time; item.rate = 0; }
      if (++item.rate > 4) {
        if (item.rate === 5) log('Input focus diagnostic IPC rate limit reached.');
        item.rate = 6;
        return;
      }
      const batch = trustedThemeFrame(win, event.senderFrame, port) && cleanBatch(payload);
      if (!batch) {
        log('Rejected untrusted or invalid input focus diagnostic message.');
        return;
      }
      item.lastRendererAt = time;
      record({source: 'renderer', window: win.id, state: state(win), ...batch});
    });
  }

  const timer = schedule(() => {
    for (const [id, item] of tracked) {
      if (item.win.isDestroyed()) continue;
      record({
        source: 'main', event: 'heartbeat', window: id, state: state(item.win),
        rendererAgeMs: item.lastRendererAt === null ? null : now() - item.lastRendererAt,
        keyboardEvents: item.keyboard, pointerEvents: item.pointer,
      });
      item.keyboard = 0;
      item.pointer = 0;
    }
  }, 15000);
  timer?.unref?.();

  function markIncident() {
    const saved = record({source: 'main', event: 'incident-marker'});
    for (const {win} of tracked.values()) {
      if (win.isDestroyed()) continue;
      record({source: 'main', event: 'incident-window', window: win.id, state: state(win)});
      native.capture(win, 'incident');
      win.webContents.send(SNAPSHOT_CHANNEL);
    }
    if (!saved) throw new Error('The input focus diagnostic log could not be written.');
  }
  function shutdown() {
    if (stopped) return;
    stopped = true;
    cancel(timer);
    for (const unsubscribe of subscriptions) unsubscribe();
    subscriptions.length = 0;
    for (const item of tracked.values()) item.dispose();
    tracked.clear();
    native.stop();
    record({source: 'main', event: 'session-end'});
  }
  return {attach, markIncident, save: writer.save, shutdown};
}

module.exports = {
  CHANNEL, SNAPSHOT_CHANNEL, MAX_LOG_BYTES, LOG_FILES, MAX_EVENTS, TARGET_IDS,
  cleanBatch, createRotatingLog, createNativeProbe, createInputFocusDiagnostics,
};
