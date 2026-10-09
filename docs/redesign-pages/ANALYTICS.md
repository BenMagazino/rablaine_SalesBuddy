# ANALYTICS: Activity and follow-up

- Checkpoint 96. Status: VERIFY, first-pass design approved October9, 2026.
- Route: `/analytics`. Native 1344px paired reading workspace.

## Inventory and lifecycle

The four portfolio totals remain alongside seller activity, customer follow-up
and note-frequency trend. Existing names/counts/customer and seller links,
attention thresholds, dates, empty states and chart inputs are preserved.
An actual stat strip replaces cards. Activity and follow-up are independent
scrolling reading panes rather than a renamed Bootstrap grid.
Seller and territory identities retain their native semantic styling.

## Evidence and verification

- Pair marker: `data-sb-page-pair="activity-follow-up"`; both independently
  scrolling regions use `data-sb-page-pane`.

- Final dark/light images are refreshed and inspected after Bootstrap component
  asset removal; `ui-base.css` loads at the unchanged desktop viewport.

- Fresh live Before and dark/light After: `final-checkpoint-96-analytics-*.png`.
- Desktop viewport unchanged at 1559x1174; no horizontal document overflow.
- Real portfolio data remains visible; no synthetic records or preview server.
- Selectors: `tests/test_ui_administration.py`, `tests/test_analytics.py`.
- Final scoped tests pass. Empty states are isolated fixtures;
  actual portfolio data is not deleted to manufacture them.
- Private artifact manifest: `final-checkpoint-94-98.json`.

## Final batch verification

Final scoped selections pass1389 Python and1113 JavaScript tests. Creator approved the first-pass design October9, 2026. The private15-checkpoint audit is complete; see
[final reconciliation](FINAL-RECONCILIATION.md) for exact evidence, native-shell
limits and the unresolved validation draft incident. No full Python suite,
production rebuild, push, merge or deployment was performed.
