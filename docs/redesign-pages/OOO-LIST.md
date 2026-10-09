# 1:1 workspace hub, checkpoint 46

## October 8 reading-width revision
- Standalone hub uses centered 1344px, preserving the 340px launcher and 790px table minimum.
- Embedded hub does not opt in. Live dark/light at 1559x1167 has no reading overflow.
- Evidence: `width-workflow-workspace-hub-{before,after,light-after}.png`.
- Revision is uncommitted and awaiting review; existing checkpoint status is unchanged.

- Route: `/one-on-one/`, including embed.
- Baseline: approved product `acb97fb3`; live Before captured before editing.
- Status: VERIFY, user-approved October 6; locally committed as `dead47b9`.
- Scope: existing directory and quick starts only. Persistent workspace/editor
  and Initiative Tracker are not redesigned here. Hub remains outside the nav menu.

## Preserved contracts

- Keep the read-only provider and most-recently-updated source order.
- Preserve every workspace destination, person/type, stripped 180-character
  standing-note preview, queued/discussed count and displayed update date.
- Preserve available-seller exclusion and case-insensitive substring filtering.
- Seller quick starts still create/reuse scoped workspaces on their existing GET.
- Manager/Other creation keeps its explicit POST, field names, required name
  and 200-character limit. No automatic workspace creation on directory rendering.

## Native composition

- Shared frame/footer, sortable directory and line-separated inline quick starts.
- All six data columns sort both ways with the existing shared sorter. Updated
  sorts by displayed calendar date; initial ordering remains the provider's order.
- Every cell retains a native link to the same workspace, including modifier/
  middle-click behavior. Only the person link adds a sequential keyboard stop.
- Seller-filter empty feedback and matched/available footer count.
- Back restores seller filter, shared sort state, independent reading regions,
  and an unsubmitted name/type. Embeds do not read/write parent history.
- Invalid history reads/writes are visibly reported and logged.

## Verification and review

- 26 scoped Python and 37 JavaScript tests pass: native hub, existing workspace
  behavior, controller state and shared sorting. Syntax/editor checks pass.
- Live comparison preserves all seven captured fields and source order for
  five workspaces, plus both available-seller destinations.
- All 12 live sort directions retain row/link identities. Successful and zero-
  match seller filters behave correctly. Existing-workspace drill-down/Back restores
  the seller filter, name/type draft and actual selected table sort.
- Nonzero reading offsets are covered by controller tests; the five-row live
  directory fits the current desktop viewport without scrolling.
- Dark/light checked at the existing desktop size. Dark restored, 24px status
  footer retained, no document scrolling and no Bootstrap page-owned controls.
- Fresh reload confirms original records/previews/counts/dates/order unchanged.
  No live create submissions, seller quick starts or standing-note edits performed.
- Private images: `one-on-one-hub-before.png`, `one-on-one-hub-after.png`,
  `one-on-one-hub-light-after.png`. Images remain outside the repository.
- Browser QA baselines/drafts cleared. No push, merge or deployment authorized.
- Discord accepted the generic review-ready DM, message `1557196584733904897`.
## October 8 content-background consistency

- Directory and launcher reading panes explicitly share `--sb-ui-surface`.
- Existing 1344px paired frame, selection, sorting and manual creation controls remain.
- Evidence: `consistency-workspace-hub-{before,after,light-after}.png`.
- Parent coordinates `test_ui_one_on_one_hub.py` and `test_ui_workflow_consistency.py`.
