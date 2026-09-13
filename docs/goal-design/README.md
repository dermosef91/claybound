# Goal design

Rebuilt the runtime finish portal against `target.png`. `after.png` is an actual
WebGL capture, framed at the reference's character scale. The surrounding
level and camera position remain those of the playable canyon.

The sculpture now has wider timber posts, tapered sandstone feet with recessed
triangle carvings, double rope bindings, angled header stones, a raised star
crest and three golden rays, four bunting pennants, a glazed gold bell, and a
matching star flag. Rock clusters and the existing cactus model ground its
feet while leaving the middle open. The bell, rope and clapper share a pivot
at the suspension point. The original completion trigger is unchanged.

The common goal appears in all four chapters. Cave dressing was moved beside
the wider frame to prevent the chest and torch from overlapping it.

## Review

- Four visual passes refined proportions, carvings, material relief and gloss.
- `iteration-2.png`, `iteration-3.png`, and `after.png` retain the later passes.
- `gameplay-desktop.png` and `gameplay-portrait.png` use the normal game camera.
- `chapter-2.png` through `chapter-4.png` check the other chapter finishes.
- `after-results.json` records browser errors, draw counts and completion.
- `scene-checks.txt` records scene, streaming and editor rebuild checks.

Run `GOAL_FULL=1 node scripts/review-goal.cjs` with the game served at
`http://127.0.0.1:5173`. The harness uses an isolated browser profile and does
not change the player's saves. `PLAYWRIGHT_MODULE`, `CHROME_PATH`, and
`REVIEW_URL` can override local tool paths.

The final browser run uses a temporary snapshot of revision `ecb72dc`, which
contains the finished goal. This keeps the capture independent of concurrent
boss implementation work in the shared workspace. `REVIEW_SOURCE_ROOT` selects
that snapshot's source directory; its goal module is identical to the workspace.

Validation: actual browser completion at the existing finish coordinate,
all four chapter renders, scene/streaming/editor checks, completion results,
208 route crossings under real physics, and 17 movement/mechanic checks.
