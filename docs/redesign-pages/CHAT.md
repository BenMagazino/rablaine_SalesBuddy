# CHAT: checkpoint 100

- Status: VERIFY, first-pass design approved October9, 2026. Baseline: `f7a5fa04`.
- Route/context: dev-only SalesIQ pane on full pages; availability is unchanged.
- Owner: `_copilot_chat.html`, `_copilot_chat_js.html`, `ui-chat.css`.
- Base extraction/wiring and legacy chat-style removal are complete.
- Final scoped tests and live nonmodal integration pass. Creator approved the genuine Before/After pair October9, 2026.

## Control and information contract

| Surface | Preserved behavior | Verification |
| --- | --- | --- |
| Pane | Nonmodal persistent 500px work region; nav and Ctrl+Shift+C toggle, Close/Escape, composer focus and opener return | `ui_chat.test.cjs` |
| Keyboard ownership | Already-handled events and active modal dialogs yield; nonmodal note drawers allow chat shortcuts/Escape and independent drafts/send; no inline-base shortcut dependency | Isolated native event tests |
| Composer | Auto-height, Enter send, Shift+Enter newline, no empty/duplicate sends, draft remains when closing/reopening | Isolated native event tests |
| History | Session restore/save, 20-message request limit, clear, open state across navigation | Isolated history tests |
| Context/tools | Explicit page context takes priority; original detected routes and existing `/api/ai/chat` request remain intact | Context/body regression |
| Responses | User text, assistant markdown/table/code/link citations and tools-used detail | Native table/citation/tool regression |
| Pending | Native labelled typing indicator and busy state; duplicate sends blocked, clear disabled while request resolves | Deferred isolated request |
| Failure | API error and network error remain visible, typing removed and controls recover | Isolated failures |

## Evidence and limitations

- Fresh Before captures the actual live empty SalesIQ pane, not mock messages.
- Actual native Dark/Light After captures inspected at unchanged 1559x1174:
  pane is 500px wide at the 46px app bar, no horizontal overflow or AI requests.
- Live toggle focuses the composer; Escape closes and returns focus to the nav.
- Actual open state restores after navigation without a request or stored history.
- Final Dark/Light captures are fresh after global Bootstrap CSS/bundle removal;
  native pane width, top, font and send-control sizing remain intact.
- Browser-host Ctrl+Shift+C did not reach the pane during live inspection; isolated
  shortcut coverage checks both key casings. No passing live shortcut claim is made.
- No AI prompt was sent. Tool side effects and successful/error responses are isolated-test only.
- Source retains the existing JSON reply transport. It does not invent streaming,
  export or action UI that did not exist in this dev-only pane.
- No stored conversation was cleared during live verification.
- Private evidence manifest: `final-checkpoint-99-101.json`.
- Native note-panel coexistence contract: `body.copilot-chat-open` supplies
  `--sb-chat-context-inset: 500px`; document emits `sb:chat-opened` and
  `sb:chat-closed` with `{open, width: 500}`. `window.copilotContext` keeps priority.
  Notes consumes the inset for native drawers; live integration is verified.
- Notes owner confirms native drawer and chat meet at x1059 with a 500px inset
  on the 1559px desktop. Parent's shared helper now uses native `show()` for
  nonmodal drawers. Chat's keyboard guard matches the global modal-only selector
  `.sb-dialog[open]:not([data-sb-nonmodal="true"])`; integration tests pass.
- Tests were not run by this agent; parent reports central validation passed.
  All owned base includes/CSS are wired.

## Final batch verification

Final scoped selections pass1389 Python and1113 JavaScript tests. Creator approved the first-pass design October9, 2026. The private15-checkpoint audit is complete; see
[final reconciliation](FINAL-RECONCILIATION.md) for exact evidence, native-shell
limits and the unresolved validation draft incident. No full Python suite,
production rebuild, push, merge or deployment was performed.
