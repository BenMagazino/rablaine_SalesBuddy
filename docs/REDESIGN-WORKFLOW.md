# Redesign workflow and feature-parity contract

Created October 2, 2026. This is the implementation process, not a claim that
the offline studies already have production feature parity.

## Start here each day

1. Open the [page tracker](REDESIGN-PAGE-TRACKER.md).
2. Reconcile product changes since the last checkpoint before choosing a page.
3. Choose one page or one tightly coupled page/partial family.
4. Create its evidence card from the [parity template](REDESIGN-PARITY-TEMPLATE.md).
5. Audit the current implementation, redesign it, verify parity, get tester
   approval, and update the tracker. Leave a next-action note before stopping.

The tracker is the durable source of progress across chats and working days.
Do not rely on conversation memory or a screenshot to declare a page complete.

## Review ownership and commit cadence

The user is the pre-release reviewer. References to "tester approval" in this
process mean the user's own validation, not approval from an external tester.
The user's tester and other users provide post-release QA after deployment;
their review is not a prerequisite for a checkpoint commit or page sign-off.

Commit each coherent, verified checkpoint on `feature/ui-redesign`, including
its implementation, scoped tests and tracking/evidence updates. The user has
authorized this cadence; no separate commit request is needed each time.
A page can span several commits. Committing progress does not mark the page DONE.

- Run relevant checks and confirm the dev app remains usable before committing.
- For user-visible checkpoints, show the running app and obtain the user's
  validation before committing, following the project's existing review gate.
- Infrastructure-only checkpoints can be committed after technical verification.
- Do not commit broken intermediate work merely because a session is ending.
  If interrupted, preserve it locally and record status, failures and next action.
- Record the checkpoint commit SHA in the handoff. When beginning the next
  checkpoint, carry that SHA into the evidence card so it identifies the tested
  implementation without requiring a self-referential commit hash.
- Keep commits focused and use conventional messages plus the Copilot trailer.
- Pushing, merging to main and deployment remain separately approved actions.
  Checkpoint commit permission does not authorize any of those.

## Starting baseline

- Product baseline: `ef552587a6514e116840b19f27c9b79ea6db0708` (current main
  when this process was created).
- Initial route/template inventory: 90 page handlers, 78 page templates,
  24 partial/helpers, and one shared base template.
- Consolidated implementation branch: `feature/ui-redesign`, based on the product
  baseline above. The approved [design archive](../design-studies/README.md) was
  brought forward from original commit `eb4fed2` as `7510963`, preserving newer
  product code rather than replacing it with archive-era code.
- Approved direction: Graphite / Muted default dark, with Graphite, Midnight,
  Harbor, and Carbon dark/light pairs. Use the reviewed connected-pane design.
- Target: Bootstrap-free finished application, preserving product behavior.
  Follow the archive's [Bootstrap audit](../design-studies/BOOTSTRAP-AUDIT.md)
  and [native-window plan](../design-studies/REDESIGN-PLAN.md).
- This branch only establishes tracking. No page has been redesigned or approved.

The global product baseline is fixed. Each page also records the actual product
revision audited and the redesign revision tested. Newer behavior takes
precedence over the original baseline.

## Status rules

| Status | Meaning |
| --- | --- |
| TODO | Not inventoried at control/information level yet |
| AUDITED | Current behavior and visible information captured in an evidence card |
| BUILDING | Redesign in progress |
| VERIFY | Implemented; parity checks or tester review still pending |
| DONE | Parity proven, tester approved, revisions and evidence recorded |
| REOPEN | A later product/shared-component change invalidated approval |
| BLOCKED | Cannot proceed; reason and next action recorded |

Only DONE counts as checked off. A good-looking mockup is not DONE. A previously
DONE page becomes REOPEN when relevant behavior changes, even if no visual
change is obvious. Uncertain impact means REOPEN until investigated.

## The per-page loop

### 1. Capture the current product contract

Render the page in the live development app (`http://127.0.0.1:5000`) with its
existing data. Inspect the template, included partials, JavaScript, route/service
code, and relevant tests. Do not use production port 5151 for development.

Inventory each control and each information surface as a separate parity row:

- Navigation, links, keyboard shortcuts, hover actions, menus, contextual actions.
- Search, filters, sorting, pagination, selections, remembered state, counts.
- Create/edit/delete, confirmations, cancel, validation, draft/unsaved recovery.
- Dates, defaults, associations, permissions/availability and conditional controls.
- Fields, badges, legends, indicators, summaries, statuses, units and timestamps.
- Async loading, background progress, refresh, disabled, empty and failure states.
- Modals, drawers, tabs, expandable sections, exports/imports, rich-text controls.
- API side effects and data persistence, including what should NOT be modified.

Record inputs, observable output and side effects, not merely a button's label.
Hidden-on-hover controls and JS-generated markup are part of the inventory.
No data in a state is not evidence that the feature does not exist.

Keep evidence free of customer-identifying screenshots/content in git.
Private captures may stay outside the repository; commit sanitized descriptions
and reproducible steps. Never copy the live database into the design archive.

### 2. Rework the page using shared components

Map every original parity row to a redesigned destination. Layout and interaction
placement can improve; functionality and information must remain available.
Do not silently remove a control, obscure an essential action, or reinterpret a
semantic status to make the design cleaner.

Any intentional removal or behavior change requires explicit user approval,
recorded in the card with rationale. "Not in the mockup" is not approval.
Defer unrelated product fixes to their own work, but track their parity impact.

Milestone/note and other shared detail partials must work in full-page and
injected-modal contexts. Test initialization, repeated opens, cleanup, nested
dialogs, unique IDs, parent restoration and focus return. A shared component
checkoff does not automatically approve every host page.

### 3. Verify the actual behavior

- Execute every parity row and record PASS, FAIL, BLOCKED or approved change.
- Compare information, navigation, prefilled values and persisted outcomes.
- Test populated, empty, loading, disabled, validation/error and conditional states.
- Test keyboard access, focus, dismissal and unsaved edits.
- Test the current desktop Electron viewport, resize/maximize, renderer zoom
  and usable scrolling. Mobile/tablet work is out of scope.
- Verify the page in all eight supported theme variants, including overlays and
  meaningful status contrast. Shared token changes reopen affected approvals.
- Run scoped automated tests on the isolated test database. Never the full suite
  or tests against the live development/production database.
- Exercise data mutations only on deliberately chosen development records.
  Avoid unnecessary external writes/sync operations; use isolated tests for
  failure/concurrency scenarios that cannot safely be induced live.

Screenshots prove appearance, not side effects. A changed markup assertion must
be replaced by an equivalent behavioral assertion, not simply deleted.

### 4. Sign off and stop cleanly

The user verifies the page in the running app. Record the audited product SHA,
tested implementation SHA, date, tester, evidence and remaining issues.
All required rows must pass with no unapproved omissions before marking DONE.
If working-tree code was tested, keep VERIFY until its resulting commit is
recorded and the tested code is confirmed unchanged.

Before leaving: update the row, last checkpoint, open issues and next action.
This should make resuming tomorrow a two-minute task.

## Explicit homepage requirements

These are mandatory HOME parity rows, not optional embellishments:

| ID | Existing contract | Required verification |
| --- | --- | --- |
| HOME-01 | Create note on a selected calendar day using that day's quick-create control and customer picker | Choosing a customer opens note creation with the selected local calendar date and customer preserved; cancel makes no note; keyboard users can reach the action |
| HOME-02 | Manually refresh meetings for one calendar day using its date-number refresh affordance | Refresh targets the chosen date, not implicitly today; loading feedback appears; duplicate clicks and days owned by morning sync do not launch duplicate pulls |
| HOME-03 | Refresh survives navigating to another month while the request runs | Completion updates the appropriate visible day or queues it for redraw when that month returns; spinner state clears without relying on detached DOM nodes |
| HOME-04 | Morning-sync ownership and Today health information | Pending/in-flight indicators and relevant health states retain their meaning; refresh availability is understandable |

Source: `templates/index.html`, `openQuickCreateModal`, `triggerDaySync`,
`applyAuraIndicators`, `renderCalendar` and `refreshDaysInPlace`.
These four seeded rows are NOT the complete homepage audit. Saved notes, ghost
meetings, customer matching/dismissal, drafts, calendar navigation, attention
panels, projects and dashboard settings also need explicit rows.
The redesigned placement may differ, but the two tester-reported actions must
remain discoverable without relying only on an unexplained hover icon.

## Handling bug fixes and features during the redesign

Continue shipping product work normally on separate branches. The redesign is
not a reason to freeze main. Preserve its business fixes when integrating.

After a product change merges, and before the next redesign work session:

1. Record a checkpoint: previous product SHA, new product SHA and date.
2. Inspect the entire product change range, not only template diffs:
   `git log --oneline <previous-product-sha>..<new-product-sha>` and
   `git diff --name-status <previous-product-sha> <new-product-sha>`.
3. Review route/service/model/default/test changes for user-visible effects.
   A changed API can invalidate a page without touching its HTML.
4. Add new pages/surfaces to the tracker, and add/modify parity rows for changed
   controls, information or behavior. Removed routes need an explicit disposition.
5. Record affected page IDs in the change ledger. Reopen affected DONE pages and
   shared hosts; explain unaffected decisions rather than assuming them.
6. Integrate product commits into the redesign using the project's normal git
   workflow. Integration success is not parity approval.
7. Verify affected behavior and record new revisions before restoring DONE.

For work authored during the redesign, include affected tracker IDs in the
change's notes and update the ledger. The ledger is a convenience, not the sole
detector: the source diff and fresh inventory catch unlogged changes.

## Final reconciliation and release gate

After all current pages are DONE, choose a specific release-candidate product
SHA and record it. Then:

1. Re-enumerate all current registered HTML routes, aliases, templates, fragments,
   global surfaces and Electron screens against the initial inventory. Classify
   every addition/removal; an old count of 90 is not a permanent target.
2. Review every product commit from the fixed starting baseline to that candidate
   for behavior changes. Cross-check the ledger and page cards, including changes
   outside presentation files and conditional/sync states.
3. Ensure each DONE card covers that candidate's current behavior, either by
   retesting or by an explicit evidenced no-impact disposition.
4. Recheck navigation reachability, cross-page flows, shared partial lifecycle,
   global UI, all theme variants and native window-state restoration.
5. Verify Bootstrap CSS/JS/classes/variables/behavior hooks are gone from runtime
   surfaces. Resolve the separate icon replacement decision explicitly. Update
   related tests and development instructions; retain unrelated uses of the word
   bootstrap and historical design evidence.
6. Require zero unresolved parity failures, unapproved removals, unclassified
   routes/templates or unreviewed ledger entries. Record final tester approval,
   scoped test results and candidate revisions. Follow normal user approval and
   changelog gates before merging/deploying.

If product changes land after the candidate was selected, advance the candidate,
reconcile that additional range and reopen affected items. Final approval is
always tied to a commit, never to "latest main" or a date alone.
