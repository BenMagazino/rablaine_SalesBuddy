# POD-VIEW: POD detail

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Creator review refinement, October 8, 2026
- Widen standalone POD detail from 1152px to the shared 1344px working region.
- Keep equal coverage/personnel panes, their independent scrolling and all assignments.
- POD directory width remains unchanged. Edit POD is also widened in a subsequent review request.
- Private revision evidence: `pod-wider-reading-{before,after,light-after}.png`.
- Live 1559x1174: each pane grows from575px to671px, zero reading/document overflow;
  roster identities and assignment values unchanged; footer remains full-width/pinned.
- 75 scoped Python and three POD interaction JavaScript tests pass.
- Prior 1152px rollout below is superseded; revision remains uncommitted and unapproved.

## Readable-width rollout, October 7, 2026
- `/pod/1`: 1152px root preserves equal flexible roster/coverage tracks without overflow.
- Live dark/light desktop verified; direct-child helper excludes shared modal fragments.
- Private evidence: `width-entity-pod-detail-{before,dark-after,light-after}.png`.

## Revision and scope
- Checkpoint 71, October 7, 2026; status VERIFY, uncommitted.
- Source: `7a43faab` plus uncommitted checkpoints 63-70, including POD directory/edit.
- Parent authorization covers 63-76; approved effort stays about 75%, DONE unchanged.
- Surface: `/pod/<id>`, `pod_view.html`, complete `partials/pod_view_content.html`.
- Only standalone template consumes this detail; no embedded detail consumer exists.
- Existing directory, edit, seller, territory and SE links retain this same route.
- Existing breadcrumbs and SalesIQ `get_pod_overview` remain unchanged.

## Audited product contract
- Identity, Edit POD and original alphabetical defaults retained.
- Territories are POD territories; counts are their direct customers.
- Sellers are unique across those territories; counts include full seller coverage.
- Seller names, optional email/type and customer counts remain visible.
- Engineers come from POD membership, not territory membership.
- Engineer names, optional email and specialty retain original destinations.
- DSSs remain grouped by territory and specialty, excluding three cloud specialties.
- Existing selected and automatic single DSS names stay static.
- Unselected multiple DSS choices retain original sorted options and disabled prompt.
- No DSS section when unavailable; all three roster empty states preserved.
- Disclosure uses original `dss_collapsed_pod_<id>` storage key/default.
- Exact POST: `/territory/<id>/dss-selection`; JSON specialty and string SE ID.
- Successful detail choices become static names; Edit POD changes saved preferences.
- No invented create, delete, exports, identity fields or provider changes.

## Native implementation
- Continuous desktop shell with compact coverage and technical-reading cells.
- Nine meaningful headings use shared SBTableSort, raw customer counts and labels.
- Records keep native anchors plus ordinary row navigation; modifiers remain untouched.
- Independent reading positions merge into entry history without overwriting sorting.
- Reuses checkpoint 70 assignment controller and native SBDialog lifecycle.
- Failed choices retain input/Retry; pending saves and failed drafts guard navigation.
- Detail-only saved-name behavior does not change the existing Edit POD surface.
- Deferred sorter mount waits for DOMContentLoaded; absent DSS safely initializes.

## Verification
- Isolated pytest: POD detail/form/directory, DSS and breadcrumb files: 168 passed.
- Node: POD detail/form/directory plus shared table sorter: 45 passed.
- Tests prove rosters, deduplication, roles, options, selected/single/empty paths.
- Shared isolated write tests cover exact saves, clears, invalid inputs and rollback.
- JS harnesses cover failures, retry, pending/draft guards, static success and history.
- Live desktop 1566 x 1167: original 2 territories, 4 sellers, 4 engineers, 7 choices.
- All 18 ascending/descending actions checked; all 12 detail destinations return 200.
- Actual Edit POD navigation and Back restore sort/row order and DSS disclosure.
- Native dialog opens/closes with Escape and restores Edit POD focus, no submit.
- Dark/light geometry has no horizontal overflow; status bottom remains 1167.
- Current live records fit both cells; nonzero scroll restoration is isolated-tested.
- Three screenshots saved privately and inspected: checkpoint-71-pod-detail-before.png,
  checkpoint-71-pod-detail-after.png, checkpoint-71-pod-detail-light-after.png.
- Theme/disclosure restored, QA sorts cleared; no live business writes performed.
- Ordinary read telemetry/cache bookkeeping may occur; no unchanged-DB claim.
- Existing staging sharing-socket DNS errors remain unrelated; dev server left running.
- One generic readiness DM accepted: `1557453322766516357` (exit 0).
- README, help and changelog updated; no branch/commit, SE checkpoints 72-74 untouched.
