# Compact page evidence card

Create `docs/redesign-pages/<PAGE-ID>.md` on demand. Aim for 40-60 lines.
Record current outcomes and references, not a chronological implementation diary.

## Identity

- Tracker ID / checkpoint:
- Route, aliases and full/embed contexts:
- Status / audited baseline / implementation SHA:
- User approval date:
- Relevant template, controller, service and test files:
- Next action:

## Scope

- Required migration:
- Tightly coupled fixes:
- Deferred work:
- Shared components reused:

## Contract and evidence

Group controls with the same outcome; do not inventory every repeated data row.
Include conditional/async controls, defaults, information and side effects.

| Surface / input | Expected behavior / information | Test or focused check | Result |
| --- | --- | --- | --- |
| Navigation / links | | | NOT TESTED |
| Filters / sorting / remembered state | | | NOT TESTED |
| Counts / values / dates / availability | | | NOT TESTED |
| Actions / confirmation / drafts | | | NOT TESTED |
| Loading / empty / errors / Retry | | | NOT TESTED |
| Exports / full / embedded / Help | | | NOT TESTED |

Results: PASS, FAIL, BLOCKED, APPROVED CHANGE, NOT TESTED.
Link approved differences with date/rationale; unresolved required failures block sign-off.

## Verification and sign-off

- Exact scoped commands and outcomes:
- Desktop integration checks / theme tokens:
- Safe write strategy / protected drafts:
- Known harness limitations or unresolved issues:
- Approved behavioral differences:
- User approval / tested commit / next action:

Detailed proof lives in tests. Link historical evidence rather than copying it.
Only mark DONE after the workflow's revision-specific reconciliation gate.
