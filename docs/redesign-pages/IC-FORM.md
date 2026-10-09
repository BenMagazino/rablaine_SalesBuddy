# IC-FORM: New/Edit Internal Contact

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/internal-contacts/new` and edit: 1152px root aligns commands around existing 620px fields.
- Dark/light live desktop has no horizontal overflow.
- Private evidence: `width-entity-ic-form-{before,dark-after,light-after}.png`.

- Checkpoint: 76, October 7, 2026. Status: VERIFY, awaiting authorized batch review.
- Final batch integration: 423 scoped pytest and 181 JavaScript tests pass.
- Scope native-style assertions to the owned form, not unrelated shell dialogs.
- Required-name redirects explicitly test rendered notices and retained input.
- Intervening navigation consumes global flashes normally without losing the draft.
- Baseline: `7a43faab`, approved `e5bde8c3`, plus uncommitted checkpoints 63-75.
- Last checkpoint of 63-76; no 77 started, no batch commit or additional approval.
- Approved effort remains about 75%; strict DONE counts remain unchanged.
- Scope: existing paired standalone forms, provider, shared manual lifecycle and help.

## Original contract and consumers

- Exact same-page HTML POSTs: `/internal-contacts/new`, `/internal-contacts/<id>/edit`.
- Name: required text, autofocus, blank New/existing Edit default, trimmed on save.
- Alias: optional text, blank/existing default, johnd hint, visible @microsoft.com suffix.
- Alias saves lowercased/trimmed, removes trailing @microsoft.com; blank becomes None.
- Role: optional free text, blank/existing default, original DAE/DSS/DSE hint.
- Suggestions, unchanged order: DAE, DSS, DSE - Security, DSE - Modern Work,
  DSE - Business Applications, SSP, TSP, CSA. Arbitrary roles remain accepted.
- No new restrictions, hidden payload fields, sync, enum validation or preferences.
- Success retains exact creation/update flash and redirect to `/internal-contacts`.
- Cancel still opens the directory; missing edit ID remains 404.
- Missing name retains original redirect and error, with raw input retained once.
- Edit duplicate retains original edit redirect/warning, now retaining raw draft input.
- New duplicate intentionally opens the existing matching Edit with its saved values.
  It does not overwrite that contact with attempted New input or misleading drafts.
- Database save failures roll back/log, render 500 and retain escaped raw input for retry.
- Existing directory name/row/New/empty-state links and canonical breadcrumbs unchanged.
- Note-view attendee Edit links keep the same route. No fragment/embed consumers exist.
- Note and engagement inline contact creation use separate existing JSON APIs unchanged.
- Attendee search, meeting prefetch, contact relationships and MSX DAE providers untouched.
- Edit originally nested forms: browser Delete submitted Edit, not intended deletion.
- Fixed with separate explicit `POST /internal-contacts/<id>/delete`, no payload fields.
- Native confirmation starts on Cancel, warns that drafts are not saved, preserves original
  note-attendee conversion/redirect/rollback. Engagement-contact conversion remains deferred.

## Native verification and evidence

- Continuous frame, focused 620px identity region, owned reading and fixed manual commands.
- Shared entry-local lifecycle preserves all three raw fields and reading position on Back.
- Links/Cancel/Escape/unload protect drafts; pending submits guard duplicates/navigation.
- Save payload remains enabled; server-error entries override stale draft history.
- `runTests`: ui_internal_contact_form, internal_contacts, ui_internal_contacts_directory,
  breadcrumb_entities: 139 passed, including ten new form cases.
- `node --test`: internal_contact/se/seller/territory/project/customer/milestone forms:
  52 passed, including six new input/guard/delete-pending/no-autosave cases.
- Live New/Edit fields, defaults, role order, labels and destinations match Before.
- No-autosave proof before typing: original form, shared lifecycle and loaded shell input
  handlers audited; only history snapshots on input, no network/storage business write.
- Actual browser Back restores all three unsubmitted fields on both New and Edit.
- Keep editing retains drafts; confirmed discard then Back restores originals/blank New.
- Delete confirmation opened/cancelled without submit; original dark theme restored.
- Desktop unchanged at 1566 x 1167; main x=0, commands y=1084.5, footer bottom=1167.
- Reading y=168.09 through 1084.5, no document overflow in either theme.
- Six private inspected photos: `checkpoint-76-ic-form-{new,edit}-{before,after}.png`
  and `checkpoint-76-ic-form-{new,edit}-light-after.png`.
- Observed POST paths throughout typed QA/Back: none; business/preference/sync writes none.
- Ordinary shell telemetry/cache bookkeeping may occur; no whole unchanged-DB claim.
- Existing sharing-hub 400 console failures remain unrelated. Playwright actionability
  timed out twice; actual DOM control activation verified dialog focus/guards instead.
- QA drafts, listener and temporary theme state cleared; dev server left responsive.
- Syntax/editor diagnostics and whitespace checks pass.
- Exactly one generic readiness DM accepted: ID `1557462577406148650`, exit 0.
