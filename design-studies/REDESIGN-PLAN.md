# Sales Buddy redesign: Electron window sizing and restoration

Status: planning only, October 1, 2026. No application code has changed.

## Required outcome

On relaunch, including after an update or shell rebuild, Sales Buddy should
respect the user's last-used window size, position, and maximized state. The
new design's default size is a first-launch fallback, not a size imposed on
every launch.

Graphite / Muted remains the selected default dark design. Milestone and note
content must use shared template partials that work on both full pages and
homepage modals. This document adds the native-window work to that upcoming
implementation; it does not implement the redesign.

The [Bootstrap dependency audit](BOOTSTRAP-AUDIT.md) records the app-wide styling,
behavior, icon, test, and instruction migration needed for full framework removal.

## Findings: why the window resets

| Surface | Current behavior | Evidence |
| --- | --- | --- |
| Window defaults | Every new window starts at **1440 x 920**, with a **900 x 600** minimum. There are no saved coordinates or maximized-state options. | [WINDOW_OPTS](../electron/main.js#L674) |
| Window creation | `openNewWindow()` always passes the same options to `new BrowserWindow()`, then shows it at `ready-to-show`. | [openNewWindow](../electron/main.js#L696) |
| Window lifecycle | No geometry read/write or move, resize, maximize, or unmaximize persistence handlers exist. | [configureWindow](../electron/main.js#L721) |
| Update restart | `runUpdate()` schedules a relaunch, then calls `app.exit(0)`. The replacement process creates a new window from the defaults. | [runUpdate](../electron/main.js#L377), [relaunchVisible](../electron/main.js#L138) |
| Shell rebuild | The shell hands off to a restaging helper and exits; the helper launches a new executable. Some failure paths also relaunch and call `app.exit(0)`. | [runRebuild](../electron/main.js#L455), [restaging launcher](../scripts/migrate-to-electron.ps1#L366) |
| Startup preferences | The existing bridge stores `start_minimized`, not window geometry. It controls launch visibility, not dimensions. | [shell preference bridge](../app/services/shell_prefs.py), [shouldBootHidden](../electron/main.js#L130) |
| Close to tray | Closing the last window hides the same native window. Reopening it within the same process retains its existing shape naturally. | [close handler](../electron/main.js#L787), [showWindow](../electron/main.js#L924) |
| Backend restart | Restart Backend reloads the existing windows without recreating the Electron shell. It is not the same as an update/relaunch. | [tray menu](../electron/main.js#L942) |

The reset is caused by fixed defaults plus missing persistence, not Bootstrap
or a calendar setting. Today, changing the default requires editing
`WINDOW_OPTS` in the Electron main process and rebuilding/restaging the shell.
There is no window-size preference or environment-variable override.

## Suggested first-launch size

Recommend **1600 x 1000 device-independent pixels (DIP), windowed**, on a
display whose usable work area can accommodate it. Center it on the launch
display. Do not maximize automatically on a roomy display.

Reasons:

- The approved calendar-first composition was reviewed at a browser viewport
  of [1587 x 1087](capture-manifest.json). A 1600-DIP-wide window is close to
  that horizontal composition, without treating a screenshot size as a contract.
- The [366-pixel attention dock](ui-theme-pairs-lab/navigation.css#L8) leaves
  roughly 1234 DIPs for the calendar before borders and padding.
- A 1000-DIP target height gives the calendar and attention panels useful
  vertical space, while allowing a non-maximized window on many desktop displays.

**Fit the display, not the screenshot.** For a fresh launch:

1. Use Electron `screen` after `app.whenReady()`.
2. Choose the display nearest the cursor for a fresh user launch; use the
   primary display as fallback.
3. Read its `workArea`, which excludes reserved desktop space such as the taskbar.
4. Cap each target dimension at the available work-area dimension minus
   a suggested 16-DIP margin on each side, then center within that work area.
5. Keep effective minimum dimensions no larger than the available work area.

The target is an **outer native window size**, not an exact web-content
resolution. The frame, native title/menu bars, and renderer zoom affect the
actual content viewport. Measure `getContentBounds()` and the rendered viewport
in the real shell when implementing.

DIP are not physical monitor pixels. A 1920 x 1080 display at 125% scaling has
approximately 1536 x 864 DIPs before taskbar reservations. Do not force a
1600 x 1000 window onto it or multiply saved geometry by the scale factor again.

Keep the existing 900 x 600 minimum provisionally, capped to the actual work
area. Do not increase it merely to make the mockup fit. Confirm the usable
minimum during the desktop layout audit.

## Proposed persistence and restoration

### Store state outside the installation

Use an Electron-owned, versioned JSON file, for example:

`path.join(app.getPath('userData'), 'window-state', 'state.json')`

This is available before Flask starts and is outside the git checkout and
restaged executable directory. Keep it separate from the backend-owned
`shell-prefs.json` bridge and from the customer database.

Keep the application identity stable across builds so the resolved `userData`
location does not change. Isolate development geometry from production geometry,
for example with a separate development state filename, without relocating
existing Chromium storage. Log the resolved state path when implementing.

Suggested state:

```json
{
  "version": 1,
  "normalBounds": { "x": 64, "y": 48, "width": 1600, "height": 1000 },
  "maximized": false
}
```

### Capture the right shape

- Save `getNormalBounds()`, not the maximized screen rectangle from `getBounds()`.
  Persist maximization separately so Restore returns to the user's windowed size.
- Capture move/resize changes with debounced disk writes, around 250 ms.
- Capture maximize/unmaximize transitions. Retain the last meaningful
  maximized flag while minimized rather than treating minimization as a new
  window shape.
- Save before close-to-tray, and flush pending writes before actual quit.
- **Flush explicitly before every update/rebuild exit.** Do not depend only on
  `before-quit`: Electron's `app.exit()` bypasses the normal quit lifecycle.
  Cover `relaunchVisible()`, direct rebuild handoff exits, and failure relaunches.
- Use a temporary file and rename for writes. Log malformed state and read/write
  failures with context. Missing state is normal on first launch; corrupt state
  gets a logged fallback, and failed writes retain the previous valid file.

### Restore before showing

1. Read and validate the version, Boolean maximized flag, and safe integer bounds.
   Width and height must be positive; negative coordinates are valid on
   multi-monitor desktops.
2. Find the current display best matching the saved rectangle. If the saved
   rectangle intersects no current display, relocate to the primary display.
3. Fit the saved bounds to that display's work area, correcting only what is
   necessary. Keep the title bar and resize edges accessible.
4. Create the window hidden at those normal bounds.
5. Apply saved maximization before showing it, avoiding a visible default-size
   flash. Verify native maximize/restore ordering in the actual Windows shell.
6. Start persistence after initial restoration so construction events do not
   overwrite the saved state prematurely.

Valid saved bounds take precedence over the new 1600 x 1000 default. Do not
recenter, resize, or unmaximize a valid saved window just because a new version
has a different preferred default.

Preserve the existing visibility rules: automatic startup may remain hidden
when `start_minimized` is enabled; explicit launches and user-initiated update
restarts still show the window. When booting hidden, restore geometry when the
first window is actually requested. Do not restore an OS-minimized state on an
explicit launch.

### Multiple windows and monitor changes

Sales Buddy supports multiple managed windows. For this scope, persist the
most recently focused app window's state for the next primary launch. Do not
let closing an unrelated background window or iterating windows during quit
overwrite that selection. Retain the selected state even if its window closes.
New additional windows can use a small, work-area-clamped cascade offset.

Reopening every window, restoring URLs, full-screen restoration, and restoring
Windows Snap groups are outside this item. Ordinary snapped geometry should
still reopen as a usable rectangle.

Handle disconnected monitors, changed DPI/work areas, and remote-desktop display
changes. Recheck visibility on display removal/metric changes, but do not
recenter a valid window unnecessarily.

## Desktop layout work that belongs in the redesign

The study currently has a
[760-pixel workspace minimum](ui-theme-pairs-lab/navigation.css#L16).
That can cause page overflow on shorter desktop viewports, especially after
Windows scaling and native chrome reduce the available content height.

Translate the design into a height-aware desktop layout rather than raising the
native minimum to hide overflow:

- Keep the calendar, panel headers/footers, and primary controls reachable.
- Preserve intentional internal scrolling for busy calendar days and attention lists.
- Keep wide modal bodies scrollable with headers/footers visible.
- Review compact desktop windows and scaled/maximized laptop work areas.
- Do not add mobile layouts, force an aspect ratio, or change the user's renderer
  zoom to make the design fit.

The recommended default is a starting point for native-shell validation, not a
claim that the current mockup has already been tested at every desktop window size.

## Implementation surfaces and acceptance checks

Primary changes belong in [electron/main.js](../electron/main.js): defaults,
creation, state capture, tray visibility, quit, update, and rebuild exits.
Extract pure validation/clamping helpers if useful. If a helper module is added,
include it in the explicit [Electron build file list](../electron/package.json).

Test geometry helpers without a live backend. Extend the relevant existing
[startup/relaunch tests](../tests/test_start_minimized.py) and
[Electron update tests](../tests/test_admin_update_electron.py) as appropriate,
then verify these native-shell scenarios:

| Scenario | Expected outcome |
| --- | --- |
| First launch with no state | Centered, windowed 1600 x 1000 target, fitted to the work area. |
| Resize/move, quit, launch | Previous size and position return. |
| Maximize, quit, launch, Restore | Maximized state returns; Restore uses the previous normal bounds. |
| Update or shell rebuild | Same shape returns, including maximization; pending writes are flushed. |
| Close last window to tray, reopen | Existing window returns without resetting geometry. |
| Login startup hidden, then tray Open | Visibility preference survives; saved geometry is restored on Open. |
| Explicit launch after minimization | Window is visible, with saved normal/maximized geometry. |
| Multiple windows, close background window | Selected last-focused geometry is not overwritten. |
| Unplug saved monitor or change scaling | Window is reachable on a current work area. Negative coordinates remain valid. |
| Malformed JSON or unwritable state directory | Diagnostic log and usable launch; no startup crash or false save claim. |
| Compact/scaled desktop viewport | Calendar, attention panels, and modal actions remain usable without forced zoom. |

This change is bundled into the executable. Ship it with a shell rebuild and
the project's `*Electron Shell Update* - ` changelog marker, subject to the
documented bootstrap exception. A plain backend update cannot replace the
already-bundled Electron main process.

## Electron API references

- [Normal window bounds](https://www.electronjs.org/docs/latest/api/base-window#wingetnormalbounds)
- [Display selection and change events](https://www.electronjs.org/docs/latest/api/screen)
- [Display work areas and DIP](https://www.electronjs.org/docs/latest/api/structures/display)
- [User-data configuration directory](https://www.electronjs.org/docs/latest/api/app#appgetpathname)
- [Immediate exit lifecycle](https://www.electronjs.org/docs/latest/api/app#appexitexitcode)
