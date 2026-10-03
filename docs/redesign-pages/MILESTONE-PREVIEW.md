# Shared milestone-preview lifecycle and nested editors

- Status: DONE for this bounded slice; technically verified and user-approved
- Checkpoint: 10
- Parent checkoffs: FR-MS and GLOBAL-SHELL remain BUILDING; host pages are not DONE
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `9545d18`, approved note-preview checkpoint
- Implementation tested: working tree based on `9545d18`
- Implementation revision: `ce61a1d`, committed after user sign-off
- User sign-off: October 2, 2026, after staged live milestone/editor review
- Next action: continue the independently reviewed [shared note body](NOTE-BODY.md).
  No push, merge or deployment is authorized.

## Scope and inventory

One native shared preview replaces seven duplicated host implementations: Home,
Action Items, seller compact milestones and embedded tracker, the full milestone
tracker, MSX Workspace and Connect Impact. Original launcher names/signatures
remain. MSX Workspace's string IDs are normalized before record validation.

Preserve title/status/MSX destinations where supplied by the host, Full Page,
all existing milestone information/navigation, cached details/comments, task
and associated-note lists, team join/leave, and nested engagement/task creation.
Connect Impact retains its generic-title launch and gains the common Full Page action.

The main content cards, badges and forecast-comment presentation intentionally
retain their current styling. Full milestone/host-page redesign is not approved
by this checkpoint. Seller's outer tracker dialog is still Bootstrap and retains
its original hide/show handoff, now listening only to the native preview's own
close event, not bubbling nested-editor dismissals.

## Lifecycle and intentional changes

- Shared `SBRecordDialog` owns HTTP/type/identity checks, Retry, obsolete-read
  cancellation, close/reopen protection and focus. Defaults preserve the approved
  note controller; milestone text/state/header hooks are configurable.
- `SBMilestoneWorkflow` scopes element lookup and handlers to each partial.
  Duplicate IDs in different roots cannot redirect callbacks to another record.
- Only the server partial's explicitly labelled inline milestone initializer is
  activated. Unrelated fragment scripts and external script tags are not executed.
  The shared forecast-comments helper remains reused, not rewritten/duplicated.
- Owned GET controllers and retry timers are disposed on close/replacement.
  POST/PUT/DELETE operations are never aborted by UI cleanup. Disposed task results
  cannot reload an unrelated/newer page.
- Concurrent writes are rejected; edited fields are disabled during saving and
  restored afterward. Busy guards remain through save-result handling.
- Native engagement/task dialogs stay nested instead of being reparented into
  the body. Top-layer focus, Escape and backdrop behavior remain local.
- Dirty nested forms and comment edits warn before closing/navigation/unload.
  Keep editing retains fields; Discard resets the child without closing its parent.
- Success-triggered task refresh protects any unrelated unsaved comment draft.
  A successful/remote-only task cannot be resubmitted while that editor stays active.
- Retain every engagement story/status/ACR/target field and linked milestone ID.
  Inline success updates engagement navigation without losing the parent preview.
- Preserve task subject/category/description, duration 60, due-date payload and
  `created_in_msx` duplicate prevention. Native form submission supports Enter.
- Tomorrow defaults to the user's local calendar date rather than UTC rollover.
  Category Retry preserves a valid current selection and shows read failures.
- Refresh details/comments is now explicit. Cached content remains visible on
  failure, and successful refresh clears stale error panels.

## Verification

- 113 scoped Node checks pass across shared UI suites and the actual task script.
- 142 scoped isolated Python checks pass across milestone, task, preview, note and
  shared-shell tests. Existing `Query.get()` deprecation warnings remain.
- Editor diagnostics report no errors in changed/new controllers and preview tests.
- No dependency, model, migration or backend write-handler changes.

| Original/required contract | Evidence | Result |
| --- | --- | --- |
| All original hosts route through the shared preview | Six routed host checks, seller parent-handoff rendering and original-launcher source contracts | PASS |
| A real Home milestone opens the native preview | Existing Home card click with valid fragment identity | PASS |
| No-customer/no-MSX and linked/unlinked branches remain valid | Isolated rendering and existing milestone/task tests | PASS |
| Nested draft confirmation does not close parent | Live engagement draft, Keep editing, Discard and task-open checks; Node guards | PASS |
| Pending saves block close and duplicate writes | Scoped fetch tests and delayed intercepted live task POST | PASS |
| Remote-only task creation keeps duplicate warning/disabled submit | Existing task error harness, backend isolated error cases and intercepted live partial-success response | PASS |
| Engagement failure retains draft; success links milestone | Live exact-endpoint interception, failed attempt then success, preserved story and milestone ID | PASS |
| Seller tracker returns only after parent preview closes | Live tracker row launch, nested task Escape, then parent Escape and tracker restoration | PASS |
| HTTP failures recover with Retry | Live 503 fragment read followed by real-data Retry; shared record failure/race tests | PASS |
| Disposed reads/timers stay local and writes are not cancelled | Scoped Node isolation/disposal tests; live aborted detail read on close | PASS |
| Comment drafts survive unrelated successful task refresh | Scoped lifecycle test, cached/fresh comments and edit-baseline handling | PASS |
| Eight theme variants fit the desktop editor | 48px top anchor, no horizontal overflow, editor within viewport; measured normal control/text contrast at least 7.31:1 | PASS |
| Approved note/shared primitives remain intact | Full shared UI and note/shell regression selections | PASS |

All browser checks use the existing development server/database at
`http://127.0.0.1:5000`. Task and engagement demonstrations intercept only their
exact POST endpoints; no live engagement, task, team membership or comment writes
are made. Real read calls retain their existing server-side cache refresh behavior.
Mocks, fake inline success content, drafts and theme attributes are cleaned up.
No viewport resizing; the user's separate New Note tab is untouched.

## User audit and stopping point

The owned Home tab is staged with a clean nested Create engagement dialog over
the real milestone preview. Review its layout, enter a throwaway story draft,
and try Escape / Keep editing / Discard. After returning to the milestone, open
the task editor and close it back to the preview.

No mock endpoints remain. Create engagement, Create Task in MSX, team actions and
Post comment are real writes now; review dismissal/drafts without submitting unless
you actually intend to create or change records.

User approved this slice. Main note/milestone content styling, full
homepage/calendar parity, other global dialogs and final product reconciliation
remain later checkpoints. DONE counts stay pages 0/90, shared helpers 0/24,
globals 5/17. Carry the eventual checkpoint SHA into the next handoff.
