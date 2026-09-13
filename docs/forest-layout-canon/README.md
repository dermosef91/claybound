# Wildwood editor promotion

Promoted the user's incognito export `claybound-chapter-2.json` into canonical
Wildwood layout **5**. The export is `editor-3-1ux64nu`, based on layout 3;
layout 4 changed only the opening coins, and the user's complete new export
supersedes those placements.

## Preserved layout

All editor-controlled fields match the export exactly: spawn, platform order,
positions and properties, coins, flowers, enemies, hazards, winds and crushers.
The original scenery metadata remains attached to the first bough.

- 49 platforms: six removed, four added, two adjusted.
- Removed `crack1`, `canopy-catch`, `canopy-return`, `choir-flower`,
  `root-flower`, and `heart-flower`.
- Raised/repositioned `tree-west` and `tree-west-spring`.
- Added `clay-1`, `clay-2`, `clay-3`, and `clay-4` with the exported geometry.
- 39 beads, one flower, four enemies, and five hazards.

Route metadata now connects the root-entry drop after the removed seal, uses
`tree-west` before its raised spring, and includes the tree-top spring. The
remaining flower is collected during that main-route bounce. The new lower
bloom spring provides a recovery route. Removed routes and the obsolete
root-seal hint were cleaned up; inactive `root-breath` remains exactly as
exported. The canonical version increment invalidates obsolete checkpoints.

## Shared goal

The improved canyon finish already uses `createGoal` in `dist/goal.js` for
all chapters through `World.makeBell`. Wildwood, Ember Caverns and Hanging
Quarter therefore use the same timber arch, carved sandstone, star crest,
bunting, gold bell and star flag. Only the canyon adds its cactus dressing.
No separate goal implementation or copied geometry was needed.

The scene suite verifies a single goal at each chapter's completion coordinate,
its decorated animated flag, shared bell/clapper pivot, valid geometry, and
survival of streaming and editor rebuilds. These are CPU scene checks, not new
GPU screenshots.

## Backups and checks

- `editor-backup.json`: the exact user-provided export.
- `previous-canonical.json`: previous complete canonical Wildwood level.
- `changes.json`: normalized editable-field differences.
- `main-playthrough.json`: continuous 64.7-second run, one flower, 26 of 39
  beads, no deaths or state edits; deterministic replay passed.
- `tests/editor.mjs` compares every editable field against the approved backup.
- All 203 main, optional and recovery crossings pass under real physics.
- Every suite in the project’s `check` command passed, including all four
  continuous chapter playthroughs, scene checks, editor models and app/DOM
  integration. After updating obsolete flower-count expectations, the affected
  suites were rerun successfully.
- Existing checks were updated for one forest flower, ten campaign flowers,
  the remaining stompable seal, and the low spring’s deliberately authored
  0.3-unit deck clearance.
- The local server at `http://localhost:4174/` serves the exact updated forest
  source and the shared goal source.

No deployment or Git commit was made.
