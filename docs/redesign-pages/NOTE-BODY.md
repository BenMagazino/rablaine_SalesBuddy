# Shared note body and full-page commands

- Status: DONE for this bounded slice; technically verified and user-approved
- Checkpoint: 11
- Parent checkoffs: NOTE-VIEW, FR-NOTE, HOME and GLOBAL-SHELL remain BUILDING
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `ce61a1d`, approved milestone-preview checkpoint
- Implementation revision: `3f8ddd5`, committed after user approval
- User sign-off: October 3, 2026, after reviewing the final divider-only grouping
- Next action: review the shared milestone body in [checkpoint 12](MILESTONE-BODY.md).
  No push, merge or deployment is authorized.

## Scope and original inventory

Replace the Bootstrap grid/cards in `partials/note_view_content.html` with one
shared desktop workbench body used by both the Home preview and `/note/<id>`.
Keep the existing root identity, rich-text container, route expressions and
action-editor hooks. There is no new query, entity, backend or write endpoint.

Preserve date and optional local call time; customer/nickname/favicon/TPID;
conditional seller and territory; topics, partners and all attendee variants;
engagements, projects, milestones, opportunities and linked MSX tasks; created/
updated local timestamp markers; and the complete authored rich-text HTML.

Full-page Share/Edit/Delete remain available. The preview continues to omit
those commands. Full-page Edit still forwards the existing return destination.
The Share hook/count remain intact; the global sharing workflow itself still uses
its existing dialog and is not migrated or approved here.

## Implementation and intentional styling changes

- Native CSS grid with a 280px details rail, a continuous divider and a reading
  pane, rather than two cards and nested opportunity cards.
- Semantic details groups, clear muted labels, consistent section headings and
  quieter linked entity tags using the approved theme tokens.
- User-requested visual refinement: separate related context, people and linked work
  with horizontal rules and spacing only, without cards, backgrounds or group titles.
  Empty optional groups are omitted; timestamps stay in a quiet footer. The rail and reading-pane widths
  are unchanged. No hide/show control, collapse state or top metadata band is added.
- Canonical entity classes/icons remain for existing conventions/integrations,
  but the redesigned tags have complete app-owned geometry and styling.
  Scoped specificity/important colors override the legacy important palette;
  untouched pages retain their existing tag styles.
- Keep the existing truncation lengths, optional labels/tooltips and destinations.
  Long metadata wraps within the rail instead of widening the page.
- Rich headings, paragraphs, lists, quotes, code and tables receive scoped
  workbench typography. The stored HTML, images and authored inline widths/styles
  are not rewritten, stripped or flattened.
- Wide content scrolls within the reading pane. A measured 6px focus gutter keeps
  image outlines visible within the pane's available reading width.
- Shared image activation and quick-action draft/save protection are unchanged.
- Full-page commands use the native button styles. Delete uses `SBDialog` instead
  of a Bootstrap modal, with labelled confirmation, Cancel autofocus,
  Escape/backdrop/cancel dismissal and opener-focus restoration.
- Delete remains the original normal POST to `/note/<id>/delete`; no client-side
  deletion request, route, validation or success/error policy is added.

## Verification

- 66 scoped Python checks pass: new note-body contracts, note-preview/action
  contracts, shared navigation, general-note detail and existing note-view smoke.
- After the grouping refinement, all 25 body/preview tests pass, including five
  new single-link-type cases, attendee placement and omission of empty groups.
- 106 shared Node UI checks pass, including dialog, note-action, image, record,
  milestone workflow and theme regressions.
- No editor diagnostics in changed templates, CSS or tests; diff whitespace check passes.
- Existing `Query.get()` deprecation warnings remain in unchanged backend handlers.

| Original/required contract | Evidence | Result |
| --- | --- | --- |
| Preview and full page share one body and every optional metadata group | Isolated full/fragment tests and live full-page navigation from the preview | PASS |
| Visual grouping is shared, always shown and does not move or hide metadata | Full/fragment group assertions, general-note omission, single-link-type cases; live unchanged 280px rail and reading width, all eight themes | PASS |
| Customer, seller, territory, topic and related-record destinations remain | Existing preview tests plus enriched real-model fixture link/field assertions | PASS |
| All seven attendee variants retain links, email/role tooltips and fallback spans | Parameterized isolated customer/partner/SE/seller/internal/external/anonymous cases | PASS |
| Seller mode and empty/general notes retain their conditions | Isolated seller-mode and general/empty-body checks | PASS |
| Local call time and created/updated timestamps remain | Existing preview time/date checks plus midnight/no-update branch assertions; live rendered timestamps | PASS |
| Rich HTML and image widths are preserved | Exact authored HTML present in the response, including headings, lists, table, code, links and inline image width | PASS |
| Linked opportunity state/number/value/owner and MSX task/HVA information remain | Isolated enriched metadata fixtures | PASS |
| Quick-action drafts and nested images remain usable | Live Keep editing/Discard and clean reopen; portrait-image open/Escape/focus return; Node regressions | PASS |
| Delete is explicit, defaults to Cancel and returns focus | Live native confirmation, Cancel autofocus and Escape restoration; isolated labelled form contracts | PASS |
| Delete submits the original method/destination | Exact live POST interception followed by a mocked redirect; original record remains present | PASS |
| All eight theme pairs fit and remain legible | Live preview geometry, no body horizontal overflow, sampled labels/headings/timestamps/tags contrast at least 4.87:1 | PASS |
| New body/commands do not depend on Bootstrap component CSS | Temporarily disabled only Bootstrap's stylesheet; sampled native typography, colors, padding/radius stay identical; stylesheet restored | PASS |
| Focus gutters remain inside the reading pane | Live full-page and preview geometry, 6px outline clearance both sides, no record/document overflow | PASS |

All browser checks use the existing development server/database at
`http://127.0.0.1:5000`. No note, action item, engagement, task, comment or membership
is created/changed/deleted by live validation. The Delete POST is intercepted before
reaching Flask, and its interceptor is removed afterward. Throwaway local drafts,
temporary theme attributes and the stylesheet state are restored. No viewport
resizing; the user's separate New Note tab is untouched.

## User audit and stopping point

The owned tab is staged with the real full note page open at its top. Review
the untitled, divider-separated metadata groups, quieter tags and reading pane.
The same grouping is verified in the Home preview. Open/close an image and
inspect Share/Edit/Delete placement or open/cancel the delete dialog.
The action editor remains available for linked engagements.

No interception remains: submitting an action item or confirming Delete is a
real write. Review/cancel unless you actually intend to change records.

This is an independent reviewable stopping point. Shared milestone-body styling
is the next comparable slice; full homepage/calendar parity, sharing/global
surfaces, other pages, theme-family persistence and final product reconciliation
remain later work. DONE counts stay pages 0/90, helpers 0/24, globals 5/17.
The approved implementation is committed as `3f8ddd5`.
