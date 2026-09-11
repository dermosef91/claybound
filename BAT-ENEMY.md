# Flying cave bat

The five authored Ember Caverns encounters use the user's blue clay bat. The first patrols above the First Spark island, followed by encounters at the gallery exit, press ledge, vault roof and upper lantern relay. All are optional obstacles; required routes never depend on an enemy bounce. Checkpoint arrivals and the quiet central vault remain clear.

All five bats patrol left and right with a gentle vertical bob. A nearby player triggers a half-second retreat away and upward, followed by a 650 ms charge warning and a fast downward dive. The target locks at the start of the warning; the dive does not home. The bat turns toward the player during retreat, then faces the locked target throughout the charge and dive. Three rounded, irregular cream clay waves expand outward along the upcoming dive direction, accompanied by a rising sound. The old surrounding ring is removed. Reduced motion keeps the three waves stationary; pausing freezes the cue. After a hit, miss, or blocked dive, the bat retraces its flight corridor and waits 2.2 seconds before attacking again. Solid decks and walls stop dives. Nearby bats take turns attacking, and respawning cancels live attacks without reviving defeated enemies. Landing on a bat or stomping it defeats it and bounces the player upward; holding jump gives the higher rebound. Side and underside contact cause normal damage with the existing invulnerability window. Wing tips are harmless, and the inner wings widen the landing window. Defeat uses a short squash and the game's existing impact particles and sound.

## Supplied assets

`scripts/prepare-bat.py` combines `flying-bat.glb` with `Meshy_AI__0906203614_texture (1).glb`. It verifies identical positions, normals, UVs and triangle indices before transferring materials. The shipped model retains all 10,426 triangles, 7,382 vertices, eight bones, skin weights and original animation channels. The textured model's tangent basis is also retained. All three maps—base color, metallic/roughness and normal—are resized to 1024 pixels for a 917 KB single-file download. The source files remain unchanged; fingerprints are recorded in `dist/assets/bat.json`.

The runtime preserves the three original clips in the GLB and removes baked Root translation from cloned playback clips so animation cannot drift away from the collision body. Patrol, retreat and recovery use Fly; the charge uses Hover, and the dive uses Swoop timed to its travel. Independent skeletons and animation mixers prevent one bat from controlling another. Geometry, textures and materials are shared and retained across streaming and chapter changes; instance skeleton resources are released.

The model loads on cave entry, including entry through the editor, and is reused thereafter. The title screen and other chapters do not download it at startup. Existing terrain, platform mechanics, level versions and stored designs are preserved. Previously edited cave drafts retain their authored enemies; Flying bat can be added or selected as an enemy type in the editor.

## Editor

In Ember Caverns, choose **Add → Flying bat**. Drag or nudge it, adjust its height, hover distance, cycle and starting phase, and set its horizontal patrol bounds. New bats receive a horizontal patrol by default. Legacy equal bounds derive a flight lane around the supporting platform at runtime, preserving the stored draft and its version. A dashed flight-area guide appears when selected. Bat fields survive autosave, undo/redo and backup export/import. Playtest and return use the same flight and collision rules as the normal game.

## Verification

- `tests/bat-ai.mjs`: both patrol directions for all five bats, legacy drafts, retreat direction, warning duration, locked aim, dive speed, terrain contact, recovery, cooldown, pause, respawn, attack coordination and stomp counters.

- `tests/bats.mjs`: direct facing on both sides and straight down, three opaque clay echo waves, outward progression, pause/reduced-motion handling, cue visibility and shared resources; real GLB parsing, all three material maps, animated wing deformation, stable root, independent skeletons, retained resources, pause and defeat, moving-top collision, jump and fast stomp kills, harmless wing tips, side damage, cooldown, cave placement and editor round trips.
- `tests/editor-ui.mjs`: actual app modules with the existing graphics/audio stubs verify deferred cave loading, reuse on re-entry, touch selection, palette placement, hover editing and playtest return. Existing title, joystick and editor checks also pass.
- Existing movement, ground enemy, other asset, editor and scene/streaming checks pass. All four complete routes pass deterministic input playthroughs with enemies, switches, hazards and timing active.
- The new enemy timings exposed a limitation in the greedy test pilot: it could arrive on the final pulse ledge too late to leave. The pilot now retries earlier input choices, with a bounded search and fresh-input replay. The platforms and their timing were not changed to satisfy that check.

`docs/bats/cave-placement.png` is an offline render of the actual scene meshes, skinned model and source texture images at the first encounter. It confirms orientation, scale and placement. It approximates lighting and does not validate browser shaders, real-phone rendering or performance.

`docs/bats/charge-echo.png` captures a natural charge at the first island with the supplied rig, a readable turn toward the player and three directional clay waves. Reproduce with `REVIEW_LEVEL=2 REVIEW_BAT_CHARGE=1 node scripts/export-citadel-scene.mjs OUTPUT_DIR 28 2.6`, then the offline renderer. The model keeps a slight camera-facing bias so its eyes and wings remain readable; its projected bearing matches the locked dive lane. `docs/canyon-direction-signs.png` shows the two former floating arch signs mounted on their ledge. These are offline composition checks, not device screenshots.
