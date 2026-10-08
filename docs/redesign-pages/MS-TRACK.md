# Milestone Tracker, checkpoint 50

## October 8 reading-width revision
- Dense tracker uses a centered 1344px root, preserving its single filter line.
- Standalone customer/seller and picker slots are tightened explicitly; all ten
  controls stay on one line, including the eleventh Reset control when displayed.
  Actual control centers and widths verified, with no business/filter submissions.
- Live dark/light at 1559x1167: reading region has no horizontal overflow.
- Private evidence: `width-workflow-tracker-{before,after,light-after}.png`.
- Shared tracker fragment has no standalone root-width rule.
- Revision is uncommitted and awaiting review; existing checkpoint status is unchanged.

- ID: MS-TRACK; `/reports/milestone-tracker`, existing `/milestone-tracker` redirect.
- Template: `milestone_tracker.html`; shared `partials/milestone_tracker_content.html`.
- Audited baseline and preceding approved MSX workspace commit: `3e6244eb`.
- Status: VERIFY, user-approved October 6; local commit `a9682c55`, including the
  one-row filter follow-up. No push/merge/deploy.
- Approved effort estimate: about 58%; strict DONE counters are unchanged.

## Original inventory and preserved contracts

- All customer-owned cached records, including inactive execution statuses, remain available.
- Standalone defaults to descending raw monthly usage; seller lock retains on-team-only
  customer membership and its original closest-due-first ordering. Providers are untouched.
- Milestone title, opportunity context, number, customer/favicon, seller, status,
  commitment indicator, due date/urgency, raw ACR, workload, team and favorite fields remain.
- Search indexes every saved field and cached forecast comments. Customer search,
  seller, quarter, status, area, urgency, commitment, team, favorites and Reset remain.
- List and Calendar retain remembered selection, month controls, customer highlighting,
  day counts, due-date placement, filtered-list totals and milestone destinations.
- CSV, Clipboard and Email retain filtered rows, order, boolean membership and source URLs.
- Sync/SSE progress, brainrot toggle, incomplete/failed status, VPN feedback and retry remain.
- Canonical native previews retain forecasts, comments, tasks/HoK, nested editors and guards.
- Calendar API scoping is intentionally unchanged, including its inherited narrower
  filter contract and Clear All quarter behavior. No provider/filter redesign is included.

## Native composition and necessary integration

- Fixed title/export/sync band, compact totals, native searchable/multi-select pickers,
  native list/calendar tabs, one independently scrolling queue and fixed status footer.
- Review follow-up: all filters share one desktop row, including active Reset;
  result count sits beside totals. Long picker labels retain their full hover titles.
- Divider-only table, eight bidirectional raw-key data sorts (seven when seller-locked).
  Source/favorite action columns and calendar weekday headings are not sortable.
- Export labels survive sorter button insertion. No second sorter/dialog asset load.
- Back restores entry-specific filters, sort, view, month and actual reading position,
  including independent scroll inside populated calendar days.
- The shared seller fragment receives the same native controls/list, not a seller overhaul.
  Move the original team action to its shared asset so that host has a callable handler;
  successful membership updates also update its raw sorting key. Original payloads remain.

## Verification and review evidence

- Initial migration: 198 pytest checks passed: `python.exe -m pytest tests\test_ui_milestone_tracker.py
  tests\test_milestone_tracker.py tests\test_milestone_tracker_filters.py
  tests\test_ui_milestone_preview.py tests\test_sync_status.py
  tests\test_milestone_sync_errors.py tests\test_disable_buttons_no_customers.py`.
- 107 Node checks pass across tracker filters/actions, table sorter, record/workflow/task,
  forecasts, exports and sync errors. Writes and auto-refresh detail GETs are isolated.
- Live exact baseline/fresh-read parity: 1,360 rows, original order, fields and links;
  $9,595,011 monthly ACR, 127 past due, 21 this week. Sixteen bidirectional sorts pass.
- Literal no-match resets correctly; PoC returns 92, On Team 107, Off Team 1,253,
  On Track 924. October Calendar shows exactly its provider's 82 entries.
- Actual Back restores PoC, ACR ascending and 487px reading scroll; calendar November
  selection and October day-one 100px inner scroll also restore. Customer Escape is safe.
- Eight theme pairs preserve desktop geometry/footer with no horizontal overflow;
  sampled input text contrast is at least 13.64:1. Native geometry survives Bootstrap removal.
- Private current-session `files` PNGs: `milestone-tracker-before.png`, `milestone-tracker-after.png`,
  `milestone-tracker-calendar-after.png`, `milestone-tracker-light-after.png`.
- No local live business writes, sync, refresh or detail auto-load. Protected drafts,
  production and the running dev server remain untouched. Dark and QA state are restored.
- Rendered script parsing, editor diagnostics, static JS syntax and diff checks pass.
- Filter follow-up: 140 scoped tracker tests pass. Live long customer/quarter/status/area
  selections and Reset stay on one row; the Area menu remains inside the desktop viewport.
  Images: `milestone-tracker-filters-before.png`, `milestone-tracker-filters-after.png`.
- Discord accepted one generic readiness DM: `1557237240810446908` (exit 0).
## October 8 content-background consistency

- Shared tracker roots use `--sb-ui-surface`; filters, headers and status tones remain.
- Existing 1344px width, scope, sorting, calendar and embedded geometry are unchanged.
- Evidence: `consistency-tracker-{before,after,light-after}.png`.
- Parent coordinates `test_ui_milestone_tracker.py` and `test_ui_workflow_consistency.py`.
