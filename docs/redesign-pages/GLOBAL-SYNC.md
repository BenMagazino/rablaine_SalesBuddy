# GLOBAL-SHELL: floating meeting-sync status slice

- Status: DONE; technically verified and user-approved on October 2, 2026
- Checkpoint: 8, floating meeting-sync status
- Parent checkoff: GLOBAL-SHELL remains BUILDING
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `f6e9163`, approved persistent-status checkpoint
- Implementation tested: working tree based on `f6e9163`
- Implementation revision: `dd44c58`, committed after user sign-off
- Next action: continue with the independently audited shared record-overlay work.

## Scope and original inventory

Replace the shared floating meeting-sync card's Bootstrap appearance and inline
controller with an app-owned workbench region and controller. Preserve the four
original host/header/date/progress IDs and the `window.SyncStatus` API.

The homepage's running-day dots call `SyncStatus.check()`. No other application
callers of this shared API were found. The note form's separate
`meetingStatusCard` is not this component and remains part of NOTE-NEW/NOTE-EDIT.
The old shared-controller comment incorrectly implied that the note form
already used this card.

Original behavior:

- Hidden by default, never proactively checks or shows.
- `check()` reads `/api/meetings/sync-status` and opens only a running sync.
- `forceShow()` can surface known progress or its default "today" state.
- Date and `Day X of Y` come from `current_date` and `aura_dates`.
- Polls every 3000ms while the UI tracks a running sync.
- The X hides only the card. Polling and the backend job continue.
- Public `hide()` stops UI polling, never the backend job.
- Completion hides, stops polling and optionally calls `checkTodayStatus()`.
  The calendar retains ownership of surgical per-day refresh.
- Header dragging saves `left`/`top` under `syncStatusCardPos`.
- Status-read and position-storage failures were silently swallowed.

This checkpoint does not change backend sync, start a sync, rebuild the
calendar, migrate the separate note-form card, or approve either host page.

## Parity and interaction evidence

| ID | Original contract | Implementation / evidence | Result |
| --- | --- | --- | --- |
| SYNC-01 | Initial state stays dormant until explicitly requested | Native `hidden`, same API and no startup fetch/timer; Node and live idle-state checks | PASS |
| SYNC-02 | Date and day counter reflect the current snapshot | Same labels/IDs; Node first/second day and live controlled status snapshots | PASS |
| SYNC-03 | Only running status is surfaced by check | Same read-only endpoint; inactive check stays hidden; Node and isolated endpoint contract | PASS |
| SYNC-04 | Poll interval and completion ownership stay unchanged | 3000ms polling, stop on inactive state, `checkTodayStatus()` only; no calendar rebuild or backend stop request | PASS |
| SYNC-05 | X hides without stopping sync or UI polling | Separate visual concealment; hidden polls update without reopening; Node and live Space dismissal | PASS |
| SYNC-06 | Public hide stops UI polling without cancelling backend work | Clears UI interval only; Node late-response/new-session guards | PASS |
| SYNC-07 | Dragging and saved position survive close/reopen | Existing storage key and coordinates; Node limits/storage tests and live drag/reopen | PASS |
| SYNC-08 | Card remains non-blocking | Modeless labelled region, no autofocus/inert background; live page focus stays on its original control | PASS |
| SYNC-09 | Native hide/retry controls work with keyboard and preserve focus | Space Hide, Enter Retry, return to opener or main, no unrelated focus theft; Node and live checks | PASS |
| SYNC-10 | Failed reads are not presented as completion | HTTP/JSON/schema/network failures are logged and show explicit Retry with automatic recovery | PASS |
| SYNC-11 | Late/overlapping reads cannot resurrect dismissed feedback or race newer state | Generation guards and shared in-flight poll reads; Node pending-dismiss/reopen/dedup checks | PASS |
| SYNC-12 | Themes and placement remain readable at the desktop viewport | Eight live variants, full card inside bounds; minimum measured text/control/warning contrast 5.74:1 | PASS |

## Intentional improvements for approval

- Quiet square workbench frame replaces the bright Bootstrap card/header.
- Failed status reads show "Unable to check meeting sync" and Retry rather than
  silently retaining stale progress. They do not claim the backend job failed.
  Existing automatic polling continues; Retry performs only a status GET.
- Hide returns keyboard focus to a visible, enabled original control, otherwise
  the main landmark. Background updates do not steal unrelated focus.
- Saved/dragged positions keep the whole card visible rather than permitting
  most of it to remain offscreen. Window resize/content changes also clamp it.
- Missing snapshot information clears obsolete day/date display rather than
  carrying a previous run's counter into the next run.
- Corrupt/unavailable position storage is logged; feedback remains usable.
- The activity spinner is app-owned and respects reduced-motion preferences.

## Verification and handoff

- 82 scoped Node checks pass across the floating card and all previously migrated
  theme/navigation/dialog/picker/image/notification/status components.
- 44 scoped Python checks pass: shared shell rendering and the existing
  meeting-sync status endpoint contract. Tests use the isolated database.
- Live development status was idle before verification. Exact status GET
  interception exercises progress, read failure, keyboard Retry and completion.
  No real sync, WorkIQ call, data write or cancellation is triggered.
- Live checks cover dragging, stored-position reopen, Space Hide, Enter Retry,
  non-blocking page focus, automatic completion hide and eight theme variants.
- Status interception, temporary themes and saved card coordinates are restored.
  No viewport resize, sample database/demo server or private screenshot commit.
- Controller assets load after the host, at the same point as the former inline
  controller. Existing homepage launchers remain unchanged.
- During review, the user reported duplicate header-search focus indicators.
  Live inspection confirmed the generic header focus rule overrode the input's
  outline reset. A scoped focus-visible override retains the outer field border
  and removes only the inner input outline, with a regression check.
  The corrected single indicator was verified live with keyboard focus.
- The user approved the floating card and corrected search focus for commit on
  October 2, 2026. Review interception, card position and stylesheet URL were
  restored after approval. No real sync was started.
- Full GLOBAL-SHELL stays BUILDING; globals remain 5 / 17 DONE. Shared record
  overlays, full page frame, onboarding and theme persistence remain separate.
  No push, merge or deployment is authorized.
