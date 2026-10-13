// Only the local app and shell-owned recovery document may update window chrome.
const TITLE_BAR_HEIGHT = 32;

function validTheme(theme) {
  return theme && ['light', 'dark'].includes(theme.mode) &&
    ['graphite', 'midnight', 'harbor', 'carbon'].includes(theme.family) &&
    ['color', 'symbolColor', 'backgroundColor'].every(
      key => typeof theme[key] === 'string' && /^#[0-9a-f]{6}$/i.test(theme[key])
    );
}

function trustedThemeFrame(win, frame, port) {
  if (!frame || frame !== win.webContents.mainFrame) return false;
  if (frame.url === win._sbStatusUrl && frame.url.startsWith('data:text/html')) return true;
  try {
    const url = new URL(frame.url);
    return url.protocol === 'http:' && !url.username && !url.password &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      url.port === String(port);
  } catch {
    return false;
  }
}

function readShellTheme(file, fs, log) {
  try {
    const theme = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!validTheme(theme)) throw new Error('Invalid saved shell theme.');
    return theme;
  } catch (error) {
    if (error.code !== 'ENOENT') log(`Could not read saved shell theme: ${error.message}`);
    return null;
  }
}

function attachShellTheme(win, port, log, onApplied = () => {}) {
  win.webContents.ipc.on('shell:theme', (event, theme) => {
    if (win.isDestroyed()) return;
    if (!trustedThemeFrame(win, event.senderFrame, port) || !validTheme(theme)) {
      log('Rejected untrusted or invalid shell theme message.');
      return;
    }
    try {
      win.setTitleBarOverlay({
        color: theme.color, symbolColor: theme.symbolColor, height: TITLE_BAR_HEIGHT,
      });
      win.setBackgroundColor(theme.backgroundColor);
      win._sbTheme = {mode: theme.mode, family: theme.family};
      onApplied(theme);
    } catch (error) {
      log(`Could not apply shell theme: ${error.message}`);
    }
  });
}

module.exports = {
  TITLE_BAR_HEIGHT, validTheme, trustedThemeFrame, attachShellTheme, readShellTheme,
};
