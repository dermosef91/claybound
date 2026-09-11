# Title screen design review

Date: 2026-09-09. Final result: **passed for the title screen**.

## Target and implementation

The user supplied `docs/title/reference.png` and requested the same visual direction with the lower-left handmade line removed. The implementation retains the orange sculpted Claybound logo, blue sky, terracotta canyon and arch, hooded character overlooking the river, cream tagline, left-aligned four-button menu, and lower-right exploration motto.

The scenery and logo are generated raster artwork based on that reference. The transparent logo and separate portrait and landscape scenes are shipped as WebP assets (535 KB combined). All buttons, labels, icons and dialogs remain real HTML controls. Existing local Clay Sans/Clay Display fonts and bundled Lucide icons are reused. The illustration is title artwork; gameplay continues to use the supplied animated character and 3D assets.

The reference-sized title uses approximately the same menu position and width. Phone layouts increase button width and keep touch targets at least 44 CSS pixels. The landscape artwork places the character and canyon to the right of the menu. Help, sound, fullscreen and the existing editor are retained in a small footer. Play changes to Continue when a compatible checkpoint exists.

## Visual evidence

Captures use the actual app in the available Chromium browser. Because this browser's viewport cannot be resized through the supported API, responsive checks use an exact-sized iframe containing the unchanged app. Only the surrounding review frame is uniformly scaled to fit the screenshot. Reference and implementation are shown together at matching 1139 × 1536 CSS-pixel dimensions; they are compared in the same screenshot. The temporary review wrapper is excluded from the shipped site.

| Capture | Viewport / review |
| --- | --- |
| `docs/title/claybound-title-reference-comparison.jpg` | Reference and implementation side by side at 1139 × 1536; hierarchy, logo, spacing, palette, image framing and menu placement |
| `docs/title/menu-detail-comparison.jpg` | Focused crop from that same comparison; icon, type, button material, spacing and relative sizes |
| `docs/title/claybound-title-phone.jpg` | 393 × 852 portrait; full menu, character clearance and footer |
| `docs/title/claybound-title-landscape-phone.jpg` | 844 × 390 landscape; alternate scene composition and compact controls |
| `docs/title/claybound-title-small-before.jpg` | 320 × 568 before the compact-phone correction |
| `docs/title/claybound-title-small-after.jpg` | 320 × 568 after the correction; Settings clears the character's head |
| `docs/title/claybound-title-collectibles.jpg` | Real collectibles dialog, four chapter rows and saved-record presentation |

The first small-phone review found Settings overlapping the character's head (P2). The short portrait layout now moves the brand and menu upward, preserving 44-pixel touch targets. The subsequent capture confirms this is resolved. No outstanding P0, P1 or P2 title-screen issues were observed in the reviewed states. Minor differences in the generated logo sculpture and background formations are accepted visual variations (P3).

## Interaction and regression verification

- Real browser checks: title loads without requiring WebGL; Chapters displays all four chapters; Collectibles displays actual saved totals; Settings opens; sound changes persist when reopened; fullscreen enters and exits; the graphics-error screen returns safely to the title.
- `tests/title-menu.mjs`: collectible IDs, duplicate suppression, best/checkpoint overlap, incompatible layout exclusion, totals bounded to available items, and separate edited-level records.
- `tests/editor-ui.mjs`: the actual app module under the existing DOM harness, with graphics/audio stubs, covers deferred world creation, menu entry, Play and return home, settings persistence, nested dialog focus restoration, and existing editor/save/playtest/joystick flows.
- `tests/completion.mjs` and `tests/controls.mjs` pass. Syntax checks and `git diff --check` pass.

The available browser reports graphics support as disabled and cannot create a WebGL context. Consequently the live 3D transition cannot be visually verified there; the real-app DOM harness verifies that transition with a graphics stub. This is a remaining device verification limitation, not a title-screen rendering failure. No physics, level layout or character asset changes are part of this update.
