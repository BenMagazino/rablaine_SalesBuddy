# HOME-COMPLETE: complete native dashboard

- Checkpoint: 93.
- Status: VERIFY, first-pass design approved October9, 2026. Technical limits remain documented.
- Route: `/`.
- Approved calendar-first connected workbench and attention dock retained.
- Standalone root: `[data-sb-home][data-sb-page-surface]`, full width.
  Explicit `ui-page-frame.css` loading; no artificial reading-width cap.

## Original controls retained

- Calendar navigation, Today, day markers, quick-create and note/meeting previews.
- Calendar, engagements and projects tabs with original associations/counts.
- Action items, project tasks, stale milestones, hygiene and upcoming milestones.
- Revenue alerts/buckets, review links, dashboard settings and immediate preferences.
- Draft recovery/listing, freshness/status controls and shared nested editors.
- Engagement search, favorites, sort/group, new command, history and record previews.

## Implementation and evidence

- Remaining static/generated Bootstrap presentation becomes native app-owned CSS.
  Tab notifications now use `sb:home-tab-selected`.
- Home supplies the shared engagement reading/body container as well as controls;
  actual live table renders 33 engagements rather than failing during mount.
- Shared directory now honors `eng_auto_load=false`: zero table rows before first
  tab activation, exported loader retained, actual records render on activation.
- Original Before retained; dark/light After, engagements, settings and shell-free
  note preview evidence is private in `final-checkpoint-91-93.json`.
- Actual desktop 1559x1174, unchanged viewport, no horizontal overflow.
- Framework CSS/JS blocked: approved composition, settings and note preview work
  without Bootstrap runtime or Reboot; no JavaScript page errors.
- All After/supplement captures refreshed after global native base loading;
  framework tags are absent from actual served HTML.
- No preference, calendar, enrichment, share or server write was submitted.
- Passing final selection includes: `tests/test_ui_home.py`,
  `tests/js/ui_home.test.cjs`, `tests/js/ui_home_summary.test.cjs`,
  `tests/js/ui_home_calendar.test.cjs`, `tests/js/ui_home_freshness.test.cjs`.

## Remaining integration and limits

- Parent includes `tests/test_ui_engagements_directory.py` in central integration
  validation for the restored deferred-load contract.
- Shared shell's automatic Socket.IO traffic remains outside this checkpoint;
  write requests were blocked on the dedicated validation page.
- Approval of the existing composition does not imply approval of this final pass.

## Final batch verification

Final scoped selections pass1389 Python and1113 JavaScript tests. Creator approved the first-pass design October9, 2026. The private15-checkpoint audit is complete; see
[final reconciliation](FINAL-RECONCILIATION.md) for exact evidence, native-shell
limits and the unresolved validation draft incident. No full Python suite,
production rebuild, push, merge or deployment was performed.
