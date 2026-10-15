# RPT-WHITE: Whitespace Analysis

## Strategic pillar follow-up, October 15, 2026

- Whitespace now uses source-defined SuperStrategicPillars: AI, Analytics, Apps,
  Databases, Developer, Infra and Security. The ACR sync also imports this grain;
  Revenue Analyzer's service buckets remain unchanged.
- Initial selection is all seven pillars, independent of compensated revenue
  buckets. Back navigation preserves pillar selections without reusing old
  bucket-based history state.
- Grid averages use monthly pillar totals in the same 62-day window. Reverse
  lookup and penetration retain historical positive spend and zero-only customers.
- Product previews share the native product/history template but query pillar
  source data. Existing installations show import guidance until their first
  successful pillar-aware revenue sync.
- Standalone reports now use the shared 1344px-wide centered frame with canvas
  gutters. Alternating table rows use theme-aware shading, preserving gap fills
  and hover feedback. Embedded reports retain their host width.
- Pillar checkbox changes update the grid immediately. The label and checkbox
  row share vertical alignment; Back restores the selected scope directly.
- Pillar selection and table sorting persist in localStorage across reloads and
  fresh visits. Sorts are isolated by table and column set. Empty selections are
  retained, and unavailable or invalid saved preferences show explicit feedback
  and Retry without blocking the report.

The checkpoint evidence below describes the earlier bucket-based implementation.

## Content consistency review

Latest evidence: `consistency-report-whitespace-{before,after,light-after}.png`.
Earlier captures below are preserved as superseded comparisons. The matrix stays
full width (1559px) and surface-backed. Semantic coverage fills, missing-topic
indicators and real customer results are unchanged in both themes.
Complete measurements and source audit: private `consistency-reports-results.json`.

- Checkpoint: 38; status: VERIFY, user-approved October 6, 2026.
- Route: `/reports/whitespace`, including `embed=1`.
- Audited baseline: `175a0b0b`; approved revision committed as `fe758b9b`.
- Files: `report_whitespace.html`, `ui-whitespace.css`, `ui-whitespace.js`.
- Providers: existing report APIs in `reports.py`, unchanged.
- Next action: retain verified behavior during remaining report migrations.

## Scope

- Required: grid, bucket selection/defaults, fully-covered toggle, reverse search,
  missing products, penetration and customer breakdown, bucket details and grid exports.
- Coupled fixes: obsolete bucket-page HTML extraction; async stale-response/error handling.
- Deferred: changing analytical windows/formulas, new persistence features or APIs.
- Shared: page frame, table sorting, dialogs, exports and embedded bucket content.
- Reverse matching remains local, retaining the original two-character / 15-match scope.

## Contract

| Surface | Expected outcome | Evidence |
| --- | --- | --- |
| Grid | Stored-row averages in the existing 62-day window; selected pillars, partial/all and single-pillar behavior | Python query fixtures; JS filtering; live 78 / 140 rows |
| Defaults | Saved Revenue filter, then compensated defaults; no preference writes | Original Databases/Fabric filter unchanged |
| Reverse | Name/nickname/TPID; historical bucket/product gaps | Python fixtures; JS matching; all three live searches |
| Penetration | Historical positive spend; zero-only denominator; with/without lists | Python fixtures; live 19 buckets / 180 customers, 2 / 178 breakdown |
| Details | Actual native bucket embed, no page-shell scraping or history rewrite | Live existing products and full-history tables; no embedded navbar |
| Exports | Loaded grid only, raw-value sorting and formatted amounts retained | Live CSV, HTML/plain clipboard and EML attachment from another mode |
| Navigation | Back restores mode, draft/confirmed scope, sort and scroll | Live one-bucket 120-row scope, two checked buckets, ascending sort, 400px scroll |
| States | Explicit failures/Retry, stale guards, native empty/embed surfaces | Python render tests; JS latest-reader tests; injected live 503 and read-only recovery |

## Verification

- Python: **10 passed**, `test_whitespace_workbench.py` plus the existing
  `TestWhitespacePenetrationCustomers` class.
- JavaScript: **20 passed**, `ui_whitespace.test.cjs` plus `ui_dialog.test.cjs`
  because the shared Help registry gained one entry.
- Live desktop: existing browser viewport, no test resizing; Grid, Reverse and Penetration,
  representative raw numeric sorting, scoped-column changes, bucket inspection,
  all exports, Back, keyboard search and contextual F1 Help.
- Graphite dark/light tokens checked without saving or changing theme preferences.
- No live writes, production access or protected-draft navigation.
- Editor diagnostics and `git diff --check` pass.

## Coupled corrections and limits

- Pillar choices immediately reload the grid; late responses cannot replace newer selections.
- Sort keys identify their column set, avoiding invalid/shifted sorts after bucket changes.
- Export labels retain amounts inside native buttons; shared export code is unchanged.
- Failed reads hide stale results/exports and offer Retry; no analytical API changes.
- Embedded bucket links open full pages in the parent window; the preview stays focused.
- This card contains checkpoint proof. Home/global histories receive no new appendices.
