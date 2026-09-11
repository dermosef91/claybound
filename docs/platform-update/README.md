# Platform and HUD review

These are offline renders of the shipped Three.js meshes and embedded source maps, using the scene export and Mitsuba tools. They approximate lighting; they are not browser screenshots.

- `forest-target.png`: the supplied orange target pad is fully above the supporting platform; collectible beads share the completion artwork’s rolled rim and central dot.
- `beads-health-fractured-clay.png`: close-up of the actual bead, two filled and one empty health clump, and a weakening two-layer platform. The second visual pass rounded the slab edges and softened the health material.
- `falling-fragments.png`: the same platform after its collision becomes inactive; individual chunks separate and smaller shared particles fall away.
- `press-floor-contact.png`: the press head at the bottom of its cycle while its housing stays fixed. Player position in this diagnostic is set near the mechanism; it is not a gameplay capture.
- `single-cottage.png`: the larger Counterweight Court cottage is retained and the smaller duplicate is absent. CPU scene checks also verify that Laundry Switchbacks contains only its front checkpoint flag.

Validation: the full check suite passes, including all four input-driven chapter completions, 207 traversal checks, press floor contact/damage/hold/release, crumble lifecycle, spring contact and exposure, shared asset survival, editor operation and responsive health-overlay coordinates. After the final rounding pass the full scene/streaming checks were repeated. GPU shader output, real-device touch feel and performance remain unverified.
