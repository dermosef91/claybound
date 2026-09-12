# Claybound title screen — reference comparison

Date: 2026-09-12

final result: passed

## Evidence and scope

- Source visual truth: `/Users/moritzgrassy/Claybound/docs/title-rebuild/reference.png`.
- Final browser-rendered implementation: `/Users/moritzgrassy/Claybound/docs/title-rebuild/desktop-final.png`.
- Preview: http://localhost:4174/ (the authored static game runtime).
- Source and implementation are both 1672 × 941 pixels; browser CSS viewport 1672 × 941, screenshot density 1. No device frame or chrome is included.
- State: initial title screen with Play, closed dialogs, loaded 3D assets. Player idle pose and subtle cloud movement are live.
- Combined full-view comparison: `docs/title-rebuild/comparison-final.png`, source left, implementation right, each reduced to 836 × 470 for inspection.
- Combined full-resolution region comparisons: `docs/title-rebuild/menu-detail.png` and `foreground-detail.png`, source left, implementation right.
- Responsive evidence: `phone.png` (390 × 844), `landscape-phone.png` (844 × 390), and `tablet.png` (768 × 1024), in the same evidence directory.
- Measured desktop button rectangles: `docs/title-rebuild/layout-verification.json`.

## Findings

No remaining actionable P0/P1/P2 issues in the requested title-screen rebuild. The four controls, logo, tagline, sun, cactus, flag and player now occupy the reference's major composition anchors. The supplied 3D mesa replaces the former repeated box platform.

Expected asset differences: the user-supplied mesa contains different rock, plant and cactus details from the reference image. The existing game's skinned player has a coat, hands and boots. These remain part of the live scene. Canyon/cloud silhouettes come from the game's existing models. Their arrangement, scale, lighting and depth have been matched, rather than substituting the reference image for the game scene.

The title artwork follows the workspace's shared clay-orange palette, including its concurrently updated logo/button pigment filters. This retains consistency with the rest of the game.

## Required fidelity surfaces

- Fonts and typography: retained the supplied clay logo image and bundled Clay Sans/DM Sans. Primary label approximately 50 px and secondary labels approximately 33 px at the reference viewport; weights, label alignment and tagline tracking match the reference hierarchy. No wrapping or clipping in verified viewports.
- Spacing and layout rhythm: primary control starts at 7.35% / 39.8% and spans 31.7% of screen width. Secondary controls are slightly inset and smaller, with consistent gaps. Logo spans 46% of the screen. Player feet sit near 74.7% / 86.2%; sun center is 84.1% / 37.8%. Tablet tagline-to-actions clearance is 16.56 px after correction. Landscape phone secondary targets are 44 px tall and all controls fit within 390 px height.
- Colors and visual tokens: blue atmosphere, warm sunlight, cream secondary buttons, brown ink and orange primary button are present. Button pigment follows shared game palette. Light comes from the upper right and produces contact shadows on the mesa. Atmospheric haze and distant defocus separate the foreground.
- Image quality and asset fidelity: generated button sprites have genuine alpha, original logo is retained, supplied mesa's embedded maps and UVs are retained, normal seams are smoothed, shared clay relief is applied. The source GLB is copied byte-for-byte; title proportions are applied at runtime to copied geometry. The player uses the original skeletal idle. The foreground stays sharp while the distant scene is softly defocused.
- Copy and content: Claybound; Small feet. Bigger worlds.; Play; Chapters; Collectibles; Settings. Existing saved-game labels remain supported. Utilities remain available in Settings.

## Comparison and correction history

1. Baseline (`before.png`): P1 undersized controls/logo, generic repeated-block overlook, oversized distant formations and absent sun. Rebuilt composition, generated clay button artwork, integrated the attached mesa and added sunlight/atmosphere.
2. First implementation (`iteration-1.png`, `comparison-1.png`): P2 icons too small, foreground props too wide/high, hard low-poly shading, flat background. Enlarged icons, changed the camera/depth, softened normals, applied clay relief and added background defocus.
3. Shading pass (`iteration-2.png`): P2 cactus/flag spacing and canyon bridge proportions differed substantially. Rebalanced the supplied sculpture's upper dressing, adjusted the arch proportions, introduced the visible river and atmospheric color falloff.
4. Proportion pass (`iteration-3.png`): P2 localized deformation bent the flag base and stretched foliage. Replaced it with a continuous monotonic horizontal mapping through the whole sculpture. The connected pole/roots stay intact; see `iteration-4.png` and `comparison-4.png`.
5. Final composition: corrected foreground left edge, increased character presentation width, matched button/icon spacing, refined clay brightness, and preserved current shared palette. Final evidence is `desktop-final.png`, `comparison-final.png`, and both detail comparisons.
6. Responsive pass: P2 tablet Play button overlapped the tagline. Made action positioning depend on the actual brand height. Verified 16.56 px clearance at 768 × 1024. Raised landscape phone minimum target height to 44 px. Corrected captures are `tablet.png` and `landscape-phone.png`.

## Interaction and regression validation

Browser checks passed for Play → gameplay → pause → Return to title, Chapters with four choices, Collectibles with chapter totals, Settings, sound off/on with restoration, and retained help/fullscreen/editor controls in Settings. Title menus remain usable before expensive assets finish loading. No console errors were recorded on the final static preview origin. The existing Three.js PCFSoftShadowMap deprecation warning is not a new title failure.

The repository check sequence passed through mechanics, platforms, cavern/spitter behavior, HUD, routes, journeys, four complete playthroughs, controls, player/assets/enemies, clay, cave lighting, scene streaming, completion, title menus/scenes, editor, audio, and DOM integration. Two existing test fixtures needed the newly required title asset setup; affected checks were rerun and passed. Title tests additionally verify texture retention, finite geometry, and restoration of player scale/yaw on return to gameplay. Diff whitespace and JavaScript syntax checks passed.

The Vite preview exposed an existing relative asset-base transform issue. Final GPU verification and handoff use the documented static-server runtime; Vite itself is not claimed as fixed.

## Follow-up polish

P3: exact cloud/letter contours and the collectible/gear icon silhouettes differ slightly from the raster reference. Existing game model identity and library icons are retained. A bespoke matching character or replacement canyon meshes are outside this title-screen rebuild.

## Implementation checklist

- [x] Supplied mesa integrated with source provenance.
- [x] Real player grounded on its triangle surface, with idle and gameplay ownership intact.
- [x] Clay buttons, matched proportions and functioning actions.
- [x] Sun, directional lighting, haze, river and distant defocus.
- [x] Repeated combined visual comparisons and fixes.
- [x] Desktop, portrait phone, landscape phone and tablet verification.
- [x] Regression checks and final static preview left running.
