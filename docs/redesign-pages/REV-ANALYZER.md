# REV-ANALYZER: reviewed Revenue Analyzer surface

## Content consistency review

Latest evidence: `consistency-analyzer-qualification-{before,after,light-after}.png`.
Earlier captures below are preserved as superseded comparisons. Analyzer remains
full width (1559px at the retained desktop viewport). Reading content and sticky
headers use shared surface tokens. No alert values, sort state or charts change.
The page-only background override is retired now that the common revenue CSS
normalizes the same reading and sticky-header rules for every consumer.
Complete measurements and source audit: private `consistency-reports-results.json`.

- Status: VERIFY, October 8, 2026 review correction on `feature/ui-redesign`.
- Scope: `revenue_dashboard.html` and page-specific `ui-revenue-analyzer.css`.
- Live URL: `http://127.0.0.1:5000/reports/revenue`.
- Confirmed route title: Revenue Analyzer. Seller Alerts is a separate surface
  and retains its original template, width classes and workbench CSS.

## Correction and measured proof

- Remove both directory-frame root classes. At the unchanged 1559 x 1174 desktop
  viewport, the Analyzer root expands from 1344px to the full 1559px width.
- Root cause: shared legacy workarea, alerts wrapper and sticky headers explicitly
  used `--sb-ui-canvas` below a surface-colored root. Analyzer-only rules now use
  `--sb-ui-surface`, matching the existing Graphite/Muted shell, not a new palette.
- Computed workarea, alerts wrapper and sticky header backgrounds: dark
  `oklch(0.23 0.009 250)`, light `oklch(0.98 0.003 250)`, matching root/shell.
- Document and table scroller each have 0px horizontal overflow in both themes.
- Live data remains 43 total alert rows and 14 visible in the existing two-bucket
  scope. Priority stays descending, with the same first alert and literal values.
- Category summary remains three Declining ($6,296 risk), eight Recent Dip
  ($0 risk), twenty Expansion ($45,270 opportunity), eleven Volatile.
- Eleven table columns, seller menu, export controls, navigation, review controls,
  bucket scope and commands are unchanged. This live Analyzer has no chart canvas;
  no chart/query/controller changes were made.
- Embedded hosts are excluded by the standalone CSS selector. Shared detail,
  Seller Alerts and other consumers are not recolored.

## Current private evidence

Captures live in the session `files` directory, not the repository. All three
images show the actual `/reports/revenue` page; both After images were inspected
at the unchanged desktop viewport.

- `review-revenue-analyzer-before.png`
- `review-revenue-analyzer-after.png`
- `review-revenue-analyzer-light-after.png`

The earlier `width-report-reports-revenue-before.png` and archived Analyzer
evidence remain preserved, superseded only for the width/background review.

## Validation

- `tests/js/ui_revenue_surface_review.test.cjs` covers Analyzer/bucket full-width
  roots, bounded customer and unchanged Seller Alerts, plus scoped token ancestry.
- Combined surface/customer/workbench/bucket-filter/alert JavaScript run: 50 pass.
- Parent-coordinated nine-surface regression, including `tests/test_ui_revenue_review.py`:
  263 Python and 111 JavaScript tests pass.
- Automated Python tests use the isolated test database. No server restart,
  live business write or viewport resize performed.
