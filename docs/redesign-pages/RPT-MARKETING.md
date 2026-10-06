# RPT-MKT: Marketing Insights

- Checkpoint: 39; status: VERIFY, user-approved October 6, 2026.
- Route: `/reports/marketing-insights`, including `embed=1`.
- Audited baseline: `fe758b9b`; approved revision committed as `858b85df`.
- Files: `report_marketing_insights.html`, `ui-marketing.css`, `ui-marketing.js`.
- Providers: existing queries in `reports.py`, unchanged.
- Next action: retain verified behavior during remaining report migrations.

## Scope

- Required: sync status/Admin links, all-account totals, customer-name filtering,
  account metrics, sales-play breakdown, top contacts and export controls.
- Native composition: sortable customer chooser beside one account's details,
  independent scrolling, pinned customer heading and useful status rail.
- Shared: page frame, table sorting, exports, favicon and UTC display renderer.
- Coupled fixes: nonexistent export target; missing UTC display-marker attributes.
- Deferred: larger MSX Workspace family, query optimization, new sync behavior.

## Contract

| Surface | Expected outcome | Evidence |
| --- | --- | --- |
| Data | Every original summary/play/contact field and source order retained | Live SHA-256 projection matches across all 207 customers |
| Totals | All-report counts unaffected by local filtering | Isolated fixtures; live all-account scope |
| Contacts | Existing top ten by email plus meeting interactions | Fixture with 13 contacts retains exact top-ten selection |
| Selection | Matching customer only; summary-only and empty states remain usable | Fixtures and live no-match/selection checks |
| Sorting | All data columns, raw counts and UTC chronology; missing values last | Typed headers/raw fixture keys; representative live list/date/contact sorts |
| Exports | Filtered customer summary, not selected detail tables | Live CSV/HTML/plain clipboard: same eight filtered rows; EML generated |
| Navigation | Query, customer, independent sorts and reading positions on Back | Live exact restoration: query, ID, ascending sort and both 350px offsets |
| Sync | Never run, running, complete, failed and incomplete; Admin owns actions | All five states tested, including zero count and missing timestamp |
| Embed | Stacked chooser/detail, no full-page frame/footer | Isolated embed render; controller skips its own history persistence |

## Verification

- Python: **9 passed**, `tests/test_ui_marketing.py`.
- JavaScript: **15 passed**, page helpers and shared dialog/Help registry
  because the contextual Help entry increases that registry to 58.
- Live development app: real data, existing desktop viewport, no test resizing.
- Customer-list and detail scrolling stay inside the window; no body overflow.
- Graphite dark/light tokens, local UTC display and contextual F1 Help checked.
- Detail sorters mount only when selected; three tables initialize initially,
  rather than mounting every hidden account's tables.
- No live writes, sync execution, production access or protected-draft navigation.
- Live baseline hash/count test marker removed after verification.
- Editor diagnostics and `git diff --check` pass.

## Review boundary

- This checkpoint does not alter query formulas, contact limits or sync timing.
- Exports were previously unusable because `summaryTable` did not exist.
  They now explicitly export the filtered three-column account summary.
- User approved the implementation; no push, merge or deployment.
- Discord accepted one authorized generic review-ready DM after verification.
