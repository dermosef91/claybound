# Claybound — design review: the ten changes that would matter most

13 September 2026 · Full pass over the shipped game in `dist/` (four routes, simulation rules, HUD/menus, audio, art direction, editor) plus the live captures in [`docs/playtest-2026-09-11/`](../playtest-2026-09-11/PLAYTEST.md).

**Scope.** This is a *design* review, not a code or performance review, and not a bug list. Every item below is a content, systems, art-direction, audio or player-experience change. Nothing here is a refactor, and nothing here is blocked on a technical problem.

**The headline.** Claybound is already a good-looking, well-behaved platformer: the movement rules are generous and correct (coyote time, buffering, variable jumps, carry, invulnerability), four chapters are traversable with no progression blockers, and the clay art direction is coherent and distinctive. What it is missing is not polish — it is *stakes and growth*. The player's abilities in minute one are the player's abilities in the last minute; the four chapters are four separate demos rather than a rising arc; every chapter ends with the same bell; and nothing the player collects, times, or masters is ever answered by the game. The ten items below are ordered by how much each would change a first-time player's experience.

---

## 1. Ship clay shaping in the actual chapters

**What's there now.** The game is called Claybound. The title screen says `EXPLORE · SHAPE · DISCOVER · REPEAT`. A complete, collision-accurate deformation system exists — `dist/shaping.js`, `dist/shaping-controls.js`, five authored stations with distinct gestures (press down, pull right, pull outward), drag-on-canvas *and* keyboard `E`/`R` *and* stomp-to-shape input, a progress meter, reversibility, and save-safe bounded poses.

**The problem.** `grep shaping dist/routes/*.js` matches exactly one file: `clay-playground.js`, a copy of chapter four reachable only from a list at the bottom of the Chapters dialog. The four real chapters never use it. So the player's verb set — run, jump, hold-jump, stomp, drop-through — is identical at minute 1 and minute 30, and every chapter's novelty is external machinery the player merely *stands on*: a valve opens a windwell, a beam lowers, a ferry drifts. The player is a passenger in a game about shaping clay.

**What to do.** Promote shaping to the chapter spine, one context per chapter, in the four-beat structure `DESIGN.md` already commits to:

| Chapter | Shaping beat |
|---|---|
| Canyon | *Establish.* One short ramp the player must stretch to cross — taught in a safe alcove with no fall. |
| Wildwood | *Elaborate.* Widen a landing mid-climb; the shape you leave decides whether the return route exists. |
| Caverns | *Surprise.* A wall you knead into stairs — but the press cycle resets it, so shape *and* timing must agree. |
| Hanging Quarter | *Mastery.* Press a bridge while riding a counterweight: the finale asks for shaping under pressure. |

The five playground stations are already exactly these shapes. This is the single biggest available change, and most of the work is authoring, not engineering.

## 2. Make mechanics compound, and make the last chapter the hardest

Each chapter introduces mechanics and then discards them. Platform kinds by chapter:

| Chapter | Kinds used | Enemies |
|---|---|---|
| Canyon | stone, ledge, lift, **switch**, **crumble**, bridge, **wind** | 4 drifters |
| Wildwood | ledge, **spring**, crumble, **break**, wind | 4 spores |
| Caverns | **ferry**, **orbit**, **pulse**, **gate**, **press**, timed, crumble ×46 | 4 bats, 3 spitters |
| Hanging Quarter | stone, ledge, lift, **balance**, **counter** | 4 basic walkers |

Chapter four contains no wind, no spring, no crumble, no press, no projectile, and no timed channel — and its only enemies are four generic walkers patrolling 3-unit ranges, strictly less dangerous than chapter three's spitters. The game therefore peaks in chapter three and coasts through its finale. A first-time player's mastery is never tested against everything they learned.

**What to do.** Reserve roughly the last third of chapters three and four for callbacks — wind ribbons over the city's gondola exchange, a crumbling rooftop run, one spitter guarding the belfry — and build the Sky Bell approach out of *four* learned verbs at once. Keep the introductions where they are; add the recombination.

## 3. Give each chapter a climax, and give the game an ending

All four chapters end the same way: walk right, reach the clay arch and bell built by the single `dist/goal.js` builder, ring it. There is no final skill test before the bell — the last platform is usually a rest. Finishing chapter four opens the same `Level Complete!` card as chapter one with one different subtitle (`What a little adventure.`) and a `Back to World Map` button. There are no credits, no epilogue, no reward for 100%, and no acknowledgement that the journey ended.

**What to do.** Two separable pieces:

- **Per-chapter climax.** One authored setpiece immediately before each bell that uses that chapter's verb under pressure: the canyon's sinking sandstone as a chase rather than a route; the tree's crown collapsing behind the player; the caverns' presses accelerating; the belfry's ropeways dropping one by one. Short — eight to twelve seconds each.
- **An actual ending.** A final scene, a credits roll, a "you shaped the whole world" card that reflects the player's totals, and one thing that only exists after the last bell. The rigged walking-caravan boss in `assets/canyon-boss/` (idle / stomp / sweep / defeated clips, 22.7k triangles) is already finished and shelved; its README records that the boss was cut deliberately, so treat it as an option for this slot rather than a regression to undo — but *something* has to happen at the top of the last tower.

## 4. Make collectibles mean something — and make them consistent

Current totals: **203 beads** (54 / 39 / 38 / 72) and **13 flowers** (3 / 2 / 5 / 3). Both README and `DESIGN.md` state "three secret flowers each, twelve total", which no longer matches the routes — Wildwood has two, Ember Caverns has five. Neither collectible is ever spent, unlocked against, or referenced again: `completion.js` prints the counts, the Collectibles dialog prints the counts, and that is the entire economy.

**What to do.**
- Normalise flowers to exactly three per chapter (add one to Wildwood; move two of the cave's five into a bonus objective) so "1/3" reads the same everywhere and the 12-flower promise is true.
- Give flowers a destination: a fifth bonus route, a time-trial mode, the completion paintings as an unlockable gallery, or a hat for the hero. Something must be gated at 12/12.
- Give beads a use — the cheapest good one is a fourth health clump at a bead threshold, which also becomes a difficulty valve for struggling players.
- Show the player *where* they are missing things: per-section flower ticks on the results card, so "I missed one in Laundry Switchbacks" is knowable without a wiki.

## 5. Fix the hero's readability and reserve the palette for meaning

The hero is a featureless orange figure with cream hands, seen in profile or from behind; its face is never legible in play (see any capture in `docs/playtest-2026-09-11/`). In the Hanging Quarter, *every walkable platform top is the same orange as the hero* — the player's silhouette dissolves into the exact surfaces they must read. Orange is currently doing every job in the game at once: the hero, city platform tops, checkpoint flags, the goal arch, forest spring pads, HUD accents. A colour that means everything means nothing.

Related, and the same class of fix: surface grammar changes per biome. "Brittle" is pale sandstone in the canyon, a wooden plank in the forest, and one of forty-six cave variants; meanwhile the caverns' decorative crystals are sharp white spikes sitting on safe floor, which is the universal video-game shape for *lethal*.

**What to do** (art direction, not code):
- Give the hero one accent colour used nowhere else in the game — a teal or ivory scarf/cap — plus legible eyes and a subtle rim light. The player must be the highest-contrast object on screen at all times.
- Reserve orange for the player and *functional* objects only. Recolour the city's walkable tops to a warm cream so the hero pops against them.
- Fix one shape+colour language for each function across all four biomes: brittle always carries the same crack motif, springs always the same bloom, hazards always the same silhouette — and decorative spikes get blunted or pushed behind the walk line.

## 6. Replace the beeps with clay foley, and score the finale

Every sound effect in the game is a synthesised oscillator tone (`dist/audio.js`): footsteps are 145 Hz blips, landings 110 Hz, squish 145 Hz, damage 160 Hz, beads a five-note sine arpeggio. For a game whose entire identity is thumbprints in plasticine, this is the largest gap between what the game looks like and what it feels like. Recorded clay foley — squish, peel, thud, crack, the dry scrape of a sliding block, a real bell — would do more for game feel than any other single change on this list, and needs no new systems.

Also: there are only three unique chapter tracks. `CHAPTER_TRACKS[3]` is `HORIZON_TRACK`, the title theme — the climactic chapter is scored with the menu music. And the sound setting is a single on/off switch, although music and effects already run through separate gain nodes.

**What to do.** Foley pass on the ~20 event types; a dedicated Hanging Quarter track; a short sting for flowers, checkpoints and the bell (currently all three play the identical four-note arpeggio); music/effects sliders in Settings.

## 7. Put someone in the world

There are 19 enemies in the entire game and zero non-hostile characters. Nobody lives here. The Hanging Quarter is a hanging *city* with a laundry model, a cottage with a garden and washing on the line — and no inhabitants. The canyon has a caravan tent nobody camps in. The caverns have elaborate machinery with no operators, and "Laundry Switchbacks" has no laundry visible in play.

This is why the game cannot answer "why am I climbing?" — there is no one to climb for.

**What to do.** A handful of idle clay villagers, one per section, on the rest platforms: a potter at the caravan steps, someone hanging washing in the switchbacks, a machinist at the furnace ferry, a bell-ringer at each goal who reacts when you arrive. One line of text each, triggered on approach, that doubles as directional guidance ("the flower's under the shelf, little one"). The enemy quadruped rig and the player rig, recoloured, cover most of this without new assets.

## 8. Teach the game in its first minute, and make hints answer the current state

Onboarding is four one-line intro cards plus **12 hints across the whole game** (3 / 2 / 5 / 2), keyed only to an x-range and auto-dismissed after 6.5 seconds (`updateHUD` in `dist/app.js`). The very first hint — "Move with A / D or arrows. Hold jump to leap farther." — never says which key jumps. Hints are position-driven only, so they cannot react to progress: the previous playtest caught the Wildwood tree still instructing "stomp the balloon above" after the player had already opened it.

**What to do.** A 20-second opening that names the keys and shows stomp on a safe target; hints gated on channel/latch state so a solved puzzle's hint is replaced by the next move, not repeated; the current objective visible in the pause menu ("Open the second windwell"); and hints that persist while the puzzle is unsolved rather than expiring on a timer.

## 9. Build the World Map the game keeps promising

The completion screen's primary button reads **Back to World Map**. It opens a dialog containing four text rows and a playground link. There is no map. There is also no unlock moment anywhere — all four chapters are open from the first launch — and no visible journey: the HUD's progress bar is an unlabelled fill, and `game.deaths` is tracked at every respawn and then shown to the player nowhere, not even on the results card.

**What to do.** A real illustrated map using the four completion paintings that already exist in `dist/assets/completion/`, with a drawn path between nodes, per-chapter flowers / beads / best time on each node, a stamp when a new chapter opens, and a visible "3 of 4 bells rung" line. Add deaths (or "falls") and per-section flower state to the results card, since the card already rewards speed with a `New best!` — the game encourages speedrunning while showing no timer during play.

## 10. Give the level editor an audience

`dist/editor.js` (41 KB) plus `editor-model.js` is one of the largest features in the project — a real editor with snapping, object browsing, jump guides, playtesting and undo. Almost nobody will ever use it, because:

- it is reachable only from a small corner button on the title screen and a row in Settings;
- you can only *edit the four shipped chapters* — `DraftLibrary` is keyed by chapter index, so there is no blank canvas and no "new level";
- and sharing is a manual JSON file download plus a manual import on the other device. Nobody can play what you make.

For a static, no-build deployment this is a missed multiplier: an editor with sharing is the only part of Claybound with unbounded replay value.

**What to do.** Call it the **Workshop** and put it on the title screen as a peer of Play. Add a blank-canvas level. Add a share link that packs the level into the URL (the deployment is static, so a link is enough — no service required), plus a one-screen "make your first jump" tutorial and two or three seeded community-style example levels to show what good looks like.

---

## Also worth doing (smaller, still felt)

1. **Gamepad support.** There is no `getGamepads` call anywhere. A platformer played on a desktop keyboard only is leaving its best control scheme on the table.
2. **Assist options.** Extra health, slower hazard timing, and infinite coyote time as explicit, guilt-free toggles — the audience for this art style includes young players.
3. **Player-controlled look-ahead.** The camera's `cameraLook` lead in `world.js` follows velocity only; let the player hold a key to pan and see a landing before committing. That, plus a modest zoom-out at spring launches, is the fix for most portrait-framing complaints.
4. **Keep landing zones clear.** Forest foliage over the player's feet and landing edges is still the most common readability problem in the captures.
5. **Update the docs to match the routes.** README and `DESIGN.md` still claim three flowers per chapter and twelve total; the game ships thirteen.

## Suggested order

1. **Shaping in the chapters** (#1) and the **per-chapter climax** (#3, first half) — these change what the game *is*.
2. **Foley pass** (#6) and **hero contrast/palette discipline** (#5) — the largest felt improvement per hour spent.
3. **Collectible economy** (#4) and **ending/credits** (#3, second half) — gives the whole run a payoff.
4. **Compounding difficulty** (#2), **NPCs** (#7), **onboarding and state-aware hints** (#8).
5. **World map** (#9) and **Workshop sharing** (#10) — the retention layer, once the core arc is worth replaying.

Then run a first-time human playtest before touching jump physics or enemy timing. The movement already feels right; the missing pieces are all above the physics layer.
