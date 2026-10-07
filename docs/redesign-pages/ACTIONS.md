# ACTIONS: checkpoint 54

- Status: VERIFY, user-approved October 7, including all morning refinements.
- Baseline: approved `4e57b1a6` plus preserved uncommitted checkpoint 53.
- Approved batch effort: about 75%; strict DONE counters await final reconciliation.
  Implementation SHA is recorded in the page tracker's approved batch handoff.
- Audit: original page, complete shared partial, provider, local-task dialog,
  associated engagement fragment/actions and current tests inspected before edits.
- Scope: `/action-items`, `/api/action-items-hub`, page/partial, scoped CSS/controller,
  optional shared task project link and page-exit guard. No provider/model changes.
- Composition, revised after morning review: native frame/footer, three task
  cells across the top, hygiene below left and a wider stale milestone cell below
  right. Shared divider lines, compact records and independent cell
  scrolling replace the initial stacked queues. No floating cards or shadows.
- Back retains all cell scroll positions, seller scope and raw field sorting.
  Previously saved stacked-queue history remains valid.

## Actual parity
- Provider populations/order unchanged: open engagement tasks; saved Copilot tasks
  before generated suggestions; ordinary project tasks; hygiene; stale milestones.
- Seller-mode and three dashboard preferences stay in the original provider.
- Live before/after counts: engagement 0, Copilot 0, project 1, hygiene 7, stale 19.
- Local fields: title, description, due/overdue, contact, priority, status,
  engagement/customer, project, source/source URL, linked note and optional save date.
- Shared preview keeps GET; PUT title/due_date/priority/contact/description;
  toggle POST; Copilot save POST with optional due_date; dismiss/not-useful POST.
- Create, rich edit, complete/reopen, reorder and DELETE remain on linked
  engagement/project surfaces; these actions never existed as hub create/delete buttons.
- Engagement preview keeps the full original body and Full Page link. Required
  host fixes preserve handler exports, sequential dependencies and one task dialog.
- Hygiene keeps record/customer/gap, engagement/milestone preview and canonical links.
- Stale keeps title/customer/workload/seller, due urgency, days stale, raw ACR/mo,
  original seller persistence and all empty/no-match states. Maintenance is not HoK.
- Sortable headings use the existing global sorter. Project controls follow
  surfaced fields; Hygiene offers Name and Customer, not Gap. Date and numeric
  keys are raw; action columns do not sort. Export-label headers retained.
- Back restores seller scope, sorter state and both reading axes. Live scope 3,
  10 visible records and reading top 200 restored exactly. Draft discard verified
  without saving; failed/duplicate writes and page-exit guards verified in isolation.

## Verification
- `venv\Scripts\python.exe -m pytest tests\test_ui_action_items.py tests\test_engagements.py tests\test_copilot_actions.py tests\test_customerless_milestone_scope.py -q`
  Result: 115 passed, 55 existing SQLAlchemy legacy warnings.
- `venv\Scripts\python.exe -m pytest tests\test_ui_action_items.py tests\test_ui_milestone_preview.py tests\test_views.py -k 'action_items or action_queue or action_fragment or stale_columns or all_milestone_hosts' -q`
  Result: 17 passed, 62 deselected. Earlier missing launcher assertion was fixed.
- `node --test tests\js\ui_action_items.test.cjs tests\js\ui_action_item_dialog.test.cjs tests\js\ui_table_sort.test.cjs`: 49 passed.
- `node --check` on ui-action-items.js, ui-action-item-dialog.js and page-help.js;
  editor diagnostics and `git diff --check` pass.
- Live: 16 populated data headings toggle ascending/descending; no sorter errors;
  zero document/horizontal overflow, fixed footer, real fragment and rich-task
  create/edit/delete/toggle handlers available, duplicate task dialogs absent.
- Final fresh partial GET returns 200 and exact queue/row text parity with the page.
- Live QA submits no business mutations, sync, refresh or saved preferences.
  Action/engagement reads are read-only; no MSX cache refresh was requested.
  Normal app telemetry/bookkeeping is not claimed unchanged. No whole-DB hash proof.
- QA typing discarded; Graphite dark, unfiltered queues and top reading restored.
- Deferred: associated engagement body/child rich editors retain their original
  legacy styling/lifecycle, intentionally not overhauled in this hub checkpoint.
- Private images: checkpoint-54-action-items-before.png / -after.png,
  -light-after.png, -preview-after.png, -edit-after.png, -stale-after.png.
  All under the session files directory; final images inspected at 1566x1174.
- Discord: accepted generic DM `1557269027901153301`, exactly one send.

## Morning dashboard revision, October 7
- User requests the original dashboard composition with Connect Goals-style cells.
- Three aligned task cells sit above hygiene and a double-width stale cell; borders
  alone separate the regions. Compact records retain all original fields and raw
  sort keys. Long seller labels truncate with the full name available on hover.
- Scoped render/embedded checks: 13 pytest passed; final markup rerun: 4 passed.
  Controller, task dialog and shared sorter checks: 52 JavaScript tests passed.
- Live populations remain 0 / 0 / 1 / 7 / 19. Verified the exact 3-over-2 geometry,
  double-width stale cell, no horizontal/document overflow, task preview, numeric
  sorting both ways and real Back restoring independent 20px / 260px cell offsets.
- Light and dark inspected at the unchanged desktop viewport. No business saves.
- New private photos: `action-items-dashboard-before.png`,
  `action-items-dashboard-after.png`, `action-items-dashboard-light-after.png`.
  Overnight gallery now points to the revised After image for checkpoint 54.
- Included in the October 7 approved batch.
- Revision readiness Discord DM accepted: `1557418524656275507`.

## Task density refinement
- Shared task summaries use title/context plus one inline metadata strip, rather
  than separate label/value rows. Empty contact/due fields and redundant normal/open
  defaults stay in the sortable data and existing editor, not in the summary.
- The actual project task shrinks from 151.5px to 64.5px (57% less height).
  Verified at most 72px in both desktop themes, seven original cells retained,
  unchanged dashboard geometry and four scoped rendering tests passing.
- Private comparison: `action-items-task-density-before.png` /
  `action-items-task-density-after.png`. Included in the approved batch.
- Density refinement Discord DM accepted: `1557420254701944879`.

## Sort controls and project row actions
- Hygiene's Record label becomes Name; the diagnostic Gap is retained in records
  but has no sort control.
- Project sorts include Action item and Project, with Contact/Due/Priority/Status
  available only when corresponding nonempty/nondefault summary values appear.
  Sort state keys identify the field projection, preventing obsolete hidden-field
  sorts from breaking restoration. Hygiene's revised contract has its own key.
- The redundant project View / Edit button is removed. The existing native title
  button stretches over the row; project links are layered above it. Enter/Space
  retain native button semantics and the full-row focus outline.
- Five scoped pytest and 52 shared controller/dialog/sorter checks pass. Live:
  exact two project and two hygiene controls, padded-row click opens the preview,
  project link navigates without opening it, Enter/Space work, Name sorts both ways.
- Private comparison: `action-items-row-actions-before.png` /
  `action-items-row-actions-after.png`. Included in the approved batch.
- Sort/row refinement Discord DM accepted: `1557423480864120985`.
