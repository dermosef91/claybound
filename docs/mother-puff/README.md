# Mother Puff

The Still Clearing extends Wildwood from the checkpoint at x=264 to the finish bell at x=315. Mother Puff stands at x=303, toward the right edge. Both idle and casting models turn 45° toward the player on her left. Her body begins mildly desaturated, with the grey tint decreasing after each hit. The entire fight takes place on her left. No black arches or root curtains are created.

Separate eroded clay plugs sit directly in her cap pores. Selected trees and leaves on the left are afflicted while healthy patches remain; ground and scenery become fully dark and desaturated toward the right, including the exit. Damaged pieces use the same recessed `porousClay` geometry *and the same `crumbleGrey` material* as the crumbling ledges, so blighted stone in the clearing is literally the stone the chapter breaks apart underfoot rather than a brown deck greyed out in the shader. These arena-owned porous bricks disappear on the final hit, remain absent through saved victory, and return on a failed-attempt reset; ordinary crumbling ledges elsewhere are unchanged. Per-view material uniforms preserve textures and the original shared assets; background shader wrappers restore when the arena unloads.

## Arrangement of the clearing

A raised, pored shoulder of ground closes each end of the frame, its broken bricks bedded into the face. Both are scenery only, parked behind the fighting plane, so the floor the encounter is tuned against stays flat and the recorded input replay still holds; `tests/mother-puff-assets.mjs` asserts neither shoulder reaches the fighting plane. Healthy crowns stand back along the left approach, small and deep enough that trunks and sky gaps read between them. Tall caps close both edges and a small one breaks up the middle ground between player and boss. Leaf clusters and flower sprays run the length of the ground line; only one flat brick is left out on the player's side of the floor, the rest bedded into the boss's side.

## The blight

Four supplied sculptures carry the corruption itself. Stone-dead tree and cap take the boss's side of the clearing outright, standing in place of the crowns and mushrooms that grew there. Two half-turned pairs mark the ground the blight is still crossing, on the player's side of centre, each yawed so its stone flank faces right, toward the boss it spreads from. The clearing floor is taken too: a crust of pored crumbling stone covers the deck's face and its moss line on the right, with slime clinging to the broken lip. The spatial grey shader still runs over all of it, so the boundary keeps moving with the clearing rather than with any one asset.

Every stone sculpture is built paired with the healthy model it replaces, hidden beside it. The recovered clearing therefore contains no corrupted asset and no corrupted material, not merely an un-greyed one. Because hidden objects are skipped, the two halves of a pair never draw together.

Recovery runs while she is still standing in it. The `healing` ramp opens as the cloud clears off her true form and spans `reveal-form`, `regard`, `farewell` and `bloom` over 7.5 seconds, which leaves her on screen for the first 5.2 of them. The stone-for-tree exchange therefore has to survive being watched, so it is a shrink-and-swell driven by the same ramp rather than a cut, completing about a second into `regard` while her own spore billows are up. By the time the last veil takes her, the blight is already gone. `b.healing` is read only by `animateMotherEnvironment`, so none of this reaches the simulation.

There is no boss title, description, health bar, counter, or instruction toast in the game. Relaxed player idle/yawn clips are suppressed throughout the encounter, while walking and jumping retain their normal animations.

## Entrance and combat

Crossing x=276 starts a 5.8-second automatic walk toward x=287.04. The camera eases from the normal framing to the wide arena view throughout the walk. Movement, jump and stomp inputs cannot interrupt the introduction; gravity and landing remain active. At the end of the walk, the supplied growl plays at 20% gain with a subtle camera shake and the first spore fires immediately.

Each chain contains ten individually telegraphed spores, spaced 1.4 seconds apart. Purple, white and green spores snapshot the player’s horizontal position when that individual cast leaves the crown. Its landing marker stays at that ground position while the player moves. The projectile rises first, crests above the release point and curves down to the marker over 1.85 seconds; it never homes in flight. In flight it sheds a trail: small clay motes in its own colour strung along the arc, dense right behind the cluster and thinning further back, inside a soft pale powder haze whose billows fade toward their rims rather than ending in hard silhouettes. The trail is view-only and placed from the recorded arc at fixed shed times, so pause, replays and frame rate draw the same trail; it lingers for under a second after the landing and dissolves. Reduced motion keeps the motes at half density and drops the haze. The tenth cast is always orange, targeting x=297.1, within bouncing reach of the boss, regardless of the player’s position. The complete chain spans 12.6 seconds; the next spree starts just 0.5 seconds after that orange shot. Every release produces a brief body compression and forward nod, settling before the next cast.

### Stop-motion pose frames

The two battle sculptures are cut between like stop-motion frames rather than blended. The casting pose appears only around a throw: it snaps on 0.2 seconds before the spore leaves the crown and holds for 0.4 seconds after, a 0.6-second window inside each 1.4-second gap. Every other moment rests on the idle sculpture — the undisturbed clearing, the walk-in, the 2.1-second recoil after each head landing, and the final collapse. Every cast gets its wind-up, including the first of each chain, which follows the reveal, a recovery or a recoil. Exactly one of the two is ever on screen. Reduced motion holds the casting pose through combat instead of cutting between frames, matching how it already suppresses the firing pulse. `motherNextCast` reports the seconds until the next spore leaves, so the view can wind up from simulation state alone and stays correct under pause and replay.

| Spore | Ground effect |
| --- | --- |
| Orange | The established forest bounce-pad asset appears near the boss; lasts 12 seconds and bounces above the crown. |
| Purple | Explosion damages and pushes the player away and upward. |
| White | Obscures visibility and reduces horizontal speed to 73% (half the previous slowdown) for contact with its 5.5-second cloud. The landed cloud is a semi-transparent mist (half opacity at the heart of each billow, fading at the rim) so the field stays readable through it; the flying cluster, its motes and its landing ring remain solid clay. |
| Green | Spawns a Spore Puff; at most three summoned children are alive. |

Move toward the orange landing marker around x=297, then bounce from the pad and steer onto her head. Any descending head landing counts; no stomp button or charged-bounce flag is required. Each of three hits breaks a group of plugs, cancels the volley, clears hazards and summoned children, and creates a leftward spore puff. The existing spore-balloon pop and a slight camera shake accompany all three successful hits. The puff carries the player left for 0.85 seconds, even against held movement input. The head target lowers from 7.25 to 7.0 to 6.8 units as the growths break away. Her remaining growths become more restless.

## Recovery

The third landing fills the whole silhouette with a large spore cloud over 1.5 seconds. For the next 1.8 seconds, the opaque cloud hides the model exchange. Over 2.6 seconds the cloud drifts and fades, revealing the supplied friendly model at its full 6-unit height, close to her initial 6.4-unit body. There is no visible shrinking or growing. She regards the player, gives a small suspicious puff, and disappears behind a second spore cloud sized to cover the larger friendly form.

Healing reuses `createSporeWind` / `animateSporeWind`: the same gold motes and cream billows found earlier in Wildwood. No new mushrooms or flowers grow on victory. The grey environment regains color. After the recovery sequence, the exit unlocks and the normal camera immediately resumes following the player, before they reach the right side of the stage.

The encounter threshold crossfades the forest music to the supplied **The Stone Orchard** over 2.4 seconds. Stone Orchard belongs to the blight, so it covers the collapse, stays hushed under the covered exchange, and then hands back to the continuing forest track over 2.4 seconds the moment the cloud clears off her true form — 3.3 seconds into the ending rather than 13.0, so the theme returns with the healed model instead of after she has gone. It never restarts: the forest stream plays on in place throughout, muted, and only its gain moves. Pause, mute, hidden-page behavior and stream fallback apply to both tracks.

Victory is saved once recovery finishes. Interrupted fights reset growths, spores and children at the checkpoint. Pause freezes the encounter. Reduced motion suppresses incidental breathing, shaking, tremors and cloud oscillation while retaining the essential reveal and healing.

## Supplied models

| Pose | User-supplied file | Triangles | Shipped bytes |
| --- | --- | ---: | ---: |
| Idle | `Meshy_AI_Sleepy_Mushroom_Guard_0913143352_texture.glb` | 10,448 | 998,460 |
| Casting | `Meshy_AI_Mushroom_Hug_0913144326_texture.glb` | 10,428 | 1,029,136 |
| Healed final form | `mushroom-boss-cured.glb` | 18,749 | 1,239,616 |
| Blighted tree | `fully-corrupted-tree.glb` | 21,343 | 2,252,176 |
| Blighted cap | `fully-corrupted-mushroom.glb` | 20,305 | 1,967,688 |
| Half-turned tree | `semi-corrupted-tree.glb` | 20,850 | 1,809,740 |
| Half-turned cap | `semi-corrupted-mushroom.glb` | 20,405 | 1,943,692 |

The four blighted sculptures add 7.97 MB to the download and take the clearing from 173,408 to 257,223 GLB triangles while the fight is running, a 1.48× rise concentrated in this one set-piece. They are loaded with the boss rather than with Wildwood, because nothing outside the clearing is blighted. Note that `tests/perf.mjs` samples chapter routes and never streams the arena in, so its Wildwood figures are unchanged by them and are not a measurement of this cost.

All three are static meshes, normalized at load time. The idle sculpture covers the undisturbed clearing and every non-casting battle moment; the casting sculpture appears only around each throw. Procedural firing pulses, clay-plug reactions and spore clouds complement the supplied forms. Their original geometry, UVs and material maps are retained, and all three carry base-colour, normal and roughness maps. Textures are repacked to 1024px JPEGs with normal vectors renormalized. The Downloads originals remain unchanged. The models, music and opening growl were supplied by the user; no provider jobs were used. The two-second growl is copied unchanged to `dist/assets/mother-puff-growl.wav`.

`scripts/prepare-mother-puff.py SOURCE idle|cast|friendly|(corrupt|semi)-(tree|mushroom)` reproduces that texture repack. The manifests beside the GLBs retain source/output hashes and geometry fingerprints.

The healed form previously came from `mushroom+character+3d+model.glb` (19,686 triangles, 1,797,432 bytes), which shipped as a straight copy with a base-colour map only. The replacement is smaller despite its full map set because it is repacked like the battle poses rather than copied.

## Implementation and verification

- `dist/mother-puff-rules.js`: deterministic entrance, ten-cast chains, next-cast timing, landing damage, push, ending, save/reset and cleanup.
- `dist/mother-puff.js`: stop-motion pose frames, effects, the translucent landed white cloud and gradual/released camera framing.
- `dist/mother-puff-trail.js`: deterministic spore trails (clay motes and rim-faded powder haze) through the shared particle pool, plus the shared soft `powderMaterial`.
- `dist/mother-puff-growth.js`: embedded clay plugs and friendly puff.
- `dist/mother-puff-environment.js`: clearing arrangement, blighted sculpture loading and placement, selective-to-complete corruption, porous geometry borrowed from the crumbling ledges, isolated background materials, the healed-pair swap and original healing winds.
- `dist/mother-puff-cinematics.js`: opaque model exchange, fading reveal and hit puff.
- `dist/mother-puff-music.js`: Stone Orchard crossfade lifecycle.
- `tests/mother-puff.mjs` and `tests/mother-puff-pilot.mjs`: four spore effects, orange placement, half-second spree restart, release-time targeting, three ordinary landings, push, input-only replay, save/retry, bounded effects and editor movement. The entrance-to-exit replay takes 9,140 fixed frames without a death or stomp input.
- `tests/mother-puff-assets.mjs`: three supplied GLBs and maps, grounding, firing pulse/pause, shared bounce-pad model and collision alignment, cloud coverage, phase silhouettes, porous geometry, absent arches, healing winds, material isolation, effects disposal and portrait framing. Spore trails are checked for one mote per shed interval on the recorded arc, identical output for identical spores, nothing shed under pause, lingering past the landing, complete cleanup of owned powder materials, a full-pool guard and reduced-motion thinning; the landed white cloud must share one translucent, rim-faded material while the flying cluster, ring and other colours stay opaque. A driven ten-cast volley checks that each cast holds one 0.6-second casting frame, that the idle sculpture fills the gaps, the walk-in and the recoil, and that exactly one sculpture is ever on screen.
- `tests/player.mjs`: relaxed idle suppression during the encounter, preserved walking and normal idle after victory.

Browser inspection verifies the upward spore arc, both turned boss poses, starting grey tint, the healed form and removal of the porous bricks. A live 24-second replay recorded every pose cut: each casting frame begins 0.17–0.19s before its spore leaves and ends 0.41–0.43s after, the idle frame fills the roughly 0.8s gaps and the whole recoil, the two windows merge across the 0.5s volley restart, and the two sculptures are never visible at once. The deterministic input replay reaches the exit after three successful head landings without a death or stomp input. The browser replay reaches x=311 with all three health remaining and the normal 9.9-unit camera view; the forest soundtrack is playing, Stone Orchard is paused and the console reports no errors. Browser screenshots also confirm the reused orange bounce pad beside the boss. The full `npm run check` suite passes, including encounter, retained-asset, audio, traversal and editor checks. `review.html` is a local development fixture using the actual World/Game and ordinary-input pilot; it is kept outside the shipped directory.

The original forest traversal is preserved. Older editor backups retain their original finish without inheriting an unreachable boss; new arena drafts keep their boss near the right side when the arena moves.
