# Claybound — optional art replacements

The connected mechanics already work with sculpted clay stand-ins. The windmill and forest mushrooms now use supplied models; the golden seed and leafy vine are sculpted in the scene. These two remaining custom models would add the most visual character. Use the new clay ball's fine fingerprints and cracks, with rounded edges and a matte surface. Supply self-contained GLB files with embedded textures; separate animated parts are welcome.

| Asset | Used in | Shape and animation | Runtime fit |
|---|---|---|---|
| Cavern pulse beacon | The Two-Beat Gallery, The Lantern Climb and Mountain Heart | Slate clay drum or lantern with a cream ring and turquoise core | About 1.8 units tall. Origin at base centre; separate core/ring allows the game to signal bridge phases. Optional pulse clip. |
| City counterweight bridge | Counterweight Court, Gondola Exchange and The Sky Bell | Orange clay deck, blue support, cream hanging weights and ropes | Centre pivot at the walkable top; deck nominally 5 units wide × 1.9 deep. Separate deck and weights. The game drives the tilt and raises the linked lift, so no baked travel animation is needed. |

The current blockout art is in `dist/setpieces.js`. These models replace visible props; platform collision, wind force, timers and safe landings remain controlled by the game. No missing model URLs are shipped.

## The Soft Dream (chapter five)

Every creature, statue and piece of furniture in the dream ships as a sculpted clay stand-in built in `dist/dream/*.js`; the collision is always the platform data, so a supplied model only replaces what is seen. All of these are nice-to-have. Colours live in the chapter's palette slots, so supply neutral (cream) albedo where a colour is not named and let the material do the rest; matte clay surfaces, rounded edges.

| Asset | Used in | Shape and animation | Runtime fit |
|---|---|---|---|
| Hat-worm | The Melted Parade (statue and the `hatworm` creature) | A fat segmented worm wearing five stacked hats; hats as separate parts so they can tumble off | Creature about 1.4 wide × .85 tall, origin at the foot centre; statue any size (scaled by width). |
| Petal-headed giraffe | The Melted Parade | Six-legged giraffe with a six-petal flower for a head; neck and head as separate parts so the head can lean toward the player | Body 7 wide × 4 tall stands on the `parade-back` deck; legs reach the ground 4 below. Origin at the body's base centre. |
| Walking teapot | The Melted Parade | Round teapot with a spout, a lid and two boot-like feet; lid separate for a steam beat | About 3 wide × 3 tall, origin at the feet. |
| Doll furniture set | The Infinite Room (pass three) and the dream fragments | A chair, a teacup and a small table at doll scale | Chair 2 wide × 3.2 tall, teacup 2 wide × 1 tall, table 4 × 2; origin at the base centre. The same set is instanced at three scales. |
| Floating eye | The Breathing Corridor walls and the `blinker` creature | Cream eyeball with an iris and a lid; iris and lid as separate parts for tracking and blinking | Creature radius .5, origin at the centre. |
| The dream flower | The Dream Knot's ending | One ordinary clay flower: a stem, two leaves, six petals and a heart, petals as separate parts so they can fold into a lump | About 1 tall, origin at the stem's foot. |

The chapter's only new materials are three glossy stream colours (roughness about .25) and one torus-knot geometry; both are built in code and need no asset.
