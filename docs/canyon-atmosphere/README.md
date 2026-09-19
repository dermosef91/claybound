# The Sunbaked Canyon's atmosphere

A pass on what stands behind the canyon's route, matched to a supplied
reference of the Sky-Sand Run's windwell ledge. `before-last-well.png` is that
frame before; `after-*.png` are the same frame and three others along the route
after, all taken by `scripts/review-canyon-atmosphere.cjs`
(`REVIEW_SPOTS=last-well,start,arch-drop,summit`).

## What changed and why

**The buttes were fogged flat.** The far rank at z −53 sat 89 % of the way into
a cream fog (`#f1bba0`, 32..91), and every rank was the playfield's own orange,
so distance was one pale cut-out. Now each rank is its own clay
(`canyon.js RANKS`: peach `#ec8a60` just behind the route, salmon `#d96b43`,
dusty rose `#c46262` at the back) and the fog is a long lavender
(`#9ea8d2`, 24..150) that adds only the last of the distance — 40 % on the far
rank, 16 % on the middle, 6 % on the low, none on the play plane. Sampled
against the reference:

| rank | reference | before | after |
|---|---|---|---|
| far butte | `#ba6f7e` – `#c38196` | `#f0af91` | `#b8828d` – `#ba838c` |
| middle mesa | `#dc7e60` – `#e68762` | (fogged orange) | `#da835b` |
| clouds | `#e3cab6` | `#efbba0` (one, salmon) | `#e9dccb` |
| sky, top | `#75ade4` | `#7ba9da` (flat) | `#70a7dd` → `#79b0e6` |

The summit and arch GLBs recolour through the orange-remap shader, so a rank
sets `userData.clayOrange` on a cloned material rather than `color`
(`palette.js orangeTextureShader` takes the pigment). Clones are cached on the
world and registered as asset materials, the way the canyon caps are, so level
reloads do not dispose them.

**One salmon cloud → a field.** Twelve clouds at one depth, one size, sixteen
apart, 96 % fogged: two on screen, both pink. Now three ranks
(`CLOUD_RANKS`, factors .06/.12/.2 at z −60/−52/−44) of 0.9–2.8-unit puffs
with `fog:false`, ~29 built, ~8 in view. The camera is orthographic, so sizes
are authored, not a consequence of depth. The Boulder Drop's anchored cloud
still composes from the far rank.

**A gradient sky.** `sky-gradient.js` is the cave's `hazeGradient` made
shareable; the canyon rides it on a factor-0 layer with `SKY_STOPS`. Subtle by
design: the reference lightens ~10 % toward the horizon.

**Pause icon** filled (`style.css`), as in the reference.

## Cost

Per frame at the same four spots, draw calls rose by 8–20 (the visible clouds
and the sky quad); triangles by ~25 k. `node scripts/check.mjs`: 64 checks
green. The playthrough fixtures were re-fingerprinted (the fog string lives in
the route file the fingerprint hashes); their recordings are unchanged.

## Not in this pass

Far-layer blur (the canyon opts out of `citadel-depth.js` for a mobile
reason), pillowier terrain bricks, crevice darkening, and foreground
dressing — see the plan that preceded this pass.
