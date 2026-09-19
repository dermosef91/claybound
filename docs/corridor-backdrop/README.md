# The Breathing Corridor — one cavern wall, kept to its own section

The corridor's far scenery is the supplied crimson cavern
(`dist/assets/dream-cavern.glb`). It was laid nine times: a near rank of four
slabs 52–64 across at parallax ×.45 and a far rank of five 22–28 across at
×.22, overlapping by a third so they would read as one continuous wall. On
screen the overlaps read as the same shape stamped three deep, and at those
slow factors the slabs stayed in frame for about 70 units either side of their
places — the Upside-Down Orchard's last stretch and the Colour River's entry
deck were both played in front of the crimson wall instead of their own skies
(`before/orchard-exit.png`, `before/river-entry.png`).

What shipped (`dist/dream/corridor.js` `backdrop`): **one slab, 44 across, on
the corridor's middle (chapter x 323.5) at ×.8**, retired with `until` at the
section's end. The frame is 20.6 wide at 16:9, so a slab W across at factor f
is out of frame once the camera is (10.3 + W/2)/f from its place — 40 units
here, against a corridor 83 long. The wall slides in from the right as the
player steps in from the Orchard (`after/corridor-entry.png`), fills the frame
through the middle thirty units (`after/corridor-middle.png`,
`after/windpipe.png`) and has left by the left edge before the exit deck
(`after/corridor-exit.png`). Neither neighbour sees it any more
(`after/orchard-exit.png`, `after/river-entry.png`).

Not changed, and now visible: the neighbours' own backdrops reach into the
corridor the same way — the Orchard's clouds and ribbons behind the slab at
the entry, the river's lavender pillars, hills and bullseye behind the windpipe
(`after/windpipe-squeeze.png`, `after/corridor-exit.png`). The crimson wall
used to cover them. Their layers run at ×.12–.42 with no `until`, so they
linger 60–100 units past their sections; confining them is the same job in
`dist/dream/orchard.js` and `dist/dream/river.js`.

Frames are `scripts/review-dream.cjs` captures at 1664×936
(`SECTION=orchard|corridor|river` and `SPOTS=windpipe,windpipe-squeeze`).
