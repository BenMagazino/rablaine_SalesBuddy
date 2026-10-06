# RPT-IMPACT: Connect Impact

- Checkpoint: 40; status: VERIFY, user-approved October 6, 2026.
- Route: `/reports/connect-impact`, including `embed=1`.
- Audited baseline: `858b85df`; approved implementation ready for checkpoint commit.
- Files: `report_connect_impact.html`, `ui-impact.css`, `ui-impact.js`.
- Provider: existing commitment query/aggregation unchanged; fiscal shortcuts reuse existing date helpers.
- Next action: retain verified behavior during remaining report migrations.

## Scope

- Required: customer ranking, total estimated ACR/mo, commitment-date scope,
  customer navigation and all five original milestone fields.
- Native composition: ranked customer chooser beside one customer's milestones,
  independently owned reading panes, pinned headings and useful status rail.
- Shared: page frame, typed table sorting, favicon and milestone preview.
- User-requested functionality: current fiscal-year Q1/year start, Q2, Q3 and Q4
  date shortcuts beside the existing picker. No end dates or default-scope change.
- Coupled fixes: implicit browser-global event handler; invalid saved dates;
  pending date leaking into Back; sorting mixed null/numeric milestone amounts.
- Deferred: new exports/search, changing calculations/status inclusion or MSX sync.

## Contract

| Surface | Expected outcome | Evidence |
| --- | --- | --- |
| Data | All original customer/milestone fields retained | Live field projection matches all 12 customers and 20 milestones |
| Scope | On-team, Committed, committed_at at/after calendar midnight | Existing provider tests and new inclusive-boundary/exclusion fixtures |
| Totals | Raw monthly amounts summed; unavailable amounts contribute zero | Decimal/null fixtures; live unchanged $113,701/mo |
| Status | Completed, Cancelled and unknown execution states remain eligible | Isolated fixtures and live Completed/Cancelled records |
| Sorting | Every data column; raw decimals/dates; fixed original customer ranks | Typed fixture keys; live customer/milestone numeric sorts |
| Inspection | Selected customer only; normal customer link and shared milestone preview | Live loaded preview, customer navigation and Back |
| Date | Existing five-month default and preference; explicit URL wins | Provider tests, JS preference/calendar/redirect tests, live changed scope |
| Back | Original effective date, customer and independent table sorts | Live date change/Back and customer drill-down/Back |
| Failures | Invalid dates stay truthful; storage/navigation/history errors visible | Controller tests; no silent failure-shaped success |
| Embed | Stacked panes, no window/footer ownership or saved-date writes | Isolated render and JS preference/navigation checks |

## Verification

- Python: **19 passed**, `test_ui_impact.py` and the existing
  `test_reports.py::TestConnectImpactReport`.
- JavaScript: **25 passed**, page controller/helpers and shared dialog/Help registry.
- Fiscal presets verified across July and calendar-year cutovers; a Q1 shortcut
  still includes commitments after Q1. Live Q1/Q2 navigation and Back restore
  both date controls; original October 6 scope/preference restored after checks.
- New contextual Help entry brings the registry to 59.
- Live development app uses real data and the existing desktop viewport.
- Graphite dark/light and contextual F1 Help checked; no body overflow in either mode.
- Reading offsets validated as saved state; current live datasets fit without
  vertical scrolling, so no fabricated nonzero-scroll claim.
- Existing date preference and dark theme restored after verification.
- No user-write actions, sync execution, production access or protected-draft navigation.
- Editor diagnostics and `git diff --check` pass.

## Review boundary

- Rank remains the original total-ACR rank, even after sorting another column.
- The controller pins the server's effective date in the URL to prevent Back
  from redirecting through a newer saved preference.
- Detail sorters mount only when selected; null amounts render/sort as zero.
- User approved the workbench and fiscal date shortcuts; no push, merge or deployment.
- Discord accepted one authorized generic review-ready DM after verification.
