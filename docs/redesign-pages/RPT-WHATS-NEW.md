# RPT-NEW: What's New

## Content consistency review

Latest evidence: `consistency-report-whats-new-{before,after,light-after}.png`.
Earlier captures below are preserved as superseded comparisons. The existing
full-width paired composition remains 1559px, with 779.5px and 778.5px reading
tracks inheriting the surface token. Results and date controls are unchanged.
Complete measurements and source audit: private `consistency-reports-results.json`.

- Checkpoint: 37. User-approved October 6, 2026.
- Implementation: `175a0b0b`; audited provider baseline: `9195a2c8`.
- Status: VERIFY for final inventory reconciliation; checkpoint approved and committed.
- Route: `/reports/whats-new`, including `embed=1`.
- Files: `report_whats_new.html`, `ui-whats-new.js`, `ui-whats-new.css`.
- Detailed historical proof: [checkpoint 37](HOME-WORKBENCH-HISTORY.md#checkpoint-37-whats-new).

## Contract

| Surface | Preserved outcome | Evidence |
| --- | --- | --- |
| Created / Updated | Original MSX/local-date precedence; incomplete metadata may overlap | Python provider tests |
| Lookback | Rolling 1-90 days, actual clamped/custom scope, saved preference and Back | Python + JS + live navigation |
| Seller / area / team | Intersect both lists; original seller default and DSS presentation | Python + JS |
| Change types | Updated only; all-history audits; latest selected calendar date | Python + JS |
| Groups / sorting | Original collapse keys, full-precision amounts, boolean membership, source order | JS + shared sorter |
| Team actions | Native confirmation, all-occurrence updates, no repeated uncertain write | JS + intercepted browser responses |
| Exports | Both lists' expanded rows; context, links and proper quoted title | Shared export tests + live payload checks |
| Embeds / Help | Stacked ordinary regions, no window ownership, native contextual Help | Python + desktop smoke |

## Verification

- 218 scoped Python tests, 10 final page tests and 85 relevant JS tests passed.
- Live fourteen-day view: 296 Created / 180 Updated.
- Initial canonical projection matched original; live data is not a frozen fixture.
- Back restores 640px/700px, filters, both sorts and first-record order.
- Lookback 14 -> 3 -> Back restores source window and selector consistently.
- Eight token pairs retain desktop geometry; no viewport resizing.
- Keyboard event dispatch verified; harness key method did not emit a DOM event.
- No manual live team writes, production access or protected-draft navigation.

Next action: migrate Whitespace; do not repeat unchanged shared proofs.
