# Reference-based title rebuild

Open the game through the existing static runtime (`python3 -m http.server 4174 --bind 127.0.0.1 --directory dist`). The main title remains live Three.js with the original animated player.

`dist/title-assets.js` loads and prepares the user-supplied cactus mesa. The GLB itself is unchanged; a copied geometry receives title-only proportions and smoothed normals. `dist/title-scene.js` positions the character against a raycast on the real upper surface, arranges the canyon/clouds and lights, and composites a softly defocused background behind the sharp foreground. Character presentation scale/yaw are restored when gameplay resumes.

`dist/title.css` supplies responsive reference proportions. Button image assets are generated blank clay surfaces with real DOM labels and library icons. Existing utility controls remain accessible through Settings.

See the root `design-qa.md` for final verification and iteration history, `mesa-provenance.json` for source integrity, and `button-provenance.md` for generated artwork prompts. `comparison-final.png` shows reference left and final browser capture right; detail comparisons and responsive captures are adjacent.
