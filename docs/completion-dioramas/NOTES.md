# The level-complete dioramas

The five level-complete screens were pre-rendered WebP plates
(`dist/assets/completion/{canyon,forest,cave,citadel}.webp`, with the Soft
Dream borrowing the citadel's). They are now live 3D scenes drawn on the game's
own canvas by `dist/completion-scene.js`, composed per chapter in
`dist/completion-dioramas.js`, and built from the chapter's own supplied models.

The plates are still in the markup and still shipped. `completionMarkup` emits
them exactly as before; `body.has-completion-diorama` is what hides them, and
that class is only set when a diorama actually built. No WebGL, or a chapter
whose models never arrived, and the screen is the poster it always was.

## What each one is

Every chapter is photographed the same way, to a set of supplied target renders
(2026-09-18): a low lens almost level with a wide stage, the hero centred on it
with both arms up, the gate they have just rung immediately to their right, and
behind the stage's far lip the chapter's own country out of focus. The stage
and everything on it draw sharp; everything past the lip is drawn to a half-size
target and blurred across and down (a separable Gaussian, two passes) before
the stage is drawn over it. The cheer is a layered pose — both upper arms
turned up about the character's forward axis after the mixer has written its
frame — so the idle keeps breathing under it.

Over a diorama the overlay is composed as a stage too: the buttons stand in a
column at the top centre, the wordmark and results keep the left, and the
top-right note gives its corner to the sky. All of that is gated on
`body.has-completion-diorama`, so the painted-plate fallback keeps its old
layout untouched. (The rise animation owns `transform`; the buttons are
centred with `left`, not `translateX`, for that reason.)

| Chapter | Stage and country | Supplied models used |
|---|---|---|
| 01 Sunbaked Canyon | terracotta plateau with strata, cacti, a pot; the caravan banner on a ledge left; the Great Arch behind the buttons, mesas each side, one flagged | `canyon-arch`, `canyon-summit`, `canyon-cave`, `canyon-tent`, `cactus`, `cloud` |
| 02 Wildwood | grass stage with leafy bushes on its lip, two toadstools, daisies; the living tree's trunks at the left edge and a crown of leaf masses across the top; falls between groves; groves adrift | `forest-grove`, `forest-waterfall`, `forest-falls`, `forest-hills`, `forest-canopy-distant`, `forest-hero-mushroom`, `forest-bloom`, `cloud` |
| 03 Ember Caverns | dark stone stage edged in blocks; cyan crystals and amber caps each with a lamp; ledges behind carrying dozens of small caps; stalactites over the top and shafts of pale light from the upper right | `cave-crystalcap`, `cave-grotto`, plus `caveRock`/`caveCrystals`/`caveMushrooms` |
| 04 Hanging Quarter | blue clay stage edged in big cream cubes, the laundry line and cacti; blue towers with green tops, trees and pennants standing out of cloud, an arch among the near ones | `castle`, `city-laundry`, `cactus`, `cloud` |
| 05 Soft Dream | the same stage in the dream's clay, flowers on it; the parade behind, two planets and a sun | `dream-giraffe`, `dream-sculpture`, `dream-hat`, `dream-flower`, `dream-planet-mint/raspberry`, `dream-saucer-mint`, `dream-sun` |

Three things this second pass taught, to add to the list below: a point light
bright enough to read as "hot" saturates under ACES (the kiln's mouth went
cream, the cave's crystals went white — the additive halo quads did as much
of that as the light); the view clones every material the level already has,
so a `if(!w.mat.x)` guard for a chapter-specific clay never fires once that
chapter has been played — replace outright; and the citadel palette has no
green, so its towers' grass is a material the diorama makes for itself.

## The two tools

`scripts/review-completion.cjs` drives the real game to each chapter's
completion screen in Chrome and screenshots it with the overlay on top — the
wordmark, the results and the buttons are half the composition, so a capture
without them says nothing about whether the diorama is framed.

    node scripts/review-completion.cjs                  # all five, desktop
    node scripts/review-completion.cjs 0 4              # only those chapters
    COMPLETION_ROUND=7 node scripts/review-completion.cjs
    COMPLETION_PORTRAIT=1 node scripts/review-completion.cjs

`scripts/frame-completion.mjs` solves the composition against the real
asymmetric frustum, forwards and backwards.

    node scripts/frame-completion.mjs desert --slots     # every slot's world position
    node scripts/frame-completion.mjs desert 0.46 0.83   # ground point at that frame position
    node scripts/frame-completion.mjs desert at 0.38 0.46 34
    node scripts/frame-completion.mjs desert -12.7 3.6 -11.5   # where that point lands

It exists because this frame cannot be reasoned about by eye, which cost two
rounds before it was written. See below.

## What the rounds actually taught

Ten capture-and-look rounds. The four things that mattered, in the order they
were learned:

1. **The frame is not a side view and cannot be estimated.** The camera looks
   down a diagonal, so a mass far to −x *and* far back draws on the **right**
   of the picture. The Great Arch at `x −7 z −20` landed at 64% across, dead
   behind the gate, and spent rounds 1 and 2 hiding there. Round 3 replaced
   guessing with `frame-completion.mjs` and the arch appeared immediately.

2. **The gate is much wider than its timbers.** Its finish flag reaches 3.3
   units past its own centre and its crest 4.4 up. Any gate centred much beyond
   `x 2` puts its flag through the right edge — which it did in four of the five
   chapters in round 1.

3. **Depth makes something monumental; size only decides whether you can see
   past it.** At the landmark's depth the frame is about sixteen units tall, so
   a landmark wants to be **8** units high, not the 16–30 that "monumental"
   suggested. Round 3's landmarks were all walls with the sky bricked up behind
   them: the canyon lost its horizon, the castle became a blue cliff, the
   giraffe an unreadable blue mass across the top of the frame. Round 4 halved
   everything and pulled the fog in to 20, and all five chapters got their sky
   and their aerial perspective back.

4. **A cave has no sky.** The Ember Caverns read as objects floating in blue
   mist until its sky dome and fog were darkened to the same near-black navy
   (round 6), so the gaps between the rocks became depth instead of daylight.
   Its kiln then took three more rounds: as a ring on a sphere it was a
   porthole, and lit brightly enough to "look hot" it blew out under ACES to a
   flat cream disc. It reads now as a squared mouth in a hillside with the melt
   banked inside it, lit at a fifth of the intensity, and moved to a slot of its
   own at 50% across — the shared landmark slot sits under the wordmark, which
   a tall bright landmark survives and a low lit one does not.

Smaller ones worth not relearning: `w.pot` takes `(parent,x,y,scale)` and a
fourth number passed as a depth becomes the scale — a 2.4-unit pot that
eclipsed the whole gate for two rounds. A footing lip stone in the island's
*body* clay is a darker orange in the canyon and the deep blue of the cliffs in
the quarter, where it reads as a hole punched in the deck. And anything that
does not read at this scale — a counterweight tower, a gondola on a long cable
— is better removed than argued with: both were, and both chapters improved.

## Portrait

Portrait cannot hold this panorama at the same scale: a 430-wide frame has
about a third of the horizontal field, and fitting the arch, the gate and the
hero all at once left the hero at five per cent of the picture. It crops the
landmark instead and keeps the figure — further back than landscape, on a wider
lens, framed so the island's broken underside mostly leaves the bottom of the
frame where the buttons sit.

## Cost

Per chapter, in its own diorama: 110–560 meshes and 190–250 draw calls, with
geometry shared with the chapter that is still built behind the screen.
Dioramas are built on first use and kept, so replaying a chapter re-shows its
scene immediately.
