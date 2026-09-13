# Sunbaked Canyon editor promotion

Promoted the saved Canyon draft from Chrome at `http://localhost:4174/` to
`dist/routes/canyon.js`, canonical layout version **4**, on 2026-09-13.

Source draft: `editor-3-qygawx`, based on canonical version 3. The draft was
checked again before refreshing the game and had not changed.

- `editor-backup.json`: exact saved editor draft.
- `previous-canonical.json`: canonical chapter before promotion.
- `changes.json`: normalized editable-field differences.
- `main-playthrough.json` and `flower-playthrough.json`: successful continuous
  playthrough results, each verified with a deterministic input replay.

## Changes

- Removed the `sand-catch` and `sand-return` recovery platforms.
- Moved `basin-flower` to x 106, y 7.75; moved its flower to x 107.75, y 8.5.
- Replaced `sky1` with the editor's `clay-1` crumble platform at x 199.25,
  y 13.5, width 4.
- Moved one bead to x 206.375, y 15.570183432365091.

Every editor-controlled field matches the saved draft exactly, including object
IDs and order. Main-route references now use `clay-1`. The second flower route
drops from `sand2` to `basin-flower`, then rejoins at `sand3`. Removed stale
recovery and wind-circuit references, and updated the sand hint so it no longer
promises the deleted recovery shelves.

## Checks

- Exact normalized comparison of spawn and all seven editable object lists: pass.
- 206 main, optional, and recovery crossing checks across all chapters: pass.
- Canyon main-route playthrough: 55.1 seconds, 41 beads, no deaths or resets.
- Canyon all-flower playthrough: 63.8 seconds, 44 beads, all 3 flowers, no deaths
  or resets. Both playthroughs use normal inputs without state edits.
- Editor model, app/DOM integration, and checkpoint journey suites: pass.
- Refreshed Chrome's cached Canyon module to version 4; Chapters shows Sunbaked
  Canyon as the original chapter without the old draft badge.
- `git diff --check`: pass.

No deployment or Git commit was made.
