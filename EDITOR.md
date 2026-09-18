# The clay workshop

Open **Level editor** on the title screen, or **Edit this chapter** from pause. All four shipped chapters can be edited in their actual Three.js environment; The Soft Dream joins the list once it has been unlocked with `ß` in the chapter menu.

## Design controls

- Tap an object, then drag it. Round handles resize platforms horizontally.
- **Add → Wall block** places a solid block in any chapter. Set Width and Wall height in Properties, or use the edge handles. Top Y is the upper edge; height extends downward. Walls block movement from both sides and below, support landing on top, and stop Echo Spitter shots. Use them for barriers, room boundaries and ceilings.
- Drag empty space or use Pan to move the camera. Pinch with two fingers, scroll a mouse wheel, or use the zoom buttons.
- Drag the chapter overview or select a passage to travel through a level. Browse objects provides a non-canvas selection path, including the player start.
- Properties expose coordinates, platform width, moving-platform travel, timing, switches, counterweights, wind forces, enemy patrols and presses.
- Add places an object at the center of the view. Duplicate, Delete, Undo and Redo support iteration. The player start, starting platform and sole finish are protected against deletion.
- Snap, Move contents and Jump guide are in More. Moving contents carries nearby beads, flowers, enemies, switches, springs, decoration and the spawn with their supporting platform.
- Matching circuit names connect the existing simulation systems. Existing authored cable routes remain intact; newly connected devices gain cables. Moving or resizing the finish updates the bell and completion boundary.

## Decorating

**Decorate** in the tool bar switches to the chapter's scenery layer. It is a separate layer of the same chapter, edited with the same tools: tap a prop to select it, drag to move, drag either round handle to resize it about its own centre, and Add offers a palette of shapes instead of platforms. Undo, redo, duplicate, delete, nudge keys, snapping, Browse and Test all behave as they do for gameplay objects.

While decorating, the beads, enemies and hazards stay drawn faintly but cannot be selected, so a tap never has to choose between a prop and what is behind it. The sparse foreground props each chapter grows on its own also become visible and hold still — during normal editing they are hidden, because a prop that fades out under whatever the cursor is over is a prop nobody can position.

### The scenery a platform carries

**Everything you can reach is outlined.** A landmark stands two to five units above the deck that owns it, so the deck's own thin hit line is nowhere near the prop being looked at; decoration mode draws a dashed box where each prop actually stands and a tap anywhere inside it selects the platform that carries it. The deck line still works and still wins ties, so it stays the precise way in where props overlap. What has no outline has nothing to select — that is how the cacti, moss and checkpoint trees, grown from a platform's own geometry, are told apart from the landmarks that are real data.

Dressed platforms are sparse — the canyon has eight across 282 units — so panning is a poor way to find them. **Browse** lists every one by its prop ("Windmill on windwell", "Camp tent on arch-entry") alongside the props you have placed, and jumps straight there.

The panel offers that platform's landmark and its `house` / `arch` / `entrance` / `rest` flags, and nothing that would change the route: the deck cannot be dragged, resized, nudged, duplicated or deleted from here, and its position, width and mechanism stay in Select mode.

A landmark streams and moves with its platform. Choosing **None** takes it away; choosing another name replaces it. The same name is labelled as the chapter actually builds it, because the art differs: `arch` is a stone arch in the caverns and the canyon's camp tent, `sandwheel` is a windmill everywhere except the canyon, where it is the eroded sandstone basin.

Two chapters do not let the name decide, and the panel says so rather than offering a choice it cannot keep:

- **Ember Caverns** keys seven arrangements off the platform's own id, not off the landmark's name. There the control is a single switch that turns the deck's story piece on or off; which piece it is comes from the deck.
- **The Hanging Quarter** does the same for its laundry courtyard, and ignores a landmark entirely on the two decks that tell their story through props.

A finish platform builds its own bell and frame, so it carries no landmark of its own.

Not every existing decorative element is reachable this way. The moss caps, the tree on each checkpoint deck, the mushrooms, crystals and torches are computed from a platform's width and position when the chapter is built, so they follow their platform but are not individual props; the parallax crowns, cave chambers and canyon skyline belong to the backdrop layers. Those would each need to become authored data before they could be selected.

Every prop carries five properties beyond its position:

| Property | Meaning |
| --- | --- |
| Decoration | Which shape, from the palette its chapter offers |
| Size across | The width of the silhouette in world units — the same measure for a pebble and for the castle |
| Depth | Signed: below zero sits behind the platforms, above zero in front of them |
| Turn | Spins the prop about its own upright axis, in degrees |
| Lean | Tips it sideways, in degrees |

The palette is per chapter, because a prop is one of the shapes the game already knows how to build and some of those belong to one biome's models. Seven shapes — boulders, pebbles, a rock shelf, a clay pot, a torch, a tree and a cloud — take the chapter's own palette and are offered everywhere; the canyon adds its arches, summits, cacti, tents and cave mouth, the Wildwood its mushrooms, blooms, crowns, groves and falls, Ember Caverns its crystals, amber mushrooms, moss and grotto rock, and the Hanging Quarter its cottages, laundry, doorways and the skyline castle.

### The horizon

**Add** offers the same shapes twice: once as props, and once under **On the horizon**. A horizon piece is the same catalogue entry standing in a parallax layer instead of the playfield, which is what lets a chapter's far scenery be authored rather than only grown in code.

It carries one property decoration has no equivalent for:

| Property | Meaning |
| --- | --- |
| Distance | How far away the piece is, from 0.05 in the far sky to 0.95 almost in the playfield. It decides how fast the piece crosses the frame and how long it stays in it |

**Position X is the world x the piece is centred on.** That is the only number worth authoring, so it is the one stored: when the camera reaches that x, the piece is exactly there, and either side of it the piece drifts past at the rate its Distance sets. Everything else reads as it does for a prop, except that Depth reaches much further back — to sixty units, because the canyon's own far skyline stands at fifty-three and the caverns' veil at fifty-nine, and a list that could not reach them could not hold the scenery it exists to stand beside.

Two things follow from a piece being genuinely far away, and both are the parallax rather than a rough edge. **A distant piece answers a drag slowly** — moving it one unit across the frame moves its authored x by one unit over its Distance, so the far sky needs a long drag. And its height follows the camera the way the rest of its layer does, so a piece is framed against the ground it was placed over rather than pinned to it.

A horizon piece is built with its chapter instead of streamed, because at a low Distance it is in frame for a hundred units of travel either side and a window drawn around its own x would bring it in and out in the wrong places. Each Distance costs one parallax layer, however many pieces stand at it, and an authored piece never tiles — the repeating skyline fields the chapters grow are a separate thing, and they stay in code.

**Decoration is scenery and nothing else.** It is never a collider, never a collectible, never a checkpoint and never reaches the simulation as anything a player can touch, so there is no way to make a chapter unplayable with it. A placement names one of the game's shapes rather than carrying geometry, and an unrecognised name is refused on import instead of being carried. A chapter with no decoration keeps the layout version it had, so adding this layer retires nobody's checkpoints; moving decoration afterwards does revise it.

The top **Test** button starts at the chapter spawn. A selected platform offers **Test from this platform**. Both run the real platforming simulation, then **Back to editor** restores the unchanged draft, selection, undo history and camera. Test checkpoints and results do not update campaign progress or records. The jump guides also sample the real simulation with full running speed and jump held; they show the initial mechanism state, not a guarantee through every moving phase.

## Saving and sharing a design

Changes save automatically to this browser/device. Regular Play initially uses the saved edited chapter. In **Chapters**, use **Play updated original** to play the latest shipped design without deleting the draft, or **Play your edit** to return to it. The chapter card shows **Original** or **Your edit**, and this choice is remembered after refreshing the page. Returning from the editor selects your saved edit again. Custom best scores and checkpoints are isolated from original chapter records. Each design has a content-derived layout version so stale checkpoints cannot resume into revised geometry.

**More → Export level backup** downloads a JSON file. **Import level backup** loads it into its matching chapter, with Undo available for the replacement. Files are checked for schema, numeric bounds, unique IDs, object limits, matching chapter and base layout. Original environment assets and executable game code cannot be replaced by imported data.

Older drafts retain their own enemy placements, including the canyon’s pre-Drifter roster. To see the four current Dust Drifters, select the updated original canyon; this does not rewrite customized enemies or platforms.

**Restore original chapter** requires an in-editor confirmation and removes that chapter's saved customization. Export first to keep it. If browser storage is unavailable or full, the editor retains changes for the session and displays an explicit request to export; it does not claim that they were saved.

### Permanent changes for everyone

The hosting can support this, but this version remains a static game with device-local drafts and no editor password. Shared publishing would add a small server component and persistent D1 storage for validated chapter revisions. Public play would load the latest published revision, with the bundled chapters as the initial defaults. A password-checked server session would protect editor writes and publishing; a password hidden in JavaScript would not provide access control.

The recommended flow is **Edit → Test → Publish changes**. Drafts remain separate until publishing, and prior revisions support rollback. Publishing changes a chapter's layout version so existing checkpoints cannot place players inside moved platforms. The public game can stay open while the editor and all write endpoints require the editor session. No shared storage, password or global publishing action has been enabled in this update.

## Keyboard

| Control | Action |
| --- | --- |
| Arrow keys | Nudge selection; pan when nothing is selected |
| Shift + arrows | Nudge one unit |
| Space + drag | Pan |
| Ctrl / Cmd + Z | Undo |
| Ctrl / Cmd + Shift + Z, Ctrl + Y | Redo |
| Ctrl / Cmd + D | Duplicate |
| Delete / Backspace | Delete selection |
| Escape | Close a workshop panel or clear selection |

Arrows, duplicate, delete and undo work on a selected prop exactly as they work on a platform.

## Architecture and verification

- `editor-model.js`: validated data, draft persistence, transformations, connection repair and bounded undo history. The horizon is a list of its own beside decoration, bounded and counted separately, and both stay outside the gameplay lists.
- `decor-kinds.js` also holds the horizon's bounds and the small amount of parallax arithmetic the editor and the frame have to agree on: where a piece sits inside its layer, and where that puts it for a given camera.
- `decor-kinds.js` / `decor.js`: the decoration and landmark catalogues as data with no renderer in them — including which chapters key scenery off a platform's id rather than its landmark's name, which `story-landmarks.js` reads from the same table — and the builders that turn a placement into geometry from the chapter's existing shapes and supplied models.
- `editor.js`: touch/pointer/keyboard tools, inspector, overview, overlays and simulation-sampled jump guides.
- `editor.css`: responsive desktop inspector and mobile bottom sheet, 44px touch targets and safe-area handling.
- `levels.js` / `simulation.js`: optional level definitions are cloned into fresh runtime instances; original authored levels remain unchanged.
- `world.js`: editor camera and streamed foreground refresh preserve loaded model resources and the background.

`npm run check` covers the original platforming gate plus completion records, draft round trips, import rejection, protected anchors, connected mechanisms, save failure, real simulation loading, camera projection and model-resource retention. DOM integration uses LinkeDOM with the actual app/editor/simulation modules; canvas rendering, audio and frame scheduling are replaced. It exercises pointer drag/resize, mobile pinch/pan, properties, palette actions, history, modal focus, testing/return, saved custom play and completion navigation.

Decoration is checked on all three levels. `tests/editor.mjs` places every catalogue shape, checks its defaults and per-biome palettes, carries a prop with its platform, walks the real simulation through one to confirm it is not a collider, round-trips it through export and import, and refuses unknown shapes, out-of-range placements, over-long lists and a decoration field with no shape. `tests/editor-ui.mjs` drives the toggle, the mode's own palette and browse list, the properties form, a pointer move and a handle resize with live preview, history, duplicate/delete, a playtest and return, the mode boundary in both directions, and saved play. `tests/scene.mjs` builds every palette shape in its own chapter against the real models and asserts exact placement, that Size across is the measured width of the silhouette within clay relief, the backdrop shadow budget, root turn and lean, streaming in and out without disposing a shared model, and that decorating restores the foreground props opaque and placed against the editor camera.

Landmarks are held to the same three levels. Every name authored in the five chapters must be one the catalogue knows; the authority rules are asserted against the actual deck-keyed tables rather than a copy of them, so they cannot drift from `landmark()`; and every name the workshop offers is put on a real bare deck in every chapter that offers it and must add geometry, with clearing it restoring the deck exactly. The outlines are measured rather than guessed: the same check asserts each built prop sits inside the box the workshop draws for it and reaches its top, so an outline cannot drift away from the thing it outlines. Tapping the windwell's windmill must select the windwell, and must not do so outside decoration mode. The panel's limits are checked too: no route fields, no jump guides, a tap that selects but pans, and refused copy, delete and nudge.

No browser was opened for this task. GPU appearance, responsive visual composition, native downloads and real mobile touch feel still need live-device verification. DOM/event and CPU scene tests are not browser or screenshot QA.
