# Reference-based moving platform

The moving decks share `dist/moving-platform.js` across canyon, forest, cavern and citadel lifts, including the citadel counterweight. The supplied image informed the stout orange timber, flowing grain, wraparound brown straps, gold studs and stars, red rope medallions, wooden suspension eyes and two-strand honey ropes.

The timber top remains at the existing landing plane. Movement, routes and collision data are unchanged. Great Arch upper ropes retain their fixed world-space ceiling attachment, while the hardware and medallions travel with the deck. Shared clay materials participate in the existing streaming lifecycle.

`reference-review.png` is an offline Blender render of exported runtime meshes, not a browser screenshot. Its studio lighting and fine surface noise approximate the game's clay shading. Export with `scripts/review-moving-platform.mjs`, then render with `scripts/render-moving-platform.py` in a separate background Blender process.

Validation: the full `package.json` check command passed, including all four chapter playthroughs. Scene checks were repeated after the final grain and rope geometry refinement. GPU appearance and device performance were not tested.
