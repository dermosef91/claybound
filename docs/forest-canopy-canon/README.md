# Wildwood canopy route — canonical layout 6

Promoted `editor-5-gns96z` from the user's latest `claybound-chapter-2.json`.
Every editable field matches the export exactly.

- Widened `bloom-entry` from x 205 / width 8 to x 204 / width 9.
- Added `clay-5`, `clay-6`, and `clay-7`, three ascending crumbling ledges.
- Added `clay-8` and its spring `clay-9` at the top of the optional climb.
- Added the second flower at (195.75, 43).
- The main route, 39 beads, existing hazards, enemies and winds are preserved.

The optional route metadata now connects the new ledges from `bloom1`, up to
the spring and flower, then back to `bloom-entry`. The test pilot preserves
running momentum for long elevated jumps and rises vertically for a flower
directly over a spring before steering towards the next landing. These are
normal inputs; no game physics or authored geometry was changed for the pilot.

Verification: all 211 individual main, optional and recovery crossings pass.
`flower-playthrough.json` records a continuous 73.7-second Wildwood run with
both flowers, 26 of 39 beads, no deaths, and deterministic replay verification.
The editor regression compares all editable fields against `editor-backup.json`.
`previous-canonical.json` and `changes.json` retain the preceding version and
exact field differences. The new canonical version isolates old checkpoints.

The source export and backups are preserved. No deployment or Git commit.
