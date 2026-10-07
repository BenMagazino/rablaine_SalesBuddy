# CUST-VIEW: customer dossier

Checkpoint 62, October 7, 2026. **VERIFY, user-approved, final reconciliation pending.**
Baseline: approved checkpoint 52 `4e57b1a6` plus preserved uncommitted 53-61.
Checkpoints 53-62 signed off together October 7. Approved effort: about 75%.
Implementation SHA is in the page tracker. No push, merge or deployment authorized.
## Actual scope and parity
- `/customer/<id>`, complete `customer_view_content.html`, native controller/CSS,
  original account-context handler and shared `_customer_opportunities.html`.
- Original name/nickname, favicon/colors, TPID/MSX URL, seller/type, territory,
  account-owner name/alias, last contact, verticals, CSAM choices and partners stay.
- All contacts retain name/title/email/photo/full photo, original ordering and APIs.
  Context, contact edit/add/delete, CSAM, photo, domain and Auto-fill workflows remain.
- Complete rich notes retain local call dates, topics, sellers, opportunities,
  milestones, engagement/project associations and all original relationship links.
- Engagement status/story controls, counts, dates and newest-first default stay.
  Opportunities keep favorites first, milestone-bearing next, then lowercase name.
- Shared note-editor information flyout retains alphabetical opportunity order,
  all nested milestone relationships/status/workload/ACR/due dates and date thresholds.
- Revenue still matches the customer name and begins in original priority order;
  all original category/action/average/trend/risk values and Details destination stay.
- Six revenue data headings sort raw text/numeric keys both ways, with export labels.
- No original standalone graph/export/action-item/SE-editor/sync control existed here:
  original linked revenue graphs, native engagement/milestone/project/note/forms and
  task/history/source workflows remain their canonical surfaces, not copied providers.
- Native header/footer, owned scroll, keyboard tabs and pipeline search; complete
  original scripts moved, not simplified. Global sorter/dialog load once.
- Actual Back restores tab/search/reading; context/contact and child-dialog drafts
  stay guarded. Manual-save failures retain input; pending/duplicate writes are blocked
  through the response body. Account-context DB failure rolls back and reports 500.
## Verification and safety
- Isolated scoped pytest: **227 passed, 47 existing warnings**, 24.96 seconds.
  `pytest.main([r'tests\test_ui_customer_detail.py', r'tests\test_customer_contacts.py',
  r'tests\test_ui_customer_form.py', r'tests\test_ui_engagement_detail.py',
  r'tests\test_ui_engagement_form.py', r'tests\test_ui_milestone_body.py',
  r'tests\test_ui_action_items.py', r'tests\test_breadcrumb_entities.py'])`.
- JavaScript: **65 passed**, including seven customer lifecycle cases.
  `node --test --test-reporter=spec tests\js\ui_customer_detail.test.cjs tests\js\ui_customer_form.test.cjs tests\js\ui_engagement_detail.test.cjs tests\js\ui_engagement_form.test.cjs tests\js\ui_milestone_workflow.test.cjs tests\js\ui_action_item_dialog.test.cjs tests\js\ui_note_actions.test.cjs`.
- Both changed JS files pass `node --check`; targeted diagnostics and `git diff --check` pass.
- SE/DSS/seller-session tests compare original rendering, exact populations/links,
  full note HTML, original context payloads and info/opportunity/milestone/contact shapes.
- Live customer 107: all **251 original links, 15 note bodies, 60 opportunities,
  106 nested milestones** preserved; 3 engagements, 14 revenue rows and 4 contacts.
- Live: five status filters, all story/newest orders, 12 revenue sorting directions,
  search, real Edit/Back restoring tab/search/120px reading, draft guard and native
  context/contact/photo editors. All QA drafts cleared; fresh API shapes/counts match.
- Graphite dark/light checked at unchanged 1566x1174; protected note/design tabs untouched.
- Normal GET telemetry adds UsageEvent only, proven by isolated commit audit.
  Six existing global Socket.IO transport POSTs handle handshake/online-user polling.
  No customer/business/AI/sync/favorite/photo/import submission; no MSX cache refresh.
- Gaps: no live write/AI probes; isolated writes tested. Known unrelated old note-card
  `border-info` role assertion stays documented; no full-suite claim.
- An older stdin-based Node syntax probe remains stalled in shell 1709, not killed.
  Replaced with bounded project-local file syntax checks, scratch cleaned. The complete
  corrected scope passed through the configured Python runner.
## Private images and review
Browser: `7206d7db-25f4-4fae-94ac-93de671dba10`; existing dev port 5000 stays running.
Images under `C:\Users\alexbla\.copilot\session-state\f00fceac-0d8b-411e-9cc9-5e17d6e6c9c7\files`:
`checkpoint-62-customer-detail-before.png`, `checkpoint-62-customer-detail-after.png`;
supplements use `checkpoint-62-customer-detail-{notes,pipeline,revenue,inline,photo,light}-after.png`.
All eight images inspected. One generic Discord DM accepted: `1557312722419458099`, exit 0.
