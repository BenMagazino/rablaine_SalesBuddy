# REV-CUST: reviewed customer revenue surface

## Content consistency review

Latest evidence: `consistency-customer-revenue-wide-{before,after,light-after}.png`.
Earlier captures below are preserved as superseded comparisons. Customer Revenue
retains its 1344px frame and standalone surface ancestry; embedded sizing is not
changed. Historical values, tables, chart and controls are unchanged.
The default scrolling-region rule now supplies the same surface in embedded
hosts too, replacing the older standalone-only color override without changing
embedded sizing, navigation or table behavior.
Complete measurements and source audit: private `consistency-reports-results.json`.

- Status: VERIFY, October 8, 2026 review correction on `feature/ui-redesign`.
- Scope: `revenue_customer_view.html` composition and `ui-revenue-customer.css`.
- Live URL: `http://127.0.0.1:5000/revenue/customer/456`.
- Existing customer alias remains `/customer/456/revenue`.

## Correction and measured proof

- Keep both directory-frame root classes. Root stays 1344px at the unchanged
  1559 x 1174 desktop viewport, with its 340px context and 1002px reading pane.
- Root cause: `sb-revenue-customer-scroll` explicitly painted the canvas token
  beneath a surface-colored root. The standalone scrolling region now paints
  `--sb-ui-surface`; analysis, history and Overview inherit the same surface.
- Computed workarea background: dark `oklch(0.23 0.009 250)`, light
  `oklch(0.98 0.003 250)`, matching the Graphite shell/root in both modes.
- Document, context, history area and the visible 954px product scroller each
  have 0px horizontal overflow. Independent pane scrolling remains intact.
- Live imported data retains ten history buckets, ten analyses and 104 product
  rows across the history sections. The selected Databases table has 14 products
  plus its total row, $202,237 all-history total and $352 latest month.
- Overview still reports the all-bucket $388,290 aggregate, and returning to
  Databases does not change saved bucket scope or recompute values.
- Embedded and stacked fallback compositions retain their previous background;
  no template, query, JavaScript or business data changes were required.

## Current private evidence

Captures live in the session `files` directory, not the repository. All current
After/light images were visually inspected at the unchanged desktop viewport.

- `review-revenue-customer-before.png`
- `review-revenue-customer-after.png`
- `review-revenue-customer-light-after.png`
- `review-revenue-customer-overview-after.png`

Earlier `width-report-customer-revenue-wide-{before,after}.png`,
`width-report-customer-revenue-wide-light-after.png` and
[checkpoint 26 evidence](HOME-WORKBENCH-HISTORY.md#checkpoint-26-customer-revenue-analysis-and-history)
remain preserved, superseded only for the background review by these captures.

## Validation

- `tests/js/ui_revenue_surface_review.test.cjs`: bounded root and background ancestry.
- Related customer/bucket-filter/workbench/alert JavaScript checks: 50 tests pass.
- Parent-coordinated nine-surface regression, including `tests/test_ui_revenue_review.py`:
  263 Python and 111 JavaScript tests pass.
- Automated Python tests use the isolated test database. No server restart,
  live business write or viewport resize performed.
