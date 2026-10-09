# Opportunity detail, checkpoint 89 (OPP-VIEW / FR-OPP)

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## October 8 reading-width revision
- Standalone root uses centered 1344px; modal consumers do not opt in.
- Live dark/light at 1559x1167: loaded MSX details, milestones and forecast comment fit.
- Evidence: `width-workflow-opportunity-detail-{before,after,light-after}.png`.
- Before is a width-only reconstruction on the same loaded live record, explicitly labelled.
- Normal automatic read/cache traffic occurs; no business controls submitted.
- Revision is uncommitted and awaiting review; batch approval remains pending.
- Status: VERIFY, implemented and uncommitted; user review remains outstanding.
- Batch 63-90 awaits review; approved effort stays 75%. Fill My Day 90 is last next.
- No git, agents, gallery changes, remote business writes or production access.
- Visible actual-dev QA tab: `44dc4737-c193-4ff9-9193-0778dba43f2f`.

## Original contracts and complete consumers

- Audited original standalone, entire shared partial, forecast helpers and Workspace bridge.
- Keep identity/account/number, state/reason, zero value, close, owner, threat, need and prose.
- Keep complete linked milestones, SQL status/title default order, due cues and raw ACR.
- Keep cached/uncached/empty forecasts, rich tables, note/engagement references and timestamps.
- Original detail provider supplies no stage/products or direct note/task collection.
  Those existing Workspace/linked milestone paths remain intact; no invented detail fields.
- Entire body, scoped initializer and forecast subpartials serve standalone and actual embed.
- Source populations, role/scope exclusions, links, manual semantics and exact APIs remain.
- POST fallback: `/opportunity/<id>/comment`; JSON POST/PUT/DELETE:
  `/api/opportunity/<id>/comment`. Favorite POST: `/api/opportunity/<id>/favorite`.
- Team POSTs: `/api/msx/join-deal-team`, `/api/msx/leave-deal-team`,
  with the original `{opportunity_id: <local id>}` and remote GUID resolution.

## Native workbench and coupled reliability

- Persistent standalone commands/status, contextual details and linked-work reading axes.
- Five bidirectional milestone data sorts use raw numbers/dates, missing values last.
- Reuse shared forecast editor, sorter, record dialog and milestone lifecycle/draft guards.
- Native Leave confirmation defaults to Cancel; child/parent focus and dismissal are guarded.
- Full original scripts activate once in Workspace; obsolete script-rewriting bridge removed.
- Favorite/cache failures roll back, log context and return explicit failure information.
- Remote team success/local-cache failure explicitly says check MSX before retrying.
- Post-save read failures leave available commands usable; read retries retain cached content.
- Delayed fresh content no longer overwrites Back positions with temporarily clamped scroll.
- Saved photo inspection exposed a clipped preview footer; shared shell fixes pinned geometry.

## Verification and evidence

- 151 isolated pytest pass, 103 existing Query.get warnings, 37.55s; final host recheck: six pass.
- Command: activated venv `python.exe -m pytest tests\test_ui_opportunity_detail.py
  tests\test_opportunities.py tests\test_ui_milestone_body.py tests\test_ui_msx_workspace.py
  tests\test_msx_workspace.py tests\test_milestone_tasks.py tests\test_opportunity_writeback.py`.
- 124 Node pass: `node --test tests\js\{ui_opportunity_workflow,forecast_comments,
  ui_milestone_workflow,ui_msx_workspace,ui_record_dialog,ui_dialog,ui_table_sort}.test.cjs`
  (seven explicit paths, not literal brace syntax). Editor diagnostics are clean.
- Owned files/edited route regions are whitespace-clean; existing unrelated route whitespace remains.
- Isolated writes cover forecast POST/PUT/DELETE, team/favorite/cache failures and retries;
  shared task/update/refresh/pending/disposal contracts remain covered without live writes.
- Live records 952, 5698 (33 milestones) and 106: both themes, actual Back restores 637px
  and descending date sort; trusted data sorts, links, Edit/Cancel and dirty Keep editing.
- Actual Workspace launcher, three read-only tabs, parent close/opener focus and nested Cancel.
- Desktop 1566 x 1167, no page overflow; preview 1200 x 1071, header/footer stay pinned
  while its body scrolls 400px. Own unsubmitted drafts cleared and dark theme restored.
- Ten private captures use `checkpoint-89-opportunity-`: `before.png`, `after.png`,
  `light-after.png`, `linked-after.png`, `modal-after.png`, `modal-light-after.png`,
  `nested-after.png`, `modal-fixed-after.png`, `modal-fixed-light-after.png`,
  `nested-fixed-after.png`. All After images inspected; three intermediate modal captures
  precede the footer repair, retained rather than overwritten.
- Monitored business POSTs: none. Shell polling POST path: `/socket.io/`, including staging
  CORS/400 errors. Detail GETs update local caches; telemetry bookkeeping can occur.
- Original non-JS comment fallback remains; do not claim AJAX draft recovery for that fallback.
- Exactly one generic readiness DM accepted: `1557508177916989494` (exit 0).
## October 8 content-background consistency

- Opportunity context and work panes explicitly share `--sb-ui-surface`.
- Existing 1344px standalone width, stacked dialog geometry and status tones remain.
- Evidence: `consistency-opportunity-detail-{before,after,light-after}.png`.
- Parent coordinates `test_ui_opportunity_detail.py` and `test_ui_workflow_consistency.py`.
