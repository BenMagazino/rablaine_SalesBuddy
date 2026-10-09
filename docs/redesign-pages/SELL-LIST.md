# SELL-LIST: Sellers directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


- Checkpoint: 63, October 7, 2026. Status: VERIFY, awaiting user batch review.
- Audited source: starting HEAD `7a43faab`, branch `feature/ui-redesign`.
- Tested implementation: uncommitted checkpoint 63; no invented implementation SHA.
- Approved effort remains about 75%; strict DONE counters do not increase.
- Scope: `/sellers`, its existing standalone template and directory controller/styles.
- Not included: seller forms/details, other directories or shared seller-mode behavior.

## Audited contract and consumers

- `app/routes/sellers.py::sellers_list` remains unchanged: all sellers, eager-loaded
  territories/PODs and customer notes, alphabetical seller order within type.
- Growth is exact `seller_type == 'Growth'`; all other types remain Acquisition.
- Customers retain `get_display_name()` order and the most recent local `call_date`.
- Names, optional alias plus `@microsoft.com`, all alphabetically ordered territories,
  customer counts, cached favicons/building fallbacks and latest-note month/day remain.
- Empty directory, zero-customer seller and No notes states remain explicit.
- Only this route renders `sellers_list.html`; no fragment/embed consumer exists.
- Existing nav/admin links and seller-form Cancel/creation redirects remain `/sellers`.
- Seller, territory, customer and New Seller destinations retain exact existing URLs.
- View as retains the original `not seller_mode` condition, including DSS behavior.
- It posts to `/api/seller-mode/activate/<id>` with no invented payload and navigates Home.

## Native implementation

- Continuous page/context/status frame with one owned directory reading region.
- October8 creator-approved standard: centered pages use darker theme-canvas
  gutters through the shared shell, not a Sellers-specific override.
  The centered reading pane keeps its approved surface, width, rows and commands.
  Dark/light collapsed and expanded views verified with zero overflow;
  eight scoped directory tests pass. Original Bootstrap Before remains unchanged.
- Compact native disclosure summaries preserve linked identity and independent actions.
- Mouse and native keyboard disclosure, mixed Expand All and Collapse All remain.
- Customer tables sort only surfaced Name and Latest note, both directions.
- Date keys are ISO calendar dates; unavailable notes remain last in either direction.
- Summary metadata/actions are not sorting controls; export labels are explicit.
- Shared `SBTableSort` loads once; no new generic helper or preference write.
- Entry-local history retains expansion, scroll and independent table sorting on Back.
- View as is explicit, deduplicated and guarded while pending; HTTP/JSON failures stay
  visible and retain directory context. Output matches actual seller-mode response.

## Verification and private evidence

- `python -m pytest tests\test_ui_sellers_directory.py
  tests\test_views.py::test_sellers_list_loads -q`: **6 passed**.
- `node --test tests\js\ui_sellers_directory.test.cjs`: **4 passed**.
- JS syntax check and editor diagnostics clean; scoped whitespace check clean.
- Live desktop: 1566 x 1167, 7 sellers, 4 Growth/3 Acquisition, 209 customers.
- All 24 live sort direction checks pass across six nonempty customer tables.
- Back from the unchanged New Seller GET restores seven expansions, six independent
  date sorts and exact reading offset 650; no form entry/submission occurs.
- Header/context/commands/footer stay fixed; footer bottom 1167; no horizontal overflow.
- Dark/light root-attribute checks retain geometry; original dark theme restored.
- Private screenshots inspected: `checkpoint-63-sellers-before.png`,
  `checkpoint-63-sellers-after.png`, `checkpoint-63-sellers-expanded-after.png`,
  `checkpoint-63-sellers-light-after.png` in the existing private session files.
- Live QA is read-only; no seller-mode activation, business writes or preference writes.
  Ordinary app telemetry/read bookkeeping may occur; no unchanged-database claim.
- Existing staging Socket.IO DNS failures remain outside directory migration scope.
- Generic readiness DM accepted once: message ID `1557432654079467692`, exit 0.

## Review refinement: aligned territory column

- Summary rows now use named grid columns for disclosure, name, optional email,
  territories, customer count and optional View as. Missing fields cannot shift tags.
- Names and emails remain complete, with wrapping for unusually long values.
  Territory tags still wrap within their flexible column; source markup is unchanged.
- Live desktop checks: all seven territory groups start at x=530, with zero-pixel
  spread across Growth and Acquisition, including the seller without an alias.
  All six populated groups' first tags share that edge. Rows remain 50 pixels high.
- Dark, light and expanded coverage checks retain alignment without horizontal
  overflow. Trusted Expand All and Collapse All work; dark theme restored.
- Scoped regression: `tests\test_ui_sellers_directory.py`, **6 passed**;
  `tests\js\ui_sellers_directory.test.cjs`, **4 passed**. Editor diagnostics clean.
- Private revision screenshots: `sellers-territory-columns-before.png`,
  `sellers-territory-columns-after.png`, `sellers-territory-columns-expanded-after.png`,
  `sellers-territory-columns-light-after.png`. All After images inspected.
- Same gallery now shows the revised primary After and retains original batch
  screenshots under revision history: 28 checkpoints, 137 loaded images.
- No seller-mode activation, form submission or preference write during this check.
  Batch approval remains pending; changes remain uncommitted.
- Generic refinement readiness DM accepted once: `1557599615153344563`, exit 0.

## Review refinement: centered directory reading width

- User selected a centered, bounded directory rather than edge-to-edge rows.
  Sellers and Customers explicitly opt into the shared `sb-directory-frame`.
- The working surface is capped at 1,152 pixels. Heading, commands, notices and
  scrolling results share that width; navigation, breadcrumbs and status stay full-width.
  Other workbench surfaces are not implicitly constrained.
- Seller name/email tracks are now 160/200 pixels, retaining named territory
  placement, complete text and wrapping without oversized identity gaps.
- Live desktop: 1,559-pixel window, surface width 1,152, equal 203.5-pixel outer
  gutters. All seven summaries remain 50 pixels high with zero territory-left spread.
  Dark, light and seven expanded disclosures have no document or reading overflow.
- Trusted Expand All/Collapse All pass on the separate directory QA entry. Actual
  Back restores Customers' complete 210-ID order, reading offset and bounded width.
- Regression: 22 pytest cases across both directory files and 9 JavaScript cases
  across both directory controllers pass. Changed-file editor diagnostics are clean.
- Private screenshots: `sellers-reading-width-{before,after}.png`,
  `sellers-reading-width-light-after.png`, `sellers-reading-width-expanded-after.png`.
  All After images inspected; original migration/alignment evidence retained.
- Same gallery contains 144 loaded images, 28 checkpoints and one additional
  related Customers comparison. No business or preference write; dark theme restored.
- This is layout-direction approval, not batch sign-off or commit authorization.
  All pending changes remain uncommitted.
- Generic readiness DM accepted once for this combined revision:
  `1557602728639864843`, exit 0.
