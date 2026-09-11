# Spore Puff

Four Spore Puffs replace Wildwood's ground enemies on spacious platforms. The supplied green mushroom mesh, its colour/normal/roughness maps and its 26-bone skeleton are preserved. The source contains no animation clips, so runtime poses animate the feet, body wiggle, breathing, squash, leap and landing.

## Encounter

| Phase | Behaviour |
| --- | --- |
| Idle | Small breathing motion and a slow platform patrol. The resting body is harmless. |
| Wiggle | At close range with clear sight, turns toward the player and wiggles for 0.65 seconds. |
| Puff | A directional cloud of cream-green clay spores can stun the player for 0.36 seconds. Spores do not remove health. |
| Crouch | Compresses its body before launch. Control returns at least 0.1 seconds before the leap. |
| Leap | Jumps aggressively toward the position warned by the puff; it does not home after launch. Body contact causes normal damage. |
| Recovery | A soft landing squash and a pause give the player time to escape or counter. |

Jumping or stomping onto the cap defeats it in every phase and bounces the player. The enemy bursts into small green clay particles. A player who leaves its sight or baits it into a gap can avoid the encounter. Nearby Spore Puffs coordinate attacks; stun immunity prevents chained paralysis. A held jump pressed while stunned is queued for when control returns, and cleared by damage or respawn.

The spores cannot pass through solid walls. Platform motion carries grounded enemies; disappearing platforms make them fall. Pausing freezes AI, stun, pose and particles. Death, chapter return and editor rebuilds retain shared models while releasing individual skeleton resources.

## Asset and editing

- Source: `Meshy_AI_Character_output.glb`, 6,037,760 bytes; source fingerprint recorded in `dist/assets/spore-puff.json`.
- Shipped: `dist/assets/spore-puff.glb`, 1,131,256 bytes, 10,396 triangles.
- Maps are resized to 1024 pixels. Positions, normals and UVs are unchanged. Eight skin influences are reduced to the strongest four and normalized for the Three.js runtime; all 26 bones remain.
- Rebuild with `python scripts/prepare-spore.py PATH_TO_SOURCE_GLB`.
- The forest editor's **Spore Puff** palette item supports placement, patrol speed/range, undo/redo, saved drafts, backups and immediate playtesting. Choosing **Play updated original** in Chapters uses the new roster if a pre-existing edited forest still contains the old enemies; saved designs are preserved.

## Checks

`tests/spore.mjs` verifies the complete attack, dodge window, stun duration, queued jump, damage, jump/stomp counters, sight and range, attack coordination, moving/disappearing platforms, asset fingerprints, skin normalization, independent skeletons, pose bounds, pause and resource retention. The app-level editor test covers adding, selecting, tuning, testing and reopening the new type. The full Wildwood automated playthrough completes with its four Spore Puffs active.

[Forest pose review](docs/cavern/spore-forest.png) is an offline render of the supplied model in the actual forest scene. It verifies framing and material retention; exact browser rendering and real-device animation feel remain unverified.
