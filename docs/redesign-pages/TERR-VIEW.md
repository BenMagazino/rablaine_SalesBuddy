# TERR-VIEW: Territory detail

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Content consistency sweep, October 8, 2026
- Standalone roster/activity workspace now uses 1344px rather than 1152px.
- Actual `.td-layout` grows from 1150px to 1342px; roster stays 340px.
- The full roster reading pane uses `ui-surface`, not the darker `ui-context`.
- Preserve Notes edge alignment, raw sorts, history, saved Accounts mode and all 102
  accounts. Dark/light desktop has no document or reading horizontal overflow.
- Private evidence: `consistency-territory-detail-{before,after,light-after}.png`.
- Uncommitted correction only; earlier width evidence is superseded, no checkpoint advances.

## Creator Notes-column correction, October 8, 2026
- Right-align Notes headings and counts in both account groups at the reading edge.
- Retain the standard 18px cell inset beside the scrollbar; remove the large gap
  caused by left-aligning counts inside the last column.
- Scope only Accounts in Territory; seller-roster and Recent Notes date columns stay unchanged.
- Preserve outer width, populations, raw sorting values and the saved view preference.
- Private revision: `territory-notes-edge-{before,after,light-after}.png`.
- Live 1559x1174 dark/light: heading and every one of 102 account counts end 18px
  before the usable reading edge, rather than about 150px for the first prior count.
- No horizontal overflow; 1152px root, roster alignment and saved Accounts mode unchanged.
- Scoped territory detail/width-policy regression: 93 Python and eight JavaScript pass.
- Earlier account-column photos are superseded; correction remains uncommitted.

## Readable-width rollout, October 7, 2026
- `/territory/21`: 1152px root comfortably contains 340px roster and flexible account pane.
- Dark/light live desktop has no horizontal overflow; shared fragments in dialogs do not match.
- Private evidence: `width-entity-territory-detail-{before,dark-after,light-after}.png`.

- Status: VERIFY, checkpoint 68, October 7, 2026; uncommitted `feature/ui-redesign`.
- Baseline: `7a43faab` plus uncommitted checkpoints 63-67, preserved; user review pending.
- Approved effort remains about 75%; strict DONE counters are unchanged.
- Scope: existing `/territory/<id>`, its content and explicit view preference.
- POD surfaces remain original; checkpoint 69 is next.

## Original population and actions
- All territory sellers remain alphabetically ordered; counts include full seller coverage.
- Optional POD retains its canonical link; Edit Territory opens the same naming form.
- Saved `territory_view_accounts` selects Accounts or Recent Notes, default False.
- Accounts use seller-territory membership, not direct customer territory assignments.
- Growth and Acquisition remain separate; other seller types stay excluded.
- Each group retains descending lifetime note counts and original tie order.
- Recent Notes use direct customer territory, the UTC seven-day threshold and newest first.
- Note dates retain local input display, showing time only when non-midnight.
- Names, customer favicons, exact counts and note/customer/seller/POD destinations survive.
- No personal seller/role filter, new fields/routes/queries/migrations or creation/delete action.
- Original empty messages remain mode-specific; missing territories still return 404.
- The explicit POST remains `/api/preferences/territory-view` with JSON
  `{territory_view_accounts: boolean}`; success retains the original reload behavior.
- No autosave or new SalesIQ analytical feature.

## Composition and consumers
- Continuous native frame: command band, seller roster and independently scrolling activity.
- Functional dividers separate roster, scope, groups and compact sortable records.
- Name/count/date columns sort both ways with raw counts and full timestamp keys.
- Shared sorter loads once, preserves row identity and entry-local group sorting.
- Page history restores independent pane offsets on actual Back; changed saved modes
  do not reuse reading offsets from another population.
- Pending preference saves prevent duplicate writes and departure; failures restore
  the original selection, unlock retry and show honest accessible feedback.
- Database preference failures roll back and log; malformed object bodies return JSON 400.
- GET preference creation is retained; saved Recent Notes is tested isolated, not changed live.
- Actual consumers: territory/seller/customer/note directories and details, topic detail,
  POD/SE details and the embedded Home note fragment retain canonical territory links.
- No territory fragment endpoint or existing embedded territory-detail host exists.
- Complete territory content/scripts are together in `partials/territory_view_content.html`;
  existing embedded note links open the same standalone native territory, not a fake preview.

## Verification and private evidence

- Scoped pytest: territory detail/directory/form files, original two detail tests and
  `test_integration.py::test_territory_create_post`: 40 pass in isolated databases.
- Node: territory detail/directory/form controller files, 20 pass.
- Live actual dev desktop 1566 x 1167, dark/light; viewport and saved preference unchanged.
- Before/After match: 3 sellers, 53 accounts, 43 Growth / 10 Acquisition, counts 21/10/22.
- All six data headings pass 12 live directional checks; POD/Edit Back restores 700px reading
  and all three independent table sorts. Seller/customer links and embedded Home note
  dialog's territory destination verified against actual records.
- Main y78/h1065; reading y221.78/h921; footer y1143 to1167; no horizontal overflow.
- Four inspected photos: `checkpoint-68-territory-detail-before.png`,
  `checkpoint-68-territory-detail-after.png`, `checkpoint-68-territory-detail-light-after.png`,
  `checkpoint-68-territory-embedded-link-after.png`.
- Live POST paths observed: none. No writes/sync/preferences/drafts submitted; normal
  shell telemetry/detail-cache bookkeeping may occur. Existing hub DNS errors remain.
- F1 native help opens/closes within the desktop; theme and own QA state cleared/restored.
- Protected tabs untouched; own network/error listeners removed after final QA.
- Readiness DM: accepted once, ID `1557447655783665796`, exit 0; generic text only.
