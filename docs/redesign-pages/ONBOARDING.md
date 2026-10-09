# ONBOARDING: checkpoints 99

- Status: VERIFY, first-pass design approved October9, 2026. Baseline: `f7a5fa04`.
- October9 appearance refinement uses the shared native Light/Dark pill switch,
  matching Settings without Bootstrap styling or changes to theme persistence.
  Its 180ms thumb slide is disabled when reduced motion is requested.
- Native dialog buttons now reserve an 8px icon/text gap, including Azure sign-in,
  Back, Next, Finish and retries. This also covers dynamically generated labels.
- Context: mandatory first-run dialog and manually opened, read-only setup review.
- Owner: `_onboarding.html`, `_onboarding_js.html`, `_guided_tour.html`,
  `ui-onboarding.css`. Parent owns base includes, theme tokens and shared sign-in banner.
- Base extraction/wiring is complete; Brainrot and row-link global source remains intact.
- Parent reports central scoped validation passed; creator approved the first-pass design October9, 2026.

## Control and information contract

| Surface | Preserved behavior | Verification |
| --- | --- | --- |
| Setup navigation | Two steps, Back, disabled Next until auth/VPN; Finish after three imports or failed-sync escape hatch after accounts | `test_onboarding.py`, native setup regression |
| Completed-user review | Closed on page load; `window.openSetupWizard()` reads actual status and saved buckets; Back/Next inspect setup; Close Review does not dismiss preferences or reload | `ui_onboarding.test.cjs` |
| Theme | Labelled keyboard switch; original persisted dark-mode API and OS-default hydration | Native selector/focus regression |
| Azure authentication | Initial, waiting/timer/nudge, cancel, success/email, VPN retry, timeout/retry, missing CLI/install link/check-again | Existing isolated auth endpoint tests; no live auth |
| Import | Accounts first, then milestones, then revenue; phase progress/count summaries, elapsed status, independent Retry, incomplete-resume warning | Existing isolated onboarding sync tests |
| Pending protection | Mandatory native `SBDialog`, no backdrop/Escape dismissal, guarded closing, before-unload during imports | Source and dialog lifecycle tests |
| Buckets | Non-DSS picker after revenue, existing saved selection, search, Select all, per-bucket save | Existing isolated bucket tests |
| Guided tour | All seven targets, Back/Next/Done, progress, original local/server completion | Native source contract; no live completion write |

## Evidence and limitations

- Actual live dev Home captured before edits at unchanged 1559x1174.
- Genuine current welcome/setup entry captured on `/admin`, expanded read-only:
  Accounts/Milestones/Revenue completion and Re-run Setup Wizard are visible.
  This is a pre-checkpoint105 entry baseline, not an original first-run dialog.
  The launch control was not clicked; no setup reset or sign-in request occurred.
- The original wizard was server-side omitted for this completed user, so no
  original wizard Before is claimed. Its genuine Admin entry Before is preserved.
- The new always-rendered wizard was reopened through the actual Admin
  `#adminReviewSetupBtn` command using `openSetupWizard()`.
  Actual Step 1 and Step 2 Dark/Light captures show current authentication,
  three already-imported phases and saved bucket selections, after global
  Bootstrap CSS/JS removal. No reset, fabricated data or preview server was used.
- Review performs GETs only until a human explicitly selects the original
  sign-in, theme-save, import or bucket-save controls. Active auth/import guards
  prevent closing; mandatory first-run navigation and Finish remain unchanged.
- Tour auto-start remains disabled by product behavior; no fabricated tour state.
- No sign-in, import, preference save, reset or enrichment was performed.
- Private evidence manifest: `final-checkpoint-99-101.json`.
- Tests were not executed by this agent. Parent reports all 288 Python and 42 JS
  central setup/chat/sharing and coupled integration tests passed.
- BASE_READY remains released: assets and all three setup/tour includes are wired.
  Admin's separate Review setup entry calls `window.openSetupWizard()`;
  the existing explicit reset/Re-run command remains unchanged. Fresh real
  entry and wizard captures cover both themes; Close Review returns focus to
  the actual review button without reset/auth/import/save requests.

## Final batch verification

Final scoped selections pass1389 Python and1113 JavaScript tests. Creator approved the first-pass design October9, 2026. The private15-checkpoint audit is complete; see
[final reconciliation](FINAL-RECONCILIATION.md) for exact evidence, native-shell
limits and the unresolved validation draft incident. No full Python suite,
production rebuild, push, merge or deployment was performed.
