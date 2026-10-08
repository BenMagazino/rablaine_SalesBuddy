# Milestone detail, checkpoint 53

## October 8 reading-width revision
- Standalone detail uses a centered 1344px root; preview consumers do not opt in.
- Live dark/light at 1559x1167: context and forecast reading regions fit.
- Evidence: `width-workflow-milestone-detail-{before,after,light-after}.png`.
- Before is a width-only reconstruction on the same live record, explicitly labelled.
- Revision is uncommitted and awaiting review; prior checkpoint approval is preserved.

- ID: MS-VIEW `/milestone/<int:id>`; canonical fragment FR-MS.
- Status: VERIFY, implemented and user-approved October 7; final reconciliation pending.
- Audited baseline: approved checkpoint 52 forms `4e57b1a6`.
- Approval: checkpoints 53-62 signed off together; approved effort about 75%.
  Implementation SHA is recorded in the page tracker's approved batch handoff.
- Existing checkpoint 12 body remains approved, not rebuilt by this checkpoint.

## Implementation and preserved contracts

- `milestone_view.html` opts into the native frame and persistent status footer.
- `partials/milestone_view_content.html` stays the single full/embedded body.
- Fixed title and original Open in MSX/Edit/Delete commands sit below ancestry.
- Details/linked work and forecasts own independent desktop reading scrolls.
- Standalone CSS is scoped; preview/inline consumers retain approved geometry.
- Status reports real linked-note/task counts, read state, drafts and pending saves.
- `ui-milestone-workflow.js` owns entry-local reading history for both regions.
- Back preserves unrelated history and restores each reading position.
- Same-tab links protect unsaved comments/nested editors with the existing dialog.
- Keep editing retains drafts; confirmed discard clears only this milestone's drafts.
- Pending writes block leaving; editing after Back re-arms navigation protection.
- Native cached POST fallback, async comments and source link destinations remain.
- Preserve all metadata conditions, relationships, owner/status/team semantics,
  notes/topics/order/counts, task category/due/HVA/note/MSX links and nested editors.
- Forecast rich tables are user-authored content, not sortable data tables.
- No new provider, fields, routes, model, dependency, autosave or controller framework.
- README, contextual detail help and changelog document the standalone behavior.

## Verification

- Python: 253 passed, 47 existing SQLAlchemy legacy warnings.
- Command: `venv\Scripts\python.exe -m pytest tests\test_ui_milestone_body.py tests\test_ui_milestone_preview.py tests\test_milestones.py tests\test_milestone_comments.py tests\test_milestone_tasks.py tests\test_breadcrumb_entities.py`
- Node: 61 passed, zero failed in the final combined run.
- Command: `node --test tests\js\forecast_comments.test.cjs tests\js\milestone_task.test.cjs tests\js\ui_dialog.test.cjs tests\js\ui_milestone_workflow.test.cjs tests\js\ui_record_dialog.test.cjs`
- `node --check` passes for workflow/help; editor diagnostics and `git diff --check` pass.
- Isolated tests cover metadata/links, native POSTs, exact remote payloads/failures,
  cached/fresh forecasts, preview lifecycle, history, guards and resumed Back editing.
- Live milestone 880 retains five notes, five tasks and five forecast comments.
- Fresh read succeeds; full page and native preview share the body without nested shell.
- Live Keep editing retains a throwaway comment; Delete defaults to Cancel, never posts.
- Real Edit drill-down/Back restores context 720px and forecasts 120px independently.
- Both themes at unchanged 1566x1174: footer ends at 1174px, no horizontal overflow.
- Inspected private session `files` images: `checkpoint-53-milestone-detail-before.png`,
  `checkpoint-53-milestone-detail-after.png`, `checkpoint-53-milestone-detail-light-after.png`,
  `checkpoint-53-milestone-detail-linked-work-after.png`.

## Safety, bookkeeping and review

- No manual refresh/sync, business mutation requests, submitted forms or remote writes.
- Normal detail loads update only milestone 880's `details_fetched_at`, `updated_at`
  and comment cache metadata; all 1,594 milestone IDs/counts and other columns remain.
- Five cached comment bodies are identical; fresh cache adds provider `displayName`.
- Existing shell Socket.IO handshake POSTs occur automatically, not business edits.
- Graphite dark/top reading restored; QA drafts/listeners/baseline removed.
- Protected drafts/design page, production and dev-server lifecycle remain untouched.
- Browser stability/RAF waits stall in the embedded host; native DOM activation and
  screenshots verify actual UI without request interception or business writes.
- Discord: accepted single generic readiness DM `1557265632574181407`, exit 0.
- Remaining gate: user morning approval. No concrete functional gap found in this scope.
