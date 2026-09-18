# The Crooked Garden — supplied pillar, pebble pile and clayfall mountain

The garden's scenery was all sculpted clay primitives: salmon backdrop pillars
under mossy domes (two pierced by windows), pale lilac silhouettes behind them,
floating islands pouring waterfalls, violet mound clusters at the pillars' feet
and in front of every stone deck, two bushes, six decorative mushrooms (three
with watching eyes) and four giant far mushrooms, under a sky of three ribbon
clouds, three puffy clouds and three coils. The user supplied three Meshy
models and asked for them to take over that scenery, with every mushroom gone
except the ones a player uses.

What shipped: `dist/assets/dream-pillar.glb` (629 KB), `dream-pebbles.glb`
(718 KB) and `dream-mountain.glb` (693 KB), repacked from 14–23 MB uploads by
`scripts/prepare-dream-assets.py` (geometry untouched, 4096² metallic-roughness
maps dropped), placed by `dreamPillar` / `dreamPebbles` / `dreamMountain` in
`dist/dream-assets.js` and laid out by depth in `dist/dream/garden.js`:

| depth | before | after |
|---|---|---|
| z −56 (deep, factor .14) | 4 lilac silhouettes | 5 clayfall spires, paled by the fog |
| z −30 (far, .22) | 5 salmon pillars, 3 mounds | 4 pink pillars (stretched 1.2, staggered z −29/−33), 2 pebble heaps |
| z −23 (far) | 2 pink far mushrooms | 2 small spires, waterfalls to the camera |
| z −20 (near, .32) | 2 pillars, 2 mounds | 2 pillars, 2 pebble heaps |
| post-arch z −30 (mid, .3) | 2 floating islands, 2 giant purple mushrooms | a 10-tall spire, a pillar, an 8.5 spire, standing |
| sky | 3 ribbons, 3 puff clouds, 3 coils | 1 ribbon, 4 shared `cloud.glb` in a pink/lilac wash, 2 coils |
| in front of every stone deck | violet/lilac mound cluster | a big and a small pebble heap (still fading over the player) |
| on the decks | 6 mushrooms, 2 bushes | 6 pebble heaps |

Kept: the watching flowers, the supplied gate, the slime, the eye pads, the
snapping flowers — and the two mushrooms that are gameplay, the spring
(`garden-shroom`) and the floating pads' caps.

| file | camera x | what to look at |
|---|---|---|
| `before/garden-start.png` → `after/garden-start.png` | 3.8 | pink pillars for the salmon fence; pebble heaps in the foreground and on the deck; the shared cloud, washed pink |
| `before/garden-pads.png` → `after/garden-pads.png` | 17.3 | the dense middle distance; caps a unit lower so cloud shows between them |
| `before/garden-arch.png` → `after/garden-arch.png` | 36.8 | the small spire's waterfall at the left edge; no mushroom beside the flower |
| `before/garden-eyes.png` → `after/garden-eyes.png` | 44.6 | pink pillars against the violet decks; the thinned sky |
| `before/garden-bed.png` → `after/garden-bed.png` | 72.3 | the 10-tall spire where the island floated; a pillar at the right edge |
| `before/garden-exit.png` → `after/garden-exit.png` | 94.3 | the post-arch spires; the mushrooms visible right of the flag are the Folding Path's |

Captured with `SPOTS=garden-start,… PORT=5198 OUT=… node scripts/review-dream.cjs`.
Draw calls fell at every spot (start 391 → 245, pads 514 → 365, arch 563 → 456,
eyes 568 → 462, bed 572 → 455, exit 549 → 427); triangles are within a few
percent of before.

Judged and left alone: the baked terracotta and mauve against the violet
post-arch palette (fog takes the terracotta to salmon, which sits with the
pinks); the lavender column at the right edge of the eyes frame, which is
another section's backdrop and was there before.
