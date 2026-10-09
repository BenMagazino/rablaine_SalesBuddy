# ADMIN: Administration and fiscal management

- Checkpoint 95. Status: VERIFY, first-pass design approved October9, 2026.
- Route: `/admin`. Native 1344px paired workbench with context commands and scope footer.
- Pair marker: `data-sb-page-pair="administration"`; both columns use `data-sb-page-pane`.
- October9 refinement adds vertical dividers between statistics and top paired
  columns. The paired gutter provides 24px on each side of its center line,
  with equal-width panes sized to remain side by side. Statistics spacing and
  link hit areas are unchanged.

## Inventory and lifecycle

Fiscal season/transition positioning, initialization/progress/archive controls,
alignment override/probe/save/cancel, integration/auth/VPN/health, imports and
sync statuses, update/changelog/rebuild/restart, telemetry/filters, backup/archive,
customer merge and database maintenance retain their original IDs and functions.
Native disclosures preserve history and do not consume embedded filter controls.
Changelog/archive/alignment use the existing native dialog owner and events.
Alignment cancellation still rolls back a pending enable. Typed revenue/milestone
deletion, database maintenance and double fiscal finalization confirmations remain.
Dynamic tables preserve actual row/action nodes when remounting native sorting.
Backup sorting uses raw bytes/timestamps. All native administration form fields
have accessible names, including telemetry filters and maintenance switches.
Both setup states offer a non-destructive Review setup command through
`window.openSetupWizard()`, beside the unchanged explicit re-run/reset command.
The always-visible Admin command band also exposes the primary Review setup
entry, independent of disclosure state; its stable ID is `adminReviewSetupBtn`.
SSE transport keeps the backend's `progress` event and JSON keys independent of
visual class names. Milestone/marketing terminal failures survive EOF, and
incomplete fiscal syncs cannot advance to sync-complete or destructive finalization.

## Evidence and verification

- Fresh live Before and dark/light After: `final-checkpoint-95-admin-*.png`.
- Expanded fiscal/danger and telemetry supplements use actual development data.
- Fiscal disclosure opens with matching ARIA state. Database compaction
  confirmation was opened and dismissed; no database operation was submitted.
- 1559x1174 desktop viewport unchanged; no horizontal document overflow.
- Primary and expanded-region dark/light captures are refreshed after Bootstrap
  asset removal, with `ui-base.css` loaded.
- Actual Review setup opens existing completed state. Close Review dismisses
  without reset/auth/import/save and returns focus to `adminReviewSetupBtn`.
  Native setup-command and review-dialog dark/light supplements are included.
  Review-dialog captures are refreshed after the setup owner's READY message,
  with explicit visible-step and computed-theme waits, and both pictures inspected.
- Parent selectors: `tests/test_ui_administration.py`, `tests/test_fy_cutover.py`,
  `tests/test_admin_update_electron.py`, `tests/js/ui_admin_panel.test.cjs`,
  `tests/js/ui_admin_sync.test.cjs`.
- Final scoped tests pass. Login, sync, update, fiscal writes,
  backup restore, archive writes and destructive operations are not live-executed.
- Latest inline applied-query/revision source now appears in the live page.
  Failure/race replay assertions pass in the final scoped selection.
- Private artifact manifest: `final-checkpoint-94-98.json`.

## Final batch verification

Final scoped selections pass1389 Python and1113 JavaScript tests. Creator approved the first-pass design October9, 2026. The private15-checkpoint audit is complete; see
[final reconciliation](FINAL-RECONCILIATION.md) for exact evidence, native-shell
limits and the unresolved validation draft incident. No full Python suite,
production rebuild, push, merge or deployment was performed.
