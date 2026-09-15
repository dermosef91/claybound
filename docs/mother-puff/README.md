# Mother Puff

The Still Clearing extends Wildwood from the checkpoint at x=264 to the finish bell at x=315. Mother Puff stands at x=303, toward the right edge. Both undisturbed and casting models turn 45° toward the player on her left. Her body begins mildly desaturated, with the grey tint decreasing after each hit. The entire fight takes place on her left. No black arches or root curtains are created.

Separate eroded clay plugs sit directly in her cap pores. Selected trees and leaves on the left are afflicted while healthy patches remain; ground and scenery become fully dark and desaturated toward the right, including the exit. Some damaged pieces use the same recessed `porousClay` geometry as the crumbling ledges. These arena-owned porous bricks disappear on the final hit, remain absent through saved victory, and return on a failed-attempt reset; ordinary crumbling ledges elsewhere are unchanged. Per-view material uniforms preserve textures and the original shared assets; background shader wrappers restore when the arena unloads.

There is no boss title, description, health bar, counter, or instruction toast in the game. Relaxed player idle/yawn clips are suppressed throughout the encounter, while walking and jumping retain their normal animations.

## Entrance and combat

Crossing x=276 starts a 5.8-second automatic walk toward x=287.04. The camera eases from the normal framing to the wide arena view throughout the walk. Movement, jump and stomp inputs cannot interrupt the introduction; gravity and landing remain active. At the end of the walk, the supplied growl plays at 20% gain with a subtle camera shake and the first spore fires immediately.

Each chain contains ten individually telegraphed spores, spaced 1.4 seconds apart. Purple, white and green spores snapshot the player’s horizontal position when that individual cast leaves the crown. Its landing marker stays at that ground position while the player moves. The projectile rises first, crests above the release point and curves down to the marker over 1.85 seconds; it never homes in flight. The tenth cast is always orange, targeting x=297.1, within bouncing reach of the boss, regardless of the player’s position. The complete chain spans 12.6 seconds; the next spree starts just 0.5 seconds after that orange shot. Every release produces a brief body compression and forward nod, settling before the next cast.

| Spore | Ground effect |
| --- | --- |
| Orange | The established forest bounce-pad asset appears near the boss; lasts 12 seconds and bounces above the crown. |
| Purple | Explosion damages and pushes the player away and upward. |
| White | Obscures visibility and reduces horizontal speed to 73% (half the previous slowdown) for contact with its 5.5-second cloud. |
| Green | Spawns a Spore Puff; at most three summoned children are alive. |

Move toward the orange landing marker around x=297, then bounce from the pad and steer onto her head. Any descending head landing counts; no stomp button or charged-bounce flag is required. Each of three hits breaks a group of plugs, cancels the volley, clears hazards and summoned children, and creates a leftward spore puff. The existing spore-balloon pop and a slight camera shake accompany all three successful hits. The puff carries the player left for 0.85 seconds, even against held movement input. The head target lowers from 7.25 to 7.0 to 6.8 units as the growths break away. Her remaining growths become more restless.

## Recovery

The third landing fills the whole silhouette with a large spore cloud over 1.5 seconds. For the next 1.8 seconds, the opaque cloud hides the model exchange. Over 2.6 seconds the cloud drifts and fades, revealing the supplied friendly model at its full 6-unit height, close to her initial 6.4-unit body. There is no visible shrinking or growing. She regards the player, gives a small suspicious puff, and disappears behind a second spore cloud sized to cover the larger friendly form.

Healing reuses `createSporeWind` / `animateSporeWind`: the same gold motes and cream billows found earlier in Wildwood. No new mushrooms or flowers grow on victory. The grey environment regains color. After the recovery sequence, the exit unlocks and the normal camera immediately resumes following the player, before they reach the right side of the stage.

The encounter threshold crossfades the forest music to the supplied **The Stone Orchard** over 2.4 seconds. Stone Orchard remains active throughout recovery and healing, hushed during the covered transformation. Only after healing completes does it crossfade back to the continuing forest track. Pause, mute, hidden-page behavior and stream fallback apply to both tracks.

Victory is saved once recovery finishes. Interrupted fights reset growths, spores and children at the checkpoint. Pause freezes the encounter. Reduced motion suppresses incidental breathing, shaking, tremors and cloud oscillation while retaining the essential reveal and healing.

## Supplied models

| Pose | User-supplied file | Triangles | Shipped bytes |
| --- | --- | ---: | ---: |
| Undisturbed idle | `Meshy_AI_Sleepy_Mushroom_Guard_0913143352_texture.glb` | 10,448 | 998,460 |
| Casting | `Meshy_AI_Mushroom_Hug_0913144326_texture.glb` | 10,428 | 1,029,136 |
| Friendly final form | `mushroom+character+3d+model.glb` | 19,686 | 1,797,432 |

All three are static meshes. The supplied friendly GLB is copied unchanged and normalized at load time. The sleepy sculpture is used before the encounter; the alert casting sculpture stays visible throughout combat. Procedural firing pulses, clay-plug reactions and spore clouds complement the supplied forms. Their original geometry, UVs and material maps are retained. Textures were repacked to 1024px JPEGs in the original implementation, with normal vectors renormalized. The Downloads originals remain unchanged. The new model, music and opening growl were supplied by the user; no provider jobs were used. The two-second growl is copied unchanged to `dist/assets/mother-puff-growl.wav`.

`scripts/prepare-mother-puff.py SOURCE idle|cast` reproduces that texture repack. The manifests beside the GLBs retain source/output hashes and geometry fingerprints.

## Implementation and verification

- `dist/mother-puff-rules.js`: deterministic entrance, ten-cast chains, landing damage, push, ending, save/reset and cleanup.
- `dist/mother-puff.js`: model poses, effects and gradual/released camera framing.
- `dist/mother-puff-growth.js`: embedded clay plugs and friendly puff.
- `dist/mother-puff-environment.js`: selective-to-complete corruption, porous geometry, isolated background materials and original healing winds.
- `dist/mother-puff-cinematics.js`: opaque model exchange, fading reveal and hit puff.
- `dist/mother-puff-music.js`: Stone Orchard crossfade lifecycle.
- `tests/mother-puff.mjs` and `tests/mother-puff-pilot.mjs`: four spore effects, orange placement, half-second spree restart, release-time targeting, three ordinary landings, push, input-only replay, save/retry, bounded effects and editor movement. The entrance-to-exit replay takes 9,140 fixed frames without a death or stomp input.
- `tests/mother-puff-assets.mjs`: three supplied GLBs and maps, grounding, firing pulse/pause, shared bounce-pad model and collision alignment, alert pose, cloud coverage, phase silhouettes, porous geometry, absent arches, healing winds, material isolation, effects disposal and portrait framing.
- `tests/player.mjs`: relaxed idle suppression during the encounter, preserved walking and normal idle after victory.

Browser inspection verifies the upward spore arc, both turned boss poses, starting grey tint, the enlarged friendly form and removal of the porous bricks. The deterministic input replay reaches the exit after three successful head landings without a death or stomp input. The browser replay reaches x=311 with all three health remaining and the normal 9.9-unit camera view; the forest soundtrack is playing, Stone Orchard is paused and the console reports no errors. Browser screenshots also confirm the reused orange bounce pad beside the boss. The full `npm run check` suite passes, including encounter, retained-asset, audio, traversal and editor checks. `review.html` is a local development fixture using the actual World/Game and ordinary-input pilot; it is kept outside the shipped directory.

The original forest traversal is preserved. Older editor backups retain their original finish without inheriting an unreachable boss; new arena drafts keep their boss near the right side when the arena moves.
