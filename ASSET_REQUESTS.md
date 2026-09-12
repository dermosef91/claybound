# Claybound — optional art replacements

The connected mechanics already work with sculpted clay stand-ins. The windmill and forest mushrooms now use supplied models; the golden seed and leafy vine are sculpted in the scene. These two remaining custom models would add the most visual character. Use the new clay ball's fine fingerprints and cracks, with rounded edges and a matte surface. Supply self-contained GLB files with embedded textures; separate animated parts are welcome.

| Asset | Used in | Shape and animation | Runtime fit |
|---|---|---|---|
| Cavern pulse beacon | The Two-Beat Gallery, The Lantern Climb and Mountain Heart | Slate clay drum or lantern with a cream ring and turquoise core | About 1.8 units tall. Origin at base centre; separate core/ring allows the game to signal bridge phases. Optional pulse clip. |
| City counterweight bridge | Counterweight Court, Gondola Exchange and The Sky Bell | Orange clay deck, blue support, cream hanging weights and ropes | Centre pivot at the walkable top; deck nominally 5 units wide × 1.9 deep. Separate deck and weights. The game drives the tilt and raises the linked lift, so no baked travel animation is needed. |

The current blockout art is in `dist/setpieces.js`. These models replace visible props; platform collision, wind force, timers and safe landings remain controlled by the game. No missing model URLs are shipped.
