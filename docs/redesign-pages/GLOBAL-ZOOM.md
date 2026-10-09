# GLOBAL-ZOOM: shared native image viewer

- Status: DONE; technically verified and user-approved on October 2, 2026
- Checkpoint: 5, rendered note image preview
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- UI baseline: `8dd3363`, approved customer-picker checkpoint
- Implementation revision: `f1916e8`
- Next action: continue shared shell notifications and record partial flows.
  This approved checkpoint is committed.

## Scope and original inventory

The original global handler opens `imageZoomModal` when an image inside
`.call-content` is clicked, copies its source into `imageZoomImg`, and uses
Bootstrap modal behavior. The image itself closes the viewer; Escape and backdrop
dismissal use Bootstrap defaults. Images fit within the viewport with their
original aspect ratio. There are no gallery navigation, zoom-slider, download,
caption or editing controls to migrate.

Consumers are the full note's shared content partial, customer detail note cards
and asynchronously loaded related notes in the note form. Delegated interaction
continues to cover subsequently inserted note content without per-host startup
code. The viewer is owned by the base template, not the note content partial.

Both original host/image IDs and the original source remain. The new host uses
native dialog behavior and the approved workbench frame. Header X, footer Close,
an image close button, status/error states and Retry are app-owned controls.
Existing image alternative text is copied; source images become keyboard
controls with accessible names. No note editor logic or stored content changes.

The image viewer stays centered. The top-anchored sizing policy approved for
customer pickers does not apply to this separate surface.

## Parity and interaction evidence

| ID | Original contract / intended control | Implementation / evidence | Result |
| --- | --- | --- | --- |
| ZOOM-01 | Clicking a rendered note image opens its preview | Same `.call-content img` scope, source and IDs; native dialog; live full-note check | PASS |
| ZOOM-02 | Display the selected image without changing its content or proportions | `currentSrc`/source copied, no bitmap transformation; actual landscape and portrait aspect/viewport checks | PASS |
| ZOOM-03 | Clicking the image closes the preview | Image is inside a native close button; live image-click dismissal | PASS |
| ZOOM-04 | Escape and backdrop dismissal remain available | Existing shared dialog policies, backdrop explicitly enabled; live dismissal checks | PASS |
| ZOOM-05 | Customer-card images remain independently interactive | New image buttons join the existing row-overlay stacking rule; live hit-target and preview check without navigating to the note | PASS |
| ZOOM-06 | Images inserted after page startup continue to work | One document-lifetime observer plus delegated interaction; live engagement-related notes in the note form and Node inserted-container checks | PASS |
| ZOOM-07 | Keyboard users can open and leave the viewer | Source images gain Tab/Enter/Space support, explicit close controls, native focus confinement and return; Node and live checks | PASS |
| ZOOM-08 | Preview cannot submit a background note form | Shared native keyboard scope; live Ctrl+Enter with an injected related-note image, no save/navigation | PASS |
| ZOOM-09 | Context help does not destroy the image preview | F1 opens stacked help; first Escape returns to viewer, next closes viewer; live check | PASS |
| ZOOM-10 | Image loading failures are visible and recoverable | Status, logged error and Retry; Node missing-source/error cases and live corrupt-preview fault/recovery with the actual source restored | PASS |
| ZOOM-11 | Repeated opens, close/reopen and late events do not leave stale state | Native idempotent open; source released on close; current image completion guards; Node cache/pending/closed-event checks | PASS |
| ZOOM-12 | Theme variants keep chrome legible and controls in bounds | Eight live variants, measured chrome/status/error text contrast at least 5.75:1; original image pixels unchanged | PASS |
| ZOOM-13 | Modified clicks on linked images retain link navigation | Modified linked clicks bypass preview and keep browser defaults; Node checks | PASS |

## Intentional improvements for approval

- Add a visible title, header close control and footer close control instead of
  relying solely on clicking the picture or pressing Escape.
- Add keyboard opening and focus return to the actual source image.
- Keep image controls above clickable customer-card overlays, like existing
  links and buttons. The previous overlay intercepted mouse clicks on images.
- Expose loading failures and Retry rather than showing a broken-image icon.
- Fit large images around the new fixed controls; do not stretch small images
  or alter their pixels.

## Verification and handoff

- 53 scoped Node checks pass across image viewing, customer pickers,
  native dialogs/help, navigation/search and themes.
- 20 scoped Python rendering checks pass, including all five native dialog
  shell balances, required image-viewer markup and script order.
- Live checks use actual development notes and their images. No sample records,
  demo server, viewport resizing, saved records or preference writes are used.
- The failure check temporarily corrupts only the preview element's source;
  the stored note and source image remain unchanged. Retry restores the actual
  image. Temporary theme attributes are restored.
- No real-data screenshots or image contents are added to the repository.
- The image host and controller no longer use Bootstrap classes, attributes,
  events or APIs. Bootstrap Icons remains the existing separate dependency.
- The user approved the image viewer without adjustments on October 2, 2026.
  GLOBAL-ZOOM is DONE; host pages and the full GLOBAL-SHELL are not
  approved by this checkpoint. Record partial redesign and their full lifecycle
  proof remain separate work. No push, merge or deployment is authorized.
