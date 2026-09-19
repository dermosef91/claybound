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
dusty rose `#c46262` at the back) and the fog is lavender (`#9ea8d2`, 36..110)
that adds the distance on top — 62 % on the far rank, 18 % on the middle,
3–6 % on the low, none on the play plane. A first pass at 40 % on the far
rank stood too close, so half of the removed fog came back. Sampled against
the reference:

| rank | reference | before | after |
|---|---|---|---|
| far butte | `#ba6f7e` – `#c38196` | `#f0af91` | `#b18ca1` – `#b38ca1` |
| middle mesa | `#dc7e60` – `#e68762` | (fogged orange) | `#d8825d` |
| clouds | `#e3cab6` | `#efbba0` (one, salmon) | `#e9dccb` |
| sky, top | `#75ade4` | `#7ba9da` (flat) | `#70a7dd` → `#79b0e6` |

The summit and arch GLBs recolour through the orange-remap shader, so a rank
sets `userData.clayOrange` on a cloned material rather than `color`
(`palette.js orangeTextureShader` takes the pigment). Clones are cached on the
world and registered as asset materials, the way the canyon caps are, so level
reloads do not dispose them.

The heavy fog had also flattened the far summits into silhouettes, and half of
that was worth keeping. Rather than fog the colour further, the far rank hands
37 % of its lit response to a flat emissive floor of its own clay (`flatten`)
and halves its baked normal map and fingerprint bump (`relief`); the middle
rank takes 15 % / 0.8. Measured on the right-hand far butte at the ledge, the
mean colour held (`#ac889f` → `#ad8aa1`) while shading contrast (luminance
stdev) went 8.0 → 4.9; the original cream-fog frame measured 2.6.

**One salmon cloud → a field.** Twelve clouds at one depth, one size, sixteen
apart, 96 % fogged: two on screen, both pink. Now three ranks
(`CLOUD_RANKS`, factors .06/.12/.2 at z −60/−52/−44) of 1.35–4.2-unit puffs
with `fog:false`, 15 built, 4–5 in view (a first pass at twice the count and
two thirds the size read as busy). The camera is orthographic, so sizes are
authored, not a consequence of depth. The Boulder Drop's anchored cloud still
composes from the far rank.

**A gradient sky.** `sky-gradient.js` is the cave's `hazeGradient` made
shareable; the canyon rides it on a factor-0 layer with `SKY_STOPS`. Subtle by
design: the reference lightens ~10 % toward the horizon.

**Pause icon** filled (`style.css`), as in the reference.

## Cost

Per frame at the same four spots, draw calls rose by 4–16 (the visible clouds
and the sky quad); triangles by ~15 k. `node scripts/check.mjs`: 64 checks
green. The playthrough fixtures were re-fingerprinted (the fog string lives in
the route file the fingerprint hashes); their recordings are unchanged.

## Not in this pass

Far-layer blur (the canyon opts out of `citadel-depth.js` for a mobile
reason), pillowier terrain bricks, crevice darkening, and foreground
dressing — see the plan that preceded this pass.
