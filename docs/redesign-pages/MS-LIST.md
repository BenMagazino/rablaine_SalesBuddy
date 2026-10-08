# Milestones directory, checkpoint 51

## October 8 reading-width revision
- Heading, commands and reading table share the centered 1152px root.
- Live dark/light at 1559x1167: no horizontal overflow; shell/status remain full-width.
- Private evidence: `width-workflow-milestones-{before,after,light-after}.png`.
- Revision is uncommitted and awaiting review; existing checkpoint status is unchanged.

- ID: MS-LIST; existing `/milestones`, actual template `milestones_list.html`.
- Audited baseline: `a9682c55`, approved Tracker and one-row filter follow-up.
- Status: VERIFY, user-approved October 7; committed locally as `c7fb7b19`.
- Approved effort estimate: about 59%; strict DONE counters are unchanged.

## Actual surface and preserved population

- This is a simple local directory, not a tracker redirect or an MSX workspace.
- Unchanged provider includes every milestone with a customer association, including
  inactive statuses; default order remains descending `created_at`, without pagination.
- Original fields are title/Untitled Milestone, source URL and linked-call count.
  Title, URL and call count retain the original full-page milestone destination.
- Customer/seller/status/commitment/ACR/date/workload/team/favorite fields, search,
  filters, exports and dialogs were not present in this directory. They remain
  available through the existing Tracker and details, not newly invented here.
- Manual New Milestone destination and automatic URL-to-note creation explanation
  remain. Forms, detail content, cache refresh, task actions and payloads are untouched.

## Native implementation and integration

- Fixed command band, restrained divider-only three-column directory, independently
  scrolling reading region, sticky headings and native scope/default-order footer.
- Reuses the approved Graphite/Muted tokens, Segoe UI, native frame and ancestry.
- All three true data columns sort both ways; raw call counts sort numerically.
  Export labels remain explicit, and source URLs retain their complete hover text.
- One globally loaded `SBTableSort`; no duplicate sorter or new controller framework.
- Existing reading-history helper restores this page's real scroll separately from
  its table sort, without overwriting other page state or any drafts.
- Persistent Tracker navigation connects to the approved page without embedding
  its sync, calendar or detail auto-refresh in this readonly directory.

## Verification and review evidence

- 63 scoped pytest checks pass: `tests/test_ui_milestones_directory.py`,
  `tests/test_milestones.py`, `tests/test_ui_milestone_tracker.py`,
  `tests/test_ui_milestone_preview.py`. All writes use the isolated test database.
- 57 Node checks pass: table sorter, reading history, record dialog and milestone
  workflow harnesses, including guarded drafts, pending writes and nested disposal.
- Live original and fresh-read parity: 1,360 records, 38 linked calls, exact original
  order, titles, source URLs, call counts and destinations. All six sort directions pass.
- Actual Tracker navigation and Back restore Calls ascending and 487px reading scroll.
  Commands remain visible; footer ends at the 1174px desktop viewport, no horizontal overflow.
- Dark/light inspected without preference writes; original Graphite dark restored.
- Empty, untitled, singular/plural, escaped content, inactive and orphan-record
  behavior verified in isolated tests. Mutating detail auto-refresh is not opened live.
- Private session `files`: `milestones-directory-before.png`,
  `milestones-directory-after.png`, `milestones-directory-light-after.png`, inspected.
- Editor diagnostics, help-script syntax and diff whitespace checks pass.
- No sync/refresh/business mutations, protected-draft navigation or production access.
  Shared legacy Copilot/share overlays still depend on Bootstrap, outside this page scope.
- Discord accepted one generic readiness DM: `1557243629909704725` (exit 0).
