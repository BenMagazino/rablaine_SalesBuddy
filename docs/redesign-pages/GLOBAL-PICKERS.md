# GLOBAL-NOTE / GLOBAL-ENG: native customer pickers

- Status: DONE; technically verified and user-approved on October 2, 2026
- Checkpoint: 4, quick-note and quick-engagement customer selection
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `160e2d9`, approved native help/dialog checkpoint
- Implementation revision: `8dd3363`
- Next action: continue the remaining global surfaces and record partial flows.
  This approved checkpoint is committed.

## Scope and original inventory

Migrate only the two global customer-selection hosts to native dialogs and
app-owned styles. Preserve their IDs and reuse the existing shared search helper.
The homepage calendar is a third consumer of that helper. Its Bootstrap host
was retained at checkpoint 4; the checkpoint 14 follow-up now migrates it to the
same native picker used by global New note.
Shared loading, safe label rendering and retry behavior apply to all three hosts.

Entry points are header New note, Ctrl+K, the notes-list empty-state action and
the engagements-hub New Engagement button. Customer names, nicknames and TPIDs,
search labels/placeholders, general-note choice, real links, keyboard selection,
lazy loading and per-picker caching are retained. Closing clears the query and
results, but reopening uses cached customers. No customer-list limit is introduced.

This does not approve or redesign the notes list, engagements hub, destination
forms, homepage body, record partials or editable-record dialog lifecycle.
Bootstrap Icons remains a separate dependency.

## Parity and interaction evidence

| ID | Original contract | Implementation / evidence | Result |
| --- | --- | --- | --- |
| PICK-01 | All four launcher surfaces remain usable | Native declarations and Ctrl+K; rendering tests and live header/hub/form checks | PASS |
| PICK-02 | Note customer selection opens a preselected create form | `/note/new?customer_id=<id>`; live selection and customer-field check | PASS |
| PICK-03 | General Note remains available, including no-match searches | `/note/new`; Node checks and live navigation | PASS |
| PICK-04 | Engagement creation requires a customer | No general option; `/customer/<id>/engagement/new`; live destination form | PASS |
| PICK-05 | Names, nicknames and TPIDs remain searchable and visible | Same client-side filter; plain-text DOM labels; Node and live TPID filtering | PASS |
| PICK-06 | Enter chooses the first actual match, never General Note | Explicit customer marker; Node checks and live filtered Enter/no-match checks | PASS |
| PICK-07 | Arrows move through results and back to search; Space activates a link | Existing keyboard contracts retained; Node checks and live arrow navigation | PASS |
| PICK-08 | Search receives focus; Escape, X, Cancel and backdrop close predictably | Native dialog policies; live dismissal and form Ctrl+K/Escape checks | PASS |
| PICK-09 | Nested F1 preserves the underlying picker query | Target-specific lifecycle handling; live F1/Escape/query-retention check | PASS |
| PICK-10 | Close clears transient state; reopen retains cached data | Generation guards, cache and shared in-flight request; Node and live checks | PASS |
| PICK-11 | Calendar customer and general links preserve the selected date | Date hook and native lifecycle; meeting links additionally preserve `from_meeting`, and ordinary day opens clear it | PASS |
| PICK-12 | Failed customer loading is visible and recoverable | HTTP/schema checks, logged error, Retry and focus returned to search; Node failures and live 503/recovery | PASS |
| PICK-13 | Late responses cannot refill a closed picker | Generation guard; Node close/reopen and in-flight deduplication checks | PASS |
| PICK-14 | Long lists scroll without losing fixed controls | Bounded native shell and single result scroller; live desktop geometry and screenshot | PASS |
| PICK-15 | Approved theme pairs remain readable | Eight live variants, no clipping; measured name/metadata/label/input/footer/error text contrast at least 6.50:1 | PASS |
| PICK-16 | User review: one field focus indicator; resize results without moving the dialog top | Input outline removed; naturally sized result area capped at 400px; picker top anchored 48px from viewport top; live full/one/no-match checks preserve dialog and search-field top positions in both pickers | PASS |

## Verification and handoff

- 42 scoped Node checks pass across customer pickers, native dialogs/help,
  navigation/search and theme foundations.
- 19 scoped navigation/picker rendering tests pass after the final changes.
  Earlier checkpoint verification also passed six Reports hub/home checks,
  for 25 scoped Python checks total. Tests use the isolated database.
- The notes empty-state launcher is covered by isolated rendering tests.
  Real notes were not deleted to manufacture an empty live page.
- Live checks use the existing development data and desktop viewport.
  No records were saved, preferences posted or meeting refresh invoked.
- Temporary failure interception and theme attributes were restored.
  No real-data screenshot is added to the archive or repository.
- User review identified duplicate input/field focus outlines and a jarring
  vertical shift when filtering. Only the field border indicates input focus;
  link/button focus outlines are unchanged. After trying a reserved-height list,
  the user requested natural resizing with a pinned top, matching the original
  interaction. Both picker dialogs now resize downward from a fixed 48px top
  inset; their headings and search fields stay put across full, filtered and
  empty results. Other native dialogs retain their centered placement.
  Eight theme variants remain in bounds. Retry also restores search focus.
- Native picker hosts and launchers no longer use Bootstrap modal APIs,
  attributes or component classes. The checkpoint 14 follow-up removes the
  helper's last Bootstrap path now that all three consumers are native dialogs.
- The user signed off on both pickers on October 2, 2026, including their
  top-anchored resizing and single field focus indicator.
  GLOBAL-NOTE and GLOBAL-ENG are DONE; their host pages and destination forms
  are not approved by this checkpoint.
  Full GLOBAL-SHELL remains BUILDING. No push, merge or deployment is authorized.

## Checkpoint 14 calendar follow-up

Calendar quick-create and unmatched ghosts now use `SBDialog` and the existing
native picker styling/controller. The date heading, General Note choice,
customer/nickname/TPID search, caching, loading/Retry and keyboard behavior stay
available. Unmatched ghosts carry their meeting ID through both customer and
general-note links, restoring the existing backend's meeting prefill/back-link
contract. Opening an ordinary day afterward clears that ID; the global New note
picker never inherits calendar context.

This follow-up is user-approved October 3, 2026, with checkpoint 14, ready to commit.

Live Home verifies the unmatched September 23 meeting opens a native picker at
y=48, focused on search, with native result classes and date/meeting parameters
on both customer and General Note links. TPID filtering yields one customer;
arrow navigation focuses its correct URL without navigating. Escape restores
the ghost opener. Reopening for September 24 clears the meeting ID, while Ctrl+K
retains plain global New note links. No note is created or meeting pulled.
The real unmatched picker is left open for review, with the existing draft and
separate unsaved New Note tab untouched.

The related checks cover 44 Node cases and 77 isolated Python cases across
calendar/picker/theme controllers, Home/navigation/note rendering and matched/
unmatched meeting time prefill. All pass; the updated Home signature assertion
was rerun separately after correcting its old one-argument expectation.
