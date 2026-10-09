# GLOBAL-SHELL: persistent status strip slice

- Status: DONE; technically verified and user-approved on October 2, 2026
- Checkpoint: 7, VPN/sign-in, fiscal-year and viewing-as strips
- Parent checkoff: GLOBAL-SHELL remains BUILDING
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `1e7b16c`, approved shared-notification checkpoint
- Implementation revision: `f6e9163`
- Next action: continue with [floating meeting-sync evidence](GLOBAL-SYNC.md).

## Scope and original inventory

Migrate the five persistent base-template strips from Bootstrap styling to
app-owned connected-pane styling. Keep their existing order and placement.
Bootstrap Icons remains intentionally.

| Surface | Original visibility and information | Original action |
| --- | --- | --- |
| VPN | Reactive MSX IP-block detection; full corpnet/VPN explanation and retry status | POST `/api/msx/vpn-check`, then delayed reload on recovery |
| Azure sign-in | Reactive MSX/AI auth failure; full explanation, elapsed/progress/error text | Start, poll and complete the existing Azure CLI sign-in flow |
| FY reminder | Existing server-supplied reminder condition and target fiscal year | `/admin#fyManagement` |
| FY transition | Existing active-transition condition, fiscal-year label and account-sync branch | Resume or Finalize at `/admin#fyManagement` |
| Viewing-as | Existing SE + active mode + seller condition; seller name, optional type and territories | Existing `exitSellerMode()` POST and Home navigation |

No authentication endpoints, polling/reload timings, detector expressions,
session keys, fetch interception rules, fiscal-year logic or viewing-mode
business flows change. This checkpoint does not migrate the floating sync card,
onboarding, page-specific alerts or page bodies.

## Parity and interaction evidence

| ID | Original contract | Implementation / evidence | Result |
| --- | --- | --- | --- |
| STATUS-01 | Access strips start hidden and restore independently across navigation | Native `hidden`; same session keys and public show/hide/state APIs; Python and Node checks | PASS |
| STATUS-02 | Auth and VPN failures remain separate | Existing response detectors and interceptor retained; scoped API, clone preservation, unrelated URL and streaming checks | PASS |
| STATUS-03 | VPN action exposes checking, failure, network error and recovery states | Same POST/button/status IDs, re-enable behavior and 1500ms recovery delay; Node checks and intercepted live failure | PASS |
| STATUS-04 | Sign-in preserves start/poll/complete, elapsed time, timeout and retry | Same endpoints, 2000ms poll, 1000ms elapsed updates, 180000ms timeout and 1200ms reload; Node checks | PASS |
| STATUS-05 | FY reminder retains its condition, year and Admin link | Isolated absent/present render checks | PASS |
| STATUS-06 | Active transition retains incomplete/complete action branches | Isolated inactive, Resume and Finalize render checks | PASS |
| STATUS-07 | Viewing-as retains its role/mode conditions and optional metadata | Isolated SE/DSS, inactive/missing seller and optional-field render checks; unchanged exit hook | PASS |
| STATUS-08 | Buttons/links stay keyboard usable with visible focus and waiting states | Native controls, explicit button types and token focus/disabled styles; live Enter VPN and Space sign-in failure checks | PASS |
| STATUS-09 | Text remains readable without losing content to layout | Eight live themes, no horizontal overflow; long upstream error keeps 708px explanation width at the existing desktop viewport | PASS |
| STATUS-10 | Strips no longer depend on Bootstrap appearance or visibility | App-owned classes, native hidden state and semantic status data; markup/script/CSS checks | PASS |

## Intentional presentation changes

- Quiet connected strips replace broad colored Bootstrap alert fills.
  Severity remains identifiable through the existing icon and semantic colors.
- Explanation stays left; actions and progress stay grouped on the right.
  Long progress/error text wraps within half the strip instead of collapsing
  the explanation column.
- Progress regions have explicit status semantics. Buttons have explicit types.
- Fiscal transition punctuation uses a colon rather than the old long dash.
  VPN network-error punctuation uses a regular hyphen.

## Verification and handoff

- 68 scoped Node checks pass across status behavior and all previously migrated
  theme/navigation/dialog/picker/image/notification components.
- 58 scoped Python checks pass across shell rendering and the existing
  MSX auth-banner suite. Tests use the isolated database.
- Editor checks and `git diff --check` are clean.
- Live checks use the running development app at its unchanged desktop viewport.
  The public reactive handlers temporarily expose the two access strips.
  Exact action endpoints are intercepted for failed VPN/sign-in responses.
  No real sign-in is launched or VPN recovery request sent.
- All eight theme variants have no horizontal overflow; measured access-strip
  text, controls and severity contrast is at least 6.49:1.
- The initial long-error probe revealed explanation-column collapse. Bounded
  action width fixes it; the same live probe reduces strip height from 1664px
  to 183px without truncating the diagnostic text.
- Dormant FY and viewing-mode branches are verified by isolated rendering,
  not by changing actual fiscal-year state or saved viewing mode.
- Temporary endpoint interception, theme attributes, stylesheet cache-busting,
  access visibility and session flags are restored after validation.
  No private screenshots or business records are committed.
- The user reviewed the temporarily exposed access strips in the live development
  app and approved this checkpoint for commit on October 2, 2026. Preview action
  interception and visibility/session state were cleared after approval.
- Full GLOBAL-SHELL remains BUILDING, global progress remains 5 / 17 DONE.
  Floating meeting-sync status, full page frame and theme-family persistence
  remain separate work. No push, merge or deployment is authorized.
