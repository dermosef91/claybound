# Shade in the joints, and a hotter sun

Item (6) of the canyon plan. `before-*.png` are the same spots with the blur
pass but no shading (item 4); `after-*.png` carry the baked shade and the
rebalanced light. Captured by `REVIEW_OUT=docs/canyon-ao
scripts/review-canyon-atmosphere.cjs`.

## What changed

**Bricks carry their own shade.** The game has no ambient occlusion, so the
joints between the pressed bricks read as light as their faces. Each pillow
brick's shape now bakes a shade into vertex colour (`block()` in
`canyon.js`): vertices in the rounded margin darken toward the edge — the
groove a neighbour sits in — by up to 22 %, a further 16 % along the bottom
where the brick meets the course below, and a faint gradient down the face.
The brick materials multiply it in (`vertexColors`), so every brick material
is now the canyon's own clone — the dark clay included, because a shared
theme material would read the missing attribute as black on every other
mesh it dresses. The shape is shared, so the shade costs nothing per brick.

**The cap lip casts.** The pressed plate's underside and the lower half of
its rolled rim are shaded to 70 % (`shadedPlate`), the lip's shadow onto the
first course. The plate has its own shaded material variant; the rock chips
keep the plain one.

**The light.** `THEMES.desert`: hemisphere 2.1 → 1.7, sun 3.3 → 3.7 and
warmer (`#ffdfb6` → `#ffd9a6`), fill .7 → .5. Brick tops catch the key, the
shaded joints and undersides fall off. The title screen shares these lights
and was checked; it reads the same.

Measured on the start deck's bricks: mean `#d2421f` → `#c63b1b`, toward the
reference cliff's `#ad4b31` (the rest of that distance is the palette's
deliberate saturation).

## A cache lesson

A cloned `BufferGeometry` shares its `userData` object with its source, and
`retainClayShape` keeps an existing `clayBytes`. The brick clone therefore
carried the base box's byte count — a coincidence that held until the brick
grew a colour attribute, when `tests/scene.mjs`'s "the cache tracks the
memory it actually holds" caught it. A clone that will change shape gets its
own `userData` and no inherited count.

Draw calls and triangles are unchanged from item (4). 66 checks green.
