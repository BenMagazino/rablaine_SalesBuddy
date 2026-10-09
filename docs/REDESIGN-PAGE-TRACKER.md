# Redesign page and surface tracker

Use the [workflow](REDESIGN-WORKFLOW.md) and [page evidence template](REDESIGN-PARITY-TEMPLATE.md).
Inventory date: October 2, 2026. Baseline product SHA:
`ef552587a6514e116840b19f27c9b79ea6db0708`.

## Approved first-pass baseline

- Creator approves the complete first-pass redesign October9, 2026:
  **105 / 105 design checkpoints approved; zero awaiting design review.**
- Future page-specific refinements during normal use are follow-up work, not
  unfinished first-pass checkpoints.
- Creator explicitly authorizes committing, merging to `main` with `--no-ff`,
  tagging the changelog with the merge SHA and pushing October9.
  Production-shell rebuild and OS-level runtime checks have not been performed.

- Approved checkpoints63-90 and all width/background/gutter refinements are
  committed as `f7a5fa04` on `feature/ui-redesign`, October8.
- The creator authorizes completing checkpoints91-105 as one unattended batch,
  with a fresh Before/After audit gallery and one Discord notification only
  after all15 are verified and ready. No intermediate readiness messages.
- Scope includes notes/Home completion, settings/admin/utilities, setup/chat/
  sharing, Electron/errors and final framework/dependency reconciliation.
- All15 final checkpoints are implemented with technical VERIFY evidence. The fresh
  private `review-91-105.html` audit contains preserved Before and current After
  evidence. Final scoped selections pass1389 Python and1113 JavaScript tests.
  Creator's October9 first-pass sign-off explicitly approves this final batch,
  including the subsequent Note, appearance-switch, Admin and setup refinements.
- October9 review refinement: the Note editor is full width when related notes
  or engagements occupy its second pane; single-pane editing remains1152px.
  Live1751px desktop and bounded single-pane checks pass without overflow;
  105 scoped Python and9 JavaScript checks pass. Checkpoint91 After evidence is
  refreshed, while original Before captures remain unchanged.
- Current captures use real dev data and the desktop viewport; original
  earlier Before files remain unchanged.
- **Validation incident:** the old edit unload autosave overwrote one unsaved
  creation draft during validation. Namespace and unchanged-navigation guards
  are fixed, but the original payload has not been recovered. No server note
  save occurred. See [the incident and limits](redesign-pages/NOTE-FORM.md#remaining-integration-and-limits).
  Technical test success is not a recovered draft or release approval.
  Creator declined recovery of this dev-only draft; it is not an outstanding
  design-review gate.

### Previous batch notes (historical)

- Branch: `feature/ui-redesign`, HEAD `7a43faab`; no commit, push, merge or deployment.
- Last committed approved implementation: `e5bde8c3`, checkpoints 53-62.
- Checkpoints63-90 are implemented, VERIFY, user-approved October8 and uncommitted.
- Shared gutter standard is complete: all centered standalone content regions
  use the darker canvas outside their surface-colored reading pane.
  This replaces the Sellers-only override. Full-width roots cover the canvas;
  shell-free embeds retain their existing surface. Breadcrumb/status colors stay unchanged.
 165 scoped regression tests pass;32 report/legacy routes pass64 live Dark/Light
  checks, five shell-free embed routes stay unchanged and all eight palette pairs pass.
- Creator signs off all pending checkpoints63-90 after this gutter standard.
  Approved effort now approximately90%. This is approval, not permission to
  merge, push, deploy or implement checkpoint91. Changes remain uncommitted.
- Earlier creator approval of all reading-width/background updates October8,
  including the352px standalone Milestone context pane, did not by itself
  approve checkpoints63-90; the later full sign-off above supersedes it.
  Checkpoint gallery After evidence is refreshed from the current live UI;
  all36 original Bootstrap Before PNGs are preserved and SHA-256 verified.
- Initial Sellers-only gutter experiment used the darker canvas outside
  the unchanged1152px reading pane. Not rolled out to other pages; awaiting
  creator feedback at that stage. It is now the shared, approved standard.
  Dark/light checks and8 scoped directory tests passed.
  Checkpoint63 current After photos, including expanded/light variants, refreshed;
  original Bootstrap Before hashes remain unchanged.
- Same private return gallery: `review-63-76.html`, now covering all 28 checkpoints.
  36 original Bootstrap/current-UI pairs, including New/Edit and Search history.
  122 fresh Dark/Light After screenshots,158 total PNGs decoded successfully.
  All122 After files are refreshed again for the shared darker-gutter standard.
  Final approval/progress labels render correctly;36 original Before hashes match.
  All primary variants and current contextual states are covered at1559x1174.
  No stale After images are shown; old images and gallery are preserved separately.
  Offline sharing is pictured as the actual no-teammates notice, not a fake modal.
  Fill My Day remains idle/confirmation-only; no enrichment or business writes.
  Refreshed gallery has zero stale After references or horizontal overflow.
  Requested generic readiness DM accepted: `1557880273083961356`; no private content sent.
- Final selected regression: 901 pytest and 379 JavaScript tests pass, no deselections.
  This covers the new surfaces and coupled shared consumers, not the full suite.
- Static ancestry discovery now follows local renderer helpers without lowering
  the 90-page threshold. Failed Template save/update retain Settings ancestry.
- Twenty-eight checkpoint and two refinement readiness DMs accepted;
  no private data sent externally.
- Sellers review refinement aligns territory tags in a shared column, including
  missing-email rows. Live themes and expansion checks pass; 6 pytest/4 JS tests pass.
  Gallery includes revision evidence; one additional generic readiness DM accepted.
- User selected centered directory reading areas. Sellers and Customers now opt into
  a shared 1,152-pixel working width; headings/controls/results align while the shell
  remains full-width. Live themes, disclosure and actual Back
  pass; 22 pytest/9 JavaScript cases pass. Seven additional revision photos inspected.
  Layout-direction approval is not batch approval; refinements remain uncommitted.
- User requested the same reading-width correction across all relevant views,
  including previously approved pages. The broad pass uses explicit 1152px roots,
  or 1344px for dense tables/contextual workspaces; full-width shell bands remain.
  Home retains its useful calendar/attention split. Legacy Settings still uses
  its existing 1320px container; remaining TODO pages are not silently migrated.
  Shared/direct-main selector and standalone guards preserve embedded/modal consumers.
  Review artifact: `reading-width-review.html`, linked from the original return gallery.
  Three workflow Before images are explicitly labelled width-only reconstructions
  on the same loaded live records, not original pre-edit captures.
  Tracker retains one filter line even with Reset visible; engagement count
  headings keep whole words. Search history groups wrap rather than overflow.
  Current classification covers all 67 actual native roots: 30 at 1152px, 31 at
  1344px and six intentional full-width surfaces (Seller detail, Marketing,
  What's New, Whitespace, Bucket Products and Revenue Analyzer), plus inherited
  Seller Products. Home retains its connected grid.
  Initiative Tracker, Seller Alerts and Import retain the measured 1344px bound.
  Creator review explicitly restores Bucket Products and Analyzer to full width.
  Final selected regression: 982 Python and 901 JavaScript tests pass, no failures
  or deselections. This is scoped UI and directly coupled report coverage, not the full suite.
  Embedded/modal contracts, exact native-root inventory and inherited-root policy pass.
  The original 28-checkpoint gallery is preserved; broad revisions remain uncommitted.
  Current private width gallery has 174 comparison pairs and 560 image references
  (559 unique PNGs), including 92 fresh whole-app consistency comparisons.
  Lazy-loaded visible images and gallery overflow checks pass.
  Three reconstructed Before labels are present; no source captures are misrepresented.
  One generic broad-refinement readiness DM accepted: `1557623279420842045`;
  no private screenshots, data, code or URLs sent.
- Width review follow-up: POD detail is now1344px rather than1152px after the
  creator found it cramped. Both equal panes gain96px; directory/forms unchanged.
  Live dark/light at1559x1174 has zero horizontal overflow and unchanged assignments.
  75 scoped Python and three JavaScript tests pass. Earlier POD photos are retained
  as superseded history; latest revision is first in its width-gallery section.
  This is a requested correction, not batch approval; everything remains uncommitted.
- Subsequent request also widens Edit POD to1344px. Existing inner layout now1240px
  gives900px to assignments, up154px; identity stays300px, directory stays1152px.
  Both live themes fit without overflow or changed assignment values. Combined
  POD detail/edit and width-policy regression:87 Python/11 JavaScript pass.
  Form revision pictures precede preserved/superseded originals in the same gallery.
- Seller detail returns to full width at the creator's request; Sellers directory
  stays bounded. Customer headers and rows align with their heading at an 18px
  left inset. Actual 102-customer seller retains all rows and independent scrolling.
  Dark/light inspected at unchanged 1559x1174, no horizontal overflow.
  Scoped detail/directory/width-policy regression: 90 Python/14 JavaScript pass.
  Latest revision precedes superseded bounded evidence in the same width gallery.
- Specialties directory no longer has a second inner table cap. Both brief and
  description-bearing shapes fill the existing bounded pane. Live table grows
  from760px to1135px usable width inside the unchanged1152px root; all14 rows remain.
  Dark/light inspected at1559x1174 without overflow.81 Python/five JavaScript pass.
  Latest comparison added to the same width gallery; no approval or commit implied.
- Specialty detail receives the same inner-width correction: partner table fills
  all1135px usable reading width instead of1000px, with the1152px root unchanged.
  Both themes at1559x1174 have zero overflow and retain all nine live partners.
  Combined detail/directory/width-policy regression:90 Python/11 JavaScript pass.
  Latest comparison added above preserved historical photos; still uncommitted.
- Territory Accounts Notes headings/counts align at the right reading edge with
  the standard18px inset, instead of the large gap from left-aligned last-column text.
  Roster and Recent Notes dates are unchanged; live102 rows and saved mode preserved.
  Dark/light1559x1174 has no overflow.93 Python/eight JavaScript pass.
  Latest revision added above historical evidence; no approval/commit implied.
- Latest creator review batch widens Connect Goals, MSX Workspace, 1:1 Report,
  Reports hub and Revenue Config from1152px to1344px. Config's actual nine-field
  form expands1087px to1279px rather than staying capped at1120px; embedded scope
  retains its prior cap and host-owned width. Topics removes760px/1100px inner
  caps and fills1135px usable reading width inside its unchanged1152px root.
  All129 topics,15 reports/four groups and nine configuration values remain.
  MSX's1384 opportunities,983 milestones and five tasks remain in their existing tabs.
- Bucket Products and the actual `/reports/revenue` Analyzer return to full width,
  1344px to1559px at the current desktop. Customer Revenue retains1344px.
  Workareas, sticky headers and expanded product history now use the shared
  dark/light palette rather than mismatched canvas backgrounds. Seller Alerts
  is not part of this restoration and remains1344px. Live1559x1174 checks show
  zero horizontal overflow; all43 Analyzer alerts/14 visible and Priority sort remain.
- Latest nine-surface regression:263 Python and111 JavaScript tests pass.
  Editor diagnostics and Git whitespace checks pass. Updated comparisons precede
  the preserved/superseded rollout images, with expanded revenue evidence retained.
  Pure width/background corrections require no additional changelog entry.
- Whole-app consistency sweep supersedes the prior Revenue Import resume point.
  Reading and contextual content panes now share the theme surface, including
  Seller/Territory sidebars and all revenue list/inspector/sticky-header paths.
  Legacy neutral body/card backgrounds also follow the same palette, without
  migrating pending legacy layouts. Command/status bands, hover/selection,
  identity/status fills, calendar meanings and authored content remain distinct.
- User selected1344px minimum for actual paired working regions, not fields
  grouped inside one form. Customer/Territory/SE detail, Seller/Territory editors,
  Project detail, Workload, Products and Product detail gain1344px. Inherited
  Seller Products follows the catalog. Stale inner clamps are removed where
  necessary, including POD assignments. Note detail and paired legacy
  Admin/Analytics also gain1344px; already-wider contextual Note editor remains.
  Simple native lists/forms and host-owned embed/modal widths remain intact.
- Final consistency regression:947 scoped Python UI tests and all UI-prefix
  JavaScript controller/palette tests pass. No full application suite run.
  Live Dark/Light evidence covers entities, workflows, all25 report/revenue
  templates and variants, Home and remaining legacy pages. All eight palette
  pairs pass live checks; no desktop resizing, saved preferences or business writes.
  Six supplemental After-only images are clearly labelled, never fake Before photos.
  Final gallery check confirms173 pairs,557 references and556 PNGs successfully
  decoded with the Windows native image decoder, with zero failures or overflow.
  Visible browser comparisons render correctly. Bulk browser decoding stalled
  on the hidden QA page; no successful all-image browser decode is claimed.
  Final editor diagnostics and Git whitespace checks pass.
  Generic readiness DM accepted: `1557870736427974717`; no private content sent.
- Milestone detail creator revision: standalone left context pane grows304px
  to352px inside the unchanged1344px frame. Forecast reading retains990px;
  embedded previews remain280px. Dark/light checks show zero overflow.
 41 scoped milestone body/preview/workflow tests pass. Fresh Before/After/light
  screenshots precede the preserved consistency comparison in the width gallery.
- **Width/background and checkpoints63-90 are approved October8.** All original
  Bootstrap Before images remain unchanged. Everything remains uncommitted;
  do not advance checkpoint91 without a new implementation request.
- Approved effort is approximately90%; strict DONE counters remain unchanged
  until final reconciliation. Working remaining plan is15 checkpoints91-105 below.
- Next action: report completion and remaining scope; no automatic merge or deployment.
- Live QA avoids business writes; caches/telemetry and shell Socket.IO traffic may
  occur. Individual caveats remain in evidence cards. Protected drafts stay untouched.

## Sequential batch handoff archive

These are historical per-checkpoint handoffs, not current instructions.
Use the compact working checkpoint above and the individual evidence cards.

- Branch: `feature/ui-redesign`; no push, merge or deployment authorized.
- Last approved implementation: overnight checkpoints 53-62, including morning
  Action Items refinements, user-approved October 7, committed as `e5bde8c3`.
- Current task: user-authorized second fourteen-checkpoint batch 77-90.
- Last authorized surface: Fill My Day 90, implemented and VERIFY.
  [Evidence](redesign-pages/FILL-DAY.md): original date/customer matching, sequential
  WorkIQ/AI enrichment, topic/HTML review, milestone context, remote task and note-save
  contracts remain intact. Native connected frame, explicit fetch guard, unmatched
  raw sorts and request-free Back restoration; no new candidate/account workflows.
  216 isolated pytest and 69 JavaScript cases pass. Four private photos, all After
  images inspected. Read-only live themes, actual Back and guard Cancel pass at
  unchanged desktop 1566 x 1167; no business POSTs observed during monitored QA.
  Browser reports existing shell `/socket.io/` POST/CORS failures, not business writes.
  Visible QA `44dc4737-c193-4ff9-9193-0778dba43f2f`. Ordinary shell telemetry,
  cache bookkeeping and Notes local page-size memory can occur; no unchanged-DB claim.
  Stop before 91. All 63-90 remain uncommitted and await user review, effort stays 75%.
  Parent owns the same 28-checkpoint gallery, final regression and breadcrumb inventory.
  One generic readiness DM accepted: `1557512412058492999`; no private content sent.
- Previous surface: Opportunity detail, checkpoint 89, implemented and VERIFY.
  [Evidence](redesign-pages/OPP-VIEW.md): complete standalone/shared partial and actual
  Workspace preview, original provider fields, forecasts, team and linked workflows.
  Native regions, raw milestone sorts, guarded manual writes and exact Back restoration.
  151 isolated pytest and 124 JavaScript cases pass; final dialog-shell recheck: six pass.
  Ten private photos saved and After images inspected; dark/light, native nested Cancel,
  draft retention and parent focus verified read-only at desktop 1566 x 1167.
  Visible QA `44dc4737-c193-4ff9-9193-0778dba43f2f`; no monitored business POSTs.
  Shell `/socket.io/` polling POSTs and ordinary read-cache bookkeeping are disclosed.
  Fill My Day 90 is implemented and VERIFY. Preserve 63-90 uncommitted; all await review,
  approved effort stays 75%. Parent owns gallery and static breadcrumb reconciliation.
  Generic readiness DM status is in the evidence card. No git/agents/gallery changes.
  New/Edit Note Templates, checkpoint 88, remain implemented and VERIFY.
  [Evidence](redesign-pages/NT-FORM.md): exact fields, distinct original POST paths,
  rich HTML roundtrip, Settings/default associations and actual Note insertion.
  Native pinned form/editor, shared manual guards/Back and retained write failures.
  303 isolated pytest and 99 JavaScript cases pass; seven private photos inspected.
  Visible QA `deaa7837-858e-4e7c-91df-f35b05d02e1b`, both themes, no monitored POSTs.
  Opportunity detail 89 is now VERIFY. Preserve 63-89 uncommitted, all 63-90 await review;
  approved effort stays 75%. Parent owns gallery and static breadcrumb inventory check.
  Generic readiness DM status is in the evidence card. No git/agents/gallery changes.
  Search, checkpoint 87, remains implemented and VERIFY.
  [Evidence](redesign-pages/SEARCH.md): unchanged exact GET/content/ownership/ANY-topic
  rules, role scope, grouping, excerpts, links and original history. Native persistent
  controls, reading stream and actual 900px/draft Back restoration; no new search features.
  166 isolated regression cases pass, plus final expanded Search selection 38 pass;
  50 JavaScript tests pass. Stale global ancestry threshold failure recorded separately.
  Eight private photos saved, After images inspected; both themes, desktop 1566 x 1167.
  Visible QA tab `deaa7837-858e-4e7c-91df-f35b05d02e1b`; no monitored POST paths.
  Note Template New/Edit forms 88 are now VERIFY. Prior 63-87 stay uncommitted;
  all 63-90 await review, approved effort 75%. No git, agents or gallery edits.
  Readiness DM status is recorded in the evidence card.
  Notes directory 86 remains implemented and VERIFY:
  [Evidence](redesign-pages/NOTE-LIST.md), original chronology, filters and pagination,
  201 pytest and 51 JavaScript tests, four inspected photos, no monitored POSTs.
  Specialty detail, checkpoint 85, remains implemented and VERIFY.
  [Evidence](redesign-pages/SPEC-VIEW.md): original description, partner listing/counts,
  contact/note context, links, Edit/delete/empty states; native sorting/history/dialog
  and relationship-safe rollback. 206 isolated pytest and 61 JavaScript tests pass;
  four inspected photos recorded. Explicit pytest supersedes stale editor discovery.
  Trusted visible dark/light sorts, Back, links and Cancel pass; no monitored POSTs.
  Before/After host viewport mismatch documented. Preserve all 63-84 uncommitted.
  Notes directory 86 is now VERIFY; approved effort remains 75%.
  All 63-90 await review. Parent owns the gallery; DM status is in the evidence card.
  Specialty New/Edit forms, checkpoint 84, remain implemented and VERIFY.
  [Evidence](redesign-pages/SPEC-FORM.md): original required name, optional description,
  normalization, case-insensitive duplicates, relationships, commands and redirects;
  shared native manual lifecycle, guarded Back drafts and retained write failures.
  Scoped verification: 177 isolated pytest and 83 JavaScript tests pass; seven photos.
  Visible read-only New/Edit and dark/light QA covers trusted guards and actual Back.
  No POST paths observed in monitored QA; original dark theme/directory restored.
  Late follow-up trusted-control timeouts are recorded without claiming extra coverage.
  Preserve all 63-83 uncommitted. Specialty detail 85 is now implemented and VERIFY.
  Approved effort remains 75%; all 63-90 await review. Parent owns the gallery.
  Readiness DM status is recorded in the evidence card.
  Specialties directory, checkpoint 83, remains implemented and VERIFY.
  [Evidence](redesign-pages/SPEC-LIST.md): all-specialty/all-partner scope, original
  descriptions and SQL name order, complete counts, New/detail/Edit destinations,
  compact native data sorts and actual Back restoration. Scoped verification:
  125 isolated pytest and 53 JavaScript tests pass; three private photos inspected.
  Visible read-only QA verifies both themes, raw sorts, links and native help closure.
  No POST paths observed. All 63-82 remain preserved and uncommitted.
  Specialties New/Edit forms 84 and detail 85 are now implemented and VERIFY.
  Approved effort remains 75%; all 63-90 await review. Parent owns the gallery.
  Readiness DM status is recorded in the evidence card.
  Partner detail, checkpoint 82, remains implemented and VERIFY.
  [Evidence](redesign-pages/PART-VIEW.md): full original contacts/primary/edit/delete,
  clipboard photos, linked notes, rating/specialty/favicon context, explicit meeting
  domain/search/review/import/retry and existing native sharing consumers.
  Scoped verification: 234 pytest and 95 JavaScript tests pass; six private photos.
  Trusted live QA covers both themes, actual Back/editor/note links, sorting,
  native cancellation/draft guards and photo inspection without business writes.
  Prior 63-81 remain preserved and uncommitted. Specialties directory 83 is now VERIFY.
  Approved effort remains 75%; all 63-90 await review; parent owns the gallery.
  Readiness DM status is recorded in the evidence card.
  Partner New/Edit forms, checkpoint 81, remain implemented and VERIFY.
  [Evidence](redesign-pages/PART-FORM.md): exact manual fields, repeated specialties,
  nullable/zero rating and favicon normalization; separate immediate specialty creation,
  shared native draft/pending/Back guards and retained write failures.
  Scoped verification: 140 pytest and 81 JavaScript tests pass; seven private photos.
  Visible New/Edit dark/light QA is read-only, with trusted controls and actual Back.
  Prior 63-80, including shared native sharing, remain preserved and uncommitted.
  Partner detail 82 is now implemented and VERIFY; Specialties directory 83 is next.
  Approved effort remains 75%; all 63-90 await review.
  Parent owns the gallery; this checkpoint makes no git or gallery changes.
  Readiness DM status is recorded in the evidence card.
  Partners directory checkpoint 80 remains implemented and VERIFY.
  [Evidence](redesign-pages/PART-LIST.md): original all-partner/all-note scope,
  compact native five-axis rows, native shared sharing/import reviews, exact exports,
  cancellation/pending/failure guards and Back context. Both themes and real links
  verified read-only; no live business sends/imports. Prior 63-79 remain preserved.
  Scoped verification: 252 pytest and 72 JavaScript tests pass; five private photos
  inspected. Generic readiness DM accepted `1557478025933889670`.
  Partner forms 81 are now implemented and VERIFY; Partner detail 82 is next.
  Topic detail checkpoint 79 remains implemented and VERIFY.
  [Evidence](redesign-pages/TOPIC-VIEW.md): original all-date/all-role tagged-note scope,
  complete relationships and previews, native data sorts/history/delete confirmation.
  Scoped verification: 155 pytest and 62 JavaScript tests pass; four private photos.
  Visible trusted keyboard sort/topic navigation also closes checkpoint 77's QA gap.
  Partners directory 80 is now implemented and VERIFY. All 63-90 await review;
  approved effort remains 75%. Parent owns the same 28-checkpoint gallery.
  Topic New/Edit forms checkpoint 78 remain implemented and VERIFY.
  [Evidence](redesign-pages/TOPIC-FORM.md): exact original manual fields and redirects,
  native shared lifecycle, guarded drafts/Back, retained failures and null-description fix.
  Scoped verification: 259 pytest and 73 JavaScript tests pass; seven private photos.
  All 63-90 await review; approved effort remains 75%.
  Topics directory checkpoint 77 remains implemented and VERIFY:
  [Evidence](redesign-pages/TOPIC-LIST.md): all-topic/all-note scope, original fields,
  links and default ordering, compact native data sorts and actual Back restoration.
  Scoped verification: 57 pytest and 38 JavaScript tests pass; three photos inspected.
  Parent owns the same 28-checkpoint gallery.
  Prior batch 63-76 remains complete, VERIFY, unreviewed and uncommitted.
  Prior checkpoint 76:
  [Evidence](redesign-pages/IC-FORM.md): original identity/role suggestions and redirects,
  manual lifecycle, draft/Back guards, failed-input retention and separate delete POST.
  Scoped verification: 139 pytest and 52 JavaScript tests pass; six photos inspected.
  Checkpoints 63 [directory](redesign-pages/SELL-LIST.md) and 64
  [forms](redesign-pages/SELL-FORM.md) remain VERIFY, unchanged by this checkpoint.
  Checkpoint 65 [seller detail](redesign-pages/SELL-VIEW.md) remains VERIFY, unchanged.
  Checkpoint 66 [territories directory](redesign-pages/TERR-LIST.md) remains VERIFY.
  Checkpoint 67 [territory forms](redesign-pages/TERR-FORM.md) remains VERIFY.
  Checkpoint 68 [territory detail](redesign-pages/TERR-VIEW.md) remains VERIFY.
  Checkpoint 69 [POD directory](redesign-pages/POD-LIST.md) remains VERIFY.
  Checkpoint 70 [Edit POD](redesign-pages/POD-FORM.md) remains VERIFY.
  Checkpoint 71 [POD detail](redesign-pages/POD-VIEW.md) remains VERIFY.
  Checkpoint 72 [SE directory](redesign-pages/SE-LIST.md) remains VERIFY.
  Checkpoint 73 [Edit SE](redesign-pages/SE-FORM.md) remains VERIFY.
  Checkpoint 74 [SE detail](redesign-pages/SE-VIEW.md) remains VERIFY.
  Checkpoint 75 [Internal Contacts directory](redesign-pages/IC-LIST.md) remains VERIFY.
  Prior authorized batch 63-76 is implemented and uncommitted.
  User authorized checkpoints 77-90 on October 7, before reviewing 63-76.
  Scope: Topics, Partners and Specialties directory/forms/detail, Notes directory,
  Search, Note Template New/Edit forms, Opportunity detail and Fill My Day.
  Extend the same private gallery for all 28 checkpoints; stop before 91.
  No New POD or New Solution Engineer workflow invented.
- Approved effort estimate: about 75%; strict DONE counters below are separate.
- Use current page code/tests and shared contracts, not historical logs.
- Protected note drafts and production port 5151 remain untouched.
- Known/deferred issues: [archived checkpoint context](REDESIGN-CHECKPOINT-HISTORY.md).
- Every future segment includes before/after screenshots and one Discord review-ready notification.
- Next action: stop before 91. Parent compiles the same 28-checkpoint gallery,
  runs final focused integration and reconciles the static breadcrumb inventory.
  Leave all 63-90 VERIFY and uncommitted for user review.
  Scope: Sellers, Territories, PODs, Solution Engineers and Internal Contacts,
  with their existing directories/forms/details. No new routes invented.
  Checkpoints 53-62 and morning refinements share approved implementation `e5bde8c3`;
  previous checkpoint 52 is `4e57b1a6`.
  Push, merge and deployment remain unauthorized; strict DONE counters are unchanged.
- Final approved-batch checks: 137 scoped pytest and 178 JavaScript tests pass,
  including the morning Action Items refinements.
  Customer-directory role cases explicitly cover both no-note visibility preferences.
  Private morning gallery: `overnight-review-53-62.html`, 26 verified screenshot files
  covering all ten checkpoints and both modes of each paired form.
- Final new-batch regression: 423 scoped pytest and 181 JavaScript tests pass.
  Coverage includes the fourteen new surfaces, shared form/dialog/sorter workflows,
  existing Seller/POD domains, contact relationships and canonical breadcrumbs.
  Integration fixes scope form styling assertions to owned markup, account for
  normal flash consumption on intervening navigation, explicitly verify rendered
  validation redirects, and update the unique contextual-help inventory to 77.
  Private return gallery: `review-63-76.html`, 17 before/after pairs and supplementary
  theme/workflow images, 57 screenshots total. Fourteen readiness DMs accepted.
  Existing SQLAlchemy warnings and sharing-hub failures remain documented; no
  full-suite pass is claimed. Seller detail's two early background POST paths
  were not recorded; later probes observed no business POSTs. No business-write
  controls were exercised, and normal read-cache/shell bookkeeping may occur.

- Working branch: `feature/ui-redesign`; approved archive is present in `design-studies/`
- Last reconciled product SHA: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Final candidate product SHA: not selected
- Page progress: 0 / 90 DONE
- Shared fragment/helper progress: 9 / 29 DONE
- Global/shell/error progress: 5 / 17 DONE
- Additional pages discovered after baseline: none recorded
- Additional shared helpers recorded: existing Revenue Buckets filter, omitted
  from the initial helper inventory; checkpoint 18 is user-approved and DONE.
  Checkpoint 21 adds the shared Revenue preview frame extracted from Home,
  with the controller reused by all four preview hosts; user-approved and DONE.
  Checkpoint 28 adds the shared monthly history renderer for bucket and product
  pages; technically verified, user-approved October 5 and DONE.
  Checkpoint 29 adds shared product customer comparison/summary fragments and
  a history-free rollup service; user-approved October 5 and DONE.
  It also adds the shared native table sorter across the recently migrated
  Revenue workbenches and their fragments; user-approved October 5 and DONE.
- Commit cadence: each coherent, verified checkpoint; no automatic push or merge
- Pre-release reviewer: the user; external tester/users provide post-release QA

Statuses: TODO, AUDITED, BUILDING, VERIFY, DONE, REOPEN, BLOCKED.
Replace the dash in Evidence with a link to the page card when work starts.
Keep counts updated, but the rows and revision-specific approvals are authoritative.

## How to read overall progress

The first-pass redesign is **complete and creator-approved October9, 2026**.
Shared theme/navigation/dialog/feedback foundations and substantial Home/note/
milestone slices are approved, alongside the engagement, project and customer
families, reports, directories/forms/details, Search, Note Templates and Fill My Day.
The gutter standard and all width/background refinements are also approved.
The final15 implementation checkpoints are complete and approved:
note forms/detail and Home, Preferences/admin/utilities, global setup/chat,
Electron/error surfaces and cross-page reconciliation. Native OS restoration
still requires actual relaunch/rebuild/tray checks before release.

### Final checkpoint review batch

Checkpoints91-105 are implemented, technically verified and creator-approved October9.
The private gallery retains original Bootstrap Before and current After evidence.
Explicit verification limits remain documented. Technical VERIFY/DONE inventory
statuses are distinct from design approval and do not imply pending design review.

| Checkpoint | Planned scope |
| --- | --- |
| 91 | Standalone New/Edit Note editor and draft/write parity |
| 92 | Standalone Note detail completion and consumer reconciliation |
| 93 | Home/calendar completion and note/action integration |
| 94 | Preferences and dashboard settings |
| 95 | Admin and fiscal-year management |
| 96 | Analytics and Metrics |
| 97 | Connect export workspace |
| 98 | AI logs and favicon utility pages |
| 99 | Welcome/sign-in/onboarding and guided tour |
| 100 | Copilot chat flyout |
| 101 | Global sharing/import-review reconciliation and remaining helper gaps |
| 102 | Electron starting/slow-start/reconnect states |
| 103 | Electron update/build states and native window restoration |
| 104 | Missing-record and HTTP error presentation |
| 105 | Final cross-page parity, Bootstrap cleanup and release reconciliation |

Report an updated effort-based estimate whenever a checkpoint is completed and
committed. Keep estimates approximate; small checkpoints may not move the rounded
percentage. Checkpoint 15: about 15%. Checkpoint 16: about 16%.
Checkpoint 17: about 17%, user-approved October 3, 2026, committed as `c1242b3`.
Checkpoint 18: about 17%, user-approved October 3, 2026, committed as `b53752c`.
This small shared-filter
slice does not change the rounded approved-work estimate.
Checkpoint 19: about 18%, user-approved October 3, 2026, committed as `cb9f0e4`.
Checkpoint 20: about 19%, user-approved October 4, 2026, committed as `401846d`.
Checkpoint 21: about 20%, user-approved October 4, 2026, committed as `a4ec9a8`.
Checkpoint 22: about 22%, user-approved October 4, 2026, committed as `25a14d4`. Shared alert lists and
the preview controller's native-parent integration are approved at this revision.
Checkpoint 23: about 24%, user-approved October 4, 2026, committed as `60dbdb3`. Native Analyzer/seller page
commands and app-wide canonical breadcrumbs are approved; the shared continuous
shell contract and Revenue pilot are the next checkpoint.
Checkpoint 24: about 25%, shell composition user-approved October 4, 2026,
committed as `4320872`. Scrolling is technically verified, not manually reviewed
by the user; the wider interim table is not the final Revenue layout approval.
Checkpoint 25: about 26%, seller queue/detail user-approved October 4, 2026, committed as `747058a`,
including restored semantic priorities and the contextual modal/full-page layout
principle. Modal lists keep shared native styling without copying full-page layout.
Checkpoint 28: about 29%, product comparison/history user-approved October 5, committed as `e286617`,
including the monthly graph, mirrored dollar labels, three-column comparison
and full-pane reading width. Checkpoint 29: about 31%, Products browser and shared
column sorting user-approved October 5, committed as `aed2350`, including loaded
previews, queue order and independent Back restoration. Checkpoint 30: about 33%,
seller Products and monthly comparison user-approved October 5, including scoped
reads, corrected matched links and separate bucket histories. Checkpoint 31:
about 35%, native Revenue reports/Synapse user-approved October 5 and committed
as `15e8333`, retaining populations, financial values, mode preferences,
sorting, complete exports and exact reading restoration.

The DONE counters are stricter: they count fully reconciled pages/helpers, not
approved sub-page checkpoints or partial completion. Consequently, `0 / 90`
pages DONE does not mean zero work is complete. Do not divide completed
checkpoints by page count; checkpoints differ substantially in size.

## Suggested work order

1. Global frame, tokens, navigation and replacement interaction primitives.
2. Home plus note/action/milestone workflows and shared modal partials.
3. Entity lists, details and create/edit forms.
4. Engagements, projects, 1:1 workspaces and their cross-page workflows.
5. Reports, revenue, preferences, admin, setup and remaining global surfaces.
6. Native window/status screens and final reconciliation.

Shared-component work can run ahead, but page sign-off is still independent.
The inventory below is grouped by domain, not a mandatory implementation order.

## Page checklist

URLs use Flask parameter syntax. Templates are relative to `templates/`.
Aliases share a page row, but every alias must be verified. Create/edit variants
have separate rows even when they use one template.

| ID | Page | URL(s) | Template | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| HOME | Dashboard/calendar | `/` | `index.html` | VERIFY | [Final Home completion](redesign-pages/HOME-COMPLETE.md); checkpoint93, review pending |
| ACTIONS | Action items | `/action-items` | `action_items_hub.html` | VERIFY | [ACTIONS](redesign-pages/ACTIONS.md); user-approved October 7, including dashboard/row refinements |
| SEARCH | Search | `/search` | `search.html` | VERIFY | [Evidence](redesign-pages/SEARCH.md); user-approved October 8, checkpoints63-90 |
| PREFS | Preferences | `/preferences` | `settings.html` | VERIFY | [PREFS](redesign-pages/PREFS.md); checkpoint94, review pending |
| NT-NEW | Create note template | `/templates/new` | `note_template_form.html` | VERIFY | [Evidence](redesign-pages/NT-FORM.md); user-approved October 8, checkpoints63-90 |
| NT-EDIT | Edit note template | `/templates/<int:id>/edit` | `note_template_form.html` | VERIFY | [Evidence](redesign-pages/NT-FORM.md); user-approved October 8, checkpoints63-90 |
| ANALYTICS | Analytics | `/analytics` | `analytics.html` | VERIFY | [ANALYTICS](redesign-pages/ANALYTICS.md); checkpoint96, review pending |
| ADMIN | Admin panel | `/admin` | `admin_panel.html` | VERIFY | [ADMIN](redesign-pages/ADMIN.md); checkpoint95, review pending |
| ADMIN-AI | AI logs | `/admin/ai-logs` | `admin_ai_logs.html` | VERIFY | [AI logs](redesign-pages/AI-LOGS.md); checkpoint98, review pending |
| ADMIN-ICONS | Favicon gallery | `/admin/favicons` | `admin_favicons.html` | VERIFY | [FAVICONS](redesign-pages/FAVICONS.md); checkpoint98, review pending |
| METRICS | Metrics | `/metrics` | `metrics.html` | VERIFY | [METRICS](redesign-pages/METRICS.md); checkpoint96, review pending |
| CONNECT | Connect export workspace | `/connect-export` | `connect_export.html` | VERIFY | [CONNECT](redesign-pages/CONNECT-EXPORT.md); checkpoint97, review pending |
| CUST-LIST | Customers | `/customers` | `customers_list.html` | VERIFY | [CUST-LIST](redesign-pages/CUST-LIST.md); user-approved October 7 |
| CUST-NEW | Create customer | `/customer/new` | `customer_form.html` | VERIFY | [CUST-FORM](redesign-pages/CUST-FORM.md); user-approved October 7 |
| CUST-VIEW | Customer detail | `/customer/<int:id>` | `customer_view.html`; `partials/customer_view_content.html` | VERIFY | [CUST-VIEW](redesign-pages/CUST-VIEW.md); user-approved October 7 |
| CUST-EDIT | Edit customer | `/customer/<int:id>/edit` | `customer_form.html` | VERIFY | [CUST-FORM](redesign-pages/CUST-FORM.md); user-approved October 7 |
| SELL-LIST | Sellers | `/sellers` | `sellers_list.html` | VERIFY | [SELL-LIST](redesign-pages/SELL-LIST.md); user-approved October 8, checkpoints63-90 |
| SELL-NEW | Create seller | `/seller/new` | `seller_form.html` | VERIFY | [SELL-FORM](redesign-pages/SELL-FORM.md); user-approved October 8, checkpoints63-90 |
| SELL-VIEW | Seller detail | `/seller/<int:id>` | `seller_view.html` | VERIFY | [Seller detail](redesign-pages/SELL-VIEW.md); user-approved October 8, checkpoints63-90 |
| SELL-EDIT | Edit seller | `/seller/<int:id>/edit` | `seller_form.html` | VERIFY | [SELL-FORM](redesign-pages/SELL-FORM.md); user-approved October 8, checkpoints63-90 |
| TERR-LIST | Territories | `/territories` | `territories_list.html` | VERIFY | [Evidence](redesign-pages/TERR-LIST.md); user-approved October 8, checkpoints63-90 |
| TERR-NEW | Create territory | `/territory/new` | `territory_form.html` | VERIFY | [Evidence](redesign-pages/TERR-FORM.md); user-approved October 8, checkpoints63-90 |
| TERR-VIEW | Territory detail | `/territory/<int:id>` | `territory_view.html` | VERIFY | [Evidence](redesign-pages/TERR-VIEW.md); user-approved October 8, checkpoints63-90 |
| TERR-EDIT | Edit territory | `/territory/<int:id>/edit` | `territory_form.html` | VERIFY | [Evidence](redesign-pages/TERR-FORM.md); user-approved October 8, checkpoints63-90 |
| POD-LIST | PODs | `/pods` | `pods_list.html` | VERIFY | [POD-LIST](redesign-pages/POD-LIST.md); checkpoint 69; user-approved October 8, checkpoints63-90 |
| POD-VIEW | POD detail | `/pod/<int:id>` | `pod_view.html` | VERIFY | [POD-VIEW](redesign-pages/POD-VIEW.md); user-approved October 8, checkpoints63-90 |
| POD-EDIT | Edit POD | `/pod/<int:id>/edit` | `pod_form.html` | VERIFY | [Evidence](redesign-pages/POD-FORM.md); user-approved October 8, checkpoints63-90 |
| SE-LIST | Solution engineers | `/solution-engineers` | `solution_engineers_list.html` | VERIFY | [Evidence](redesign-pages/SE-LIST.md); user-approved October 8, checkpoints63-90 |
| SE-VIEW | Solution engineer detail | `/solution-engineer/<int:id>` | `solution_engineer_view.html` | VERIFY | [Evidence](redesign-pages/SE-VIEW.md); user-approved October 8, checkpoints63-90 |
| SE-EDIT | Edit solution engineer | `/solution-engineer/<int:id>/edit` | `solution_engineer_form.html` | VERIFY | [SE-FORM](redesign-pages/SE-FORM.md); user-approved October 8, checkpoints63-90 |
| IC-LIST | Internal contacts | `/internal-contacts` | `internal_contacts_list.html` | VERIFY | [card](redesign-pages/IC-LIST.md); user-approved October 8, checkpoints63-90 |
| IC-NEW | Create internal contact | `/internal-contacts/new` | `internal_contact_form.html` | VERIFY | [IC-FORM](redesign-pages/IC-FORM.md); user-approved October 8, checkpoints63-90 |
| IC-EDIT | Edit internal contact | `/internal-contacts/<int:id>/edit` | `internal_contact_form.html` | VERIFY | [IC-FORM](redesign-pages/IC-FORM.md); user-approved October 8, checkpoints63-90 |
| TOPIC-LIST | Topics | `/topics` | `topics_list.html` | VERIFY | [77](redesign-pages/TOPIC-LIST.md); user-approved October 8, checkpoints63-90 |
| TOPIC-NEW | Create topic | `/topic/new` | `topic_form.html` | VERIFY | [78](redesign-pages/TOPIC-FORM.md); user-approved October 8, checkpoints63-90 |
| TOPIC-VIEW | Topic detail | `/topic/<int:id>` | `topic_view.html` | VERIFY | [Parity](redesign-pages/TOPIC-VIEW.md); user-approved October 8, checkpoints63-90 |
| TOPIC-EDIT | Edit topic | `/topic/<int:id>/edit` | `topic_form.html` | VERIFY | [78](redesign-pages/TOPIC-FORM.md); user-approved October 8, checkpoints63-90 |
| NOTE-LIST | Notes | `/notes` | `notes_list.html` | VERIFY | [86](redesign-pages/NOTE-LIST.md); user-approved October 8, checkpoints63-90 |
| NOTE-NEW | Create note | `/note/new` | `note_form.html` | VERIFY | [NOTE-FORM](redesign-pages/NOTE-FORM.md); checkpoint91, incident disclosed, review pending |
| NOTE-VIEW | Note detail | `/note/<int:id>` | `note_view.html` | VERIFY | [NOTE-VIEW](redesign-pages/NOTE-VIEW.md); checkpoint92, review pending |
| NOTE-EDIT | Edit note | `/note/<int:id>/edit` | `note_form.html` | VERIFY | [NOTE-FORM](redesign-pages/NOTE-FORM.md); checkpoint91, incident disclosed, review pending |
| FILL-DAY | Fill My Day | `/fill-my-day` | `fill_my_day.html` | VERIFY | [Evidence](redesign-pages/FILL-DAY.md); user-approved October 8, checkpoints63-90 |
| ENG-LIST | Engagements | `/engagements` | `engagements_hub.html` | VERIFY | [ENG-LIST](redesign-pages/ENG-LIST.md); user-approved October 7 |
| ENG-NEW | Create engagement | `/customer/<int:customer_id>/engagement/new` | `engagement_form.html` | VERIFY | [ENG-FORM](redesign-pages/ENG-FORM.md); checkpoint 56, user-approved October 7 |
| ENG-VIEW | Engagement detail | `/engagement/<int:id>` | `engagement_view.html` | VERIFY | [ENG-VIEW](redesign-pages/ENG-VIEW.md); checkpoint 57, user-approved October 7 |
| ENG-EDIT | Edit engagement | `/engagement/<int:id>/edit` | `engagement_form.html` | VERIFY | [ENG-FORM](redesign-pages/ENG-FORM.md); checkpoint 56, user-approved October 7 |
| MS-LIST | Milestones | `/milestones` | `milestones_list.html` | VERIFY | [Milestones directory](redesign-pages/MS-LIST.md); user-approved October 7 |
| MS-NEW | Create milestone | `/milestone/new` | `milestone_form.html` | VERIFY | [Manual milestone forms](redesign-pages/MS-FORM.md); checkpoint 52, user-approved October 7 |
| MS-VIEW | Milestone detail | `/milestone/<int:id>` | `milestone_view.html` | VERIFY | [Standalone frame](redesign-pages/MS-VIEW.md), [approved body](redesign-pages/MILESTONE-BODY.md); user-approved October 7 |
| MS-EDIT | Edit milestone | `/milestone/<int:id>/edit` | `milestone_form.html` | VERIFY | [Manual milestone forms](redesign-pages/MS-FORM.md); checkpoint 52, user-approved October 7 |
| MS-TRACK | Milestone tracker | `/reports/milestone-tracker`; `/milestone-tracker` redirects | `milestone_tracker.html` | VERIFY | [Milestone tracker](redesign-pages/MS-TRACK.md); user-approved October 6 |
| OPP-VIEW | Opportunity detail | `/opportunity/<int:id>` | `opportunity_view.html` | VERIFY | [Complete native detail and consumers](redesign-pages/OPP-VIEW.md); user-approved October 8, checkpoints63-90 |
| PROJ-NEW | Create project | `/project/new` | `project_form.html` | VERIFY | [PROJ-FORM](redesign-pages/PROJ-FORM.md); checkpoint 58, user-approved October 7 |
| PROJ-VIEW | Project detail | `/project/<int:id>` | `project_view.html` | VERIFY | [PROJ-VIEW](redesign-pages/PROJ-VIEW.md); checkpoint 59, user-approved October 7 |
| PROJ-EDIT | Edit project | `/project/<int:id>/edit` | `project_form.html` | VERIFY | [PROJ-FORM](redesign-pages/PROJ-FORM.md); checkpoint 58, user-approved October 7 |
| PART-LIST | Partners | `/partners` | `partners_list.html` | VERIFY | [Parity](redesign-pages/PART-LIST.md); user-approved October 8, checkpoints63-90 |
| PART-NEW | Create partner | `/partners/new` | `partner_form.html` | VERIFY | [81](redesign-pages/PART-FORM.md); user-approved October 8, checkpoints63-90 |
| PART-VIEW | Partner detail | `/partners/<int:id>` | `partner_view.html` | VERIFY | [Evidence](redesign-pages/PART-VIEW.md); user-approved October 8, checkpoints63-90 |
| PART-EDIT | Edit partner | `/partners/<int:id>/edit` | `partner_form.html` | VERIFY | [81](redesign-pages/PART-FORM.md); user-approved October 8, checkpoints63-90 |
| SPEC-LIST | Specialties | `/specialties` | `specialties_list.html` | VERIFY | [Evidence](redesign-pages/SPEC-LIST.md); user-approved October 8, checkpoints63-90 |
| SPEC-NEW | Create specialty | `/specialties/new` | `specialty_form.html` | VERIFY | [84](redesign-pages/SPEC-FORM.md); user-approved October 8, checkpoints63-90 |
| SPEC-VIEW | Specialty detail | `/specialties/<int:id>` | `specialty_view.html` | VERIFY | [85](redesign-pages/SPEC-VIEW.md); user-approved October 8, checkpoints63-90 |
| SPEC-EDIT | Edit specialty | `/specialties/<int:id>/edit` | `specialty_form.html` | VERIFY | [84](redesign-pages/SPEC-FORM.md); user-approved October 8, checkpoints63-90 |
| OOO-LIST | 1:1 hub | `/one-on-one/` | `one_on_one_hub.html` | VERIFY | [Card](redesign-pages/OOO-LIST.md) |
| OOO-VIEW | 1:1 workspace | `/one-on-one/<int:workspace_id>` | `one_on_one_workspace.html` | VERIFY | [Checkpoint 47](redesign-pages/OOO-VIEW.md); user-approved `6ee2af6d`, final reconciliation pending |
| RPT-HUB | Reports hub | `/reports` | `reports_hub.html` | VERIFY | [Checkpoint 34](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-34-main-reports-directory); native grouped directory, identical registry/menu order, local filter and Back context; user-approved October 5 |
| RPT-INIT | Initiative Tracker | `/reports/initiative-tracker`; `/reports/manager-one-on-one` | `report_manager_one_on_one.html` | VERIFY | [Checkpoint 48](redesign-pages/RPT-INIT.md); user-approved October 6; [project nesting 59](redesign-pages/PROJ-VIEW.md) user-approved October 7 |
| RPT-ACT | Activity coverage | `/reports/activity-coverage` | `report_activity_coverage.html` | VERIFY | [Card](redesign-pages/RPT-ACTIVITY-COVERAGE.md) |
| RPT-OOO | Seller 1:1 preparation | `/reports/one-on-one` | `report_one_on_one.html` | VERIFY | [card](redesign-pages/RPT-OOO.md) |
| RPT-WORK | Workload | `/reports/workload` | `report_workload.html` | VERIFY | [Checkpoint 35](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-35-workload-report); native topic/customer browser, preserved scope/totals/exports, sorting, Back and compact embeds; user-approved October 6 |
| RPT-HYG | Hygiene | `/reports/hygiene` | `report_hygiene.html` | VERIFY | [Checkpoint 36](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-36-engagement--milestone-hygiene); native sortable data columns, plain Fix headings, confirmed annotations, protected dialogs, authoritative refresh, both-queue exports and Back; user-approved October 6, committed `9195a2c8` |
| RPT-NEW | What's New | `/reports/whats-new` | `report_whats_new.html` | VERIFY | [Page card](redesign-pages/RPT-WHATS-NEW.md); user-approved October 6, committed `175a0b0b` |
| RPT-WHITE | Whitespace | `/reports/whitespace` | `report_whitespace.html` | VERIFY | [Page card](redesign-pages/RPT-WHITESPACE.md); user-approved October 6, committed `fe758b9b` |
| RPT-MSX | MSX workspace | `/reports/msx-workspace` | `report_msx_workspace.html` | VERIFY | [MSX workspace](redesign-pages/RPT-MSX.md); user-approved October 6 |
| RPT-MKT | Marketing insights | `/reports/marketing-insights` | `report_marketing_insights.html` | VERIFY | [Page card](redesign-pages/RPT-MARKETING.md); user-approved October 6 |
| RPT-GOALS | Connect goals | `/reports/connect-goals` | `report_connect_goals.html` | VERIFY | [Card](redesign-pages/RPT-CONNECT-GOALS.md); native dashboard/frame, user-approved October 6 |
| RPT-U2C | U2C | `/reports/u2c` | `report_u2c.html` | VERIFY | [RPT-U2C](redesign-pages/RPT-U2C.md) |
| RPT-IMPACT | Connect impact | `/reports/connect-impact` | `report_connect_impact.html` | VERIFY | [Page card](redesign-pages/RPT-CONNECT-IMPACT.md); user-approved October 6 |
| REV-DASH | Revenue dashboard | `/reports/revenue`; `/revenue` redirects | `revenue_dashboard.html` | VERIFY | [Continuous shell pilot](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-24-continuous-workbench-shell-and-revenue-pilot) |
| REV-IMPORT | Revenue import | `/revenue/import`; `/import/revenue` redirects | `revenue_import.html` | VERIFY | [Checkpoint 33](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-33-revenue-syncimport); native maintenance panes, sortable unchanged history/months, explicit sync/save recovery and shared inline buckets; user-approved October 5, committed as `a6b6253` |
| REV-CONFIG | Revenue configuration | `/revenue/config` | `revenue_config.html` | VERIFY | [Checkpoint 32](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-32-revenue-analysis-configuration); native contextual editor, exact fields/values and save parity; user-approved October 5, committed as `350e152` |
| REV-SELL | Seller revenue alerts | `/revenue/seller/<seller_name>` | `revenue_seller_alerts.html` | VERIFY | [Queue/detail workbench pilot](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-25-seller-revenue-queue-and-inspector) |
| REV-SELL-PRODS | Seller products | `/revenue/seller/<seller_name>/products` | `revenue_seller_products.html` | VERIFY | [Checkpoint 30 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-30-seller-products-and-monthly-comparison) |
| REV-SELL-PROD | Seller product detail | `/revenue/seller/<seller_name>/product/<path:product>` | `revenue_seller_product_view.html` | VERIFY | [Checkpoint 30 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-30-seller-products-and-monthly-comparison) |
| REV-CUST | Customer revenue | `/revenue/customer/<int:customer_id>`; `/customer/<int:customer_id>/revenue` | `revenue_customer_view.html` | VERIFY | [Checkpoint 26 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-26-customer-revenue-analysis-and-history) |
| REV-BUCKET | Customer bucket products | `/revenue/customer/<int:customer_id>/bucket/<bucket>`; `/customer/<int:customer_id>/revenue/bucket/<bucket>` | `revenue_bucket_products.html` | VERIFY | [Checkpoint 27 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-27-customer-bucket-product-history) |
| REV-PRODS | Products | `/revenue/products`; `/products` | `revenue_products_list.html` | VERIFY | [Checkpoint 29 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-29-products-directory) |
| REV-PROD | Product detail | `/revenue/product/<path:product>`; `/product/<path:product>` | `revenue_product_view.html` | VERIFY | [Checkpoint 28 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-28-product-revenue-comparison-and-history) |
| REV-RPTS | Revenue reports | `/reports/revenue-reports`; `/revenue/reports` redirects | `revenue_reports_list.html` | VERIFY | [Checkpoint 31](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-31-revenue-report-surfaces); native real-report list and Analyzer command; user-approved October 5 |
| REV-SYN | Synapse customers | `/reports/synapse-customers`; `/revenue/reports/new-synapse-users` and `/reports/new-synapse-users` redirect with `?mode=new` | `revenue_report_synapse_customers.html` | VERIFY | [Checkpoint 31](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-31-revenue-report-surfaces); native grouped reading, modes, sorting, exports and Back; user-approved October 5 |

## Shared HTML fragments and helpers

These must be verified in every host context, not only in isolation.
An `/api/` URL can return HTML. Page-local dialogs remain in their page's card.

| ID | Surface / template | Route or host | Status | Evidence |
| --- | --- | --- | --- | --- |
| FR-ACTIONS | `partials/_action_items_hub.html` | `/api/action-items-hub` | VERIFY | [ACTIONS](redesign-pages/ACTIONS.md) |
| FR-CUST-OPPS | `partials/_customer_opportunities.html` | Customer dossier; `/api/customer/<int:customer_id>/opportunities-html`; note-editor information flyout | VERIFY | [CUST-VIEW](redesign-pages/CUST-VIEW.md) |
| FR-ENG | `partials/_engagement_view_content.html` | `/api/engagement/<int:id>/detail` | VERIFY | [ENG-VIEW](redesign-pages/ENG-VIEW.md); checkpoint 57, complete shared body and controllers |
| FR-MS | `partials/milestone_view_content.html` | `/api/milestone/<int:id>/detail` | VERIFY | [Standalone/fragment parity](redesign-pages/MS-VIEW.md), [lifecycle/editors](redesign-pages/MILESTONE-PREVIEW.md), [approved body](redesign-pages/MILESTONE-BODY.md) |
| FR-NOTE | `partials/note_view_content.html` | `/api/note/<int:id>/detail` | VERIFY | [Final canonical note consumer](redesign-pages/NOTE-VIEW.md); shell-free preview and standalone parity |
| FR-OOO | `partials/one_on_one_workspace_content.html` | `/api/seller/<int:seller_id>/one-on-one/detail` | VERIFY | [Final shared-controller reconciliation](redesign-pages/FINAL-RECONCILIATION.md); native workspace and draft contracts revalidated, no retired parent-modal fallback |
| FR-OPP | `partials/opportunity_view_content.html` | `/api/opportunity/<int:id>/detail` | VERIFY | [Full body/scripts and actual Workspace preview](redesign-pages/OPP-VIEW.md) |
| FR-PROJ | `partials/project_view_content.html` | `/api/project/<int:id>/detail` | VERIFY | [PROJ-VIEW](redesign-pages/PROJ-VIEW.md); complete native body and nested tasks |
| FR-REV | `partials/revenue_alert_detail.html` | `/api/revenue/analysis/<int:analysis_id>/detail`, all four preview hosts | DONE | [Checkpoint 20 evidence](redesign-pages/HOME-WORKBENCH.md) |
| FR-REV-HISTORY | `partials/_revenue_monthly_history.html` | Customer bucket Full History and product customer history | DONE | [Checkpoint 28 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-28-product-revenue-comparison-and-history) |
| FR-PRODUCT-COMPARE | `partials/_revenue_product_customers.html`, `partials/_revenue_product_summary.html`, `get_product_comparison` | Products inspector and Product Revenue; existing product aliases with `comparison=1` | DONE | [Checkpoint 29 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-29-products-directory) |
| JS-TABLE-SORT | `static/js/ui-table-sort.js`, `static/css/ui-table-sort.css` | Products, Product/Customer/Bucket Revenue, Analyzer, seller alerts and shared inspectors/previews | DONE | [Sorting evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#shared-sortable-columns-october-5-follow-up) |
| INC-ACTION | `partials/_action_item_detail_modal.html` | Home, action hub, engagement/project details | DONE | [Approved evidence](redesign-pages/HOME-WORKBENCH.md); [scoped project lifecycle extension 59](redesign-pages/PROJ-VIEW.md) VERIFY, counters unchanged |
| JS-REV-BUCKET | `static/js/revenue-bucket-filter.js` | Home, revenue dashboard/customer/seller views, seller summary and preview | DONE | [Checkpoint 18 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-DASH | `partials/_dashboard_settings.html` | Home and preferences | VERIFY | [Preferences and dashboard](redesign-pages/PREFS.md); original selection/save contracts |
| INC-FY | `partials/_fy_management_card.html` | Admin | VERIFY | [Admin fiscal-year controls](redesign-pages/ADMIN.md); guarded original operations |
| INC-PROJ-FORM | `partials/_project_form_fields.html` | Project/note forms | VERIFY | [PROJ-FORM](redesign-pages/PROJ-FORM.md), [native note drawer](redesign-pages/NOTE-FORM.md); shared IDs, attachment choices and handlers |
| INC-EXPORT | `partials/_report_export.html` | Reports, revenue dashboard, milestone tracker | VERIFY | [Final native defaults](redesign-pages/FINAL-RECONCILIATION.md); all nine hosts retain native CSV/clipboard/email and honest feedback, no optional legacy branch |
| INC-ACT-CAIP | `partials/activity_coverage_caip.html` | Activity coverage | VERIFY | [Final helper coverage](redesign-pages/FINAL-RECONCILIATION.md); existing native CAIP controls and isolated activity regressions revalidated |
| INC-ACT-MS | `partials/activity_coverage_milestones.html` | Activity coverage | VERIFY | [Final helper coverage](redesign-pages/FINAL-RECONCILIATION.md); existing native milestone audit and isolated activity regressions revalidated |
| INC-CUST-ICON | `partials/customer_favicon.html` | Customer favicon macro, multiple hosts | VERIFY | [Final helper coverage](redesign-pages/FINAL-RECONCILIATION.md); unchanged cached PNG, dimensions and native fallback macro contract |
| INC-ENG-PANEL | `partials/engagements_panel.html` | Home, engagements hub, seller | VERIFY | [Final Home completion](redesign-pages/HOME-COMPLETE.md), [directory](redesign-pages/ENG-LIST.md); deferred Home activation and eager directory loading preserved |
| INC-MS-TRACK | `partials/milestone_tracker_content.html` | Milestone tracker and seller | VERIFY | [Milestone tracker](redesign-pages/MS-TRACK.md); [complete seller Full View](redesign-pages/SELL-VIEW.md) |
| INC-PART-ICON | `partials/partner_favicon.html` | Partner/specialty surfaces | VERIFY | [Final helper coverage](redesign-pages/FINAL-RECONCILIATION.md); unchanged cached PNG, dimensions and native fallback macro contract |
| INC-REV-ALERTS | `partials/revenue_alerts_content.html`, `static/js/ui-revenue-alerts.js` | Revenue Analyzer, seller alerts and Seller Full View | DONE | [Checkpoint 22 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-REV-PREVIEW | `partials/revenue_alert_preview.html`, `static/js/ui-revenue-preview.js` | Home, Revenue Analyzer, seller alerts and native Seller Full View drilldown | DONE | [Checkpoints 21-22 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-REVIEW | `partials/review_action.html`, `static/js/ui-revenue-review.js` | Home and revenue/seller surfaces | DONE | [Checkpoint 19 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-FORECAST | `_forecast_comments.html` | Milestone/opportunity details | VERIFY | [Milestone evidence](redesign-pages/MILESTONE-BODY.md), [complete opportunity integration](redesign-pages/OPP-VIEW.md) |
| INC-FORECAST-JS | `_forecast_comments_js.html` | Milestone/opportunity details | VERIFY | [Milestone evidence](redesign-pages/MILESTONE-BODY.md), [opportunity draft/write parity](redesign-pages/OPP-VIEW.md) |

## Global, native-shell and error surfaces

| ID | Surface | Location | Status | Evidence |
| --- | --- | --- | --- | --- |
| GLOBAL-SHELL | Navigation, page frame, theme, flash/status messages, global controls | `templates/base.html` | VERIFY | [Final runtime reconciliation](redesign-pages/FINAL-RECONCILIATION.md) |
| GLOBAL-SETUP | Welcome/sign-in/onboarding | `base.html`, native setup dialog | VERIFY | [ONBOARDING](redesign-pages/ONBOARDING.md); checkpoint99, review pending |
| GLOBAL-NOTE | Quick-note customer picker | `base.html`, native quick-note dialog | DONE | [Card](redesign-pages/GLOBAL-PICKERS.md) |
| GLOBAL-ENG | Quick-engagement customer picker | `base.html`, native quick-engagement dialog | DONE | [Card](redesign-pages/GLOBAL-PICKERS.md) |
| GLOBAL-HELP | Contextual page help | `base.html`, native help dialog | DONE | [Card](redesign-pages/GLOBAL-HELP.md) |
| GLOBAL-KEYS | Keyboard shortcuts | `base.html`, native shortcuts dialog | DONE | [Card](redesign-pages/GLOBAL-HELP.md) |
| GLOBAL-CHAT | Copilot chat | `base.html`, native chat flyout | VERIFY | [CHAT](redesign-pages/CHAT.md); checkpoint100, nonmodal coexistence verified |
| GLOBAL-SHARE | Sharing | `base.html`, native sharing dialog | VERIFY | [Final sharing reconciliation](redesign-pages/SHARING-FINAL.md); checkpoint101 |
| GLOBAL-IMPORT | Shared-data import review | `base.html`, native import-review dialog | VERIFY | [SHARING-FINAL](redesign-pages/SHARING-FINAL.md); offline/native contract limits explicit |
| GLOBAL-ZOOM | Image zoom | `base.html`, native image dialog | DONE | [Card](redesign-pages/GLOBAL-ZOOM.md) |
| GLOBAL-TOUR | Guided product tour | `base.html`, tour script | VERIFY | [ONBOARDING](redesign-pages/ONBOARDING.md); checkpoint99 |
| SHELL-START | Starting Sales Buddy | `electron/main.js` | VERIFY | [ELECTRON-STARTUP](redesign-pages/ELECTRON-STARTUP.md); checkpoint102 |
| SHELL-SLOW | Startup taking longer than usual | `electron/main.js` | VERIFY | [ELECTRON-STARTUP](redesign-pages/ELECTRON-STARTUP.md); checkpoint102 |
| SHELL-UPDATE | Updating Sales Buddy | `electron/main.js` | VERIFY | [ELECTRON-UPDATE](redesign-pages/ELECTRON-UPDATE.md); checkpoint103 |
| SHELL-BUILD | Building desktop app | `electron/main.js` | VERIFY | [ELECTRON-UPDATE](redesign-pages/ELECTRON-UPDATE.md); checkpoint103 |
| SHELL-RECONNECT | Backend unavailable / reconnecting | `electron/main.js` | VERIFY | [ELECTRON-STARTUP](redesign-pages/ELECTRON-STARTUP.md); checkpoint102 |
| ERROR-DEFAULT | Missing records/routes and other HTTP failures | `app/routes/errors.py`, `templates/error.html` | VERIFY | [ERRORS](redesign-pages/ERRORS.md); checkpoint104 |

Native geometry/maximized-state restoration is also a release requirement from
the archive window plan. Test actual relaunch, update/rebuild exits, tray and
monitor work areas; HTML screen approval does not prove native persistence.

## Inventory reconciliation

At the initial inventory baseline, all103 tracked templates were classified:
78 full-page + 9 routed fragments +
15 include-only helpers + one base. No orphan templates were found.
Checkpoint 21 adds one include-only Revenue preview template after that baseline.
Ninety page handlers use 95 direct page URL rules; six additional legacy URL
rules redirect to pages already listed.

There is no standalone opportunity list/create/edit, project list, POD create,
solution-engineer create, internal-contact detail or note-template list page.
Their embedded/API workflows belong in host-page cards, not invented page rows.
JSON APIs, mutation-only routes, downloads, streams and health/static endpoints
are not page checkoffs, but their user-visible consumers and results must be
covered. Add new page rows when those surfaces acquire a page.

## Product-change ledger

For every reconciliation range, list all affected IDs, the decision, and
evidence. Reopen approvals when needed. Include route/service/model/test changes.

| Product SHA/range | Change | Affected IDs | Disposition / evidence | Reconciled by/date |
| --- | --- | --- | --- | --- |
| `ef552587a6514e116840b19f27c9b79ea6db0708` | Initial inventory baseline | All | Inventory only; no page approved | October 2, 2026 |

## Final release reconciliation

- [ ] Candidate product and implementation SHAs recorded
- [ ] Current route/template/global-surface inventory reconciled
- [ ] All product changes since baseline reviewed, including unlogged changes
- [ ] All required rows DONE at candidate revisions; no unapproved feature loss
- [ ] Shared hosts and cross-page flows reverified
- [ ] Theme variants, global controls and native window behavior verified
- [ ] Runtime Bootstrap removal and icon decision verified
- [ ] Related tests/instructions/changelog updated
- [ ] Final tester approval and scoped test evidence recorded
- [ ] Any changes after candidate selection reconciled before release
