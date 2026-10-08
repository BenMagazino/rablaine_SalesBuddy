# PROJ-FORM: manual New/Edit Project forms

## October 8 reading-width revision
- Shared New/Edit root uses centered 1152px; existing fields and pinned commands remain.
- Both variants verified live dark/light at 1559x1167 without horizontal overflow.
- Evidence: `width-workflow-project-{form,edit}-{before,after,light-after}.png`.
- Revision is uncommitted and awaiting review; prior checkpoint approval is preserved.

- Status: VERIFY, checkpoint 58, user-approved October 7.
- Audited baseline: `4e57b1a6` plus checkpoints 53-57.
- Approved batch effort: about 75%; implementation SHA is in the page tracker.
  Strict DONE counters await final reconciliation.
- Scope: `/project/new`, `/project/<id>/edit`, `project_form.html`,
  native branch of `_project_form_fields.html`, and manual POST failures.
- Existing note-form flyout keeps its compact IDs, fields and original controller.
- Project detail/body and inline task workflows are unchanged, checkpoint 59 next.

## Audited and preserved contract

- Exact POST names: `title`, `description`, `project_type`, `due_date`,
  repeated `note_ids`; `status` exists only when editing.
- Title is the only native required field. Description stays escaped plain text,
  not HTML editing; no rich-text toolbar, owner, seller or role chooser existed.
- Types stay General, Training, Achievement in that order; `copilot_saved`
  remains excluded, including the original first-option fallback for hidden/custom types.
- Edit statuses stay Active, On Hold, Completed. Creation retains model Active.
- Creation trims title/description/type, defaults type to general, ignores invalid dates.
- Edit retains original blank-title fallback, optional description-to-None,
  empty-date clearing, invalid-date retention and existing status/type fallback.
- New notes: customer-free and unattached. Edit additionally includes this project's
  linked general notes, prechecked. Descending call date, stripped/truncated labels unchanged.
- Successful create/update redirects stay `/project/<id>` with original success messages.
- Cancel stays `/engagements` for New and `/project/<id>` for Edit; canonical crumbs unchanged.
- Missing records remain 404. No new business validation or permission scope.

## Implementation and verification

- Native frame, owned reading scroll and persistent Save/Cancel/footer reuse shared
  tokens, dialogs and the existing manual milestone form controller, not a duplicate.
- Entry-keyed history preserves raw fields, checkbox IDs, form and note-list scroll;
  no autosave/localStorage framework. Navigation/Back guards and pending POST lock retained.
- Failed create required-title checks now render 400 with the original error and input;
  transaction failures rollback, log, flash and render retained input with 500.
- No successful-looking fallback, disabled POST fields or changed payload names.
- Scoped pytest: `python -m pytest tests\test_ui_project_form.py tests\test_projects.py
  tests\test_ui_milestone_form.py tests\test_breadcrumb_entities.py`: 164 passed.
- Final project-only rerun of the first two pytest files: 27 passed.
- Node: `node --test tests\js\ui_project_form.test.cjs
  tests\js\ui_milestone_form.test.cjs`: 17 passed, including milestone regression.
- `node --check`, Python/Jinja syntax, editor diagnostics and `git diff --check` pass;
  Pylance reports only two existing unused-import hints in the routes file.
- Live Edit parity: 14 named controls, 9 notes, 3 checked; New: 10 controls, 6 notes,
  no status or checked notes. Raw values, options, defaults and required semantics match.
- Real Edit -> project -> Back restores unsubmitted text/type/status/date/notes and scroll.
- New/Edit discard guards retain input on Keep editing; all QA entries cleared.
- Both modes checked in Graphite dark/light at preserved 1566x1174; persistent footer
  and page height verified; no saved theme preferences or business POSTs.

## Evidence and boundaries

- Private images: `checkpoint-58-project-form-new-before.png`, `-new-after.png`,
  `checkpoint-58-project-form-edit-before.png`, `-edit-after.png`, in session `files`.
- Business fingerprints: projects, note associations, notes and action items unchanged.
- No MSX reads/cache bookkeeping needed. Ordinary shell view telemetry may run.
- Existing shell Socket.IO staging connection reported `ERR_NO_BUFFER_SPACE`; unrelated.
- One generic authorized Discord DM accepted: message `1557288608765845606`.
