# ENG-LIST: checkpoint 55

- Status: VERIFY, user-approved October 7; final reconciliation pending.
- Audited baseline: `4e57b1a6` plus preserved 53-54.
- Approved batch effort: about 75%; implementation SHA is in the page tracker.
- Audit: original hub, complete panel/controller, API/seller scope, customer
  picker, related detail/lifecycle, project provider and tests read first.
- Genuine live BEFORE captured first at 1566x1174, Graphite dark.
- Scope: `/engagements`, hub template, opt-in panel controls, scoped CSS/controller,
  tests/help/documentation. No provider, model, API, form or full-detail changes.
- Composition: native frame/footer, persistent summary/commands, owned directory/project scroll.

## Actual parity
- Complete live population: 33 engagements, Active 30, On Hold 0, Won 2, Lost 1.
- Story health: 9 empty, 21 partial, 0 complete; original Active + On Hold scope.
- Default favorite priority, provider updated-desc order, seller then customer
  group order/membership and saved panel storage key remain unchanged.
- Seller mode keeps its original provider scope and default flat view; toggled
  grouping is customer-only. SE grouping retains seller name and Unassigned.
- All/Active/On Hold/Won/Lost, grouping, favorites-only, original four order
  selections persist. Updated oldest-first and target late-first complete pairs.
- Fields: full title, status, nickname/name/favicon, seller, story percentage/
  thresholds/bar, raw ACR/mo, target, latest note, tasks/notes/opportunities/
  milestones, favorite state and canonical engagement/customer links.
- Provider shape is unchanged; Last Updated uses exact server-provided order,
  not a fabricated timestamp or display date. Missing dates stay last both ways.
- Eleven data headers sort both ways through the one global SBTableSort.
  Separate customer tbodies keep group membership; group headers stay pinned.
  Date/numeric keys are raw; Favorite is an unsorted action with export label.
- No topic filter, source chooser or export action existed here; existing
  detail/embed workflows are retained rather than invented or removed.
- Internal projects preserve the complete original population/order, type,
  status, description truncation, open-task counts, due/overdue and New Project.
- Creation reuses the canonical native picker: 210 live results, correct
  customer-specific form destinations, autofocus and Escape; no form submission.
- Favorite keeps the original POST with no body and immediate update lifecycle.
  Failed saves remain visibly failed; duplicate writes and pending page exit
  are guarded. Directory itself contains no editable business-data draft.
- Back live proof: Active, story-desc, flat, ACR descending, reading top 240,
  left 0 and exact row order restored after opening an actual engagement.

## Verification and boundaries
- `venv\Scripts\python.exe -m pytest tests\test_ui_engagements_directory.py tests\test_engagements.py -q`:
  86 passed, 48 existing SQLAlchemy legacy warnings. Initial fixture setup fixed.
- `node --test tests\js\ui_engagements_directory.test.cjs tests\js\ui_table_sort.test.cjs`:
  41 passed, including isolated failure/duplicate/pending-save paths.
- `node --check static\js\ui-engagements-directory.js`, page-help syntax,
  editor diagnostics and `git diff --check` pass.
- Live: 22 sort toggles verify actual values and fixed memberships; status
  counts 33/30/0/2/1; favorites 0; oldest-first parity; all row values fresh-read
  matched. Fixed footer at 1174, zero document/horizontal overflow.
- No live business writes, sync, refresh or saved preference changes.
  Directory/detail/picker providers read local records; no MSX cache refresh
  requested. Normal telemetry/recent-view bookkeeping is not claimed unchanged.
- Home/seller panels and associated rich-editor previews retain their full legacy lifecycle.
  Shared engagement body migration is deferred to checkpoint 57;
  New/Edit forms belong to checkpoint 56. No related surface was simplified.
- Images: checkpoint-55-engagements-directory-before.png / -after.png,
  -light-after.png, -picker-after.png, -projects-after.png in session files.
- QA storage/listeners cleared; default grouping/order/All/top and dark restored.
- Discord: accepted generic DM `1557271986424512544`, exactly one send.
