const path = require('path');

const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

function validBounds(bounds) {
  return bounds && ['x', 'y', 'width', 'height'].every(
    key => Number.isSafeInteger(bounds[key])
  ) && bounds.width > 0 && bounds.height > 0 &&
    Number.isSafeInteger(bounds.x + bounds.width) &&
    Number.isSafeInteger(bounds.y + bounds.height);
}

function fitBounds(bounds, area) {
  const width = Math.min(area.width, Math.max(Math.min(MIN_WIDTH, area.width), bounds.width));
  const height = Math.min(area.height, Math.max(Math.min(MIN_HEIGHT, area.height), bounds.height));
  return {
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)),
    width, height,
  };
}

function matchingDisplay(bounds, screen) {
  let selected = screen.getPrimaryDisplay();
  let largest = 0;
  for (const display of screen.getAllDisplays()) {
    const area = display.bounds;
    const overlap = Math.max(0, Math.min(bounds.x + bounds.width, area.x + area.width) -
      Math.max(bounds.x, area.x)) *
      Math.max(0, Math.min(bounds.y + bounds.height, area.y + area.height) -
      Math.max(bounds.y, area.y));
    if (overlap > largest) {
      largest = overlap;
      selected = display;
    }
  }
  return selected;
}

function windowPlacement(state, screen, additional = false) {
  const display = state ? matchingDisplay(state.normalBounds, screen) :
    screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area = display.workArea;
  const width = Math.max(1, Math.min(1600, area.width - 32));
  const height = Math.max(1, Math.min(1000, area.height - 32));
  const bounds = state ? {...state.normalBounds} : {
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width, height,
  };
  if (additional) {
    bounds.x += 32;
    bounds.y += 32;
  }
  return {
    ...fitBounds(bounds, area),
    minWidth: Math.min(MIN_WIDTH, area.width),
    minHeight: Math.min(MIN_HEIGHT, area.height),
    maximized: state?.maximized ?? false,
  };
}

function createWindowState({file, fs, screen, log, schedule = setTimeout, cancel = clearTimeout}) {
  let state = null;
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (value?.version !== 1 || typeof value.maximized !== 'boolean' ||
        !validBounds(value.normalBounds)) {
      throw new Error('Expected version 1, safe integer bounds, and a Boolean maximized flag');
    }
    const {x, y, width, height} = value.normalBounds;
    state = {version: 1, normalBounds: {x, y, width, height}, maximized: value.maximized};
  } catch (error) {
    if (error.code !== 'ENOENT') log(`Could not read window state at ${file}: ${error.message}`);
  }
  log(`Window state file: ${file}`);
  let written = state ? JSON.stringify(state) : null;
  let selected = null;
  let timer = null;
  let stopped = false;
  let adjusting = false;
  const tracked = new Set();

  function capture(win) {
    if (stopped || adjusting || win !== selected || win.isDestroyed()) return;
    try {
      // Minimization and full-screen transitions must not replace the normal restore rectangle.
      if (win.isMinimized() || win.isFullScreen()) return;
      const bounds = win.getNormalBounds();
      if (!validBounds(bounds)) throw new Error('Native window returned invalid normal bounds');
      state = {version: 1, normalBounds: {...bounds}, maximized: win.isMaximized()};
    } catch (error) {
      log(`Could not capture window state: ${error.message}`);
    }
  }

  function flush() {
    if (timer !== null) cancel(timer);
    timer = null;
    if (selected) capture(selected);
    const value = state ? JSON.stringify(state) : null;
    if (value === null || value === written) return;
    const temporary = `${file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(temporary, value, 'utf8');
      fs.renameSync(temporary, file);
      written = value;
    } catch (error) {
      log(`Could not save window state at ${file}: ${error.message}`);
      try {
        fs.unlinkSync(temporary);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          log(`Could not remove temporary window state at ${temporary}: ${cleanupError.message}`);
        }
      }
    }
  }

  function changed(win) {
    if (stopped || adjusting || win !== selected) return;
    capture(win);
    if (timer !== null) cancel(timer);
    timer = schedule(flush, 250);
  }

  function repair(win) {
    if (stopped || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    try {
      const bounds = win.getNormalBounds();
      const maximized = win.isMaximized();
      const placement = windowPlacement({normalBounds: bounds, maximized}, screen);
      win.setMinimumSize(placement.minWidth, placement.minHeight);
      const fitted = {x: placement.x, y: placement.y,
        width: placement.width, height: placement.height};
      if (Object.keys(fitted).some(key => fitted[key] !== bounds[key])) {
        adjusting = true;
        try {
          if (maximized) win.unmaximize();
          win.setBounds(fitted);
          if (maximized) win.maximize();
        } finally {
          adjusting = false;
        }
      }
      changed(win);
    } catch (error) {
      log(`Could not fit window to the current displays: ${error.message}`);
    }
  }

  return {
    placement: additional => windowPlacement(state, screen, additional),
    track(win) {
      tracked.add(win);
      if (!selected || selected.isDestroyed()) selected = win;
      win.on('focus', () => {
        if (stopped || adjusting) return;
        selected = win;
        changed(win);
      });
      for (const event of ['move', 'resize', 'maximize', 'unmaximize']) {
        win.on(event, () => changed(win));
      }
      win.on('restore', () => repair(win));
      win.on('close', () => {
        if (win === selected) flush();
      });
      win.on('closed', () => tracked.delete(win));
      changed(win);
    },
    watchDisplays() {
      for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) {
        screen.on(event, () => {
          for (const win of tracked) repair(win);
        });
      }
    },
    flush,
    shutdown() {
      flush();
      stopped = true;
    },
  };
}

module.exports = {createWindowState, windowPlacement};
