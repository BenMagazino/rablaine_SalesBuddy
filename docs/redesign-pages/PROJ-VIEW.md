# PROJ-VIEW - Internal project dossier

## October 8 reading-width revision
- Standalone detail uses centered 1344px for the paired task/note reading areas.
- Remove the dossier's 1100px inner clamp so the real work area gains the room.
- Task/note panes use the shared surface background; inline consumers stay stacked.
- Live dark/light at 1559x1167: task/note reading and bottom task entry remain usable.
- Evidence: `width-workflow-project-detail-{before,after,light-after}.png`.
- Revision is uncommitted and awaiting review; prior checkpoint approval is preserved.
- Consistency evidence: `consistency-project-detail-{before,after,light-after}.png`.

Checkpoint 59, October 7, 2026: VERIFY, user-approved, final reconciliation pending.
Audited baseline: `4e57b1a6` plus checkpoints 53-58. Approved batch effort: about 75%.
Implementation SHA is recorded in the page tracker's approved batch handoff.
## Scope and baseline parity
- `/project/<id>` and `/api/project/<id>/detail` retain the complete shared body.
- Native frame/footer, persistent Edit/Delete/Back and manual task-entry commands.
- One owned dossier reading region; inline content does not copy the page shell.
- Preserve title, plain-text description, type, status, due/overdue and created date.
- Preserve every task in relationship order, completed/high-priority meaning and dates.
- Preserve linked-note counts, newest-first ordering, labels and actual destinations.
- New note still passes `project_id`; Edit/Delete retain their original URLs/methods.
- Task preview retains rich description, priority/contact/date/completion, source,
  source URL, related note/engagement/project links and saved Copilot operations.
- No original dossier table/export/discussion/role control exists or was removed.
- Initiative Tracker's talking points/history, timestamps, ordering, search, U2C
  eligibility, raw-value column sorts and work-source behavior remain unchanged.
- Project forms completed in checkpoint 58 remain intact; no model/provider rewrite.

## Controllers and all consumers
- `ui-project-detail.js` mounts once per shared root, with local task/discard dialogs.
- Quick-add keeps `{title}` plus optional `due_date`, POST and `{success, id}`.
- Pending writes prevent duplicate saves/navigation; controls lock only during saves.
- HTTP/network/JSON/invalid-success failures retain both inputs and show Retry Add.
- Server commit failure rolls back, logs the project ID and returns explicit JSON 500.
- Reuse `SBActionItemDialog`: default Home/action hub/engagement/note behavior retained.
- Scoped mount adds disposal, dirty/busy access and the existing post-change reload.
- Native task/discard dialogs keep Initiative Tracker's native parent in place.
- Parent close/replacement/Full Page guards drafts and pending writes; disposal aborts
  stale task reads and removes global guards. Reopening uses a fresh scoped body.
- Full-page history validates identity/raw scroll offsets and retains parent history.
- No Bootstrap task-parent transition, duplicated handler exports or second sorter.

## Exact scoped validation
```powershell
& C:\dev\SalesBuddy\venv\Scripts\Activate.ps1
& C:\dev\SalesBuddy\venv\Scripts\python.exe -m pytest tests\test_ui_project_detail.py tests\test_projects.py tests\test_initiative_projects.py tests\test_initiative_project_migration.py tests\test_ui_project_form.py tests\test_manager_one_on_one.py tests\test_ui_one_on_one_workspace.py tests\test_ui_action_items.py tests\test_ui_engagement_detail.py tests\test_breadcrumb_entities.py
node --test tests\js\ui_project_detail.test.cjs tests\js\ui_action_item_dialog.test.cjs tests\js\manager_one_on_one.test.cjs tests\js\ui_record_dialog.test.cjs tests\js\ui_engagement_detail.test.cjs tests\js\ui_dialog.test.cjs | Select-Object -Last 12; exit $LASTEXITCODE
```
- Results: 271 Python passed (49 existing ORM warnings); 86 JavaScript passed.
- Four `node --check` checks, two Python syntax checks and scoped diagnostics pass.
- `git diff --check` passes; no commits, staging, dependency changes or migrations.

## Real live evidence, safety and remaining review gaps
- Real projects 3 and 2, task 9; dark/light, task view/Edit/Cancel and linked notes.
- Actual directory link -> project -> Back restores directory reading offset 2155.
- Private folder: `C:\Users\alexbla\.copilot\session-state\f00fceac-0d8b-411e-9cc9-5e17d6e6c9c7\files`.
- Inspected `checkpoint-59-project-detail-before.png`, `-after.png`, `-light.png`,
  `-task-editor.png`, `-notes.png`; supplements use the same full prefix.
- Live inline gap: Tracker has 14 work rows but zero pinned projects; no live project
  inline screenshot can be produced without a business write or fabricated row.
- `-inline-unavailable.png` records that real context, not a fake project preview.
- Shared inline render/API and native parent/child lifecycle are isolated-test verified.
- Short live dossiers do not exercise nonzero project scrolling; history tests do.
- Observed task request: one GET, zero non-GETs; no interception or live input/submits.
- DB digest window: 81/82 tables unchanged; only `usage_events` grows 35309 -> 35323 (+14).
- Initial before-image reads precede the digest window; no business/cache table changes.
- Restored Graphite dark, clean dialogs/drafts/listeners and unchanged 1566x1174 viewport.
- Protected note drafts/production stay untouched; dev server remains running.
- One generic Discord DM accepted: `1557292395824029717`; scratch digest removed.
