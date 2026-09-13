# Ember Caverns editor promotion

Promoted the saved Ember Caverns draft from `http://localhost:4174/` into
`dist/routes/cave.js` as canonical layout version **5**.

- Source draft: `editor-4-10otl6g`, based on canonical layout version 4.
- `editor-backup.json` preserves the exact exported draft.
- `previous-canonical.json` preserves the previous canonical level.
- `changes.json` records the editable-field differences.

## Applied changes

- Removed `spark-step`, `spark-return`, `ferry-flower`, and `ferry-return`.
- Removed the checkpoints on `spark-hub` and `ferry-exit`.
- Moved `spark-return-low` to x 30.5, y 2.25.
- Moved and resized `press-bridge` to x 84.5, y 6, width 2.5.
- Removed the two beads formerly above `spark-step`.
- Moved the second flower to x 85.5, y 7.25.
- Moved the first spitter to x 29 with a patrol range of 26.5–31.5.

All editor-controlled fields match the saved draft exactly. Route metadata was
updated to reference the remaining platforms, the stale guide on `spark-return`
was removed, and the spitter hint was moved before its new position. The test
pilot now approaches elevated platforms that overlap broad floors from underneath
and can target the left portion of a ledge when dropping past a raised switch.

## Validation

- Exact normalized comparison of spawn, platforms, coins, flowers, enemies,
  hazards, winds, and crushers against the saved draft: passed.
- All 211 main, optional, and recovery crossings: passed with the route suite's
  isolated traversal checks.
- Cavern mechanics and checkpoint journey checks: passed.
- Editor model and app/DOM integration suites: passed.
- Local browser preview refreshed to canonical version 5; the Chapters menu now
  lists Ember Caverns as the original chapter without the old draft badge.
- All four main-route continuous playthroughs and deterministic replays: passed
  without deaths or state edits (`all-main-playthroughs.json`). Ember Caverns
  completed in 87.6 seconds with 72 beads.
- Optional all-flower continuous playthrough: **unverified**. The bounded input
  pilot exhausted its search at `ferry-niche` on the approach to `press-switch`.
  Individual optional crossings pass, but that does not establish a complete
  continuous flower run with active presses. The user's geometry was preserved.

No deployment or Git commit was made.
