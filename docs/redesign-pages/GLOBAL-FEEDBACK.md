# GLOBAL-SHELL: shared flash notification slice

- Status: DONE; technically verified and user-approved on October 2, 2026
- Checkpoint: 6, shared Flask flash messages
- Parent checkoff: GLOBAL-SHELL remains BUILDING
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `f1916e8`, approved image-viewer checkpoint
- Implementation revision: `1e7b16c`
- Next action: continue with [persistent status strip evidence](GLOBAL-STATUS.md).

## Scope and original inventory

There is one shared `get_flashed_messages(with_categories=true)` renderer in the
base template. It displays messages in their supplied order as alert regions,
escapes ordinary strings and provides a Bootstrap dismiss button per message.
Flask's existing session/redirect flow consumes messages on the next rendered
request. No application consumers of Bootstrap alert lifecycle events or
programmatic Alert APIs were found.

Replace only this renderer's styling and dismissal behavior with app-owned
notices. Preserve its spacing wrapper even when empty, every message's full
text and category, ordering, escaping and request-scoped consumption.
Backend publishers are unchanged. All observed publisher categories are
success, warning, danger, error and info.

Page-specific alerts, validation panels, FY/auth/sync banners and onboarding
messages remain separate surfaces. This does not approve the revenue dashboard
or any other hosted page body.

## Parity and interaction evidence

| ID | Original contract | Implementation / evidence | Result |
| --- | --- | --- | --- |
| FLASH-01 | Every supplied message and category remains available in order | Same Flask renderer and payloads; isolated ordered/full-text checks | PASS |
| FLASH-02 | Plain strings remain escaped, including customer names and error text | Same Jinja interpolation; isolated script/angle-bracket/ampersand checks | PASS |
| FLASH-03 | Each message can be dismissed independently | Native button and delegated removal; Node nested-icon/multiple-message checks and live mouse dismissal | PASS |
| FLASH-04 | Alert semantics and an accessible close control remain | Original alert role retained; explicit type label, decorative severity icon and named native button | PASS |
| FLASH-05 | Messages stay tied to the existing request/redirect flow | Session-consumption regression: first request shows message, next request does not | PASS |
| FLASH-06 | Empty message state does not manufacture content or disturb shared spacing | Empty wrapper retained, no notice rendered; isolated rendering check | PASS |
| FLASH-07 | Success, warning, error/danger and information remain distinguishable | Category/icon/label checks; semantic theme tokens; `error` explicitly shares danger styling | PASS |
| FLASH-08 | Default and custom Flask categories do not look like successful operations | Original category retained, explicit neutral treatment and Notice label; isolated checks | PASS |
| FLASH-09 | Keyboard dismissal remains usable without dropping focus | Native Enter/Space; next/previous notice close control or focusable main landmark; Node and live checks | PASS |
| FLASH-10 | Dismissal does not steal unrelated field/dialog focus or scroll the page | Focus changes only when inside removed notice, with preventScroll; Node and live scroll/Tab checks | PASS |
| FLASH-11 | Long content remains readable rather than clipped | Wrapping body, no truncation/nowrap; full-text rendering and scoped CSS checks | PASS |
| FLASH-12 | Theme pairs keep text and severity cues readable | Eight live variants, no horizontal overflow; text/control contrast at least 7.31:1, all five semantic indicator colors at least 6.13:1 | PASS |

## Intentional improvements for approval

- Use quiet connected-pane styling instead of broad Bootstrap alert fills.
- Give the existing `error` category explicit error styling. Bootstrap did not
  define an `alert-error` appearance.
- Add type-specific accessible labels without changing the message text.
- Preserve keyboard focus after dismissal. Once the last notice is dismissed,
  focus moves to the main landmark without scrolling; Tab proceeds into the
  page. Its visible focus outline uses the approved accent color.
- Dismiss immediately rather than waiting on Bootstrap fade behavior.

## Verification and handoff

- 60 scoped Node checks pass across shared notifications and the previously
  approved image/picker/dialog/navigation/theme components.
- 30 scoped Python checks pass across shared shell rendering, flash categories,
  full text/escaping, session consumption and previous dialog/launcher contracts.
  Tests use the isolated database.
- Live verification uses an existing missing-customer revenue redirect to produce
  the application's real "Customer not found." message. No fake records or demo
  server are created, and no business records are saved.
- Mouse, Enter and Space dismissal, page focus, next Tab and scroll preservation
  are verified live. Multiple-message and programmatic dismissal use Node checks.
- Escape is not a notification-dismiss shortcut, matching the original alert
  behavior. Keyboard dismissal means focusing X and pressing Enter or Space.
  The user confirmed this distinction and signed off on October 2, 2026.
- Temporary theme attributes are restored. No preferences are posted and no
  viewport is resized. No private screenshots are committed.
- Shared flashes no longer use Bootstrap classes, data attributes, alert APIs or
  events. Other alert surfaces and Bootstrap Icons remain intentionally.
- This notification slice is approved. GLOBAL-SHELL remains BUILDING. Its full page
  frame, persistent status banners and theme persistence still need independent
  verification. No push, merge or deployment is authorized.
