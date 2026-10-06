# RPT-WHITE: Whitespace Analysis

- Checkpoint: 38; status: BUILDING.
- Route: `/reports/whitespace`, including `embed=1`.
- Audited baseline: `175a0b0b`; working tree pending visual approval.
- Files: `report_whitespace.html`, report APIs in `reports.py`.
- Next action: migrate existing three-mode analysis, verify scoped behavior.

## Scope

- Required: grid, bucket selection/defaults, fully-covered toggle, reverse search,
  missing products, penetration and customer breakdown, bucket details and grid exports.
- Coupled fixes: obsolete bucket-page HTML extraction; async stale-response/error handling.
- Deferred: changing analytical windows/formulas, new persistence features or APIs.
- Shared: page frame, sorting, dialogs, customer picker and Revenue previews.

## Contract

| Surface | Expected outcome | Evidence |
| --- | --- | --- |
| Grid | Existing trailing average API, selected buckets and gap filtering | Pending |
| Defaults | Saved Revenue bucket filter, then compensated buckets; no preference writes | Pending |
| Reverse | Name/nickname/TPID search; historical bucket/product gaps | Pending |
| Penetration | Existing positive-spend counts/rate/gap and with/without lists | Pending |
| Details / exports | Shared bucket preview; grid-only exports retain scope | Pending |
| States / navigation | Native modes, precise counts, reads/Retry, safe Back and embeds | Pending |

## Verification

- Pending page tests, relevant shared integration and live desktop smoke.
- No live writes or protected-draft navigation.
