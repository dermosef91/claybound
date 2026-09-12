# Claybound — complete playthrough review

11 September 2026 · Current local working tree · Gameplay, visual assets, and level design

The four chapters are traversable and visually cohesive. **The best next pass is clarity and pacing:** keep important landing surfaces clear, make instructions respond to solved puzzles, improve portrait visibility, and give repeated rooms stronger identities. No progression blocker occurred in the completed main routes or final flower routes. These conclusions combine automated traversal with direct inspection of live WebGL screenshots; they are not a substitute for a first-time human player's difficulty assessment.

**Highest-priority findings and improvements**

| Priority | Finding and reproduction | Why it matters | Concrete improvement / owner | Evidence |
|---|---|---|---|---|
| High | At the first Counterweight Court beam, the instruction box sits over the beam's right end, counterweight, and connecting mechanism. | The player must inspect exactly the area the instruction obscures to understand where to stand. | Anchor the instruction above the mechanism or in a reserved clear area; collapse it once weighting begins. Keep the beam, weight, and destination visible together. `dist/app.js`, `dist/style.css`, `dist/controls.css`. | [Counterweight](detail-weight1.png) |
| High | At Wildwood's `tree-heart`, the “roots are breathing” success toast appears while the hint still says to stomp the balloon above. | Successful players are told to repeat a completed action instead of being shown their next move. | Gate the hint on `tree-spores` state. After activation, replace it with “Ride the spores to the right” or dismiss it. Apply the same state-aware rule to valves and relays. `dist/app.js`, `dist/routes/forest.js`. | [Solved tree](detail-tree-heart.png) |
| High | Canyon flower recovery from `sand-return` to `sand-rest` needs an unintuitive takeoff near the lower shelf's left edge. The original complete-flower pilot exhausted its search here; adding left-edge takeoffs completed the whole chapter. | A recovery route should be easier to understand than the challenge above it. Overlapping shelves encourage a jump beneath the solid upper platform. | Extend `sand-return` left, offset `sand-rest` right, or draw a short left-up-right bead arc. Preserve the existing upper crumble sequence. `dist/routes/canyon.js`. This is awkward routing, **not a demonstrated softlock**. | `sand-return`: x117–121, y8.8; `sand-rest`: x118–123, y10.8. [Flower results](flower-results.json) |
| Medium | Portrait views devote significant height to empty sky while the lateral route and destination are clipped, especially at Wind Crown and the Breathing Tree. | Optional routes and upcoming landings are harder to discover; an automatic spring leaves little time to inspect the next platform. | Trial a room-aware framing profile, modest zoom-out at spring launches, and a player-controlled look-ahead. Frame both departure and landing before committing. Do not globally shrink the character without device testing. `dist/camera.js`. | [Wind Crown](portrait-wind-crown.png), [Tree Top](portrait-tree-top.png) |
| Medium | At phone width the flower counter disappears, although secret flowers remain an active objective. | Exploration feedback differs between desktop and phone. | Retain a compact flower icon and count, or expose it in a tappable progress strip; avoid adding another large panel. `.stamp-count` in `dist/style.css`. | [Portrait tree](portrait-tree-top.png) |
| Medium | Forest foliage overlaps the player's feet and landing edges; directional signs can sit beneath higher platforms and among leaves. | The contact point and exact safe platform width become less readable during jumps. | Clear the centre of each landing zone; move flowers toward rear corners; lower front foliage or fade it near the player. Raise directional signs above foliage. `dist/forest-details.js`, `dist/world.js`. | [Brittle Canopy](chapter-2-brittle-canopy.png), [Tree Top](detail-tree-top.png) |
| Medium | Wake the Windwell, Sinking Shortcut, and Sky-Sand Run use very similar windmill/flag/cactus compositions. | Distinct gameplay beats look like repeated sections, weakening orientation and the sense of travel. | Keep windmills at functional windwells; give Sinking Shortcut an eroded basin or broken sandstone landmark, and reserve a strong skyline reveal for Sky-Sand Run. Recompose existing assets first. `dist/canyon.js`, route landmark assignments. | [Windwell](chapter-1-wake-the-windwell.png), [Shortcut](chapter-1-the-sinking-shortcut.png), [Sky-Sand](chapter-1-the-sky-sand-run.png) |
| Medium | Hanging Quarter's functional orange decks read clearly, but Laundry Switchbacks and several rooftop stretches appear sparsely inhabited. The completion art promises a denser castle town. | The final chapter has less environmental storytelling than its room names imply. | Add restrained rear-plane laundry, roofline details, windows, and one distinct civic landmark per section. Keep orange walkable tops unobstructed. `dist/citadel.js`. | [Laundry](chapter-4-laundry-switchbacks.png), [Gondola Exchange](chapter-4-gondola-exchange.png), [Completion](chapter-4-complete-settled.png) |
| Medium | Cavern crystals appear as sharp, bright spikes on safe floor. The imported Spitter also has a detailed crystal silhouette that competes with nearby crystal scenery. | Hazard, enemy, and decoration shape language overlaps. | Put decorative spikes behind the walk line or give them a lower base; reserve a stronger outline and distinct attack flash for threats. Preserve the purple enemy body against the blue cave. `dist/cavern.js`, `dist/spitter-asset.js`, `dist/spitter.js`. | [Gallery](detail-gallery-watch.png), [Cave opening](chapter-3-start.png) |
| Low | Cave rooms repeatedly reuse the same spiral grotto and hanging moss clusters. Forest upper supports include tall, nearly featureless cylinders. | Close repetition exposes the construction kit and weakens hero landmarks. | Vary grotto orientation/scale and silhouette spacing; add selective moss breaks and branch forks to large forest supports. Prefer composition changes over more high-resolution assets. | [Ferry](detail-furnace-ferry.png), [Turning Heart](detail-heart-paddle.png), [Tree Top](detail-tree-top.png) |

These are design priorities, not a list of confirmed critical bugs. The state-inappropriate forest hint and hidden mobile flower count are directly evidenced behavior. Difficulty and discoverability judgments should be validated with new players.

**Chapter-by-chapter level design**

| Chapter / section | Keep | Specific next iteration |
|---|---|---|
| Canyon — Caravan Steps | Clear rightward bead trail, safe starting deck, early moving lift. | Explicitly show the jump key in the first hint; “hold jump” assumes the player already knows it. Introduce the first Drifter with a safe view of its cycle before the landing. |
| Canyon — Wake the Windwell | Valve-to-updraft connection and a vertical flower branch. | Make the valve's cream disc more legible against the deck; show the full launch-to-crown relationship. Give the leftward flower branch its own bead cue. |
| Canyon — Sinking Shortcut | Fragile upper route with a lower catch and optional reward. | Repair the visual guidance on `sand-return` → `sand-rest`. The second half can retain its wind-and-crumble escalation. |
| Canyon — Inside the Great Arch | A quiet break, lift, upper balcony, and flower return loop. | Frame the actual arch around the route rather than letting another repeated distant arch carry the identity. Make the left optional branch and right exit clearly distinct. |
| Canyon — Sky-Sand Run | Combines learned wind, moving-platform, and crumble skills. | Reveal the bell earlier from `sky-rest`; reduce decorative repetition so the last climb feels like an arrival. |
| Wildwood — Mushroom Choir | Automatic target bounce, bead arcs, and high/low route changes. | Visually separate functional orange targets from decorative orange mushrooms. Add a readable compression/rebound cue if the launch still surprises new players. |
| Wildwood — Under the Roots | A deliberate downward route and balloon break that changes the space. | Put the downward bead trail and safe landing in view before the stomp; teach the difference between breaking a seal and dropping through a thin ledge. |
| Wildwood — Breathing Tree | The strongest forest landmark: mushroom, suspended seed, climb, and released spores. | Introduce a wider establishing view; replace the stale post-activation instruction. Break up the plain upper support and uncover the right arrow near `tree-top`. |
| Wildwood — Brittle Canopy | Alternating short-lived decks, a stable pause, and lower recovery. | Preserve the 1.0/.9/.85/.9-second crumble rhythm initially. Improve edge visibility first; then test whether learners can read the warning without memorizing the sequence. |
| Wildwood — Heartwood Bloom | Recombines spring, seal, spores, and crumble mechanics. | Let the final mushroom/bell vista be the reward; avoid another equally dense patch of flowers at the precise landing edge. |
| Cavern — Echo Switchback | Locked ground exit with an upper relay and a separate descent. | Keep the gate/cable/relay in one introductory composition where possible. The first Spitter deserves a safe, visible attack demonstration before players descend near it. |
| Cavern — Furnace Ferry | Weight steering, alternating presses, and a flower route that pauses the presses. | Mark the neutral braking zone on the ferry, distinguish steering from the nearby switch-like cream disc, and make press warning indicators readable from the dock. The optional route's gameplay reward is excellent. |
| Cavern — Turning Heart | Large rotating structure, moving viewpoint, upper dismount, and lower catch. | Highlight the intended exit lip; keep hints away from the catch shelf. In portrait, show more of the wheel and its destination before boarding. |
| Cavern — Sunken Relay | A change of direction, safe lower chamber, return lift, and leftward flower detour. | Give the hatch a unique downward mark and visibly connect the relay to the exit. Keep the reliable return lift: it makes exploration feel recoverable. |
| Cavern — Spitters’ Gallery | Cover → crumble → enemy platform creates a combat-platforming sequence. | Protect the safe observation position and separate the Spitter's attack cue from crystal scenery. Recheck target readability before changing projectile speed or enemy health. |
| Cavern — Last Light | Short return to relays with a pulse-platform finale. | Give the final lit bridge a stronger visual payoff and preview the bell. Avoid adding another long staircase. |
| Hanging Quarter — Familiar Rooftops | Orange tops on blue masonry provide the clearest walkable-surface contrast. | Restore a few rear architectural details to establish an inhabited district while preserving simple foreground collision. |
| Hanging Quarter — Counterweight Court | The beam visibly causes the lift to rise; the first puzzle teaches the chapter verb. | Move the hint, then add clear weighting/latched feedback. Vary the second beam's approach instead of repeating identical decoration. |
| Hanging Quarter — Laundry Switchbacks | Alternating directions and a high flower branch. | Make “Laundry” visible with a small rear clothesline composition; keep the left/right signs above the landing edge and clear of beads. |
| Hanging Quarter — Gondola Exchange | A transfer between paired moving decks changes the rhythm. | Give the meeting point a visual marker and a clear waiting area. Use ropes and axle geometry to explain the paired motion. |
| Hanging Quarter — Sky Bell | Climactic ascent using learned lifts and counterweights. | Add an early view of the final bell/castle silhouette, then make the last safe platform visually celebratory. Differentiate the fourth counterweight from the first. |

**Assets and visual direction**

The player, recessed beads, orange flags, windmill sails, and textured clay decks make a coherent identity. Forest haze separates depth well; the warm torch/cool rock contrast is effective in the cavern. The city has especially clear platform-top contrast. Keep these systems.

Prioritize placement over asset replacement. Forest flowers should frame jumps, not conceal soles. Canyon landmarks need variation more than more polygons. Cavern imported rocks and crystals are visibly more angular and detailed than the soft constructed terrain; adjust their scale, placement, and lighting to bridge that difference. The new Spitter is recognizable in the gallery, but its attack silhouette should be checked at phone size against its own crystal back and nearby spikes.

The live title loads correctly, and the completed result screen has clear next/replay/map actions once its reveal animation settles. The result art is more atmospheric and densely composed than some playable city stretches; use it as a composition target without obscuring the gameplay plane.

No missing model or texture was apparent in the reviewed captures. No failed HTTP responses or uncaught JavaScript errors were recorded during the main browser run. This does not establish asset-download performance on a cold mobile connection. No sound-quality judgment or target-device frame-rate claim is made.

**Coverage and results**

| Chapter | Main run, simulated time | Beads / total | Flowers on main route | All-flower run | Final result |
|---|---:|---:|---:|---:|---|
| Sunbaked Canyon | 55.10 s | 41 / 55 | 0 / 3 | 64.13 s; 42 beads; 3 / 3 | Complete, zero deaths |
| Wildwood | 64.44 s | 37 / 75 | 1 / 3 | 73.07 s; 37 beads; 3 / 3 | Complete, zero deaths |
| Ember Caverns | 87.48 s | 75 / 96 | 0 / 3 | 78.08 s; 73 beads; 3 / 3 | Complete, zero deaths |
| Hanging Quarter | 64.18 s | 67 / 72 | 0 / 3 | 68.23 s; 66 beads; 3 / 3 | Complete, zero deaths |

Times come from a deterministic look-ahead pilot and **are not estimates of first-play session length**. The cavern flower route being faster is consistent with its upper shortcut, but the pilot also chooses different waits, so this is not a controlled shortcut-speed comparison. These are all-flower runs, not all-bead runs.

The main browser traversal covered all 21 named sections and reached all four completion screens. It replayed the recorded movement/jump/stomp inputs against the actual simulation and WebGL world, with hazards and enemies active. Character positions, switches, health, and collectibles were not set to force completion. The pilot searches candidate input sequences using cloned simulations, then deterministically replays the successful route. It has more information and precision than a human player.

A temporary response-only patch to `app.js` exposed test access and disabled the normal animation loop during deterministic replay. The main replay rendered every simulation tick; the detail pass rendered in coarser batches to capture selected mechanics. The shipped app source was not edited for the review. Browser keyboard movement/jump and Escape pause were also exercised through actual input; pause froze simulation time. Desktop captures use 1500×850; portrait captures use 390×844. Portrait is viewport emulation, not a physical-phone playthrough.

Existing checks verified held jumps, coyote time, buffering, braking, stomp, springs, moving platforms, damage, checkpoint recovery, controls, assets, and editor integration. The 211 isolated trajectory checks and 32 checkpoint checks passed. Those isolated crossing tests have different constraints from complete runs, so the complete runs are the stronger traversal evidence.

The initial full regression command stopped at `tests/scene.mjs:443` because it expected the previous three-child projectile shape. The working tree changed during this review: the assertion was updated externally to recognize the imported crystal. The updated scene test passed on recheck, and all six remaining test groups passed separately. Consult [scene recheck](scene-recheck.txt) and [remaining checks](remaining-checks.txt) for final outcomes. This was an asset/test synchronization issue observed during concurrent local work, not a browser progression failure.

The canyon all-flower pilot initially exhausted its search on `sand-return` → `sand-rest`. In the temporary review pilot only, takeoff offsets 3.8, 3.6, and 4.0 were added for this crossing; the run then completed without altering the level or physics. Keep this case in future end-to-end route tests.

Recorded input streams are preserved as compressed JSON alongside this report (`main-inputs.json.gz` and `flower-1` through `flower-4-inputs.json.gz`).

Evidence: [main browser results](live-results.json), [flower results](flower-results.json), [detail capture results](detail-results.json). The renderer counters in the main JSON are sampled after drawing the separate health HUD and therefore describe that final render pass; **do not use them as whole-scene performance totals**. One city portrait capture (`portrait-exchange2.png`) caught an asynchronous resize with the manual render loop stopped. Both a resize-settled redraw and the normal animation loop rendered correctly with no errors: [settled portrait](portrait-exchange2-resize-settled.png), [live portrait](portrait-exchange2-live.png), [recheck results](portrait-recheck.json). This was a capture artifact, not a confirmed rendering defect. Some early completion captures show reveal animations mid-transition; use the `complete-settled` images. A few replay captures also catch transient bead-count animation or player damage flashing; these were not treated as persistent missing HUD/player defects.

**Suggested implementation order**

1. Make hints state-aware and move them clear of active mechanisms; retain the phone flower counter.
2. Clarify the canyon lower recovery jump and forest landing edges; verify the same full routes still complete.
3. Tune portrait framing around springs, the turning wheel, and paired gondolas; test on a physical phone.
4. Recompose repeated canyon/cave landmarks and add restrained city storytelling with existing assets.
5. Run a first-time human playtest measuring missed cues, falls by checkpoint, waiting time, and flower discovery before changing jump physics or enemy timing.

This delivery records findings and proposed improvements. No gameplay, level geometry, or production assets were changed by this review.
