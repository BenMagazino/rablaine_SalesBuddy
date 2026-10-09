# SELL-FORM: New and Edit Seller

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Content consistency sweep, October 8, 2026
- Identity editing plus duplicate-seller reference is a paired workspace, now 1344px.
- Remove `.sf-layout`'s old 1080px cap; actual paired content reaches 1278px.
- Keep original fields, selected territories, reference names and all save controls.
- Private evidence: `consistency-seller-form-{before,after,light-after}.png`.
- Uncommitted correction only; no checkpoint advancement.

## Readable-width rollout, October 7, 2026
- `/seller/new` and edit: 1152px root aligns commands around bounded identity/seller tracks.
- Dark/light live desktop has no horizontal overflow; existing 1080px maximum stays.
- Private evidence: `width-entity-seller-form-{before,dark-after,light-after}.png`.

- Status: VERIFY, checkpoint 64, October 7, 2026; user review pending.
- Baseline: `7a43faab` plus uncommitted checkpoint 63; implementation uncommitted.
- Scope: `/seller/new`, `/seller/<id>/edit`, complete `seller_form.html`.
- Native identity/coverage editor with a quiet existing-seller reference column.
- Continuous desktop frame, owned reading scroll, persistent commands/status rail.
- Approved effort remains about 75%; no strict DONE counter changed.

## Audited contract and consumers

- Providers: `sellers.seller_create`, `sellers.seller_edit`, sorted Territory/Seller queries.
- Consumers: existing Sellers New link, seller detail Edit link, canonical breadcrumbs.
- No fragment/embed form consumer found; inline customer seller creation stays unchanged.
- Required text `name`; optional text `alias`; `Growth`/`Acquisition` `seller_type`.
- New defaults empty name/email, Growth, no territories; Edit uses saved identity/email.
- Territory search excludes selected IDs, matches case-insensitively, supports mouse,
  ArrowUp/Down, Enter/Space/Tab choice selection and Escape/outside close.
- Repeated hidden `territory_ids` preserve many-to-many assignment/replacement.
- Selected territories retain alphabetical initial display, location identity and removal.
- All existing sellers remain alphabetical; Edit excludes only the current seller.
- Inline territory dialog keeps required `name`, current-URL `redirect_to` and original
  `/territory/create-inline` POST, duplicate handling and immediate-save semantics.
- Cancel still returns `/sellers`. Create success returns `/sellers`; Edit success
  returns the original seller detail. New duplicate still opens that existing seller.
- Empty-name redirects and Edit duplicate redirects retain their original destinations.

## Lifecycle and tightly coupled repairs

- Shared `ui-milestone-form.js` lifecycle now also binds Seller forms; no new framework.
- Native discard/keep-editing and inline dialogs replace Bootstrap interaction.
- Entry-local Back state retains identity, repeated territory IDs, search, inline name
  and reading position without autosave, storage writes or changes to other drafts.
- Pending POST preserves enabled payload fields and blocks duplicate submissions/leave.
- Failed writes roll back/log and render honest HTTP 500 with escaped raw entries.
- Original validation redirects retain failed input once in a route-scoped session slot.
- Territory names are JSON/text nodes, including quotes, ampersands and closing scripts.

## Verification and private evidence

- `pytest tests\test_ui_seller_form.py tests\test_ui_customer_form.py`
  plus seller New/Edit tests from `test_forms.py` and seller POST from `test_integration.py`:
  43 passed; 14 new seller tests use only the isolated test database.
- `node --test tests\js\ui_{seller,customer,project,milestone}_form.test.cjs`:
  30 passed; six new seller matching/history/guard/pending/failure checks.
- Live 1566 x 1167 desktop: New seven reference names, Edit six; original field/default/
  association values match Before. Body equals window height; command/status bands visible.
- Actual Back recovered draft name and added territory; keyboard/mouse add/remove,
  inline open/Escape, inline-draft guard and Keep editing verified without submissions.
- Dark/light After images inspected; temporary theme attributes restored, QA drafts cleared.
- Private images: `checkpoint-64-seller-{new,edit}-{before,after}.png` and
  `checkpoint-64-seller-{new,edit}-light-after.png` in the session files directory.
- Syntax/editor diagnostics and diff whitespace clean; business write tests stay isolated.
- Live QA issued no form/provider writes; ordinary read telemetry/bookkeeping may occur.
- Existing sharing-hub DNS errors remain unrelated; no seller page JavaScript errors.
- One generic readiness DM accepted: message ID `1557435036846792797`.
- Seller detail remains checkpoint 65; combined gallery/regression belongs to the parent.
