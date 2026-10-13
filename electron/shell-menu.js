// The custom caption hides Windows' menu strip, but its native dropdowns/actions remain reusable.
const {trustedThemeFrame} = require('./shell-theme');

function menuSnapshot(menu) {
  return (menu?.items || []).map((item, index) => ({
    index, label: item.label, enabled: item.enabled !== false,
    submenu: !!item.submenu, visible: item.visible !== false,
  }));
}

function attachShellMenu(win, port, getMenu, log, getCursorPoint) {
  const ipc = win.webContents.ipc;
  let active = null;
  let hoverTimer = null;
  let dismissedHeading = null;
  let swallowingClick = false;
  function isAlive() {
    return !win.isDestroyed() && !win.webContents.isDestroyed();
  }
  function headingAt(point, rects, zoom) {
    const origin = win.getContentBounds();
    return rects.find(rect => point.x >= origin.x + rect.left * zoom &&
      point.x < origin.x + rect.right * zoom && point.y >= origin.y + rect.top * zoom &&
      point.y < origin.y + rect.bottom * zoom);
  }
  function finish(session, notify = true) {
    if (active !== session) return;
    clearInterval(hoverTimer);
    hoverTimer = null;
    active = null;
    if (notify && isAlive()) win.webContents.send('shell:menu-active', null);
  }
  function close(notify = true) {
    dismissedHeading = null;
    swallowingClick = false;
    const session = active;
    if (!session) return;
    finish(session, notify);
    if (isAlive()) session.menu.closePopup(win);
  }
  function nativeFinished(session) {
    if (active !== session) return;
    if (isAlive() && getCursorPoint) {
      const rect = headingAt(getCursorPoint(), session.rects, session.zoom);
      dismissedHeading = rect ? {rect, zoom: session.zoom} : null;
    }
    finish(session);
  }
  // Windows dismisses the popup before replaying the same press into its parent window.
  win.webContents.on('before-mouse-event', (event, input) => {
    if (input.type === 'mouseUp' && input.button === 'left' && swallowingClick) {
      swallowingClick = false;
      event.preventDefault();
      return;
    }
    if (input.type === 'mouseDown') {
      const heading = dismissedHeading;
      dismissedHeading = null;
      if (!heading || input.button !== 'left') return;
      const {rect, zoom} = heading;
      if (input.x >= rect.left * zoom && input.x < rect.right * zoom &&
          input.y >= rect.top * zoom && input.y < rect.bottom * zoom) {
        swallowingClick = true;
        event.preventDefault();
      }
    } else if (input.type === 'mouseMove' || input.type === 'mouseLeave') {
      dismissedHeading = null;
    }
  });
  win.webContents.on('before-input-event', () => { dismissedHeading = null; });
  win.on('blur', () => {
    dismissedHeading = null;
    swallowingClick = false;
  });
  win.on('closed', close);
  win.webContents.on('destroyed', () => close(false));
  win.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
    if (isMainFrame) close();
  });
  function show(item, index, x, y, rects) {
    close(false);
    const zoom = win.webContents.getZoomFactor();
    const session = {menu: item.submenu, index, rects, zoom};
    active = session;
    try {
      item.submenu.popup({window: win, x: Math.round(x * zoom), y: Math.round(y * zoom),
        callback: () => nativeFinished(session)});
      if (!isAlive()) { finish(session); return; }
      win.webContents.send('shell:menu-active', index);
      // Native popups capture mouse input. Sample at the timer minimum, with no hover dwell.
      let lastPoint;
      if (getCursorPoint && rects.length) hoverTimer = setInterval(() => {
        if (!isAlive()) { finish(session); return; }
        const point = getCursorPoint();
        if (lastPoint && point.x === lastPoint.x && point.y === lastPoint.y) return;
        lastPoint = point;
        const rect = headingAt(point, rects, zoom);
        if (!rect || rect.index === session.index) return;
        const next = getMenu()?.items[rect.index];
        if (!next?.submenu || next.enabled === false || next.visible === false) return;
        try {
          show(next, rect.index, rect.left, rect.bottom, rects);
        } catch (error) {
          log(`Could not switch application menu: ${error.message}`);
          if (isAlive()) win.webContents.send('shell:menu-error',
            'Could not switch the application menu. Please try again.');
        }
      }, 1);
    } catch (error) {
      finish(session);
      throw error;
    }
  }
  function initialMenu(event) {
    if (!isAlive() || !trustedThemeFrame(win, event.senderFrame, port)) {
      log('Rejected untrusted shell menu request.');
      return {error: 'Application menu is unavailable for this document.'};
    }
    return {items: menuSnapshot(getMenu())};
  }
  ipc.handle('shell:menu-list', initialMenu);
  ipc.on('shell:menu-initial', event => {
    event.returnValue = initialMenu(event);
  });
  ipc.handle('shell:menu-open', (event, value) => {
    if (!isAlive() || !trustedThemeFrame(win, event.senderFrame, port)) {
      log('Rejected untrusted shell menu action.');
      return {error: 'Application menu is unavailable for this document.'};
    }
    const item = Number.isSafeInteger(value?.index) ? getMenu()?.items[value.index] : null;
    if (!item || item.enabled === false || item.visible === false ||
        (value.toggle !== undefined && typeof value.toggle !== 'boolean') ||
        !Number.isFinite(value.x) || !Number.isFinite(value.y) ||
        value.x < 0 || value.y < 0 || value.x > 10000 || value.y > 10000) {
      return {error: 'This menu action is unavailable.'};
    }
    const rects = value.rects === undefined ? [] : value.rects;
    if (!Array.isArray(rects) || rects.length > getMenu().items.length ||
        rects.some(rect => !Number.isSafeInteger(rect?.index) ||
          !getMenu().items[rect.index]?.submenu ||
          ![rect.left, rect.right, rect.top, rect.bottom].every(coordinate =>
            Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 10000) ||
          rect.right <= rect.left || rect.bottom <= rect.top)) {
      log('Rejected invalid shell menu geometry.');
      return {error: 'This menu action is unavailable.'};
    }
    try {
      if (item.submenu && value.toggle && active) {
        close();
        return {success: true};
      }
      win.focus();
      if (item.submenu) {
        show(item, value.index, value.x, value.y, rects);
      } else if (typeof item.click === 'function') {
        close();
        item.click(item, win);
      }
      return {success: true};
    } catch (error) {
      log(`Could not open application menu: ${error.message}`);
      return {error: 'Could not open the application menu. Please try again.'};
    }
  });
}

module.exports = {menuSnapshot, attachShellMenu};
