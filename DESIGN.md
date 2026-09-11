# Claybound — four focused journeys

## What makes the reference games work

These are selected design case studies, not an objective ranking, and this pass uses published developer accounts and available reference material rather than claiming a new hands-on playthrough of those games.

**Super Mario 3D World — Beep Block Skyway.** A consistent timing rule can produce many decisions: when to leave safety, how many platforms to commit to, and whether to risk an optional reward. The useful principle is progression within a coherent idea. Koichi Hayashida describes Mario's sequence of learning, elaboration, surprise and demonstrated mastery in this [developer interview](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design). Claybound applies that structure to each chapter, especially the cavern's pulse gallery followed by the connected press and relay climb. The inspiration is the structure; no music or level geometry is copied.

**Celeste — its compact climbing rooms and summit progression.** Small, readable challenges make attempts meaningful. An apparent mistake often becomes recoverable movement rather than a long walk back. Thorson's [level-design workshop](https://www.gdcvault.com/play/1024307/Level-Design-Workshop-Designing-Celeste) discusses arranging the mountain's rooms and story. Her [forgiveness article](https://www.mattmakesgames.com/articles/celeste_and_forgiveness/index.html) explains coyote time, buffered jumps and other deliberately generous control windows. Claybound keeps those existing movement affordances, adds lower recovery routes and turns the camera toward leftward switchbacks. Difficulty comes from decisions and combinations, with generous landings.

**Rayman Legends — Castle Rock.** The useful lesson from the [official level presentation](https://www.youtube.com/watch?v=wV-w6crl3-c) is a sequence with a legible physical rhythm: brief preparation, committed action, a satisfying landing, then a new phrase. My design interpretation is that players should be able to anticipate and perform a route. The canyon sand run and woodland canopy use short repeating rhythms, broken by stable islands. This game does not claim to synchronize platform motion to Rayman's soundtrack, or to reproduce its authored music timing.

**Ori and the Blind Forest — Ginso Tree.** A place can become memorable when its systems change the journey through it. Thomas Mahler discusses control feel and the consequences of the flooded Ginso Tree in this [interview](https://www.xboxuser.de/news/exklusives-interview-zu-ori-and-the-blind-forest). Claybound's interpretation is a visible change of state: opening a root seal makes the living tree breathe; its spores then become the way upward. The player creates the route used in the next challenge.

**Donkey Kong Country: Tropical Freeze — its moving environmental setpieces.** Nintendo and Retro describe keeping the core actions while developing new level ideas and using 3D staging to support play in this [interview](https://gameinformer.com/games/donkey_kong_country_tropical_freeze/b/wii_u/archive/2013/12/24/nintendo-answers-our-donkey-kong-country-tropical-freeze-questions.aspx). The relevant judgment here is that scenery should explain movement. Clay cables connect controls to platforms, roofs support balcony routes, and logs connect woodland footholds to trunks.

## Reassessment of the previous routes

The extended routes introduced many mechanics but distributed them across ten similar-length districts. Generous rest floors filled a length budget, height mostly drifted rightward, secrets frequently reused the same two-shelf shape, and mechanisms lived next to one another without affecting one another. Cutting the arrays at 30% would preserve those weaknesses.

The new layouts are authored independently. Their exact horizontal distances are 244.5, 262.5, 289.5 and 300.75 units: 30% of the previous versions. They now have 36, 44, 41 and 44 main transitions, three distinct flower excursions each, and 32 checkpoints in total. No filler floor is generated to meet a distance target. The subsequent cavern rebuild develops its vertical returns and machinery further; [CAVERN-GAMEPLAY.md](CAVERN-GAMEPLAY.md) records that room plan and enemy design.

## The four arcs

| World | Establish | Develop | Change the context | Finale |
|---|---|---|---|---|
| Canyon | A forgiving rope lift and broad sandstone landings | A valve opens a windwell; use the breeze to climb | Sinking sandstone offers a fast upper route and a recoverable lower route; an arch lifts the path vertically | Open the second windwell and combine rising air, ropes and sinking ledges |
| Wildwood | Mushroom launches and descending boughs | Stomp a seal, explore below, then bounce back up | Reverse around a tree; breaking its upper seal releases the spores needed for the next ascent | Bounce high, drop through another seal, then follow its spores to the crown |
| Caverns | Climb and double back to open a ground grate | Steer a ferry through presses; an upper flower route pauses the machinery | Ride rotating cradles to an upper relay, then drop into a sunken switch chamber and return by lift | Use stone cover against projectile shooters, then wake the final bridge from a reversed staircase |
| City | Familiar ropeways and inhabited blue roofs | Lean on beams to charge and permanently raise the connected lift | Left/right balcony switchbacks lead into two opposing gondolas | Raise a final ropeway, reverse around the belfry and transfer between lifts to reach the sky bell |

Flowers ask for three different kinds of commitment across the game: an extra climb with a return, a deliberate drop into a lower pocket, or a detour from a timed route. They never unlock the exit. Short clay arrow signs clarify direction changes without covering the playfield with instructions.

## Environment and readability

The supplied cactus, arch and summit models anchor the canyon. Geometry is retained in the shipping GLBs; texture downloads are reduced from about 17 MB to 2 MB. Runtime background variants continue the lower rock feet down into the canyon. Warm sculpted blocks, segmented lips, wooden lifts, orange star pulleys, blue sky and volumetric ivory clouds follow the target image.

Woodland ledges now read as moss-covered branches with supporting roots, not generic stone platforms. Cavern circuits use illuminated clay cables and the same visible state that controls bridge collision and press movement. City counterweights raise the connected rope decks; charge beads show progress and the route remains raised after leaving the beam. Existing custom character/enemy animations and source-clay surface treatment remain in use.

## Verification and limits

- Real fixed-step trajectories cover all 211 main, optional and recovery links.
- A look-ahead input pilot completes and deterministically replays all four main routes from spawn to bell, with enemies, hazards and timers active, without position changes, resets or direct mechanism activation. Clean traversals take about 55–88 seconds; those are automated execution times, not estimates of a first human playthrough. A second cavern run collects all three flowers, using the foundry's upper shortcut.
- Save/restore checks cover every checkpoint, collected items, opened valves, raised lifts and broken seals. Old-layout saves are rejected before spawning into changed geometry.
- CPU scene checks cover geometry, animation, collision/surface conventions and resource retention while moving forward/backward through every chapter. Actual meshes/textures are exported for offline composition review.
- These checks do not establish live WebGL performance, mobile ergonomics or subjective enjoyment. Those require device playtesting. The source retains targeted tests so feedback can change an encounter without losing the rest of the route.
