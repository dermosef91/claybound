# Ember Caverns: depth, moss and clay relief

This documents the scenery and material pass. The subsequent route and enemy redesign is recorded in [CAVERN-GAMEPLAY.md](CAVERN-GAMEPLAY.md), including its current verification results.

The old scene left large empty blue areas between nearly flat columns, with small isolated grotto models. The new composition embeds the supplied Grotto of the Glowing and Crystalcap Cavern models into overlapping rock shelves. Irregular slate columns, rounded ceiling clusters and hanging olive moss frame those formations. Orange mushroom light and cyan crystal light lead the eye through a cooler, hazier chamber.

The playable route, mechanisms, checkpoints, bats and soundtrack remain intact. No additional custom scenery asset is essential for this pass.

## Reference and comparison

| Image | Evidence |
| --- | --- |
| [Target](docs/cavern/target.png) | User-supplied target: irregular rock, embedded glowing plants, moss and layered depth. |
| [Before](docs/cavern/before-device.png) | User-supplied device screenshot of the prior implementation. |
| [Iteration 2](docs/cavern/iteration-2.png) | First volumetric composition; rock was too dark and recesses too sparse. |
| [Iteration 4](docs/cavern/iteration-4.png) | Increased moss and embedded formations; refined slate lighting and blue depth haze. |
| [Final landscape](docs/cavern/final-landscape.png) | Larger and more frequent custom formations, stronger depth separation and reduced surface scoring. |
| [Final portrait](docs/cavern/final-portrait.png) | Same scene and camera rules reviewed in portrait. |
| [Canyon material](docs/cavern/ball-canyon.png) | New surface on warm cliff blocks and a rope lift. |
| [City material](docs/cavern/ball-city.png) | New surface on blue walls; corrected extruded-face seams. |

The iteration images are offline renders of the actual exported game meshes and maps, not screenshots from WebGL. The renderer approximates direct lighting and depth fog; browser shader compilation, exact mobile appearance and frame rate remain unverified. These comparisons support composition and geometry judgments, not a claim of pixel-perfect matching.

## What changed

- Three-dimensional, lobed columns and ceiling rocks replace flat extruded silhouettes.
- Two scales of supplied grotto formations establish near recesses and distant arches. Extra rock hides the models' standalone bases.
- Olive moss covers rock joins and ledge ends. Small stone fragments break the underside silhouette without changing the collision deck.
- Slate/lavender rock, softer ambient fill and blue fog separate planes. Fog spans 28–108 world units from the camera.
- Existing amber/cyan fixtures retain a fixed four-light pool with smooth handoffs. No new light count changes or sudden assignment jumps were introduced.
- Moss is merged by material and background layers wrap around the camera. Streaming and geometry caches remain bounded in all four chapters.

## Why the X marks appeared

The repeated X-like pattern came from the previous cube treatment: its projected face was repeated using mirrored quadrants, while substantial blocks still used the cube's original atlas. That symmetry made its local marks appear as the same stamp across unrelated forms.

The new source is `012544a4-143b-42da-8292-4fcb848aca43.glb`, SHA-256 `820698f25cbe41db380468d37f30f0178a943975817fcc65d015070560130925`. It supplies mesh relief, normal and roughness maps; it does not contain a separate depth map. `scripts/prepare-clay-ball.py` derives height from the authored normal map and mesh residual, removes the sphere's broad curvature, and makes the field periodic without mirrored quadrants. Neutral pigment keeps each world's palette intact.

The old shipped cube and atlas are removed. All constructed blocks now use rounded geometry sculpted with the ball-derived field. The same shared texture supplies finer rest-space detail to other solids and the clay buttons. Imported models keep their original UV maps and authored normals. Cross-world reviews also caught diagonal seams at duplicated corners and long extruded wall triangles. Constructed normals are now welded, the mesh field is filtered to retain broad presses, and extruded city outlines receive shallow depth-only relief. The fine cracks remain in the shading map; thin architectural triangles cannot fold or invert.

## Validation

`npm run check` covers the existing complete playthroughs of all four chapters, 207 traversal trajectories, material provenance and shader assembly, collision margins, shared resources, scenery coverage in both orientations, editor rebuilds, camera wrapping and fixed-budget cave lighting. Separate exports reviewed the new material in the canyon, forest, caverns and Hanging Quarter. The final cave images are at a representative elevated chamber; scene coverage checks also traverse entrances, climbs, district transitions and backtracking.

Rebuild the material with `python scripts/prepare-clay-ball.py PATH_TO_CLAY_BALL_GLB`. Reproduce a landscape cave export with `REVIEW_LEVEL=2 REVIEW_FACING=-1 node scripts/export-citadel-scene.mjs OUTPUT_DIRECTORY 177 10.8`, then render with `python scripts/render-citadel-review.py OUTPUT_DIRECTORY OUTPUT.png` (Mitsuba, NumPy and Pillow).
