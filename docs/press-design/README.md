# Cavern press design

The supplied second image is the visual target. All three cavern presses use the updated shared view.

## Changes

- Broader rounded golden rails, rounded side collars and outer axle caps.
- Soft slate head, thicker rolled impact plate, larger golden studs and a clearer orange warning strip.
- Dedicated slate and gold materials with finer fingerprints and shallow geometric relief; scenery materials are unchanged.
- Existing press width, stroke, timing, damage, held-state lamp and floor contact remain intact.

## Visual verification

Chrome WebGL captures use an isolated profile and the actual app. `before-portrait.png` and `after-portrait.png` share the same portrait viewport and camera. `after-impact.png` shows floor contact; `after-held.png` shows the linked-switch lamp; `after-gameplay.png` shows the machinery at landscape gameplay scale.

The final visual review passed: rails, studs and side joints remain readable, rounded silhouettes follow the target, the moving plate reaches the floor, and the fixed rails remain in place. The supplied target has different background framing and lighting; the existing level scenery and lighting are retained.

`browser-checks.json` records all five cycle states, head/floor alignment and zero browser errors. `playthrough-results.json` records completion of all four chapters through normal input. The full existing check command is recorded in `check-results.txt`.

Reproduce with a local server at port 5184 and `node scripts/review-press.cjs`. `PRESS_BASELINE=1` captures the previous implementation directly from revision `e08e768` without changing the working source.
