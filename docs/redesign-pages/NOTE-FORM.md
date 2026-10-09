# NOTE-FORM: native editor workspace

- Checkpoint: 91.
- Status: VERIFY, first-pass design approved October9, 2026. Technical limits remain documented.
- Routes: `/note/new`, `/note/new?customer_id=...`, `/note/<id>/edit`.
- Composition: full-width customer editor/context workspace; 1152px single editor,
  darker outer canvas, independent scrolling and connected commands/status.
- Standalone root: `#noteFormRow[data-sb-page-surface]`; page explicitly loads
  `ui-page-frame.css` and uses shared `sb-directory-frame` policy.
- `data-sb-note-paired` selects the full-width pair or 1152px single pane when context
  is absent by toggling `sb-directory-frame`. No private width clamp, old
  shell-container padding or 1900px editor sizing remains.

## Original controls retained

- Customer/general context, project and multiple engagements, local call date/time.
- Partners, attendees, contacts, topics, AI tagging and existing relationship searches.
- Original Quill editor, formatting, images/tables, templates and meeting imports.
- Milestone selection/matching, task fields, linked tasks and inline engagements.
- Related notes and all contextual drawers, including project/note attachments.
- Save, discard draft, cancel, edit delete confirmation and Back/next context.
- Draft restore, debounce autosave, unsaved guards and calendar-linked inputs.

## Implementation

- Static and generated markup use app-owned controls, notices, layout and tags.
  Native menus/collapse and shared SBDialog replace Bootstrap widgets.
- Corrected shared native project fields retain the existing editor IDs and write
  handlers; the editor explicitly loads `ui-project-form.css`.
- Saving has explicit pending/error feedback and rejects duplicate submissions.
  Failed inline engagement saves no longer mark clean or submit the note anyway.
- The AJAX listener respects canceled/deferred validation, and dynamic contact
  selectors, status classes, nickname placeholders and ratings are native too.
- Edit drafts have separate note namespaces. Matching legacy edit drafts migrate
  without consuming unrelated creation drafts; unchanged create/edit navigation does
  not autosave or evict another draft.
- Native context drawers use `[data-sb-note-drawer][open]`, retaining earlier
  panes via `sb-note-drawer-shift-1..5`. `body.copilot-chat-open` offsets them by
  `--sb-chat-context-inset` (500px when chat opens, 0px closed), without touching
  chat or prompt context.
- Drawers use nonmodal `dialog.show()` with a fixed foreground layer above
  editor sticky commands. Nested review/photo dialogs remain genuinely modal.

## Evidence and verification

- Private manifest: `final-checkpoint-91-93.json`; actual Before retained.
- Actual live customer/general/edit GETs checked at 1559x1174, without resizing.
- Creator's October9 refinement makes the editor full width whenever the second
  pane contains related notes or inline engagements. General/empty-context editors
  retain1152px; standalone note reading remains1344px.
- After the safety fix, an actual read-only existing-note edit/navigation kept
  every current stored draft byte-for-byte unchanged.
- Native engagement/project menus, partner/project drawers and Escape checked.
- All eight theme pairs checked for editor ink/surface and horizontal overflow.
- Framework CSS/JS blocked on the dedicated page: editor renders without
  Bootstrap Reboot or runtime, with no JavaScript page errors.
- All After and supplemental captures refreshed after global native base loading:
  live HTML has `ui-base.css` and no Bootstrap framework tags.
- Final scoped selections pass 1389 Python and 1113 JavaScript tests,
  including note forms, bodies, previews, templates and actual drawer controllers.
- Live Contacts and SalesIQ coexist at the current1751px desktop: drawer right
  and chat left both measure1251px,
  chat is500px wide, and the drawer is not `:modal`. Its foreground hit test passes.
  Escape closes a nested modal first, then chat without closing the context drawer.
  Closing background context preserves chat-input focus.
- Read-only edit and customer-create navigation preserves both currently stored
  draft payloads byte-for-byte. These checks do not recover the earlier lost payload.

## Remaining integration and limits

- No live server save, delete, enrichment or share action was exercised.
- **Validation incident:** visiting an existing edit page triggered its old
  unload autosave and overwrote the unsaved creation draft at
  `salesbuddy_draft_107` with note285's edit payload. No server note save occurred.
  The collision and unchanged-navigation writes are fixed, but the original
  creation payload has not been recovered. No raw preflight snapshot was captured;
  the previously protected pages are no longer accessible through either browser
  registry. Current storage remains unchanged after the final read-only checks.
  This is not a recovered draft or a successful data-preservation result.
- General/edit supplements have no invented Before images.
