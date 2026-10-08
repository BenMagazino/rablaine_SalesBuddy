# IC-LIST: Internal Contacts directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/internal-contacts`: 1152px root aligns heading, commands and identity/role table.
- Dark/light live desktop has no horizontal overflow.
- Private evidence: `width-entity-ic-list-{before,dark-after,light-after}.png`.

- Checkpoint: 75, October 7, 2026. Status: VERIFY, awaiting batch review.
- Baseline: `7a43faab`, approved implementation `e5bde8c3`, plus uncommitted 63-74.
- Parent batch remains 63-76; approved effort about 75%, DONE counters unchanged.
- Scope: existing directory, owned native CSS/history, deletion confirmation and help.
- New/Edit forms now have separate checkpoint 76 [evidence](IC-FORM.md); no detail route or filter invented.

## Audited product contract
- Provider returns every `InternalContact`, ordered by name, with no personal/role scope.
- Preserve name, ID, alias-derived Microsoft email, free-text role and missing values.
- Missing alias retains Not set; missing role remains empty.
- Original name/Edit destination is `/internal-contacts/<id>/edit`; row/name now carry it.
- New Contact and empty-state Create your first retain `/internal-contacts/new`.
- Empty guidance still explains automatic creation through note attendees.
- Exact directory write: `POST /internal-contacts/<id>/delete`, no payload fields.
- Delete preserves note attendees by copying name/email and clearing their contact FK.
- Successful deletion retains the original flash and redirect to `/internal-contacts`.
- No original filters, pagination, export, detail, sync or preference writes existed.
- Consumers: Browse menu, canonical New/Edit ancestry, form Cancel and save redirects.
- Only standalone directory consumer exists; no fragment/embed renderer was found.
- Notes and engagements reuse contact identities in their independent people search.
- Existing `POST /api/internal-contacts`, `PATCH /api/internal-contacts/<id>`,
  attendee/contact attachment APIs, meeting prefetch and MSX DAE upserts are unchanged.

## Native implementation

- Continuous desktop frame, compact command/context band, flat rows and status count.
- Divider lines separate commands, sortable header, records and the persistent status rail.
- Names are keyboard-accessible Edit links; non-control row clicks use the same destination.
- Delete uses one shared native dialog, safe identity text, explicit warning and Cancel.
- Pending deletion blocks duplicate submits/dismissal; pageshow resets pending controls.
- Commit failure rolls back contact and attendee changes, logs context and renders HTTP 503.
- Failure shows an honest retained-record directory with canonical Internal Contacts ancestry.
- Name, Alias and Role sort both ways with raw text; unavailable values remain last.
- Actions/counts are not sort controls; every heading has an export label.
- Shared sorter/dialog load once; original source order stays unchanged on initial load.
- Entry-local reading state preserves independent sorter and unrelated history state.

## Verification and private evidence

- `python -m pytest tests\test_ui_internal_contacts_directory.py tests\test_internal_contacts.py
  tests\test_attendees.py tests\test_engagement_contacts.py tests\test_breadcrumb_entities.py`:
  186 passed, including seven directory scope/parity/rollback/POST-only tests.
- `node --test tests\js\ui_internal_contacts_directory.test.cjs
  tests\js\ui_table_sort.test.cjs tests\js\ui_dialog.test.cjs`: 49 passed.
- Live parity: all 10 original identities/fields, initial ordering and destinations match.
- All three columns sort both directions in dark/light; blank aliases/roles stay last.
- Keyboard Space sorts; name and non-control row links open actual Edit; actual Back restores.
- Live population fits without scrolling, so Back restores top=0; nonzero offsets tested isolated.
- Delete dialog shows exact POST action/identity; Cancel/Escape restore focus, no write submitted.
- Desktop 1566 x 1167; full-width x=0, 43px rows, footer bottom=1167; no horizontal overflow.
- Photos inspected: `checkpoint-75-internal-contacts-before.png`,
  `checkpoint-75-internal-contacts-after.png`, `checkpoint-75-internal-contacts-light-after.png`.
- Original dark attributes restored; QA sorting/session state cleared, no drafts/listeners added.
- No business/preference/sync writes; ordinary shell telemetry may occur, no unchanged-DB claim.
- Existing sharing-hub CORS/400 console failures are unrelated to this native directory.
- Legacy Edit nested forms fixed in checkpoint 76; deferred deletion still does not convert engagement contacts.
- Python/JS syntax, editor diagnostics and diff whitespace pass; no branch/commit/deployment.
- Exactly one generic readiness DM accepted: ID `1557460815345487983`, exit 0.
