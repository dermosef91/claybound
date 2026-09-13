# Great Arch rope bridge

The former orange arch-drop platform is a short suspension bridge matching the supplied reference: three bowed wooden timbers, stout posts, braided tan handrails, five angled double lashings, and continuous sandstone banks. Five visual passes refined the silhouette, timber thickness, rope construction, wood grain, support positions, and nearby composition. The bridge is 5.65 units wide at x 176.85, y 13.43, with 0.4859 units of deck sag.

The right checkpoint terrace is raised to y 12.6 and begins at x 183.35. Its two beads, flag footing, and the cloud behind the bridge follow the reference. The Great Arch cave visible behind the left cliff was added concurrently by a separate task and is preserved in these captures.

The bridge surface and collision share one profile. Walking in both directions, jumping, landing from above, and upward passage from below work. The editor offers Rope bridge; its selection outline, jump guides, and Test from this platform follow the curve. Moving, resizing, undo/redo, export/import, and streaming rebuilds retain the bridge.

The canyon remains layout version 5. Earlier promoted edits, including removed recovery platforms, the basin flower relocation, and the Sky-Sand crumble, remain. See preserved-draft.json for the scope of this crossing revision.

## Verification

- Full package.json check suite passed, including all four continuous playthroughs and 208 main, optional, and recovery crossings.
- Canyon main run: 55.4 seconds, 42 beads, no deaths or resets.
- Canyon flower run: 64.1 seconds, 45 beads, all three flowers, no deaths or resets.
- tests/rope-bridge.mjs covers both directions, both slopes, center landings, jumping, one-way passage, checkpoint arrival, editor round trips, curved selection, and raycast agreement between visible wood and collision.
- tests/scene.mjs covers bridge streaming, geometry disposal, return, and editor rebuild without disposing shared assets.
- Chrome WebGL checks passed in desktop and portrait views. Keyboard traversal reaches last-rest with full health. Editor checks cover browsing, resizing, undo, and clicking the bowed deck. No browser errors or failed asset responses occurred.
- The user's running localhost:4174 tab retained stale modules after normal reloads. Loading //index.html on the same origin fetched fresh module paths while retaining saved progress and drafts. The live editor was then visually verified and left framed on the rebuilt Rope bridge. No draft edits were made during that live check.

## Images and reproduction

- reference.png: supplied target image, unchanged.
- before-scene.png: supplied original platform screenshot, unchanged; its framing differs from the review camera.
- after-scene.png: fifth-pass WebGL capture with reference-oriented framing.
- bridge-overview.png: wider view including the spike bed and both banks.
- gameplay-desktop.png and gameplay-portrait.png: normal gameplay cameras.
- editor.png: editor selection of the curved bridge.
- iterations/: intermediate captures and the final fifth-pass review bundle.

Serve dist on localhost:5173, then run node scripts/review-canyon-bridge.cjs. PLAYWRIGHT_MODULE, CHROME_PATH, REVIEW_URL, and REVIEW_OUT override local defaults. BRIDGE_BASELINE=1 captures only the current scene as before-scene.png; use a separate REVIEW_OUT to preserve the supplied baseline. JSON files alongside the images record the checks.
