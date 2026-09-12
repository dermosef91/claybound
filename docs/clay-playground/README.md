# The Kneading Quarter

Open **Chapters → Clay playground**. This is an independent copy of Hanging Quarter with a new five-station workshop at the entrance. The full original route follows the workshop, shifted 120 units to the right. Its rooftops, enemies, flowers, counterweights, checkpoints and finish bell are retained.

## Try the experiments

| Station | Shape | Input |
| --- | --- | --- |
| Lower the lift | Shorten and broaden a blue support to lower its hanging deck | Drag down or stomp the support |
| Stretch a ramp | Stretch a block into a curved, walkable ramp up to the next roof | Drag right |
| Widen the landing | Spread the cap of a narrow pillar across a spike gap | Drag either side outward |
| Wall into stairs | Pull a tall wall into three rising steps | Drag right |
| Press a bridge | Flatten a tall orange block into a bridge across a spike gap | Drag down or stomp the block |

**Hold E** or the **KNEAD** button is an alternative for every station. Dragging backward reverses the shape. **R / Reset** returns the player to the station's safe dock and reforms its original shape. Each stomp presses the support or bridge halfway. Use **Stations** in the shaping panel, or **Pause → Choose a shaping station**, to jump between experiments without clearing their shapes.

Movement, jump and stomp retain the game's existing keyboard and touch controls. Shaping pauses with gameplay. Deformation and collectibles survive deaths within the current playground run. Starting over or reopening the playground starts fresh. Playground activity does not write campaign checkpoints, best records, chapter selections or editor drafts.

## POC boundary

These are authored, reversible transformations, not arbitrary terrain sculpting or a general soft-body solver. Mesh vertices and collision surfaces share the same continuously changing dimensions; the ramp uses a smooth profile, the landing keeps a tapered support, the stairs expose separate collision surfaces, and the lift follows its support's deformation. A player riding deforming clay moves with it. Existing clay textures and city assets are reused; no generated or downloaded assets are required.

The playground camera is wider so the player can see the experiment and its destination together. The original campaign camera is unchanged.

## Verification

- `node tests/shaping.mjs`: five reversible shapes; pause; walking the ramp without jumping; passenger carry; checkpoint recovery; stomp activation; continuous deterministic workshop playthrough using 3,407 input frames without deaths or position edits; source/campaign isolation.
- `node tests/shaping-views.mjs`: intermediate mesh poses, finite positions/normals, reused vertex buffers, cap/collider agreement and tapered pillar sides.
- `node scripts/review-clay-playground.cjs`: isolated Chrome session; chapter entry; pointer dragging all five shapes; keyboard traversal, E/R, on-screen hold, pause/resume, campaign save isolation, landscape/portrait screenshots and browser errors. Requires the local server on port 5174 and the bundled Playwright runtime.
- `check-results.txt`: full repository check output for this iteration.
- `browser-results.json` and the adjacent PNGs: browser checks and representative before/after states. These are local Chromium checks, not physical-device performance measurements.

Implementation: `dist/routes/clay-playground.js`, `dist/shaping.js`, `dist/shaping-views.js`, `dist/shaping-controls.js`, and `dist/shaping.css`, with small integrations in the level loader, simulation, world, app and stylesheet entry point.
