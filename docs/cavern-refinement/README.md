# Cavern enclosure and Echo Spitter refinement

The cavern roof sits two world units lower, its stalactites are shorter, and the lower rock bank rises 1.7 units. Continuous rock backing embeds the grotto islands. The dark slate roof and buttresses frame the existing blue crystals and warm mushrooms. These are background changes: route definitions, collision, jump clearance, enemy behavior, projectile rules and machine timing are unchanged.

Echo Spitters now use the latest user-supplied Gloobasnout model and custom skeletal animation, plus the supplied crystal projectile. See `../spitter-assets/README.md` for provenance, runtime preparation and animation limitations. The earlier procedural creature has been replaced.

## Remaining asset gaps

The dedicated Echo Spitter geometry has been supplied and integrated. The Gloobasnout rig now supports a newly authored shuffle and continuous idle/attack animation. A matching modular rock wall/ceiling kit would still improve the cavern reference's rounded rock strata and small-scale surface detail.

## Performance and verification

Static cave descendants reuse local matrices. Conservative per-cell bounding spheres let the renderer skip complete offscreen subtrees. Moving parallax parents are resolved before sampling light anchors, preventing stale fixture locations. No mesh decimation, resolution reduction, reduced lighting, or simulation changes are used.

At the gallery review camera, 628 static nodes avoid local matrix composition; 20 of 31 cells are culled and the visible background traversal shrinks from 678 to 310 nodes. These are scene-work counts, not measured FPS gains. The unavailable game-dev CLI prevented its sealed hardware profiling workflow.

`verification.json` records ten camera checks across landscape and portrait. Each compares the same frame with static-matrix reuse/culling disabled and enabled. All ten output images are pixel-identical, with no browser errors. This verifies the optimization's visual preservation at those samples; it does not establish equivalence at every possible camera or an FPS improvement.

The complete package.json check command passed; see `check-results.txt`.

## Reviews

- `game.png`: actual WebGL gallery scene, without game HUD.
- `cave.png`: isolated cavern backdrop.
- `spitter.png`: actual runtime watch, charge and recoil poses.
- `cavern-target.png` and `spitter-target.png`: user-supplied targets.

Serve `dist`, then open `/cavern-game-review.html` or `/cavern-review.html`. The isolated backdrop uses `/cavern-review.html?cave`. Run `scripts/verify-cavern-webgl.mjs` with Playwright installed (or PLAYWRIGHT_MODULE pointing to its index.mjs); CHROME_PATH and REVIEW_ORIGIN optionally select the browser executable and preview server.
