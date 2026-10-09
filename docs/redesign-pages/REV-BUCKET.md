# REV-BUCKET: reviewed bucket products surface

## Content consistency review

Latest evidence: `consistency-bucket-products-wide-{before,after,light-after}.png`,
plus the `bucket-products-wide-expanded` series for full product history.
Earlier captures below are preserved as superseded comparisons. Bucket Products
remains full width (1559px); collapsed and expanded content inherit the surface
token in both themes. Queries, history values and controls are unchanged.
The default reading rule now supplies the same surface in embedded hosts too;
the older standalone-only color override is redundant and removed. Embed layout
and standalone full-width policy are unchanged.
Complete measurements and source audit: private `consistency-reports-results.json`.

- Status: VERIFY, October 8, 2026 review correction on `feature/ui-redesign`.
- Scope: `revenue_bucket_products.html` and `ui-revenue-bucket.css`.
- Live URL: `http://127.0.0.1:5000/revenue/customer/456/bucket/Databases`.
- Existing customer alias remains `/customer/456/revenue/bucket/Databases`.

## Correction and measured proof

- Remove both directory-frame root classes. At the unchanged 1559 x 1174 desktop
  viewport, the root expands from 1344px to 1559px; context remains 340px and the
  reading pane expands from 1002px to 1219px.
- Root cause: the workarea explicitly used `--sb-ui-canvas`, darker than its
  shell/root `--sb-ui-surface`. The standalone workarea now uses the shell surface;
  transparent reading, analysis and expanded history descendants inherit it.
- Computed workarea background: dark `oklch(0.23 0.009 250)`, light
  `oklch(0.98 0.003 250)`, exactly matching the Graphite surface token in each theme.
- Document and both panes have 0px horizontal overflow. Recent product table
  remains bounded at 1120px; individual history tables retain their 640px bound.
- Real data: 14 products, seven recent months, 13 imported months and 111 full
  history rows. Expand/collapse and native sorting controls remain available.
- Embedded composition keeps its prior canvas background and does not acquire
  the standalone surface override. No query, business data or JavaScript changes.

## Current private evidence

Captures live in the session `files` directory, not the repository. All current
After/light images were visually inspected at the unchanged desktop viewport.

- `review-revenue-bucket-products-before.png`
- `review-revenue-bucket-products-after.png`
- `review-revenue-bucket-products-light-after.png`
- `review-revenue-bucket-products-expanded-before.png`
- `review-revenue-bucket-products-expanded-after.png`
- `review-revenue-bucket-products-expanded-light-after.png`

The earlier `width-report-customer-456-revenue-bucket-Databases-before.png` and
[checkpoint 27 evidence](HOME-WORKBENCH-HISTORY.md#checkpoint-27-customer-bucket-product-history)
remain preserved, superseded only for width/background review by the captures above.

## Validation

- `tests/js/ui_revenue_surface_review.test.cjs`: root width and background ancestry contracts.
- Related bucket-filter/customer/workbench/alert JavaScript checks: 50 tests pass.
- Parent-coordinated nine-surface regression, including `tests/test_ui_revenue_review.py`:
  263 Python and 111 JavaScript tests pass.
- Automated Python tests use the isolated test database. No server restart,
  live business write or viewport resize performed.
