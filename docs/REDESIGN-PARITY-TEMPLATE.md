# Page evidence card template

Copy this into `docs/redesign-pages/<PAGE-ID>.md` when starting a page.
Create cards on demand, not 90 empty files up front. This file is not a checkoff.

## Identity

- Tracker ID / page:
- URLs, aliases and entry points:
- Status:
- Owner / pre-release reviewer (the user):
- Product revision audited:
- Implementation revision tested:
- Last product reconciliation SHA:
- Shared templates/components and host pages:
- Relevant route/service/JS/test files:
- Next action:

## Original-to-redesign parity matrix

Use one row per control or information surface, including conditional and
JS-generated UI. Describe outcomes precisely enough that someone else can test.

| ID | Original control / information and visibility condition | Input / action | Expected output, defaults and side effects | Redesigned location | Evidence / scoped test | Result |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE-01 | | | | | | NOT TESTED |

Allowed results: NOT TESTED, PASS, FAIL, BLOCKED, APPROVED CHANGE.
APPROVED CHANGE requires explicit approval in the decisions section.

## State and presentation checks

| Check | Evidence / result |
| --- | --- |
| Populated and empty data | |
| Conditional controls / information | |
| Loading, background progress and repeat interaction | |
| Disabled/unavailable state | |
| Validation, failures and recovery | |
| Keyboard, focus return, dismissal and unsaved edits | |
| Persistence, associations, date/time defaults and navigation | |
| Full-page and injected partial contexts where applicable | |
| Repeated/nested modal opens, cleanup and no duplicate handlers | |
| Desktop viewport, resize/maximize, zoom and scrolling | |
| Graphite dark / light | |
| Midnight dark / light | |
| Harbor dark / light | |
| Carbon dark / light | |
| Scoped tests using isolated test DB | |

## Decisions and exceptions

Record approved behavioral differences with approver/date/rationale.
No implicit approval from visual mockups. Link unresolved bugs here and keep
status VERIFY or BLOCKED until required parity is resolved.

## Changes since the audit

| Product commit / change | Affected parity rows / shared hosts | Disposition and retest evidence |
| --- | --- | --- |

## Sign-off

- All required rows passed:
- No unapproved omissions or unresolved parity failures:
- User validation / approval date:
- Audited product SHA:
- Tested implementation SHA:
- Evidence links / scoped tests:
- Last reconciliation checkpoint:
- Approved changes:
- Next action / handoff:

Mark DONE in the main tracker only after completing this section.
