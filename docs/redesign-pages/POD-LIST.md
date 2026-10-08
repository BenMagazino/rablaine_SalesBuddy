# POD-LIST: POD directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/pods`: heading and relationship table share a centered 1152px root.
- Dark/light live desktop has no horizontal overflow; complete seller/SE links remain.
- Private evidence: `width-entity-pods-list-{before,dark-after,light-after}.png`.

- Checkpoint: 69, October 7, 2026. Status: VERIFY, awaiting batch review.
- Approved baseline: `7a43faab`, approved implementation `e5bde8c3`.
- Prior uncommitted checkpoints 63-68 preserved; this checkpoint is uncommitted.
- Parent batch remains 63-76; approved effort about 75%, DONE counters unchanged.
- Scope: `/pods`, standalone directory template, owned CSS/history and page help.
- Existing POD edit/detail remain deferred to checkpoints 70/71.

## Audited product contract

- Provider: `pods_list()` in `app/routes/pods.py`, unchanged.
- Every POD, `POD.name` ascending; no personal/role or seller-mode filter.
- Existing eager-loaded territories and directly assigned solution engineers unchanged.
- Territory count uses `pod.territories|length`; SE count uses direct POD membership.
- Sellers are unique model identities across all POD territories, sorted by name.
- SE names remain alphabetical direct POD members, not territory-only DSS assignments.
- Empty personnel stays empty, zero counts remain visible; No PODs yet stays unchanged.
- Original whole-record detail destination and View-name accessible entry retained.
- Names of sellers/SEs were text, not detail links; no new personnel actions invented.
- No filters, exports, Edit/Delete, creation or manual sync commands existed here.
- Consumers: Browse menu, admin count link and canonical POD detail/edit ancestry.
- No alternate fragment/embed renderer exists; consumer endpoints remain unchanged.
- Existing SalesIQ `get_pod_overview` continues its original independent provider.

## Native implementation

- Continuous frame, compact heading, owned reading region and all-POD count/scope rail.
- Flat 41.5px live rows with functional header/record dividers, no card grid.
- Name link is keyboard accessible; non-control row surface opens original details.
- Name, Sellers and Solution Engineers sort text; Territories and SEs sort raw counts.
- All five meaningful headers have export labels; global sorter loads exactly once.
- Fresh history preserves provider order; Back restores sorting and reading context.
- Reading history merges existing state, retaining independent shared-sorter state.
- No provider, route, model, business write or preference contract changed.

## Verification and private evidence

- `python -m pytest tests\test_ui_pods_directory.py tests\test_breadcrumb_entities.py`:
  130 passed, including five isolated POD tests and existing breadcrumb contracts.
- `node --test tests\js\ui_pods_directory.test.cjs tests\js\ui_table_sort.test.cjs`:
  34 passed; malformed state, modifiers, raw counts and mounted history covered.
- Live Before/After: all three PODs, counts, unique sellers and SE names match exactly.
- Every heading toggles both directions in both themes; Space sorts, Enter opens the link.
- Actual name links to all three PODs and row-cell navigation open original details.
- Actual detail/Back retains descending SE-name order and row identities.
- Desktop 1566 x 1167 unchanged; main/surface x=0, width=1566, footer ends y=1167.
- Dark/light images inspected, no document overflow; original dark attributes restored.
- Live rows fit without scroll; nonzero reading restoration proven in isolated JS tests.
- Photos: `checkpoint-69-pods-directory-before.png`,
  `checkpoint-69-pods-directory-after.png`, `checkpoint-69-pods-directory-light-after.png`.
- Observed reload/detail/Back/keyboard network writes: none, no POST paths.
- Directory has no writes; existing detail DSS POST is
  `/territory/<territory_id>/dss-selection`, audited only, never triggered in live QA.
- No business/preference/sync writes or interception; normal shell telemetry may occur.
- Existing sharing-hub WebSocket DNS failure is unrelated; no whole-DB unchanged claim.
- Syntax/editor diagnostics and whitespace checks pass; QA sort state cleared.
- Exactly one generic readiness DM accepted, ID `1557449076038045747`, exit 0.
