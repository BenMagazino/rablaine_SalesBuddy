# Home note-preview lifecycle and shared quick actions

- Status: DONE for this bounded slice; technically verified and user-approved on October 2, 2026
- Checkpoint: 9
- Parent checkoffs: HOME, FR-NOTE and GLOBAL-SHELL remain BUILDING
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `dd44c58`, approved floating-sync/search-focus checkpoint
- Implementation tested: working tree based on `dd44c58`
- Implementation revision: `9545d18`, committed after user sign-off
- Next action: continue the independently reviewed [shared note body](NOTE-BODY.md).
  No push or merge is authorized by this checkpoint.

## Scope and original inventory

Replace only Home's Bootstrap note-preview host and loading lifecycle, plus the
quick action editor shared with the full note page. The preview was never wholly
read-only: notes with linked engagements already expose Create Action Item.
Preserve that workflow instead of dropping it during the overlay migration.

At checkpoint 9, the note's information/body layout deliberately retained its Bootstrap
implementation. [Checkpoint 11](NOTE-BODY.md) migrates that body separately.
This does not approve the full note page, fragment or homepage.
Full-page Edit, Delete and Share controls remain; preview responses still omit
them. The full-page delete confirmation is not migrated here.

Preserved interfaces:

- Calendar entries call `openHomeNoteDetail(noteId, customerName)`.
- GET `/api/note/<id>/detail` returns the shared note fragment.
- Full Page navigates to `/note/<id>`.
- POST `/engagement/<id>/action-items` accepts title, optional due date and note ID.
  This creates a local action item, not an MSX task.
- Date/local call time, customer/TPID, conditional seller, territory, topics,
  partners, attendees, engagements, projects, milestones, opportunities, linked
  MSX tasks, rich content, images and creation/update metadata remain in the partial.

## Implementation and intentional behavior changes

- Native top-layer dialog, pinned 48px from the top, scrolling body, persistent
  header/Full Page and native focus/keyboard lifecycle.
- Visible read failures with Retry; validate HTTP, HTML response and note identity.
- Abort obsolete reads and reject late responses after close or record replacement.
- Inject server-rendered markup without executing arbitrary fragment scripts.
- Scoped note editor mounting/disposal, native details/form disclosure and Enter submission.
- Preserve the POST contract, keep engagement/due selections, clear only the title
  on success. Failures retain the draft and show/log an error.
- Prevent duplicate submits; disable fields during saving. Closing, record switching
  and same-tab links wait for the existing save instead of cancelling it.
- Unsaved title, engagement or due-date changes prompt Keep editing / Discard draft.
  Escape or backdrop dismissal of the confirmation keeps the original draft.
- Discard releases the editor before navigation, avoiding a second unload warning.
  Modified, new-window, download and non-HTTP links retain native behavior.
- Connected dirty/busy editors warn on page unload, including the full note page.
- Reusable timestamp rendering applies the original page formats to injected notes
  too. Naive SQLite display timestamps are treated as UTC; local `call_date` is
  unchanged. Explicit positive/negative offsets are retained, invalid markers warn.
- The dialog foundation adds cancellable `sb:dialog-before-close`, without changing
  unguarded dialogs. Application dismissals continue through `SBDialog.close`.

## Verification

- 99 scoped Node checks across the shared `ui_*.test.cjs` suites pass.
- 52 isolated Python checks pass:
  `tests/test_ui_note_preview.py` and `tests/test_ui_navigation.py`.
- Editor diagnostics show no errors in changed controllers or the new Python test.
- `git diff --check` passes.
- Existing SQLAlchemy `Query.get()` deprecation warnings come from the unchanged
  action-item endpoint; no dependency or backend mutation logic changes.

| Contract | Evidence | Result |
| --- | --- | --- |
| Actual calendar entry opens the native note | Live April calendar, 13 existing note entries, real entry click and returned identity | PASS |
| Note metadata, rich content and image URLs remain | Isolated fragment/full-page contracts and existing live development notes | PASS |
| Quick actions write the original endpoint/payload | Isolated real POST creates one correctly linked item with due date; invalid title/date create none | PASS |
| Enter works on the full note page | Live Enter submission with exact write endpoint intercepted; edit/delete remain available | PASS |
| Dirty Escape, X, backdrop and links protect the draft | Native browser interactions; Keep retains fields, Discard closes/navigates with zero extra browser prompts | PASS |
| A pending save cannot close/navigate or duplicate writes | Node tests and delayed intercepted live POST; exactly one request, clean close after success | PASS |
| Dirty record switching waits for approval | Node lifecycle tests and live switch between existing records | PASS |
| Failed loads Retry and stale replies are ignored | HTTP/type/identity/network and abort/race Node checks; live 503 then real-data Retry | PASS |
| Nested image viewer preserves parent and focus | Existing portrait image opens; Escape closes image only and returns focus to its image control | PASS |
| Created/Updated render in injected fragments | Live populated timestamps and timestamp format/offset/re-render tests | PASS |
| Eight themes fit the existing desktop viewport | 48px top anchor, no horizontal dialog overflow, all controls within viewport; measured normal text/control contrast at least 6.49:1 | PASS |
| Previously approved globals still behave | Shared picker/dialog/image/navigation/status/theme suites | PASS |

All browser work used the existing development server/database at
`http://127.0.0.1:5000`. Write demonstrations intercepted only the exact action-item
POST and created no live business records. Interceptions, temporary drafts,
calendar storage and theme attributes were cleaned up/restored. The user's
separate New Note tab was not touched. No viewport resizing or production testing.

## User audit

1. Review the preview's frame, top anchor, scrolling and Full Page control.
2. Expand Create Action Item and review the compact editor.
3. Type a throwaway draft, close the preview and try Keep editing / Discard draft.
4. Open an existing image and close it back to the preview.

The owned development tab is left on a clean existing note preview with the editor
expanded. No mock endpoints remain: pressing Add Action Item now really saves.

## Deferred work and stopping point

Shared milestone previews include team changes, nested engagement creation,
MSX task creation, detail retries and comments across multiple hosts. Migrate
that lifecycle coherently in a subsequent checkpoint, not by stripping controls.
Full note/milestone body styling and full Home/calendar parity are separate too,
including create-note-on-day and manual daily meeting refresh.

The user approved the image return, quick-action draft protections and preview
behavior, with the intentionally deferred body styling clarified. This checkpoint
does not advance the DONE counts: pages 0/90, shared helpers 0/24, globals 5/17.
Carry its commit SHA into the next handoff. Next work is shared milestone-preview
lifecycle and nested editors across their existing hosts.
