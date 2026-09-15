# Mother Puff

The Still Clearing extends Wildwood from the entrance checkpoint at x=264 to the bell at x=315. A narrowing approach through rigid charcoal roots opens onto an enormous, uncomfortable mushroom. Her normal cream body remains visible underneath a swollen cap, cream growths, and hard cracked clay lodged in her head. The clearing’s trees, floor and flowers have lost their color.

The encounter has no boss name, health bar, hit counter, description, or boss instruction toast. Its changing sculpture conveys progress. The existing orange-bounce and stomp lessons earlier in Wildwood teach the required verbs.

## Reveal and fight

Crossing the threshold starts a 3.4-second reveal. The camera opens toward her while root curtains close. Gravity remains active, and held movement/jump/stomp inputs cannot interrupt the scene. She then inhales for 2.1 seconds.

Each volley fires five spores **one at a time, 0.48 seconds apart**: two orange, then purple, white, and green. The landing positions lock when the volley begins, and each spore has its own landing warning and 1.85-second flight. Purple targets avoid the orange launch lanes.

| Spore | Ground effect |
| --- | --- |
| Orange | Two mushroom caps, one on either side, bounce the player above her crown. Lasts 12 seconds. |
| Purple | An explosion deals one health of damage and pushes the player away and upward. |
| White | A cream cloud obscures visibility and reduces horizontal speed to 46% while touching it. Lasts 5.5 seconds. |
| Green | Spawns a Spore Puff enemy, with at most three summoned children alive. |

Bounce from an orange cap, steer above the swollen crown, and press **↓ / S / STOMP**. Each hit consumes the bounce, cancels the remaining volley, and clears spores and summoned enemies. Ordinary crown landings bounce harmlessly. Fresh orange bounces are required for all three hits.

- Initially, three overlapping growth layers bury the cap. The stomp surface is 8.35 units above the floor.
- After the first hit, the largest layer breaks apart, her normal coloration starts returning, and restless breathing and head movements become quicker. The target lowers to 7.45 units.
- After the second hit, only the final central growth remains. The target lowers to 6.95 units.
- The third hit bursts the final plug and begins recovery.

## Recovery

She collapses over 1.5 seconds, followed by 1.8 seconds of stillness with the music hushed. Friendly spores escape as she slowly rises at 36% of her original model scale over 2.8 seconds. She turns toward the player, gives a small suspicious puff, and disappears in a warm spore cloud.

An outward wave then opens the closed flowers and returns some color to the grey floor and trees. Hard clay remnants remain, so the clearing looks relieved rather than instantly pristine. After the 3.6-second bloom beat, the root curtains finish withdrawing and the exit opens. The player is gently guided beside her during recovery and keeps normal gravity and landing behavior.

Completion is saved once recovery finishes. Reloading a completed encounter retains the healed clearing and open exit. Interrupted/failed fights reset all growths, effects and summoned enemies at the entrance checkpoint. Pause freezes every encounter timer. Reduced motion removes breathing, shaking, head tremors, debris flight, cloud orbit and farewell hopping; it preserves the essential shrinking and flower-opening progression.

## Supplied models

| Pose | User-supplied file | Triangles | Shipped bytes |
| --- | --- | ---: | ---: |
| Idle / recovery | `Meshy_AI_Sleepy_Mushroom_Guard_0913143352_texture.glb` | 10,448 | 998,460 |
| Casting | `Meshy_AI_Mushroom_Hug_0913144326_texture.glb` | 10,428 | 1,029,136 |

Both are static meshes. The game switches sculptures for casting and adds procedural breathing, growth layers, reactions and recovery. Their original geometry, UVs and material maps are retained. Textures were repacked to 1024px JPEGs in the original implementation, with normal vectors renormalized. The Downloads originals remain unchanged. This revision adds no external assets or provider jobs.

`scripts/prepare-mother-puff.py SOURCE idle|cast` reproduces that texture repack. The manifests beside the GLBs retain source/output hashes and geometry fingerprints.

## Implementation and verification

- `dist/mother-puff-rules.js`: reveal, individual launches, contact effects, changing stomp surfaces, recovery, healing, cleanup and reset.
- `dist/mother-puff.js`: supplied models, framing, pose animation, arena, telegraphs and spore effects.
- `dist/mother-puff-growth.js`: swelling, cracked clay, isolated material desaturation, flower opening and friendly spores. Grey materials are cloned per arena instance, preserving the healthy forest and the shared GLBs.
- `dist/mother-puff-hud.js` / `.css`: only the white-spore visibility effect.
- `tests/mother-puff.mjs`: ordered launches and timing, all four ground effects, swept stomp collision, an input-only victory, the recovery sequence, pause, save/retry, effect limits and editor integration.
- `tests/mother-puff-assets.mjs`: supplied asset integrity, grounding, pose switching, growth silhouettes, shrinking, flower progression, shader composition, material ownership, effect disposal, HUD removal and portrait framing.
- `tests/mother-puff-pilot.mjs`: ordinary-input encounter replay used by route and complete chapter checks. The revised encounter reaches the exit deck in 4,294 frames from its entrance, with three stomps, no deaths and full player health.

The current revision is checked by deterministic simulation and CPU scene-graph tests; the earlier browser screenshots cover the previous encounter, not this visual revision. `review.html` remains a local inspection fixture outside the shipped `dist` directory, using the actual World/Game modules and an input replay.

The original forest traversal is preserved. Older editor backups keep their original finish without inheriting an unreachable boss; new arena drafts retain their boss and move her with the arena floor.
