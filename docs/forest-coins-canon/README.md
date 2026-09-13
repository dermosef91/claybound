# Forest opening coin placement

Promoted the Wildwood draft `editor-3-1ls1cmr` from Chrome at
`http://localhost:4174/` into canonical Forest layout version 4 on 2026-09-13.

The first mushroom's coin trail now uses (9.5, 4), (11, 5.5), (13, 6.5), and
the retained endpoint (14.833333333333334, 5.25). The total is 74 coins, down
from 75. Every coin matches the saved draft exactly; all other chapter data is
unchanged except the layout version, which invalidates old collectible indices.

- `editor-backup.json`: exact saved draft, checked again before finishing.
- `previous-canonical.json`: previous canonical chapter.
- `changes.json`: exact removed and added positions.
- `main-playthrough.json`: successful 64.4-second continuous Wildwood run with
  39 beads, no deaths or resets, and deterministic replay verification.

An exact data comparison confirmed that only coins and layoutVersion changed.
Chrome's Forest asset cache was refreshed for the next game load. The active
game tab was left undisturbed because another browser session controls it.
Temporary backup pages were removed. No deployment or Git commit was made.
