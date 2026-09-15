# Mother Puff

The Still Clearing extends Wildwood from the checkpoint at x=264 to the finish bell at x=315. Mother Puff stands at x=303, toward the right edge. The entire fight takes place on her left. No black arches or root curtains are created.

Separate eroded clay plugs sit directly in her cap pores. Selected trees and leaves on the left are afflicted while healthy patches remain; ground and scenery become fully dark and desaturated toward the right, including the exit. Some damaged pieces use the same recessed `porousClay` geometry as the crumbling ledges. Per-view material uniforms preserve textures and the original shared assets; background shader wrappers restore when the arena unloads.

There is no boss title, description, health bar, counter, or instruction toast in the game. Relaxed player idle/yawn clips are suppressed throughout the encounter, while walking and jumping retain their normal animations.

## Entrance and combat

Crossing x=276 starts a 5.8-second automatic walk toward x=287.04. The camera eases from the normal framing to the wide arena view throughout the walk. Movement, jump and stomp inputs cannot interrupt the introduction; gravity and landing remain active. A full 2.1-second inhale precedes the first cast.

Each chain contains ten individually telegraphed spores, spaced 1.4 seconds apart. Every landing target is on the left side. Exactly one yellow launch spore appears, alternating between cast eight and cast nine. Purple hazards keep clear of its launch lane. The complete chain spans 12.6 seconds; each projectile flies for 1.85 seconds.

| Spore | Ground effect |
| --- | --- |
| Yellow | One mushroom launch cap at x=297.1; lasts 12 seconds and bounces above the crown. |
| Purple | Explosion damages and pushes the player away and upward. |
| White | Obscures visibility and reduces horizontal speed to 46% for contact with its 5.5-second cloud. |
| Green | Spawns a Spore Puff; at most three summoned children are alive. |

Bounce from the yellow cap and steer onto her head. Any descending head landing counts; no stomp button or charged-bounce flag is required. Each of three hits breaks a group of plugs, cancels the volley, clears hazards and summoned children, and creates a leftward spore puff. The puff carries the player left for 0.85 seconds, even against held movement input. The head target lowers from 7.25 to 7.0 to 6.8 units as the growths break away. Her remaining growths become more restless.

## Recovery

The third landing fills the whole silhouette with a large spore cloud over 1.5 seconds. For the next 1.8 seconds, the opaque cloud hides the model exchange. Over 2.6 seconds the cloud drifts and fades, revealing the supplied friendly model at its full 2.35-unit height. There is no visible shrinking or growing. She regards the player, gives a small suspicious puff, and disappears behind a second, smaller spore cloud.

Healing reuses `createSporeWind` / `animateSporeWind`: the same gold motes and cream billows found earlier in Wildwood. No new mushrooms or flowers grow on victory. The grey environment regains color. After the recovery sequence, the exit unlocks and the normal camera immediately resumes following the player, before they reach the right side of the stage.

The encounter threshold crossfades the forest music to the supplied **The Stone Orchard** over 2.4 seconds. The third landing fades back to the continuing forest track, hushed during the covered transformation. Pause, mute, hidden-page behavior and stream fallback apply to both tracks.

Victory is saved once recovery finishes. Interrupted fights reset growths, spores and children at the checkpoint. Pause freezes the encounter. Reduced motion suppresses incidental breathing, shaking, tremors and cloud oscillation while retaining the essential reveal and healing.

## Supplied models

| Pose | User-supplied file | Triangles | Shipped bytes |
| --- | --- | ---: | ---: |
| Undisturbed idle | `Meshy_AI_Sleepy_Mushroom_Guard_0913143352_texture.glb` | 10,448 | 998,460 |
| Casting | `Meshy_AI_Mushroom_Hug_0913144326_texture.glb` | 10,428 | 1,029,136 |
| Friendly final form | `mushroom+character+3d+model.glb` | 19,686 | 1,797,432 |

All three are static meshes. The supplied friendly GLB is copied unchanged and normalized at load time. The sleepy sculpture is used before the encounter; the alert casting sculpture stays visible throughout combat. Procedural inhaling, clay-plug reactions and spore clouds complement the supplied forms. Their original geometry, UVs and material maps are retained. Textures were repacked to 1024px JPEGs in the original implementation, with normal vectors renormalized. The Downloads originals remain unchanged. The new model and music were supplied by the user; no provider jobs were used.

`scripts/prepare-mother-puff.py SOURCE idle|cast` reproduces that texture repack. The manifests beside the GLBs retain source/output hashes and geometry fingerprints.

## Implementation and verification

- `dist/mother-puff-rules.js`: deterministic entrance, ten-cast chains, landing damage, push, ending, save/reset and cleanup.
- `dist/mother-puff.js`: model poses, effects and gradual/released camera framing.
- `dist/mother-puff-growth.js`: embedded clay plugs and friendly puff.
- `dist/mother-puff-environment.js`: selective-to-complete corruption, porous geometry, isolated background materials and original healing winds.
- `dist/mother-puff-cinematics.js`: opaque model exchange, fading reveal and hit puff.
- `dist/mother-puff-music.js`: Stone Orchard crossfade lifecycle.
- `tests/mother-puff.mjs` and `tests/mother-puff-pilot.mjs`: four spore effects, late yellow timing, three ordinary landings, push, input-only replay, save/retry, bounded effects and editor movement. The entrance-to-exit replay takes 8,803 fixed frames without a death or stomp input.
- `tests/mother-puff-assets.mjs`: three supplied GLBs and maps, grounding, alert pose, cloud coverage, phase silhouettes, porous geometry, absent arches, healing winds, material isolation, effects disposal and portrait framing.
- `tests/player.mjs`: relaxed idle suppression during the encounter, preserved walking and normal idle after victory.

The browser replay reached the right exit with three successful landings, full health and no console errors. Its view returned from 18.8 to the normal 9.9 units. Static browser inspection verified the affected arena, full cloud cover and friendly form appearing through the fading veil. `review.html` is a local development fixture using the actual World/Game and ordinary-input pilot; it is kept outside the shipped directory.

The original forest traversal is preserved. Older editor backups retain their original finish without inheriting an unreachable boss; new arena drafts keep their boss near the right side when the arena moves.
