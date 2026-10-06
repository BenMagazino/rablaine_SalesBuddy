# RPT-WHITE: Whitespace Analysis

- Checkpoint: 38; status: VERIFY, user-approved October 6, 2026.
- Route: `/reports/whitespace`, including `embed=1`.
- Audited baseline: `175a0b0b`; working tree pending visual approval.
- Files: `report_whitespace.html`, `ui-whitespace.css`, `ui-whitespace.js`.
- Providers: existing report APIs in `reports.py`, unchanged.
- Next action: approved implementation ready for checkpoint commit.

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
| Grid | Stored-row averages in the existing 62-day window; confirmed buckets, partial/all and single-bucket behavior | Python query fixtures; JS filtering; live 78 / 140 rows |
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

- New bucket choices do not relabel old results; Show Whitespace confirms the scope.
- Sort keys identify their column set, avoiding invalid/shifted sorts after bucket changes.
- Export labels retain amounts inside native buttons; shared export code is unchanged.
- Failed reads hide stale results/exports and offer Retry; no analytical API changes.
- Embedded bucket links open full pages in the parent window; the preview stays focused.
- This card contains checkpoint proof. Home/global histories receive no new appendices.
