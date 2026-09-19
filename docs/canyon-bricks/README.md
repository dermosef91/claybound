# Pressed bricks for the canyon's cliffs

Item (5) of the canyon plan that followed the atmosphere pass. `before-*.png`
are the deployed atmosphere build; the others are the same spots after,
captured with `REVIEW_OUT=docs/canyon-bricks scripts/review-canyon-atmosphere.cjs`
(`REVIEW_SPOTS=last-well,start,arch-drop,pocket-dock,summit`).

## What changed

**Slabs → cushions.** A cliff was two or three columns of blocks a storey
tall (2.9 wide, up to 4.7 high, bevel .28 — a sawn edge at that size), so a
face read as three rectangles. `courses()` in `canyon.js` now lays rows of
bricks about half that size in running bond: heights from `[1.5 … 2.5]`,
widths 2.0–2.5, both snapped to a quarter; bevel .45 on a 4-segment rounded
box (`clayBox` takes a segment count now — the default three faceted at that
radius); each brick's front and back bellied out by .1 at the centre and the
old sharp horizontal ripple dropped (`block(...,{radius,segments,pillow})`).
Bricks overlap by .06, so the courses stay solid and the joints read as
grooves. Each brick's place, lean and depth jitter are unique; its geometry
is one of ~240 shapes shared across the chapter. `buildCanyonWall` (solid
`wall` bodies, e.g. under the Sandwright's Pocket) uses the same courses.

**The batch's slight variety.** The old slabs differed a little in brightness
and hue block to block, and split each column at its own height, so joints
stepped across the face; a first pass at three shades within 5 % in ruled
courses lost both, and the user asked for them back. Six shades as small
hue/saturation/lightness offsets from the terrain clay (`BRICK_SHADES`,
hue within ±2°, lightness within ±4 %), each with its own fingerprint offset,
the darker clay one brick in seven; and about half the bricks in a course
stand a quarter or half a unit taller (`STRETCH`), growing down into the
course below and a hair forward, as a `scale.y` on the shared shape. A first
try at twice these offsets read as a patchwork.

**The cap is the cave's pressed plate.** Thumb hollows and a rolled rim
(`pressedPlate` in `cavern.js`, split out of `caveCap`), in the canyon's cap
clay with a softer .24 edge, in pieces ≤ 6 wide. Sculpted once per half-unit
of width × 5 hollow patterns through the clay cache, then stretched the last
few percent in x — an uncached plate cost ~2.5 ms per piece on every
stream-in, which was the whole build cost of a wide deck.

Collision is untouched: bricks fill the same box, the cap top is the same
walk plane, and the crumble platforms (Voronoi shards that say "this falls")
were deliberately left as they are.

## Cost

`tests/perf.mjs`, Sunbaked Canyon, main checkout → this branch:

| | draws | triangles | stream p50 | stream p90 | cache |
|---|---|---|---|---|---|
| before | 91 | 125 k | 0.8 ms | 54.9 ms | 117 MB |
| bricks | 139 | 195 k | 0.6 ms | 19.4 ms | 74 MB |

(The before row is a few commits older and lacks the atmosphere pass's
clouds, which account for ~5 of the draws.) A wide deck's warm build fell
from 8.4 ms to 0.3 ms once the caps were cached. At the busiest gameplay spot
(the pocket) draw calls are 527. `node scripts/check.mjs`: 66 checks green.
