# CONNECT-EXPORT: Connect evidence export

- Checkpoint 97. Status: VERIFY, first-pass design approved October9, 2026.
- Route: `/connect-export`. Native 1152px reading and command surface.

## Inventory and lifecycle

Name/date range generation, export history/view/delete, summary totals/topics,
text evidence, markdown/JSON download, clipboard, cached AI summary,
AI generation/regeneration/progress/error states remain.
History sorting uses native controls and raw date values. Draft fields and the
selected export retain Back state. Pending generation gates duplicate submits.
Late view/AI responses cannot overwrite a newer selection. Deleted rows cause
identity-preserving sorter remounting. Delete retains its explicit confirmation.

## Evidence and verification

- Final primary/saved-export dark/light images are refreshed and inspected after
  Bootstrap component asset removal, without generating or downloading an export.

- Fresh live Before and dark/light After: `final-checkpoint-97-connect-export-*.png`.
- Existing-export supplements load the actual saved record through its GET route.
- Desktop viewport unchanged at 1559x1174; no horizontal document overflow.
- No generation, AI call, deletion, external export or clipboard write is invoked live.
- Selectors: `tests/test_ui_administration.py`, `tests/test_connect_export.py`,
  `tests/js/ui_admin_panel.test.cjs`, `tests/js/ui_connect_export.test.cjs`.
- Final scoped tests pass; async failures/races use isolated tests,
  not mocked live screenshots.
- Private artifact manifest: `final-checkpoint-94-98.json`.

## Final batch verification

Final scoped selections pass1389 Python and1113 JavaScript tests. Creator approved the first-pass design October9, 2026. The private15-checkpoint audit is complete; see
[final reconciliation](FINAL-RECONCILIATION.md) for exact evidence, native-shell
limits and the unresolved validation draft incident. No full Python suite,
production rebuild, push, merge or deployment was performed.
