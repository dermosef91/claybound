# Depth of field for the canyon's backdrop

Item (4) of the canyon plan. `before-last-well.png` is the deployed bricks
build; `after-*.png` the same spots with the far scenery blurred, captured by
`REVIEW_OUT=docs/canyon-blur scripts/review-canyon-atmosphere.cjs`.

## What changed

The canyon used to opt out of `citadel-depth.js` — the offscreen
blur/composite the citadel and forest use — over a backdrop that "can
disappear on mobile". It now takes the pass, and a stronger one: the
backdrop draws into a half-size target, is blurred across into a second
target and blurred down as it is composited (a separable nine-tap Gaussian,
reach 1.2 half-frame texels), then the playfield draws over the composite.
Only what is far away goes soft: the far rank of buttes and the farthest
cloud rank (with the sky). The middle and near ranks and the two nearer
cloud ranks are marked `userData.sharp` and draw with the playfield. A first
pass blurred the middle rank too at reach 1.8; the user asked for the blur
to stay on the distant elements and to be lighter. The citadel, forest and
soft dream sections keep their original single 3×3 pass.

## The probe

The disappearing backdrop had a history: on some hardware the chapter's clay
materials came back black from a render target while a plain quad did not,
so a synthetic probe had passed and the backdrop vanished. The pass now runs
behind a probe that is the real thing — once per chapter it draws the
chapter's own backdrop into the target and compares the read-back against
the same frame with the backdrop hidden; no difference means the round trip
fails, and the chapter draws direct for the rest of the session.

Two things the probe had to learn here (ANGLE over Metal, headless Chrome):
a render with `scene.background=null` came back black where the same render
with a background did not, so the probe keeps the background and diffs
against it; and draws issued in the frame a material's target-variant
program is first used landed nothing in the target, so the first two eligible
frames only warm the target and the verdict waits for the third. Both would
have condemned a working GPU to the direct path. The probe also waits until
backdrop clay is actually in the frustum, so the menu's frame or an all-sky
summit cannot cast the verdict, and `userData.sky` quads are hidden for it.

`REVIEW_FORCE_COMPOSITE=1` skips the probe; `REVIEW_PROBE_DUMP=1` writes the
offscreen target itself, which is how the render was shown to be working.

## Cost

Per frame at the windwell ledge: 409 → 403 draw calls and 456 k → 430 k
triangles, plus two half-resolution fullscreen passes. 66 checks green;
`tests/scene-canyon.mjs` now asserts the three-pass shape and that only the
sharp-marked ranks draw with the playfield.

**Still needs a phone test.** The probe's fallback is the direct draw, which
is what shipped before, so the failure mode is "no blur", not "no backdrop".
