# Mother Puff

Mother’s Clearing extends Wildwood from its former finish at x=264 to the new bell at x=315. The old finish deck now holds a checkpoint; a broad mossy arena and surrounding supplied forest trees lead to the bell beyond the boss.

## Fight

Mother Puff stays rooted at the center. Entering the clearing wakes her and closes its living root curtains. She visibly inhales for 2.1 seconds before releasing clouds. Landing markers warn for the full 1.85-second flight; targets lock at release.

| Spore | Ground effect |
| --- | --- |
| Orange | Two large mushroom caps, one on each side. Run onto one to bounce high enough to reach her crown. They last 12 seconds. |
| Purple | A brief explosion deals one health of damage and pushes the player away and upward. Ordinary damage invulnerability applies. |
| White | A thick cream cloud obscures the area and slows horizontal movement to 46% while touching it. It lasts 5.5 seconds. |
| Green | Spawns an existing Spore Puff enemy. No more than three boss children can be alive. |

Bounce from an orange cap, steer above her crown, and press **↓ / S / STOMP**. Exactly three successful stomps win. Each hit consumes the orange bounce, clears current spores and summoned children, and gives a short recovery before the next breath. An ordinary landing on her crown bounces harmlessly. A normal ground jump cannot reach the target.

On defeat she settles back to sleep, the roots open, and the new bell becomes reachable. Defeat is saved with checkpoint progress. Losing the fight clears all temporary effects and starts a fresh three-hit fight from the entrance checkpoint. Pause freezes the simulation and boss pose. Reduced motion removes breathing, wobble, camera shake and cloud orbit. The camera widens on entering the arena, including enough horizontal space in portrait to see the orange launch pad and crown.

## Supplied models

| Pose | User-supplied file | Triangles | Shipped bytes |
| --- | --- | ---: | ---: |
| Idle / recovery | `Meshy_AI_Sleepy_Mushroom_Guard_0913143352_texture.glb` | 10,448 | 998,460 |
| Casting | `Meshy_AI_Mushroom_Hug_0913144326_texture.glb` | 10,428 | 1,029,136 |

Both are static meshes. The game switches sculptures for casting and applies procedural breathing, hit reactions and settling. Geometry, UVs and original material maps are retained; textures are repacked to 1024px JPEGs, with normal vectors renormalized. Combined download: 2.03 MB instead of 11.90 MB. The originals in Downloads are unchanged.

`scripts/prepare-mother-puff.py SOURCE idle|cast` reproduces the texture repack. The two manifests beside the GLBs record source/output SHA-256 hashes, unchanged geometry fingerprints, dimensions and triangle counts. These assets were supplied by the user for this project; no external provider job or new license was requested.

## Implementation and checks

- `dist/mother-puff-rules.js`: deterministic encounter state, flight, ground contact, minion limits, stomp gating and cleanup.
- `dist/mother-puff.js`: shared model loading, arena scenery, procedural poses, telegraphs and effects.
- `dist/mother-puff-hud.js` / `.css`: remaining stomps, contextual guidance and visibility effect.
- `tests/mother-puff.mjs`: all spore effects, timing, pause, high-speed stomp contacts, input-only victory, save/retry lifecycle, bounds and editor preservation.
- `tests/mother-puff-assets.mjs`: actual GLBs, geometry/material retention, pose selection, grounding, pause/reduced motion, effect disposal, HUD and portrait framing.
- `tests/mother-puff-pilot.mjs`: shared normal-input fight pilot used by route and full-chapter replays.

The full forest playthrough reaches the new bell in 10,700 input frames (89.2 seconds), with all enemies and hazards active, no deaths, no state shortcuts, and deterministic replay from a fresh start. Browser review at 1280×720 and 390×844 covered idle/cast models, ground spores and a three-stomp victory with full health. No WebGL console errors were observed. These checks do not establish performance across other devices.

`review.html` is a local inspection fixture that uses the actual World/Game modules, with selectable static poses and an input-only fight replay. It is kept outside `dist`, so review controls are not deployed with the game. To use it during local review, temporarily copy it to `dist/__mother_review.html` and open that path on the development server.

The original forest traversal is preserved; its last platform changes from a goal to a checkpoint. Existing version-6 forest saves use the game's normal layout-version restart behavior. Imported older editor backups keep their original finish and do not inherit an unreachable boss. New arena drafts retain their boss and move her with the arena floor.
