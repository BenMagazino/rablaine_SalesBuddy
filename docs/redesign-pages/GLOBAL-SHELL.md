# GLOBAL-SHELL: shared frame and theme foundation

- Status: BUILDING, checkpoint 1 implemented and verified; not page-approved
- Owner: user and coding assistant
- Pre-release reviewer: the user; external tester/users review after release
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Implementation revision tested: working tree based on `84cb361`
- Last product reconciliation SHA: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Entry points: every page inheriting `templates/base.html`, including embed mode
- Dependencies: existing `dark_mode` preference, first-launch OS detection,
  onboarding theme choice, menu toggle and preferences page
- Next action: finish the global control/information inventory before replacing
  navigation. Role/seller conditions, search, sync/status controls and global
  overlays must be mapped, not copied blindly from the offline fixture.

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

## Original-to-redesign parity matrix (partial inventory)

This is the theme slice only. No claim of a complete global audit yet.

| ID | Original contract | New behavior / destination | Evidence | Result |
| --- | --- | --- | --- | --- |
| SHELL-T01 | Saved light/dark preference wins over OS preference | Existing persistence unchanged; tokens use mirrored `data-sb-mode` | Scoped Node tests; live dev page mode agreement | PASS |
| SHELL-T02 | Unset first-launch preference detects OS before painting | Existing script still runs first; bridge uses existing mode or OS when unset | Both OS choices tested without added persistence | PASS |
| SHELL-T03 | Menu/onboarding/preferences mode changes take effect | Observe legacy attribute changes, update only new mode attribute | Both directions tested; browser attribute transition verified | PASS |
| SHELL-T04 | Approved palette and control/status colors stay consistent | App-owned tokens reproduce the reviewed values for all eight variants | 296 comparisons in Node and browser, zero mismatches | PASS |
| SHELL-T05 | Existing page appearance and controls remain intact while migrating | Tokens declare custom properties only; no legacy selector/property overrides | Isolation test; live dev body retains existing background | PASS |
| SHELL-T06 | Corrupt theme mode is not silently presented as success | Log invalid value; retain last valid token mode | Scoped error-path test | PASS |
| SHELL-T07 | Persist optional theme family independently from mode | Not implemented; no picker exposed yet | Requires PREFS / shared theme persistence work | NOT TESTED |

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

## Remaining work and sign-off

The full shell audit, replacement navigation/menus, global controls and overlays,
theme-family persistence, Bootstrap removal and tester approval are outstanding.
No page is DONE. Theme token verification is not workflow parity approval.
Checkpoint 1 may be committed after technical verification under the agreed
infrastructure cadence. Record its SHA in the handoff and carry it into this
card at the next checkpoint. Page completion still requires user validation;
no merge or deployment is implied.
