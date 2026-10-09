# ENG-FORM: New/Edit engagement forms

## October 8 reading-width revision
- Centered 1344px root preserves story and linked-record panes without horizontal overflow.
- Both New/Edit verified live in dark/light at 1559x1167; pinned commands remain usable.
- Private evidence: `width-workflow-engagement-{form,edit}-{before,after,light-after}.png`.
- Revision awaits review and is uncommitted; prior checkpoint approval is preserved.

- Inventory: ENG-NEW, ENG-EDIT. Checkpoint 56 VERIFY, user-approved October 7.
- Audited baseline: approved HEAD `4e57b1a6` plus uncommitted checkpoints 53-55.
- Approved batch effort: about 75%; implementation SHA is in the page tracker.
  Strict DONE counts await final reconciliation.
- Scope: `/customer/<customer_id>/engagement/new`, `/engagement/<id>/edit`.
- Template: `engagement_form.html`; native CSS/controller and form error rendering.
- Full engagement detail/shared detail body is unchanged and remains checkpoint 57.

## Original contract and preserved parity

| Surface | Observable contract |
| --- | --- |
| Identity | Fixed customer; original customer ancestry and link; no new customer/product/role chooser |
| Native POST | Same route, names and payload; Title required/autofocus, Status Active/On Hold/Won/Lost in original order |
| Story | Key Individuals, Technical/Business Problem, Business Process/Strategy Impact, Solution Resources and original narrative prompts |
| Outcome/timeline | Estimated monthly ACR: original number/min=0/step=1, zero displayed blank on GET; optional local date |
| Contacts | Customer, partner, SE, seller, internal and external; hidden repeated types/ref IDs and external name/email pairs intact |
| Contact picker | Original customer/domain-aware searches, duplicate exclusion, icons/details/email, arrows/Tab/Enter/Escape, hover and outside close |
| Immediate person creation | Original customer/internal POST endpoints and exact JSON payloads; clearly labeled as immediate writes |
| Associations | Customer-only notes newest-first, opportunities by name, milestones by title; exact values, preselection, truncation and MSX statuses |
| Save | Original trimming/null semantics; same customer filtering; edit still invokes milestone tracking |
| Destinations | New success: customer; edit success: engagement; Cancel in both modes: customer |
| Delete | Edit-only native confirmation, same POST action and warning; linked notes/opportunities/milestones are not deleted |
| Failure | Original required-title/date messages; rollback/log DB or parse failures, visible error, retain submitted fields/contacts/checks |
| Draft/Back | No autosave/new business validation; entry-local history, independent story/link/choice scrolls, shared SBDialog discard and unload guard |
| Pending | Native POST leaves payload fields enabled; duplicate saves/deletes and pending-contact navigation are guarded |
| Non-form data | Existing business outcome, MSX/product/team metadata and unrelated relationships untouched |

## Verification evidence

- Scoped Python: `python -m pytest tests\test_ui_engagement_form.py tests\test_engagements.py
  tests\test_engagement_contacts.py`: 108 passed. New form tests cover both modes/all person types,
  original defaults/order/escaping, title/date/numeric/DB failures and successful isolated writes.
- Existing contact-score test corrected from obsolete sixths to current sevenths
  (14%/28%); no completeness provider or business behavior changed.
- JS: `node --test tests\js\ui_engagement_form.test.cjs tests\js\ui_milestone_form.test.cjs`:
  22 passed, including draft restoration, corrupted history, pending saves/contacts and delete Back.
- Jinja parse, Python AST, JS syntax, editor diagnostics and `git diff --check` clean.
- Real desktop 1566x1174: both modes retain exact original FormData; 18 opportunity
  and 21 milestone choices unchanged. New defaults Active and no Delete.
- Additional real populated edit: five people, two notes, 25 opportunities, three
  milestones, two selected notes/two selected milestones; fresh GET payload matches.
- Live plain typing/existing-person keyboard selection, association selection,
  Cancel/Keep editing, reload recovery and real Back scroll restoration verified; QA cleared.
- Both real dark/light modes inspected; Graphite dark restored, no preference writes.
- No live form submission, contact creation, autosave, AI, sync or business write.
- Form GETs/domain/search providers audited read-only; no form-specific MSX/cache writes.
  Engagement/contact/note/opportunity/milestone business fingerprint unchanged.

## Private screenshots and review

- Session files: `checkpoint-56-engagement-form-new-before.png`, `-new-after.png`,
  `checkpoint-56-engagement-form-edit-before.png`, `-edit-after.png`.
- Supplements: `checkpoint-56-engagement-form-new-light.png`, `-edit-light.png`,
  `checkpoint-56-engagement-form-populated.png`, `-draft.png`.
- User approval pending. No live save/delete/remote-contact write was performed;
  their success/error/pending paths are isolated tests rather than live mutations.
- One generic Discord DM accepted: `1557277001813983243`. No private content sent.
## October 8 content-background consistency

- Actual story editor and association-reading panes share `--sb-ui-surface`.
- Existing 1344px frame, field values and contact/status/control tones are unchanged.
- Evidence: `consistency-engagement-{form,edit}-{before,after,light-after}.png`.
- Parent coordinates `test_ui_engagement_form.py` and `test_ui_workflow_consistency.py`.
