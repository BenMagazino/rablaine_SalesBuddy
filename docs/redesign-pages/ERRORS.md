# ERRORS: checkpoint 104

- Status: VERIFY. Implementation complete; centralized tests pass; first-pass design approved October9, 2026.
- Product baseline: default Werkzeug HTTP pages at `f7a5fa04`.
- Scope: unavailable record/page, HTTP failures and safe recovery presentation.
- Fresh live GET `/customer/999999999` captured before edits: actual missing-record 404.

## Parity and implementation
- App-owned standalone HTML/CSS/JS avoids depending on the normal base rendering or database.
- Explicitly loads `ui-page-frame.css`; its standalone recovery document is full-width,
  with a 720px inner reading region, not a directory or embedded fragment.
- Home context band, readable recovery region, original safe HTTP description and status rail.
- Status codes and protocol headers survive, including 405 Allow and 503 Retry-After.
- Specific non-server HTTP descriptions stay escaped; 500-level exceptions stay private.
- Existing diagnostic exception logging remains; the page exposes only its correlation reference.
- Failed transactions cannot trigger another ORM preference lookup during 500 rendering.
- Missing records are still missing; no redirect disguises the 404 as a successful page.
- Home is a real GET link. Back appears only when browser history exists.
- Try again is offered only for GET/HEAD server failures, never potentially mutating POSTs.
- Retry disables immediately and ignores duplicate clicks; failed-save guidance remains visible.
- API paths and explicit JSON clients receive JSON with unchanged HTTP failure semantics.
- Existing successful JSON endpoints, domain-local handlers and native Electron dialogs remain.
- Light/dark follows saved preference when safe; system fallback is used for server failures.
- All eight shared token palettes render without page-specific color overrides.

## Evidence and validation limits
- Private paired images: `final-checkpoint-104-errors-{before,after-dark,after-light}.png`.
- Live missing-record response, unchanged 1559x1174 viewport, fullPage false; pictures inspected.
- Read-only live API unknown-path 404 returns JSON; GET on POST-only CSAM endpoint returns
  405 with `Allow: POST, OPTIONS` and the native error document.
- Eight theme attribute samples retain distinct surfaces, readable ink and no overflow.
- 500/503 and failed-write contracts are isolated tests, not injected live failures.
- Flask's development debugger/exception propagation remains unchanged; production
  500 handling is tested with propagation disabled instead of hiding dev tracebacks.
- Follow-up live verification: actual Home link and conditional Back navigate to Home,
  GET 200, Home title, debugger absent. Pointer actionability timed out in the integrated
  browser; activating the real DOM elements with `element.click()` verified navigation,
  without substituting responses or mocking the browser history/bridge.
- No live business write, server restart, saved theme change or production launch was made.
- Normal GET bookkeeping/telemetry is not claimed unchanged.
- Test selections: `tests\test_ui_errors.py`, `tests\js\ui_errors.test.cjs`.
- Final scoped tests pass. Editor diagnostics/whitespace passed.
- No shared base/frame/global tokens/tracker/changelog edits.

## Final batch verification

Final scoped selections pass1389 Python and1113 JavaScript tests. Creator approved the first-pass design October9, 2026. The private15-checkpoint audit is complete; see
[final reconciliation](FINAL-RECONCILIATION.md) for exact evidence, native-shell
limits and the unresolved validation draft incident. No full Python suite,
production rebuild, push, merge or deployment was performed.
