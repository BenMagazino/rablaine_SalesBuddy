# GLOBAL-HELP / GLOBAL-KEYS: native reference dialogs

- Status: DONE; technically verified and user-approved on October 2, 2026
- Checkpoint: 3, native dialog foundation and read-only help surfaces
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `1fbdd64`, approved header/navigation checkpoint
- Implementation revision: `160e2d9`
- Entry points: header help button, `?`, F1 from pages and existing dialogs
- Next action: continue customer pickers and record dialogs in separate checkpoints.
  This approved checkpoint is committed.

## Scope and original inventory

The keyboard reference has six common shortcut rows, a debug-only SalesIQ row
and a header close control. Contextual help has a route-dependent title/body,
header close control, footer close button and F1 hint. It toggles with F1 and
selects the first matching route, otherwise using fallback help.

All 46 route entries, their order, patterns, titles and original content are
preserved. A normalized content fingerprint checks the entire map and fallback,
ignoring presentation classes and tone attributes. Existing copy is not rewritten;
copy accuracy remains part of each host page's audit.

Both surfaces now use native `<dialog>` and app-owned styles/behavior. Help
tables, keycaps, legends and indicators no longer use Bootstrap utilities.
Bootstrap Icons remains the existing, separate icon dependency. Other global
dialogs, offcanvas panels and page bodies are not migrated by this checkpoint.

## Parity and interaction evidence

| ID | Original contract | New implementation / evidence | Result |
| --- | --- | --- | --- |
| HELP-01 | F1 works from pages, including typing in a form | Existing shell shortcut invokes the same PageHelp API; live form input test | PASS |
| HELP-02 | Route-specific titles, content and fallback remain available | All 46 entries and fallback match their original normalized fingerprint; live Dashboard/New Customer contexts | PASS |
| HELP-03 | F1 toggles help; both close controls work | Native toggle and declarative dismiss controls; Node and live checks | PASS |
| HELP-04 | Footer retains contextual-help instruction | Original F1 hint and Close button retained | PASS |
| KEYS-01 | Header button and `?` open/toggle shortcut help | Native trigger and shell toggle; original target ID retained | PASS |
| KEYS-02 | Common shortcut list and debug-only chat row remain accurate to baseline | Isolated rendering checks for debug on/off; no rows removed | PASS |
| KEYS-03 | Close, Escape and backdrop dismissal remain available | Header close and native Escape; both help dialogs explicitly opt into backdrop close | PASS |
| DIALOG-01 | Opening an overlay cannot strand a navigation menu | App-owned opening event closes the native menu; Node and live check | PASS |
| DIALOG-02 | Keyboard focus stays in the modal and returns to its opener | Native modal focus handling plus opener tracking; live Tab loop and form/picker return | PASS |
| DIALOG-03 | Escape closes only the top surface, not background Cancel | Captured Escape, stacked frame tracking; live form and legacy picker checks | PASS |
| DIALOG-04 | Long help remains readable without losing close controls | Bounded shell, fixed header/footer, focusable scrolling body; live PageDown and viewport bounds | PASS |
| DIALOG-05 | Existing Bootstrap dialogs remain usable during migration | F1 over the real quick-note picker confines focus and returns to its customer input | PASS |
| DIALOG-06 | Nested and repeated opens preserve context | Synchronous close bookkeeping, queued-close guard and opener handoff when underlying help is toggled closed | PASS |
| DIALOG-07 | Background shortcuts cannot submit a form through a help dialog | Local key-event scope; Ctrl+Enter/Ctrl+K checked on real New Customer form, no save/navigation | PASS |
| DIALOG-08 | Light/dark families remain legible and fit the desktop viewport | All eight variants measured live; text/legend/indicator contrast at least 5.63:1, footer in bounds | PASS |

## Shared API and policies

- `SBDialog.open(idOrDialog)`, `.close(idOrDialog, reason)` and `.toggle(idOrDialog)`.
- Targets must be native dialogs with `.sb-dialog`; invalid targets throw an
  explicit error. Repeated open is idempotent.
- `data-sb-dialog="dialogId"` opens a declared dialog.
  `data-sb-dialog-close` dismisses the nearest app-owned dialog.
- Backdrop dismissal defaults off. Both read-only help dialogs explicitly use
  `data-sb-backdrop-close="true"`, matching their previous behavior. A click must
  begin and end outside; dragging from inside does not dismiss.
- Escape defaults on; `data-sb-escape-close="false"` blocks it. Editable workflows
  must retain their own original policy when migrated, not inherit help's policy.
- Bubbling lifecycle events: `sb:dialog-opening`, `sb:dialog-opened`,
  `sb:dialog-closed`. Closed detail includes the reason. No animation-completion
  delay or Bootstrap event emulation is implied.
- Local widget keyboard handlers still work. Dialog key events do not bubble to
  unrelated page shortcuts; F1 and `?` remain available to the shared help handler.
- Root scrolling is locked only while an app-owned dialog is open. Existing
  Bootstrap body locks are not modified.
- This is not yet an editable-record adapter. Unsaved-edit confirmation, injected
  partial initialization/disposal and note/milestone lazy workflows must be
  implemented and verified in their own checkpoints.

## Verification and handoff

- 20 scoped pytest checks pass: navigation/help rendering and shell balance, Reports hub and two
  homepage rendering checks, using the isolated test database.
- 31 scoped Node checks pass across dialog/help, navigation/search and themes.
- Live checks include focus loops/return, keyboard scrolling, stacked help,
  legacy picker interoperability, background form protection and all eight themes.
- No note/customer was saved, preference posted or meeting refresh invoked.
  Temporary theme attributes were restored; no private screenshot is archived.
- The user tested F1, `/` and `?` on several live pages and approved this
  checkpoint for commit on October 2, 2026. GLOBAL-HELP and GLOBAL-KEYS are DONE;
  this does not approve their host page bodies or other global surfaces.
- The full GLOBAL-SHELL, editable pickers, record partials and homepage body remain
  in progress or TODO. No push, merge or deployment is authorized here.
