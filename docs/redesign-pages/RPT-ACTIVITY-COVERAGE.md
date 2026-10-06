# RPT-ACT: Activity Coverage

- Checkpoint: 42, `feature/ui-redesign`.
- Audited revision: `706cf6ae`.
- Status: VERIFY, technically checked and user-approved October 6, 2026.
- Approved implementation committed locally as `55c4bc9c`.
- Approved overall effort is about 47%; final whole-app reconciliation remains separate.

## Contract

- Preserve weekly/full-FY chronological meeting review, week boundaries, milestone
  filtering and All/Open/Prepared/Failed/Logged filters.
- Preserve customer/milestone/activity pickers, automatic meeting-draft saves,
  activity creation/linking, occurrence/series dismissal and background progress.
- Preserve FY HVA coverage, covered/inactive toggles, prior-year evidence,
  prepared-meeting drafts and standalone HVA forms.
- Keep CAIP's separate population and completed-task methodology, fiscal-year
  grouping, activities-logged indicator and HVA indicator.
- No provider, calculation, MSX-write payload or background-job changes.

## Native implementation

- Shared window frame, fixed header/lens/scope controls, independently scrolling
  audit list and always-visible native footer. No document-level scrolling.
- Page-owned CSS and theme tokens replace all three templates' Bootstrap styles
  and component classes, including dynamically generated picker/activity markup.
- Native popovers replace recurring-meeting Bootstrap dismissal dropdowns.
- Pickers fit above/below their field within the reading region and track scrolling.
- Back restores scroll and expanded meeting/milestone rows; embeds leave outer
  frame, footer and history ownership to their host.
- Footer counts displayed records, not the coverage denominator.
- Validate saved preferences, expose storage failures, preserve scope/embed on
  navigation and prevent malformed saved values from causing redirect loops.
- Do not label CAIP as FY27 Data-filtered: that filter applies only to FY HVA.
- F1 describes separate methodologies, automatic saves and reading context.

## Verification

- Scoped Python regression/render tests: 77 passed.
- Native JavaScript preference/history/picker tests: 11 passed.
- Live before/after totals and row text match across all three methods:
  - Meetings: 48%, 39 logged, 0 ready, 43 needing matches; 3 weekly rows.
  - FY27 Data HVA: 23%, 14/61 covered; 47 uncovered rows.
  - CAIP: 16%, 53/334 activities logged; 12%, 41/334 HVA; 334 rows.
- All meeting/CAIP fields and milestone fields match the baseline except
  unsaved standalone activity timestamps, which the unchanged provider derives
  from the current time on each request.
- Desktop footer/window ownership verified for every method.
- Keyboard picker navigation, visible-row filtering, expansion, Back restoration
  and a browser-local intercepted draft-save failure checked without a live write.
- Recurring popovers open by keyboard, fit the window and close on Escape with
  focus returned to the invoker, without expanding the meeting or dismissing data.
- F1 Help verified; no editor diagnostics or diff-whitespace errors.
- Private before/after images cover meetings, FY HVA and CAIP. An expanded meeting
  editor image is also retained in session artifacts, never committed or DM'd.

## Review gate

- Discord accepted the generic review-ready DM, message `1557157050558058559`.
  No customer data or images were sent.
- User sign-off received and local commit completed. No push, merge or deployment authorized.
