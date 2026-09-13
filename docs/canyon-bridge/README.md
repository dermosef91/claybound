# Great Arch rope bridge

Rebuilt the reference crossing between the high Drifter perch (`arch-roof`)
and the checkpoint terrace (`last-rest`). The former floating `arch-drop`
ledge is now a 6.3-unit wooden rope bridge at x 176.85, with sandstone
abutments merging into both banks. Its shallow deck sags 0.4725 units at
the centre. Rounded planks, curved timber runners, wood grain, twisted
handrails, wrapped posts and double rope lashings use the existing clay
materials. No additional downloaded models or textures are needed.

The bridge surface and collision share one profile. It supports walking in
both directions, jumping and landing from above, and upward passage from
below. The editor includes a Rope bridge type; selection, curved outlines,
jump guides and Test from this platform follow the deck. Moving, resizing,
undo/redo, export/import and streaming rebuilds retain it.

The canyon is layout version **5**. Existing version-4 geometry outside this
crossing, including the prior promoted editor changes, is preserved. The
earlier recovery-platform removals, flower relocation and Sky-Sand crumble
remain. Checkpoints use the existing layout-version compatibility rules.

## Verification

- Full `package.json` check suite passed, including all four continuous
  playthroughs and 208 main, optional and recovery crossing checks.
- Canyon main run: 55.3 seconds, 43 beads, no deaths or resets.
- Canyon flower run: 64.1 seconds, 46 beads, all three flowers, no deaths
  or resets. Both runs also passed deterministic input replay.
- `tests/rope-bridge.mjs` checks grounded traversal, both slopes, centre
  landings, jumping, one-way passage, checkpoint arrival, editor round trips,
  curved hit selection and raycast agreement between planks and collision.
- `tests/scene.mjs` checks bridge removal, geometry disposal, return and
  editor rebuild without disposing shared clay assets.
- Actual Chrome WebGL screenshots reviewed in desktop and portrait views;
  keyboard crossing reaches the checkpoint at full health. The editor
  browser check covers browsing, resizing, undo and clicking curved planks.
  No browser errors or failed asset requests occurred. Browser checks use an
  isolated profile, leaving the user's saved progress and drafts untouched.
- All earlier promoted platform data, collectibles, enemies, hazards, winds
  and spawn were compared against `../canyon-canon/editor-backup.json`.

## Images and reproduction

- `before-scene.png` / `after-scene.png`: identical reference framing.
- `bridge-overview.png`: wider framing showing the spike bed and both banks.
- `gameplay-desktop.png` / `gameplay-portrait.png`: normal gameplay cameras.
- `editor.png`: native editor selection of the curved bridge.

Serve `dist` on localhost:5173, then run
`node scripts/review-canyon-bridge.cjs`. Set `PLAYWRIGHT_MODULE`, `CHROME_PATH`
or `REVIEW_URL` if their local paths differ. `BRIDGE_BASELINE=1` captures only
the current scene as `before-scene.png`; the saved baseline here predates the
bridge implementation. JSON files alongside the images record the checks.
