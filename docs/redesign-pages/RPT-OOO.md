# Seller 1:1 preparation, checkpoint 45

- Route: `/reports/one-on-one`, including its embed.
- Baseline: approved product `b1574e84`; before captured before this page changed.
- Status: VERIFY, user-approved October 6; local commit authorized.
- Scope: preparation report only, not persistent workspaces or Initiative Tracker.

## Preserved contracts

- Keep the route/provider read-only and its two-week, active, fiscal-quarter,
  overdue, on-team and fiscal-year populations unchanged.
- Keep all six metrics, commitment/review/topic/quarter highlights, grouped
  engagements, story completeness, milestone links, note excerpts and territories.
- Preserve first-five note limits and extra-note counts.
- Preserve Initiative Tracker, existing workspace destinations, numeric seller
  destinations and the explicit Manager/Other POST creation form.
- Keep CSV, clipboard and email exports across all highlight tables, including
  offscreen rows and original milestone URLs. Activity lists remain outside exports.

## Native composition

- Shared frame/footer, persistent commands, six line-separated metrics and
  Customer activity view controls. One owned page reading region.
- Line-separated highlights; long tables have independent reading regions.
- Every highlight data column sorts in both directions with the shared sorter.
  Topic Trend sorts by its FY note total, retaining monthly SVG bar tooltips.
- Native customer/note disclosures and app-owned workspace dialog.
- Back retains lens, disclosures, page/table positions and shared table sorts.
- Embeds omit outer frame/footer and do not own parent reading history.
- Invalid navigation or reading-state failures are logged and visibly reported.

## Verification and review

- Tests: `tests/test_ui_one_on_one_report.py`,
  `tests/js/ui_one_on_one_report.test.cjs`, existing report and workspace contracts.
- Scoped checks: 132 Python and 39 JavaScript tests passed, including workspace,
  report, shared sorter and breadcrumb contracts. No relevant editor diagnostics;
  Help syntax and `git diff --check` pass.
- Live comparison: all six metric values, both milestone tables, original export
  URLs and every customer/engagement/milestone/note/territory link match. The two
  tables retain all 29 rows; All Open retains 30 engagements across 25 customers.
- All 16 live sort directions retain row identities. CSV, decoded email and
  intercepted clipboard exports preserve headers and offscreen rows. Fixed missing
  export labels exposed by real sorted-header QA; regression coverage includes all
  four tables, including populated topic and reviewed-alert cases in isolated tests.
- Customer drill-down/Back restores the lens, disclosures and exact page/table
  offsets. Native dialog Escape restores opener focus. Dark/light desktop checks
  pass; the 24px footer stays visible without document scrolling. Dark restored.
- Browser request interception failed during form QA. One empty test workspace
  was created and removed by exact ID/name/type in the explicit dev database.
  All five original workspaces and two available sellers are restored. Use isolated
  tests, not browser routing interception, for future create-action QA.
- Private comparisons: `one-on-one-report-before.png`, `one-on-one-report-after.png`,
  `one-on-one-report-open-after.png`, `one-on-one-report-launcher-after.png` and
  `one-on-one-report-light-after.png`. Screenshots are not committed.
- Existing business records unchanged. No push, merge or deployment authorized.
- Discord accepted the generic review-ready DM, message `1557189396715933860`.
