# Shared milestone body and forecast comments

- Status: DONE for this bounded slice; technically verified and user-approved
- Checkpoint: 12
- Parent checkoffs: MS-VIEW, FR-MS, forecast helpers, HOME and GLOBAL-SHELL remain BUILDING
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `3f8ddd5`, approved divider-only note body
- Implementation revision: `c652057`
- User sign-off: October 3, 2026, after semantic tag refinement and functional testing
- Next action: review the following Home workbench checkpoint.
  No push, merge or deployment.

## Scope and original inventory

Replace the shared milestone body's Bootstrap grid, cards, lists, buttons and
forecast presentation in both the preview and `/milestone/<id>`. Preserve its root
identity and scoped initializer, original routes, field conditions and lifecycle.
There is no new entity, query, report, backend endpoint or dependency.

Retain customer/favicon, opportunity and engagement destinations; conditional
engagement creation; status, owner links, commitment, number, workload, value,
monthly usage, due date, team membership and original date fields; associated
notes, ordering, topic truncation and New Note context; task category, due date,
HVA, linked note and MSX destinations; cached, empty, uncached and no-MSX forecast
branches; and the original full-page Edit/MSX/Delete commands.

## Implementation and intentional changes

- One 280px details rail beside a forecast reading pane. Related context uses
  divider lines and spacing, not cards, shaded grouping boxes or new group titles.
  Existing Details, Associated Notes, Tasks and Forecast Comments headings remain.
  There is no hide/show control or metadata band above the reading pane.
- Native geometry, labels, lists, controls, loading captions and error regions
  use the approved tokens. Existing entity badges retain their semantic classes
  and reuse the note-body badge styling without changing note layouts or prose.
- User-requested refinement: filled metadata tags remain distinct from outlined
  action buttons, with transparent borders and matching text/fill hues.
  Topics use the existing blue accent; On Track and On Team use green; At Risk
  and task HVA use amber; Blocked uses red; Completed uses blue. Cancelled,
  inactive/unknown statuses, counts and additional-topic indicators use gray.
  Labels/icons and linked-tag hover/focus affordances remain. Note-body tags and
  status indicators outside the sidebar are unchanged.
- Server and client forecast presentation now opt in for milestones and opportunities.
  Opportunity integration is checkpoint 89, VERIFY, documented in [OPP-VIEW](OPP-VIEW.md).
  Shared sorting,
  reference links, local timestamps, rich-table/plain-text branches, handlers,
  identifiers and POST/PUT/DELETE payloads remain in one implementation.
- Cached comment drafts transfer into the fresh form with focus preserved.
  Reset the now-hidden cached textarea after transfer so clearing the visible
  draft does not leave a phantom dirty draft.
- Failed comment edits retain text, re-enable controls and restore the Save
  caption rather than leaving a stale Saving caption. This shared correction
  applies to both presentation modes.
- Fresh status tags use DOM text and dataset assignment, not interpolated
  attribute content. Native edit/delete comment icons have explicit accessible names.
- Native team actions and engagement success rows retain delegated hooks.
  Nested engagement/task editor fields and pending-write/draft guards are unchanged.
- Full-page deletion uses the shared native dialog, Cancel autofocus, dismissal
  and focus restoration. Its original normal POST remains `/milestone/<id>/delete`;
  previews omit those commands and that confirmation.
- Existing browser alerts/confirms for remote comment and membership writes
  remain unchanged. This slice does not replace their write/error policy.

## Verification

143 scoped Python checks and 75 scoped Node checks pass. Python covers the new
body contracts, milestone previews, note-body regressions, comment tracking,
existing milestone CRUD/details/comments and MSX task endpoints. Node covers
both forecast presentations and the shared dialog, record, milestone workflow,
task, note-action, image and theme contracts.

Updated three old layout tests to assert actual navigation destinations, rail
placement and section order, rather than Bootstrap classes or heading levels.
Editor diagnostics and the diff whitespace check are clean. Existing SQLAlchemy
`Query.get()` deprecation warnings remain in unchanged handlers.

| Required/original contract | Evidence | Result |
| --- | --- | --- |
| Full page and preview share native body and every original field/link | Enriched isolated fixtures and live milestones 342, 880 and 2700 | PASS |
| Associated notes/tasks retain ordering, counts, topic truncation, HVA and destinations | Isolated general/customer note and task fixtures; live 880 with five notes/tasks | PASS |
| No customer, no MSX ID, empty or malformed caches retain conditional behavior | Isolated markup and existing route regressions | PASS |
| Cached/fresh forecasts preserve sorting, escaping, tables, refs and timestamps | Native/legacy VM tests and isolated rich/plain cache fixtures; live real forecasts | PASS |
| Cached-to-fresh draft/focus handoff leaves no hidden dirty copy | Held real read on 880, typed draft, released read; focus/text retained and clearing becomes clean | PASS |
| Preview comment drafts support Keep editing and Discard | Live draft, Escape, Keep editing, Escape/Discard and clean reopen | PASS |
| Comment edit Cancel restores original body | Live edit of 880's first comment, throwaway text, Cancel | PASS |
| Remote comment payloads and error recovery remain | Exact intercepted POST/PUT/DELETE on 880; failures explicit, Save restored, five real comments unchanged | PASS |
| Native team controls retain destinations, payloads and delegated replacement | Exact intercepted Leave/Join POSTs, native replacement classes and original milestone ID | PASS |
| Nested task/engagement draft flows remain usable | Live task draft on 880 and engagement draft through Home's 342 launcher; Keep editing/Discard leaves parent intact | PASS |
| Read failures retain useful cached content and recover | Intercepted detail GET 503, five cached comments retained, actual Refresh recovers | PASS |
| Full-page Delete defaults to Cancel and posts to original destination | Live 880 confirmation, Escape/opener restoration and intercepted normal POST/redirect; record intact | PASS |
| Opportunity default stays legacy and functional | Actual `/opportunity/3058` cached/fresh rendering, legacy heading/composer, no page errors; VM and helper tests | PASS |
| All eight themes fit and meet sampled text contrast | Live full page/preview plus refined semantic tag probes; minimum 4.73:1, no horizontal overflow | PASS |
| New component styling is Bootstrap-independent | Temporarily disabled only Bootstrap CSS; sampled native fonts, colors, padding, borders and radii unchanged | PASS |
| Approved note styling remains intact | All 17 note-body checks and shared note-action/image regressions | PASS |

Desktop columns measure 280px/942px on the full page and 280px/731px in the
preview at the existing viewport. No viewport resizing or mobile testing.
Temporary family/mode attributes and Bootstrap stylesheet state are restored.
The sidebar-tag refinement is verified against the adjacent plus and Linked Note
buttons. The live stylesheet is refreshed without navigating, moving the user's
scroll position, closing dialogs or altering drafts.
Tag borders are transparent, while adjacent action buttons retain their visible
outlines and transparent backgrounds. Semantic colors come from existing theme
tokens, not a separate tag palette.
Hidden CSS probes verify 13 status/tag cases in all eight theme pairs, including
Cancelled, On Track, At Risk, Blocked, Completed, inactive/unknown states,
On Team, additional topics, topics, counts and HVA. All use their expected token
and retain transparent borders; minimum text contrast is 4.73:1. Probes are removed
afterward without changing actual record data. Tint blending uses OKLab so the
neutral surface hue does not overwhelm the semantic hue.

All browser checks use the existing development server/database at
`http://127.0.0.1:5000`. Comment, membership and deletion test requests are
intercepted before reaching their write endpoints. No real note, engagement,
task, comment, membership or deletion write is performed. Normal read/cache
refreshes are allowed. All interceptors are removed and throwaway drafts cleared.
The user's separate New Note tab is untouched.

## User audit and stopping point

The owned Home tab is staged with real milestone 880, Azure for Healthcare,
open in its preview at the top. It has five real associated notes, tasks and
forecast comments. The correct MSX link and Full Page destination are available.
Review the rail grouping, forecast reading pane, note/task links and comment
edit/Cancel controls. Full Page shows Edit/MSX/Delete and the native confirmation.
Milestone 342 remains a useful engagement-creation example through Home.

No interceptor remains. Posting/saving/deleting a comment, changing membership,
creating an engagement/task or confirming milestone deletion is a real write.
Review/cancel unless you actually intend to change records.

The user approved checkpoint 12 after testing its other functionality. Home dashboard/calendar
styling is the next portion. Full page/fragment reconciliation, remaining global
surfaces and theme-family persistence still require later work. DONE counts stay
pages 0/90, helpers 0/24 and globals 5/17.
## October 8 content-background consistency

- Shared milestone roots and context/reading panes explicitly use `--sb-ui-surface`.
- Existing 1344px standalone width and compact fragment geometry remain unchanged.
- Semantic badges, forecast markup, hover states and task controls are preserved.
- Evidence: `consistency-milestone-detail-{before,after,light-after}.png`.
- Parent coordinates `test_ui_milestone_body.py` and `test_ui_workflow_consistency.py`.
