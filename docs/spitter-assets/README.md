# Gloobasnout Echo Spitter

The latest user-supplied Gloobasnout replaces both previous Crystalback character poses. `echo-spitter-gloob.glb` is a byte-for-byte copy of `Meshy_AI_Gloobasnout_quadruped_Character_output.glb`: one 10,452-triangle skinned mesh, original PBR textures, and the supplied quadruped skeleton. The 0.033-second embedded clip is effectively a rest pose, not a useful walk cycle.

## Animation

The supplied one-second walking clip was inspected and initially softened. Visual review still showed excessive leg folding and torso motion. It was replaced with a newly authored 1.35-second four-beat shuffle directly on the supplied skeleton:

- Four staggered paw phases, each planted for 68% of the loop.
- Small paw lift and steady bind-pose torso; no pelvis rescaling or root drift.
- Seamless loop endpoints and offline sampled ground correction.
- Movement-dependent blending to a restrained idle, with head breathing and subtle tail motion.
- A continuous skeletal wind-up, brief recoil impulse and eased settle. No mesh swapping or whole-body wobble.
- Exact pause preservation and reduced-motion handling.

Animation is authored in `scripts/prepare-spitter-motion.mjs` and runtime skeletal code in `dist/spitter.js`; Blender was not needed for this revision. The new clip is only a few KB and avoids loading a second copy of the character mesh/textures. The original walking GLB remains unchanged in Downloads.

Spitters now patrol their authored ranges at 0.38 units/second, turning at platform edges and closed obstacles. A clear sightline stops locomotion; after the cooldown they lock aim for the existing 0.9-second wind-up, fire, and recover. They resume patrol when the target is no longer visible. The editor preserves patrol endpoints and speed, and new Spitters receive a default four-unit lane. Runtime instances share retained geometry/materials and own independent skeletons.

## Review and validation

- `gloob-animation.webm`: actual WebGL capture of idle, shuffle and attack cycle.
- `gloob-animation.png`: labeled animation preview.
- Serve `dist` and open `/spitter-motion-review.html` for the live comparison.
- `tests/spitter-assets.mjs`: rig sharing/isolation, grounding, seam continuity, no walk rescaling, stop-to-idle, both idle and moving pause, reduced motion, cleanup and projectile checks.
- `assets.json`: current and superseded asset provenance and hashes.

## Projectile

The previously selected optimized crystal is unchanged: `Meshy_AI_Floating_Opal_Crystal_0911122019_texture.glb`, copied byte-for-byte, 3,045 triangles and 15.37 MB. Its largest runtime dimension is now 0.6 world units, with a matching 0.3 collision radius. Shots originate at the calibrated animated mouth in X/Y/Z; direction and mouth depth are preserved for both facing directions. `optimized-projectile-comparison.png` shows the earlier local copy on the left and the selected supplied version on the right.

## Patrol and mouth launch verification

`patrol-and-mouth.webm` records the in-game sequence; `/spitter-patrol-review.html` is its live preview. `mouth-launch.png` captures a newly emitted crystal. Tests cover bounded patrols, closed-gate cover, sightline lock, fixed wind-up position/aim, and matching the simulation muzzle to the actual head-bone anchor within 0.001 world units.

All four complete-route input replays pass with no resets. The test pilot now includes braking drift in its furnace-press stopping margin and avoids repeating identical machine-transfer attempts. These are test-harness fixes, not changes to ferry or press gameplay. See `patrol-playthrough-results.txt` and `patrol-regression-results.txt`.
