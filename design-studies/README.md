# Sales Buddy design archive

Open `index.html` directly in a desktop browser. No Flask, database, network,
package install, or build is required. This folder is an offline reference
archive, not application code.

## The sequence

1. `ui-style-lab`: six broad workspace directions.
2. `ui-style-lab-round-2`: five dark, calendar-first refinements, plus logo references.
3. `ui-navigation-lab`: six connected navigation arrangements and calendar markers.
4. `ui-color-lab`: seven dark palettes, including the later blue and contrast variants.
5. `ui-accent-lab`: five interaction-highlight comparisons.
6. `ui-outlook-lab`: Midnight and Graphite Blue with Outlook-inspired blue
   brightness levels and event rails. Ghost meetings use muted blue, saved notes
   use a stronger fill, and Today/active controls use the brightest blue.
   Engagement linkage does not change event fill or rail.
   Ghost rails are diagonally striped; saved-note rails remain solid.
   Five additional fictional entries on Today demonstrate ghost, plain note,
   milestone, task, and HVA visuals against the highlighted day. Busy days
   retain the existing within-cell scrolling.
   Today uses a thin muted-blue outline, the normal calendar surface with a 10% blue tint,
   and a highlighted day number with `aria-current="date"`, without an in-cell label.
7. `ui-status-rails-lab`: the same two palettes and 23 entries with green milestone,
   blue task, and gold HVA rails replacing those icons; plain notes use neutral gray.
   Dimmer, cool emerald milestones and stronger blue tasks separate the work statuses.
   Milestone lightness stays close to plain gray without changing its emerald hue.
   Today places plain gray, task blue, and milestone green notes consecutively for comparison.
   HVA > task > milestone precedence remains. Unmatched ghosts keep normal striped blue
   rails and a question mark; the ghost calendar and right-side engagement icons remain. Entry descriptions
   and labeled, interactive rail legends retain the status information.
8. `ui-note-surfaces-lab`: softened original blue and nearly neutral saved-note fills,
   each on Midnight and Graphite Blue. Quiet Blue uses 40% lightness and .065 chroma,
   moderately reduced from the original .09 chroma while retaining Today separation;
   Graphite Neutral uses 40% lightness with .012 chroma to separate entries from Today.
   Midnight Neutral keeps its 32% lightness and .012 chroma. Hover remains restrained.
   Text, status rails,
   ghost styling, Today, fixtures, and layout remain unchanged from round seven.
9. `ui-customer-colors-lab`: customer-color functionality observed in the live
   calendar and confirmed in `templates/index.html`. The month's saved-note customers
   are assigned first, followed by additional matched-ghost customers, cycling through
   fifteen slots. Matched ghosts share their customer's hue; unmatched ghosts do not
   get a customer slot. Hover highlights the same customer's entries, with keyboard
   focus supported too. The live color families are adapted to restrained opaque
   OKLCH fills, not exact Bootstrap RGBA values. Work-status rails remain independent.
   Today retains the approved 10% blue tint. Its five examples reuse four
   fictional customers; the first eighteen entries are unchanged. No live data is copied.
10. `ui-blue-controls-lab`: muted blue fill, blue outline, and blue-text alternatives
    for New note and the Today date badge, each in Midnight and Graphite. Only those
    controls and their hover/focus treatments change. The customer palette, highlighting,
    work-status rails, Today cell tint and outline, typography, and layout stay approved.
    Round nine preserves the brighter controls for comparison.
11. `ui-theme-pairs-lab`: Graphite / Muted is the selected default dark design,
    preserved exactly in the app workspace. Its light counterpart uses cool,
    soft-white surfaces. Optional Midnight, Harbor, and Carbon pairs offer navy,
    petrol, and warm-charcoal alternatives with matching porcelain, sea-glass,
    and soft-paper light modes. Layout and behavior remain identical across modes.
    Light modes translate all fifteen customer hues into light tinted fills and
    dark text, deepen the status rails, and preserve ghost stripes/dashes.
    The toolbar switches families while retaining mode, or switches mode within
    the current family. This records a design choice, not an application setting.
12. `ui-modal-lab`: centered modals replace the preview's side drawers while
    preserving all eight selected theme variants. The live homepage's action-item,
    milestone, and note dialogs were inspected read-only for structure, not copied
    for content. Compact action items have completion and edit controls; wider
    notes and milestones pair metadata with readable content. Headers and footers
    remain visible while long bodies scroll. All edits and saves are local previews.
    Full page and MSX actions are inert illustrative destinations. Round eleven
    preserves the earlier side drawers. The gallery compares workspace, menus,
    action-item, milestone, and note states.

## Selected themes for audit

The final theme set is Graphite, Midnight, Harbor, and Carbon, each with dark
and light modes. Graphite / Muted is the default dark design. These choices
are locked in for design review; implementation in the running app is separate.

When implementing the redesign, milestone and note content must come from shared
template partials that work on both their full pages and homepage modals. The
offline modal examples illustrate the presentation, not the production rendering
architecture.

The [redesign plan](REDESIGN-PLAN.md) records the Electron window-sizing root
cause, proposed first-launch dimensions, and last-used window-state restoration.
It is planning only; the desktop shell remains unchanged.

The [Bootstrap removal audit](BOOTSTRAP-AUDIT.md) inventories styling and behavior
dependencies for an informed framework-removal decision. No runtime changes are
included in the audit.

The [implementation workflow](../docs/REDESIGN-WORKFLOW.md) and
[page tracker](../docs/REDESIGN-PAGE-TRACKER.md) define page-by-page feature-parity
checks, tester approval and reconciliation with ongoing product changes.

Every study with grouped navigation uses `DIRECTORY` above All Sellers and
`OVERVIEW` above All Reports. Link destinations and other groups are unchanged.
The menu headings are shared by all theme variants, not a Graphite-only override.
Gallery screenshots are refreshed from the updated offline previews.

Every gallery, preview, and logo page links back to the archive homepage.
The compact fixed archive link does not change preview pane geometry and
remains available when the study toolbar is hidden, including embedded previews.
Both the Design archive and Iteration gallery links are always visible.
Escape restores hidden study controls. Navigation destinations are illustrative
placeholders, not links into the running application.

All customers and sellers use numbered fictional labels. Work titles, amounts,
counts, dates, and times are fictional. The April 2031 fixture has the same
30-day, Tuesday-start geometry as the earlier studies. All 18 calendar entries
remain available. Later iterations preserve marker combinations to demonstrate
relationships, not to document customer activity.

## Privacy rules

- Copy only reviewed HTML, JavaScript, CSS, and SVG source. Never copy captured
  application screenshots, exported archives, production records, or databases.
- Replace customer, partner, seller, and contact names, record IDs, work titles,
  financial figures, counts, dates, meeting times, and free-form text with
  explicitly fictional fixtures before putting files in this folder.
- Review every source file, including hidden details, navigation menus, tooltips,
  comments, embedded assets, and SVG metadata. Strip SVG metadata and generator
  comments. Product names and public brand geometry may remain.
- Do not add emails, personal paths, session directories, tokens, external asset
  URLs, analytics, application API calls, or application links.
- Generate screenshots only from the sanitized archive. Do not blur or crop a
  confidential screenshot and call it safe. The original baseline is excluded.
- Inspect generated screenshots visually before sharing or committing them.
  Static validation cannot prove the provenance or pixel content of a PNG.

## Validate

Node.js 18 or newer is sufficient; no dependencies are needed.

```powershell
node --test design-studies\validate.test.cjs
```

The tests validate local assets/backlinks, JavaScript syntax, fictional fixtures,
calendar indicators, gallery image variants, capture coverage, and privacy
hazards. Missing PNGs are allowed only when declared in the capture manifest.
To require all regenerated images:

```powershell
$env:ARCHIVE_REQUIRE_SCREENSHOTS = '1'
node --test design-studies\validate.test.cjs
Remove-Item Env:\ARCHIVE_REQUIRE_SCREENSHOTS
```

For an additional comparison against old source artifacts, set
`ARCHIVE_SOURCE_ROOT` to their local parent directory before running the tests.
The comparison reads text source only and checks original customers, sellers,
distinctive work titles, amounts, and timestamps without storing their values
in the archive. It also verifies event kinds and relationship flags.

## Regenerate screenshots

`capture-manifest.json` lists each preview URL and PNG output path, both relative
to this folder. It covers every image referenced by the galleries, including
Workspace, Reports-open, and Browse-open states.

1. Run the tests before capture.
2. Resolve each URL against this folder's `file:` URL in a dedicated desktop
   browser tab, or against a loopback-only static server serving this folder.
   Do not use the Flask app or a production tab.
3. Preserve the browser's current desktop viewport. The manifest's 1587 x 1087
   dimensions describe the source reference, not a resizing requirement.
   Never resize a user-shared tab. Keep the study toolbar visible and wait for scripts, menu popovers, and font
   rendering to settle. Capture full-page images. No external fonts are required.
4. Save each screenshot to its exact manifest `output` path. Do not substitute
   screenshots from earlier artifacts. Gallery screenshot-state controls rely
   on the original sample filenames.
5. Review the PNGs, rerun tests with `ARCHIVE_REQUIRE_SCREENSHOTS=1`, and inspect
   each gallery state. Optional whole-gallery screenshots are not required.

Until capture is complete, galleries have pending image files; their interactive
preview links work independently. No old PNGs or ZIPs are included.

## Add an iteration

Create another clearly named directory with reviewed offline text assets.
Keep older iterations unchanged. Add it at the end of the homepage's ordered
list, with a short description and accurate sample count.

Include `../archive.css` and the shared `.archive-nav` markup from an existing
page on **every** HTML page, not just the gallery. Keep it outside any
hideable study toolbar or dynamic `#app` container. Use the same fictional-data
conventions, retain relevant behavior demonstrations, and add fixture/behavior
assertions where the new design differs.

Add every gallery-referenced preview state to `capture-manifest.json`, retaining
the gallery's screenshot filenames. The gallery coverage test understands
`concepts`, `studies`, and `themes` catalogs; extend it for a new catalog format.
Validate, regenerate screenshots from sanitized sources, and visually review
the entire iteration before committing.
