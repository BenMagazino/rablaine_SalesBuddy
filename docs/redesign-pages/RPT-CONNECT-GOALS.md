# RPT-GOALS: Connect Goals dashboard

- Checkpoint: 41, `feature/ui-redesign`.
- Audited product revision: `eb588a08`.
- Status: VERIFY, technically checked and user-approved October 6, 2026.
- Approved implementation committed locally as `706cf6ae`.
- Layout decision: keep the admired dashboard, not a navigator/detail workbench.
- Approved effort is about 45%; final whole-app reconciliation remains separate.

## Contract and intentional change

- Preserve wide U2C analysis above the team/HVA coverage panels.
- Keep these three metrics primary: values, progress, target markers, status
  explanations, source freshness, counts and the technical-validation breakdown.
- Keep weekly U2C history, its live endpoint and quarter-target series.
- Retain supporting whitespace lanes, ramping/sustained states, customer links
  and expandable, chronologically ordered monthly histories.
- Preserve annual setup, required Databases/Fabric choices and optional buckets.
- Preserve off-team Data tracker scope for FY27 and FY28, including active statuses.
- User explicitly authorized removing the external earnings placeholder.
  The page, API and existing SalesIQ tool now share four widgets, not five.
- No calculation, population or filtering changes to the remaining providers.

## Implementation

- Rebuild on the shared window frame, with fixed header/scope bands, an owned
  dashboard reading area and the native status footer always visible.
- Remove the legacy page-container CSS and copied spacing/layout utilities.
  Native semantic components use the same surface and typography as other reports.
- Dashboard composition and full-width reading flow remain intact.
- Per user review, replace filled/boxed goal cards with horizontal section
  dividers and one vertical divider between the coverage metrics.
- Browser Back restores dashboard scroll and expanded customer histories;
  embedded views leave window/footer/history ownership to their host.
- Native bucket dialog shares setup validation and confirmed-save handling.
- Pending saves block duplicate submission and dismissal. Server-confirmed saves
  remain distinguishable from local preference/reload failures.
- Chart colors resolve theme tokens to RGB, including points and target legend.
- F1 Help describes the four remaining goals.

## Verification and private comparison

- [Python parity tests](../../tests/test_connect_goals.py): 15 passed, including
  ready/setup shell ownership, shared footer and embedded rendering.
- [SalesIQ coverage/handlers](../../tests/test_salesiq_tools.py): 75 passed.
- [Native controller tests](../../tests/js/ui_connect_goals.test.cjs): 19 passed.
- Live API values and fields match the captured four-widget baseline exactly.
- All 10 whitespace records, 80 monthly values/labels and customer destinations
  match provider data; expansion/collapse works.
- Native dialog opens, validates required choices, preserves retry after an
  intercepted save failure and cancels without a live preference write.
- Chart data/target, dark/light colors and F1 Help checked in the existing desktop.
- Footer stays at the viewport bottom while the dashboard scrolls; the document
  does not scroll. Actual customer drill-down/Back restores the expanded history.
- Private before/after full-page and viewport images are saved in session artifacts
  as `connect-goals-before*.png`, `connect-goals-shell-before.png` and
  `connect-goals-after*.png`, not committed.
- Workflow now requires comparable before/after screenshots for every redesign.
- User authorized a local checkpoint commit and continuation to the next report.
  No push, merge or deployment authorized.
