# SE-LIST: Solution Engineers directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/solution-engineers`: 1152px root aligns heading and identity/assignment table.
- Dark/light live desktop has no horizontal overflow.
- Private evidence: `width-entity-se-list-{before,dark-after,light-after}.png`.

- Checkpoint: 72, October 7, 2026. Status: VERIFY, awaiting batch review.
- Baseline: `7a43faab`, approved implementation `e5bde8c3`, plus prior uncommitted 63-71.
- Parent batch remains 63-76; approved effort about 75%, DONE counters unchanged.
- Scope: existing `/solution-engineers`, standalone template, owned CSS/history and help.
- Edit/detail checkpoints 73/74 remain untouched; no routes or providers changed.

## Audited product contract

- `solution_engineers_list()` eagerly loads PODs, returns all SEs ordered by name.
- Role, personal seller and impersonated seller mode do not narrow this directory.
- Preserve every name, alias-derived Microsoft email, specialty and direct POD assignment.
- POD names stay alphabetical; territory-only assignments are not substituted for PODs.
- Missing email/specialty stay empty; unassigned records retain No POD assigned.
- Empty population retains No solution engineers yet, without an invented New SE flow.
- Original name/detail and explicit Edit links retain exact ID-based destinations.
- Email and POD labels remain text, not invented mailto or POD navigation actions.
- No original filters, pagination, delete, sync, export or directory writes existed.
- Consumers: Browse menu, admin directory link and canonical detail/edit ancestry.
- No standalone fragment/embed renderer exists; existing consumers retain their endpoints.
- Existing SalesIQ POD/territory engineer rosters use independent unchanged providers.

## Native implementation

- Continuous frame, compact heading, flat records and owned vertical reading region.
- Name/email/specialty/PODs share one readable row, instead of stacked default metadata.
- Native name links support keyboard entry; non-control row clicks open the same detail.
- Explicit Edit remains independent, including modifiers and accessible engineer identity.
- Four surfaced data headings sort raw text both ways; missing values stay last.
- Actions, scope totals and default labels are not sortable diagnostic data.
- Export labels exist on every header; global sorter loads once, no new export invented.
- Initial provider order remains unchanged; entry-local sorting and scroll restore on Back.
- History updates retain unrelated state and independent sorter state.

## Verification and private evidence

- `python -m pytest tests\test_ui_se_directory.py tests\test_breadcrumb_entities.py`:
  130 passed, including five isolated SE parity/scope tests.
- `node --test tests\js\ui_se_directory.test.cjs tests\js\ui_table_sort.test.cjs`:
  34 passed; mounted history, raw sort semantics, modifiers and malformed state covered.
- Live Before/After: all 52 identities, fields, assignments and 104 links match exactly.
- Original order confirmed again after clearing QA sorting; 44 unassigned rows preserved.
- All four columns verified ascending/descending in dark and light; missing email last.
- Space activates sorting; Enter opens a real detail; explicit Edit and row links verified.
- Actual browser Back restores all row identities, sort state and nonzero scrollTop 703.
- Desktop remains 1566 x 1167, main x=0/full-width; footer ends exactly at y=1167.
- Flat live rows are 38.5px; owned reading scrolls, no document/horizontal overflow.
- Dark/light photos inspected; original dark attributes restored, QA history/listeners cleared.
- Photos: `checkpoint-72-se-directory-before.png`, `checkpoint-72-se-directory-after.png`,
  `checkpoint-72-se-directory-light-after.png`, private session files only.
- Observed live navigation writes: none. Directory has no POST path.
- Existing audited writes: `/solution-engineer/<id>/edit` and
  `/solution-engineer/<id>/delete`, neither submitted during live QA.
- No business/preference/sync writes; ordinary shell telemetry may occur.
- Existing sharing-hub WebSocket DNS failure remains unrelated; no unchanged-DB claim.
- Syntax/editor diagnostics and diff whitespace pass; no branch, commit or deployment.
- Exactly one generic readiness DM accepted: ID `1557454760523862027`, exit 0.
