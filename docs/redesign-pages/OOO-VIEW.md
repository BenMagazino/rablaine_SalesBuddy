# Persistent 1:1 workspace, checkpoint 47

## October 8 reading-width revision
- Explicit standalone wrapper flag enables centered 1344px; embed/API fragment omit it.
- Live dark/light at 1559x1167: standing notes and conversation keep independent scrolling.
- Evidence: `width-workflow-workspace-{before,after,light-after}.png`.
- Before is a width-only reconstruction on the same live record, explicitly labelled.
- No notes or talking points edited. Revision is uncommitted and awaiting review.

- Routes: `/one-on-one/<workspace_id>`, embed and the existing seller detail fragment.
- Baseline: last approved hub `dead47b9`; Before captured before implementation.
- Status: VERIFY, user-approved October 6; committed locally as `6ee2af6d`.
- Approved effort estimate: about 52%; strict DONE counters are unchanged.
- Scope: persistent editor/dialogs and inline-host contracts, not the hub/prep report.

## Preserved contracts

- Keep the existing Quill and better-table editor, headings, formatting, lists,
  indentation, links, images, editable tables and table dimensions.
- Preserve standing HTML, table/image-only content, blank-note handling and 700ms
  autosave; talking points keep their exact PATCH payload and field values.
- Preserve engagement-first candidate search, seller/full-book scope, active-item
  exclusions, team/status/ACR context and each existing selection POST.
- Keep milestone conversion, inline engagement editing with all seven PUT fields,
  linked discussion-note creation and the three most recent note links/previews.
- Keep discussed dates/points, mark discussed, restore and confirmed removal,
  including orphan source snapshots. No provider, model or API changes.

## Native composition and coupled fixes

- Shared desktop frame/footer; standing context beside the conversation agenda,
  divided by lines with independent reading, not a directory/detail browser.
- Native search/edit dialogs, details menus/history, app tokens and controls.
  Checkpoint 48 adds native Initiative Tracker host events while preserving the
  workspace-scoped save/close/dispose integration and legacy-host compatibility.
- Serialize in-flight autosaves, expose explicit retries and retain failed drafts.
  Clean blur/initial rich-content normalization do not write to the database.
- Flush edits before mutations/navigation or inline-host replacement/close;
  protect unsent discussion notes and inline engagement changes.
- Retain the latest candidate response and selection type during pending saves.
- Back restores agenda and both note scroll regions plus history disclosure.
  Embeds never change parent history; invalid history produces visible feedback.
- Agenda/candidate/history entries are lists, not tabular grids. User-authored
  rich-note tables retain their original order and are not converted into sorters.

## Verification and review

- 30 scoped pytest tests pass (7.29s), using the activated repo venv:
  `python.exe -m pytest tests\test_one_on_one_workspace.py tests\test_ui_one_on_one_workspace.py tests\test_manager_one_on_one_js.py -q`.
- 44 Node tests pass:
  `node --test tests\js\ui_one_on_one_workspace.test.cjs tests\js\manager_one_on_one.test.cjs`.
  Editor diagnostics, four JS syntax checks and `git diff --check` pass.
- Isolated tests cover writes/payloads, concurrent edits, blank/rich saves, retries,
  failed-save mutation protection, native cancellation and inline replacement.
- Live read-only QA checks rich content, all five agenda identities/points,
  seller search/type switching, zero matches, loaded edit fields, existing empty
  workspace/history and nested native dialogs with parent/focus preserved.
- Fresh-read parity passes; monitored local mutation requests are zero. Back
  restores a real 120px agenda offset. Dark/light checked at 1566x1174 with 24px
  footer and no document scrolling. Dark restored without preference writes.
- Private images: `one-on-one-workspace-before.png`, `one-on-one-workspace-after.png`,
  plus `one-on-one-workspace-light-after.png`, `one-on-one-workspace-picker-after.png`,
  `one-on-one-workspace-embedded-after.png`, `one-on-one-workspace-history-after.png`.
- Screenshots inspected; private QA baseline/listeners cleared. Protected drafts,
  production and the running dev server are untouched. Live writes intentionally
  remain isolated-test-only; frozen browser animation/rAF required direct read-only
  event dispatch and completed-transition capture for some embedded checks.
- Review follow-up: remove the standing pane's unused scrollbar gutter so its
  formatting toolbar and editor span the full column width. Live widths all
  measure 656.71875px; comparison images are `one-on-one-workspace-width-before.png`
  and `one-on-one-workspace-width-after.png`. Added a gutter regression test.
- Height follow-up: standing notes fill the available page or inline-host height;
  toolbar stays fixed, long content scrolls inside, and manual/stored sizing is removed.
  Live full/embed bottom gaps are zero; constrained-host test tracks 219px available
  height and scrolls content without moving the toolbar. Notes remain unchanged.
  Images: `one-on-one-workspace-height-before.png` and `one-on-one-workspace-height-after.png`.
- One generic Discord review-ready DM accepted; message ID `1557211426064703549`.
## October 8 content-background consistency

- Standing-note and next-conversation panes use `--sb-ui-surface` in both themes.
- Discussion-note and engagement composers use the same reading/editor surface.
- Existing 1344px paired geometry, saved rich content and talking-point history remain.
- Evidence: `consistency-workspace-{before,after,light-after}.png`.
- Parent coordinates `test_ui_one_on_one_workspace.py` and `test_ui_workflow_consistency.py`.
