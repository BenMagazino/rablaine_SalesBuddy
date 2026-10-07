# ENG-VIEW - Engagement dossier

Checkpoint 57, October 7, 2026: VERIFY, user-approved, final reconciliation pending.
Audited baseline: `4e57b1a6` plus checkpoints 53-56. Approved batch effort: about 75%.
Implementation SHA is recorded in the page tracker's approved batch handoff.
## Scope and composition
- Full `/engagement/<id>` and `/api/engagement/<id>/detail` share the complete body.
- Native frame/footer, story/relationship and follow-up/note reading regions.
- Embedded action-queue details use one contextual flow, not a duplicated page shell.
- Retain all story fields, AI drafts/review/application and partner recommendations.
- Retain people, status, opportunities, milestones, notes and assignment permissions.
- Retain rich task creation/editing, priority/contact/dates, completion/reopening,
  deletion, quick-add, drag ordering, linked note/source and Copilot preview actions.
- Full-only favorite/header/story editing and note assignment remain full-only.
- Lists remain lists: no original dossier export or data table was removed/invented.
- Action-queue data sorts remain raw-key sorts; user-authored rich tables are not sorted.

## Controllers and coupled consumers
- `ui-engagement-detail.js` scopes original controllers to the complete shared root.
- Native AI-review/task dialogs retain original scripts, requests and payloads.
- Native action-queue parent activates all scripts/dependencies in sequence.
- Child closes retain their parent; parent close aborts reads, disposes guards and
  restores prior Copilot context. Repeated opening does not export global task handlers.
- Shared task dialog lazily uses existing Quill and preserves raw HTML on load failure.
- Note task flyout uses the same native lifecycle and rich editor styling; its
  main note editor, task insertion/badges, cursor and note draft system are untouched.
- Pending writes guard navigation and duplicate saves; failures retain inputs for retry.
- Stale/wrong task reads, media-only descriptions, blank-editor normalization,
  keyboard activation and identity-validated reading history have regressions.
- Prior form-helper breadcrumb discovery now follows helpers to actual route owners.

## Exact scoped validation
```powershell
& C:\dev\SalesBuddy\venv\Scripts\Activate.ps1
& C:\dev\SalesBuddy\venv\Scripts\python.exe -m pytest tests\test_ui_engagement_detail.py tests\test_engagements.py tests\test_engagement_contacts.py tests\test_ui_engagement_form.py tests\test_ui_engagements_directory.py tests\test_ui_action_items.py tests\test_ui_milestone_body.py tests\test_ui_milestone_preview.py tests\test_ui_milestone_tracker.py tests\test_ui_one_on_one_workspace.py tests\test_one_on_one_workspace.py tests\test_manager_one_on_one.py tests\test_breadcrumb_entities.py
node --test tests\js\ui_engagement_detail.test.cjs tests\js\ui_action_item_dialog.test.cjs tests\js\ui_action_items.test.cjs tests\js\ui_milestone_workflow.test.cjs tests\js\milestone_tracker_actions.test.cjs tests\js\ui_one_on_one_workspace.test.cjs tests\js\manager_one_on_one.test.cjs | Select-Object -Last 9
& C:\dev\SalesBuddy\venv\Scripts\python.exe -m pytest tests\test_ui_engagement_detail.py
```
- Results: 378 Python passed, 95 JavaScript passed; final dossier rerun 9 passed.
- Four controller/help `node --check` checks and scoped editor diagnostics pass.
- `git diff --check` passes; no staging/commits, migrations or dependency changes.

## Real live evidence and limits
- Existing dev data: full engagement 52, inline engagement 26, shared project task 9.
- Open/cancel rich editors, milestone selection and nested parents; repeated inline load.
- Inspected final dark/light/full/inline/editor images at unchanged 1566x1174.
- Private image folder: `C:\Users\alexbla\.copilot\session-state\f00fceac-0d8b-411e-9cc9-5e17d6e6c9c7\files`.
- Images: `checkpoint-57-engagement-detail-before.png`, `-after.png`,
  `-inline.png`, `-light.png`, `-editor.png` (all use the same full prefix).
- Transparent browser fetch observation records three real GETs and zero non-GETs;
  no requests were blocked/intercepted as write protection. Tool request listeners
  did not capture navigation traffic, so table hashes independently verify safety.
- Read-only audit: 80/81 tables byte-hash unchanged; only `usage_events` grows
  35279 to 35296 (+17). Initial before-image reads precede this digest window.
- No business/cache entity changes, AI generation, remote writes or note-draft reloads.
- Protected note editor runtime and mutating/AI flows remain isolated-test/source QA;
  real engagement 52 fits both panes, so nonzero Back scrolling was not exercised live.
- Longer than target because three rich-editor consumers and nested-host parity
  required migration, plus repair of tightly coupled prior form breadcrumb coverage.
- Restored dark theme, clean dialogs and native fetch; dev server remains running.
- Discord: one generic ready DM accepted; message ID `1557285807793115180`.
