# GLOBAL-SHELL: shared frame and theme foundation

- Status: BUILDING; checkpoints 1-18 committed, checkpoint 19 shared Review Alert editor approved
- Owner: user and coding assistant
- Pre-release reviewer: the user; external tester/users review after release
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Checkpoint 1 implementation revision: `e84b675e9fadbc3ab3b7a31eaac1e3e64b6680d3`
- Checkpoint 2 implementation revision: `1fbdd64`
- Checkpoint 3 dialog foundation: `160e2d9`, [Help/dialog evidence](GLOBAL-HELP.md), user-approved
- Checkpoint 4 customer pickers: `8dd3363`, [Picker evidence](GLOBAL-PICKERS.md), user-approved
- Checkpoint 5 image viewer: `f1916e8`, [Image evidence](GLOBAL-ZOOM.md), user-approved
- Checkpoint 6 shared flash notifications: `1e7b16c`, [Feedback evidence](GLOBAL-FEEDBACK.md), user-approved
- Checkpoint 7 persistent status strips: `f6e9163`, [Status evidence](GLOBAL-STATUS.md), user-approved
- Checkpoint 8 floating meeting-sync status: `dd44c58`, [Sync evidence](GLOBAL-SYNC.md), user-approved
- Checkpoint 9 note-preview lifecycle/editor: `9545d18`, [Note-preview evidence](HOME-NOTE-PREVIEW.md),
  technically verified, user-approved
- Checkpoint 10 milestone-preview lifecycle/editors: `ce61a1d`, [Milestone evidence](MILESTONE-PREVIEW.md),
  technically verified, user-approved
- Checkpoint 11 shared note body/full-page commands: `3f8ddd5`, [Note-body evidence](NOTE-BODY.md),
  technically verified, user-approved
- Checkpoint 12 shared milestone body/forecast comments: `c652057`, [Milestone-body evidence](MILESTONE-BODY.md),
  technically verified, user-approved
- Checkpoint 13 Home frame/attention panels/native tabs: `a5ed892`, [Home evidence](HOME-WORKBENCH.md),
  technically verified, user-approved October 3 after balanced-bar/readability refinement
- Checkpoint 14 calendar fills/rails/native day controls: [Calendar evidence](HOME-WORKBENCH.md),
  technically verified, user-approved October 3 including native calendar picker,
  tag-color correction and floating failure feedback; committed as `3e4c5be`
- Checkpoint 15 calendar loading/error feedback: [Calendar evidence](HOME-WORKBENCH.md),
  technically verified, user-approved October 3, committed as `1f1472a`
- Checkpoint 16 Home Action Items settings: [Home evidence](HOME-WORKBENCH.md),
  native host and shared Preferences controls technically verified, user-approved October 3,
  committed as `6d15a91`
- Checkpoint 17 shared Action Item preview/editor: [Home evidence](HOME-WORKBENCH.md),
  technically verified, user-approved October 3, committed as `c1242b3`
- Checkpoint 18 shared Revenue Buckets filter: [Home evidence](HOME-WORKBENCH.md),
  technically verified across all live consumers, user-approved October 3,
  committed as `b53752c`
- Checkpoint 19 shared Review Alert editor: [Home evidence](HOME-WORKBENCH.md),
  technically verified across all five live consumers; user-approved October 3.
  The shared child editor is migrated before the Revenue preview shells/bodies.
- Last product reconciliation SHA: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Entry points: every page inheriting `templates/base.html`, including embed mode
- Dependencies: existing `dark_mode` preference, first-launch OS detection,
  onboarding theme choice, menu toggle and preferences page
- Next action: continue the remaining global surfaces after this checkpoint;
  homepage and shared note/milestone dialogs are not approved by this checkpoint.
  Commit approved checkpoint 19, then continue Revenue preview migration;
  no push, merge or deployment is authorized.

## Checkpoint 1 scope

Implemented `static/css/ui-tokens.css` with the approved four dark/light pairs.
All tokens are namespaced `--sb-ui-*`; no existing component is recolored.
Graphite is the default family. This is infrastructure, not a completed shell
redesign or a new user-facing theme picker.

`static/js/ui-theme.js` synchronously mirrors the current legacy mode into
`data-sb-mode` before token CSS loads. Its temporary attribute observer covers
all existing theme-changing surfaces without duplicating preference writes.
It does not modify the database, change the existing choice, or persist a
family selection. Remove this bridge when all consumers own `data-sb-mode`
directly. Family selection/persistence remains a later PREFS requirement.

## Checkpoint 2 scope

Replace only the shared header, menu controller and inline customer-search
presentation with app-owned code. The page bodies, status banners and global
dialogs retain their existing implementation. The header uses the approved
46px workbench frame, logo-only Home, compact icon navigation, centered search
and quiet blue New note control.

Inventory includes all 38 original header route expressions, dynamic seller
links, DSS/SE and seller-mode conditions, debug role/chat controls, update badges,
theme/settings actions, search behavior and existing dialog launchers. All
original destinations remain. Bootstrap dropdown/collapse behavior is removed
from this header; Bootstrap modal launchers and Icons remain intentionally.

Sellers and Reports now open their menus on click instead of navigating directly.
All Sellers under Directory and All Reports under Overview retain the direct
destinations. This is an intentional placement/interaction change requiring the
user's checkpoint approval. Desktop navigation no longer uses a mobile toggler.

The related admin update renderer uses native `hidden` properties for the new
header badges. Search renders customer labels as text, reports failed requests
visibly and permits retry. Customer detail pages highlight Customers or Browse
according to role. Escape from search/menu does not trigger page-level Cancel.

## Original-to-redesign parity matrix (partial inventory)

This covers theme infrastructure and the header only, not a complete global audit.

| ID | Original contract | New behavior / destination | Evidence | Result |
| --- | --- | --- | --- | --- |
| SHELL-T01 | Saved light/dark preference wins over OS preference | Existing persistence unchanged; tokens use mirrored `data-sb-mode` | Scoped Node tests; live dev page mode agreement | PASS |
| SHELL-T02 | Unset first-launch preference detects OS before painting | Existing script still runs first; bridge uses existing mode or OS when unset | Both OS choices tested without added persistence | PASS |
| SHELL-T03 | Menu/onboarding/preferences mode changes take effect | Observe legacy attribute changes, update only new mode attribute | Both directions tested; browser attribute transition verified | PASS |
| SHELL-T04 | Approved palette and control/status colors stay consistent | App-owned tokens reproduce the reviewed values for all eight variants | 296 comparisons in Node and browser, zero mismatches | PASS |
| SHELL-T05 | Existing page appearance and controls remain intact while migrating | Tokens declare custom properties only; no legacy selector/property overrides | Isolation test; live dev body retains existing background | PASS |
| SHELL-T06 | Corrupt theme mode is not silently presented as success | Log invalid value; retain last valid token mode | Scoped error-path test | PASS |
| SHELL-T07 | Persist optional theme family independently from mode | Not implemented; no picker exposed yet | Requires PREFS / shared theme persistence work | NOT TESTED |
| SHELL-N01 | Logo navigates Home; all header destinations remain available | Logo-only Home and original links, including all 16 reports and Browse destinations | Original route-expression comparison; rendered navigation/report tests | PASS |
| SHELL-N02 | Role/seller conditions choose the correct controls and seller links | Existing conditional rendering and role-switch POST retained | Isolated rendering checks for SE, DSS, seller mode, dynamic sellers and debug state | PASS |
| SHELL-N03 | Sellers/Reports direct navigation and dropdown access | Click/hover opens menu; direct destinations are All Sellers/All Reports | Live menus and preserved hrefs; user must approve interaction change | VERIFY |
| SHELL-N04 | Menus open, switch and dismiss predictably | Native popovers; hover crossing, outside dismissal, arrows, Home/End, Escape and Tab | Scoped Node checks and live pointer/keyboard checks | PASS |
| SHELL-N05 | Customer search lists, filters and navigates real customers | First ten on empty focus; name/nickname/TPID filtering, selection and native links retained | Live initial/empty states and keyboard navigation to real customer; text-rendering test | PASS |
| SHELL-N06 | Search failure is visible, retryable and does not crash | HTTP/shape guards, logged error and explicit retry hint | Node HTTP/malformed-response tests; live 503 and real-data retry | PASS |
| SHELL-N07 | Active destination remains identifiable | Reports precedence retained; customer details choose role-appropriate destination | Role-aware regression test and live customer/report navigation | PASS |
| SHELL-N08 | Updates remain visible and can be dismissed | Existing update state; native hidden attributes and admin updater aligned | Both rendered badge states; related admin mutations inspected | PASS |
| SHELL-N09 | New note, help and debug chat launchers remain available | Existing IDs and launch hooks retained; legacy dialogs still own their content | Live New note/help open-close; conditional/debug launcher rendering tests | PASS |
| SHELL-N10 | Header respects theme and avoids clipping at desktop viewport | App-owned token styling and bounded native menu placement | All eight variants measured live; 46px header, no horizontal overlap, menu text contrast at least 11.83:1 | PASS |
| SHELL-N11 | Embedded partial views omit the global header | Existing embed condition retained; controller safely skips absent header | Rendered embed test and Node no-header test | PASS |

## Verification

- `node --test tests/js/ui_theme.test.cjs`: scoped theme foundation tests.
- All 37 foundation colors match each approved theme (296 comparisons).
- Browser comparison used the owned archive page with production token CSS,
  restored its original attributes and removed the temporary stylesheet.
- Live dev homepage serves both assets and resolves Graphite dark tokens.
- Browser mode transitions were temporary attribute changes, restored afterward;
  no preferences POST, meeting refresh or data mutation was triggered.
- Editor diagnostics: no CSS or JS errors in the new files.
- The existing calendar quick-create and daily-refresh controls have not changed.

### Checkpoint 2 verification

- 17 scoped pytest checks pass: navigation rendering, Reports hub and two
  homepage rendering checks. The full suite was not run.
- 19 Node checks pass across navigation/search behavior and theme foundation.
- Live dev checks cover hover crossing/replacement/dismissal, menu keyboard
  behavior, search selection/navigation, empty result, Escape, failed request
  and recovery, active destinations and New note/help dialog opening/closing.
- Temporary failure interception was removed. Theme attributes were restored;
  no note was saved, preference posted or daily meeting refresh invoked.
- Geometry and theme checks use the existing desktop viewport, not resized
  mobile previews. No real-data screenshot is added to the design archive.
- Debug chat launcher is preserved; its full interaction audit remains
  GLOBAL-CHAT. Full admin update workflows remain ADMIN.
- Editor checks and `git diff --check` are clean.
- The user approved the live header/menu checkpoint for commit on October 2,
  2026, including the Sellers/Reports menu interaction change. Record its commit
  SHA in the next checkpoint, avoiding a self-referential documentation commit.

## Remaining work and sign-off

Checkpoint 6 replaces shared Flask flash styling/dismissal and adds a keyboard
landing target on the main landmark. Its evidence and approval are separate
from persistent status banners, inline page alerts and the full page frame.

The first app-owned dialog slice is implemented with the read-only help surfaces
in checkpoint 3. Its verification is separate from editable record workflows.

Checkpoint 7 replaces persistent VPN/sign-in, FY and viewing-as strip styling
and visibility utilities. Existing actions, conditions and business flows remain.
Its focused evidence records Node behavior, isolated dormant branches and live
access-strip checks. The user approved the live strip preview on October 2, 2026.

Checkpoint 8 replaces shared floating meeting-sync presentation and its
controller. Its API, polling, drag storage and hide-without-cancel behavior remain,
with explicit failed-read feedback and Retry. Its evidence remains separate from
the note form's own meeting-status card and the homepage's refresh ownership.
The user approved the live card preview and corrected header focus on October 2, 2026.

The checkpoint 8 review also identified duplicate customer-search focus outlines.
The scoped input override preserves the outer field's accent border and leaves
all other header/menu keyboard focus indicators unchanged.

Remaining scope includes editable shared overlays, onboarding and
their injected-partial lifecycle, theme-family persistence, full Bootstrap removal
and page approval. Bootstrap Icons remains a separate dependency decision.

No page is DONE. Header verification does not approve its hosted page bodies,
dialog workflows or the full global shell. Checkpoint 1 is committed. Checkpoint
2 is technically verified and user-approved for its checkpoint commit under the
agreed cadence. No push, merge or deployment is implied.
