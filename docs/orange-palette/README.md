# Shared clay orange

The richer base pigment is `#e64e1e`, defined in `dist/palette.js`. Its light and dark
steps scale that pigment directly, without mixing in cream. This restores the
saturation and red-orange character of the original hut roof and claylings. World accents, Hanging Quarter caps and
flags, sandstone, health clumps, controls, editor accents and menu buttons use
this palette. The health clumps use the Hanging Quarter's light colors too.

Imported player, clayling, drifter, cottage, laundry, castle, canyon and selected
forest props match orange pixels to the pigment in the clay shader. Source
brightness references preserve their texture shading. Neutral faces, eyes,
blue surfaces and foliage are excluded by the orange mask. Gold rewards and
emissive light sources keep their distinct materials. No GLB, texture file,
geometry, animation, collision data or gameplay rule was changed.

The title logo and Play button artwork use SVG color matrices derived from the
same pigment, preserving transparency and texture luminance. The button's text
and icon sit outside its filtered background.

## Verification

- For the initial implementation, all existing check scripts passed. The initial run exposed stale title-model
  setup in the scene and editor UI fixtures; both passed with that setup fixed
  (`fixture-check-results.txt`). The other checks are recorded in
  `check-results.txt` and `ui-check-results.txt`, including the initial failures.
- `scripts/review-orange-palette.cjs` captured the title, three Hanging Quarter
  locations, the other three chapters and a 390×844 portrait view. The browser
  reported no JavaScript, shader, or asset-request errors (`after-results.json`).
- Matching material values were read from the live renderer: flags, city tops
  and the health clumps all use `e64e1e`. Lighting and fog still shade them.
- Before/after PNGs are stored here for visual comparison.

Run the review with the local game server at `127.0.0.1:5173`. Set
`PLAYWRIGHT_MODULE` and `CHROME_PATH` if their locations differ from this machine.

The saturation follow-up uses the same browser review. `first-pass-city-flags.png`
retains the muted first attempt; `before-city-flags.png` is the original roof/enemy
reference, and `after-city-flags.png` shows the richer shared palette.
