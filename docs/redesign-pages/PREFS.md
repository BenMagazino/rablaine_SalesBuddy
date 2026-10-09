# PREFS: Preferences and dashboard settings

- Checkpoint 94. Status: VERIFY, first-pass design approved October9, 2026.
- October9 refinement restores the labelled Light/Dark pill switch using the same
  native control as setup: amber light state, blue dark state, pale thumb and
  keyboard focus ring. The thumb slides in 180ms, with reduced motion respected.
  Original checked state, persistence and failure feedback remain.
- Route: `/preferences`. Native 1152px reading surface, context commands and scope footer.
- Preserve the existing native dashboard settings host; its controller now exits safely when absent.

## Inventory and lifecycle

All appearance/Copilot/stale milestone/hygiene/Connect impact/writeback switches,
Copilot refresh, meeting prompt save/reset, template create/edit/delete and both
default-template selectors remain. Original endpoints and payloads are retained.
Toggles confirm returned values and roll back failed saves. Prompt pending state
gates duplicates; failed saves keep the draft. History restores prompt/default
drafts. Manual defaults prevent duplicate submission and recover on Back.
Storage/validation failures retain selections, including unavailable templates.
Delete uses the shared native dialog and keeps the original POST confirmation form.

## Evidence and verification

- Final dark/light images are refreshed and inspected after Bootstrap component
  asset removal; `ui-base.css` loads at the unchanged desktop viewport.

- Fresh live Before and dark/light After: `final-checkpoint-94-preferences-*.png`.
- Native delete-confirmation and template-region supplements are private artifacts.
- Desktop viewport unchanged at 1559x1174; no horizontal document overflow.
- No preferences or templates were saved/deleted; Copilot refresh was not invoked.
- Isolated checks added: `tests/test_ui_administration.py`,
  `tests/js/ui_settings.test.cjs`; retain `tests/js/ui_dashboard_settings.test.cjs`.
- Final scoped tests pass. Live failed/pending saves
  are deliberately not manufactured. See private `final-checkpoint-94-98.json`.

## Final batch verification

Final scoped selections pass1389 Python and1113 JavaScript tests. Creator approved the first-pass design October9, 2026. The private15-checkpoint audit is complete; see
[final reconciliation](FINAL-RECONCILIATION.md) for exact evidence, native-shell
limits and the unresolved validation draft incident. No full Python suite,
production rebuild, push, merge or deployment was performed.
