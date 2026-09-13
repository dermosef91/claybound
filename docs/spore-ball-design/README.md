# Segmented spore-ball design

Implemented the supplied target in the runtime's procedural geometry.
`target.png` is the user reference; `preview.png` is an offline render of the
actual game meshes, with approximate studio lighting, not a WebGL screenshot.

The cream body has eight rounded, thick shell segments and five crown petals,
a recessed red star-shaped opening, golden seams and spots, and the existing
measured clay surface treatment. The crown faces upward and slightly towards
the gameplay camera. The body is softly flattened like the reference.

The slow inhale and quick exhale remain. Twelve golden pollen balls and three
clusters of cream puff lobes use a fixed pool, with no per-frame mesh creation.
The motion follows simulation time, freezes on pause, and becomes static with
no drifting particles under reduced motion. Broken seals stop animating and
retain the game's existing burst effect. Streaming owns the meshes/materials.
The complete sculpture is fitted to the canonical platform width and stomp
surface; no level geometry, collectible, hazard or gameplay changes were made.

Implementation: `dist/spore-ball.js`, used by `dist/forest-details.js`.

Validation:
- `tests/spore-breath.mjs`: geometry alignment through the full breathing cycle,
  pollen and puff phases, pause, reduced motion, hidden/broken seals, fixed
  object pool, and unchanged level state.
- `tests/scene.mjs`: all chapter scenes, streaming/rebuilds, clay resources,
  balloon contact, seal/checkpoint behavior, and animation checks passed.
- JavaScript syntax and diff whitespace checks passed.

To reproduce the offline preview, run `node scripts/review-spore-ball.mjs`
then Blender in background mode with `scripts/render-spore-ball.py`, passing
`/tmp/claybound-spore-ball-review` and the desired PNG output path after `--`.

## Rewarding burst and released updraft

The broken pod now ejects copies of its cream shell plates, blooms into larger
cream clouds, and throws golden pollen that slows and drifts upward. A low pop,
rising bloom tone and two quiet sparkle notes distinguish the explosion.

Released spore winds carry matching cream puff clusters and golden pollen
throughout the lift area. Smaller clouds and pollen follow the former vine
connection from the broken pod towards the affected platforms. The field only
appears when its gameplay channel is active. It remains readable but static
with reduced motion; simulation pause freezes the rising field.

`tests/spore-effects.mjs` covers the layered burst, particle budget, pause,
source-safe fragment ownership, transient disposal, wind activation, upward
motion and reduced motion. Audio tests cover the layered cue and mute. Wind
strength, lift bounds and gameplay timing remain unchanged.
