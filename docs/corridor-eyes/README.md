# The Breathing Corridor's eyes — the supplied fleshy eyeball in its socket

The corridor's six eyes were a cream `w.ball` with a flat dark disc for a pupil
and two flattened lobes for lids, and the lobes sat at `z = -0.3` — *behind* the
ball — so an eye read as a sphere stuck onto a flat striped wall. The user
supplied a fleshy eyeball model and a reference frame of one set into folds of
clay, and asked for both: the model, and a better embedding.

What shipped: `dist/assets/dream-eyeball.glb` (610 KB, repacked from a 16.5 MB
Meshy upload by `scripts/prepare-dream-assets.py`, geometry untouched, its
4096² metallic-roughness map dropped), placed by `dreamEyeball` in
`dist/dream-assets.js` and socketed by `eye()` in `dist/dream/corridor.js`.

The model's pupil is painted into its colour map rather than set on the ball at
load, so this is the one eye in the chapter where **the ball itself turns** to
look. It is held to a 23.6° cone: the bake mirrored a second dark cap onto the
ball's back, and that needs 68° of turn to come round to the silhouette.

| file | what it shows |
|---|---|
| `before-open.png` | the eye as it was — the sculpted ball in front of its lobes |
| `corridor-eyes-open.png` | after, at play framing: three eyes set into the ceiling's strata |
| `corridor-eyes-blinking.png` | the same frame with the middle eye shut and the right one closing |
| `socket-close-ups.png` | the three sites — exit deck face, ceiling vault, throat wall |
| `blink-sequence.png` | open → closing → shut, showing the lips rolling together over the ball |
| `against-the-reference.png` | the ceiling eye beside the supplied reference frame |

Captured with `node scripts/review-dream.cjs`, the close-ups at double
resolution and cropped. The frames are deterministic: `ticks` fixes how far the
machinery has advanced, so 150 catches an open eye and 300 a shut one.

The numbers `tests/dream-models.mjs` holds, measured on the built scene rather
than asserted by eye: both lips stand 0.15 in front of the ball's front pole
(against the ±0.06 the clay sculpt wanders), the socket shows an almond of 0.80
of the ball's 1.14, and the blink closes it to −0.03 with the lips still in
front — so a shut eye is really covered. Cost at the corridor's mouth went from
111 draws / 101.7k triangles to 114 / 110.4k, against a budget of 200 / 400k.
