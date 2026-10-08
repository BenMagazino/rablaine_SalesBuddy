# POD-FORM: existing Edit POD

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Content consistency sweep, October 8, 2026
- Retain approved 1344px paired identity/assignment workspace.
- Remove the 1240px inner cap; `.pod-edit-layout` reaches 1278px. Identity stays
  300px while assignment reading uses the remaining width.
- Preserve all autosave controls and data; live QA does not submit assignments.
- Private evidence: `consistency-pod-form-{before,after,light-after}.png`.
- Uncommitted correction only; no checkpoint advancement.

## Creator review refinement, October 8, 2026
- Widen Edit POD from1152px to the shared1344px root, matching detail.
- Existing1240px inner layout can now expand rather than being limited to1086px.
- Preserve synced identity, assignment values, automatic-save behavior and disclosure.
- Private revision evidence: `pod-form-wider-reading-{before,after,light-after}.png`.
- Actual1559x1174 dark/light: inner1240px layout,900px assignment area (up154px),
  zero horizontal overflow, unchanged selector values and300px identity context.
- Combined POD detail/edit and width-policy regression:87 Python/11 JavaScript pass.
- Prior1152px photos below are superseded; revision remains uncommitted and unapproved.

## Readable-width rollout, October 7, 2026
- `/pod/1/edit`: 1152px root fits 300px identity +40px gap and assignment minima.
- Existing expanded assignment controls have no overflow in dark/light; no save triggered.
- Private evidence: `width-entity-pod-form-{before,dark-after,light-after}.png`.

## Checkpoint and scope
- Checkpoint 70, October 7, 2026; VERIFY, uncommitted on `feature/ui-redesign`.
- Baseline `7a43faab` plus preceding uncommitted checkpoints 63-69.
- Batch 63-76 remains authorized; approval estimate stays about 75%.
- Existing `/pod/<id>/edit` only. No New POD, whole-record submit or new route.
- POD detail remains checkpoint 71; its template/provider is untouched.

## Actual provider and parity
- `app/routes/pods.py::pod_edit` stays GET-only and has no business writes.
- Name is read-only; territories and POD SEs remain managed by MSX sync.
- Territory and SE names retain alphabetical order, personnel and empty states.
- All territory/specialty groups and candidate names retain original scope/order.
- Cloud specialties and missing specialties remain excluded from DSS choices.
- Single DSS without an explicit preference remains automatic, not a selector.
- Explicit single preference and multiple candidates retain dropdown behavior.
- Existing selected IDs and empty defaults remain unchanged; None clears selection.
- Territory identity keeps its semantic accent; SE/person icons remain visible.
- Exact existing write: `POST /territory/<territory_id>/dss-selection`.
- JSON keys: `specialty`, `solution_engineer_id` (string ID or null for clear).
- Content-Type and X-Requested-With headers preserved; success is JSON, no redirect.
- Whole-POD POST remains 405. Back to POD remains `/pod/<id>`.

## Native implementation and tightly coupled fixes
- Continuous shared page frame, contextual identity rail and owned reading region.
- Shared native SBDialog handles pending/draft navigation lifecycle.
- Existing entry-local form/history and async-write prior art reused for autosaves.
- Manual POST lifecycle is deliberately not attached to this GET-only editor.
- Existing `dss_collapsed_pod_<id>` disclosure preference and expanded default retained.
- Native labeled choices, keyboard disclosure, live save status and retry feedback.
- Each assignment saves only on change or explicit Retry, never on restored Back.
- Pending duplicate saves are blocked; failed selections remain editable and guarded.
- Discard only drops unsaved choices; it does not undo assignments already saved.
- Storage errors roll back/log and return honest 500 JSON; malformed IDs return 400.
- Previously silent fetch failures and no-DSS initialization errors are fixed.
- No migrations, tooling, role changes or unrelated hardening.

## Verification
- Scoped pytest: `test_ui_pod_form.py`, `test_dss.py`,
  `test_breadcrumb_entities.py`, `test_ui_pods_directory.py`: 165 passed.
- Node: `ui_pod_form.test.cjs`, `ui_territory_form.test.cjs`,
  `ui_pods_directory.test.cjs`: 19 passed.
- Isolated tests cover defaults/selected/single/empty, API success/clear/rollback,
  malformed input, failure retention/retry, pending guards and Back/draft restoration.
- Real dev desktop: 1566 x 1167, main y=78..1143, footer y=1143..1167.
- All seven selectors/options/defaults and three automatic entries match live Before.
- Dark/light inspected; no horizontal/document overflow, no viewport changes.
- Live unsubmitted DOM choice, no change event: native draft dialog opened; cleared.
- Back to real POD then browser Back restored clean choices; observed POST paths: none.
- All live saves/failure/autosave scenarios remain isolated tests, not live writes.
- Ordinary shell telemetry/read bookkeeping may occur; no whole-DB unchanged claim.
- Existing staging Socket.IO DNS errors are unrelated and remain deferred.

## Evidence and readiness
- Private images: `checkpoint-70-pod-edit-before.png`, `checkpoint-70-pod-edit-after.png`,
  `checkpoint-70-pod-edit-light-after.png`; all inspected.
- README, contextual help and changelog updated. No user approval or commit claimed.
- One generic readiness DM accepted, message ID `1557451154919784449` (exit 0).
