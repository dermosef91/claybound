# Chapter completion redesign

The supplied portrait reference grounds the full-screen result scene: an oversized cream serif heading, orange brush underline, three physical clay rewards, a prominent Next Chapter action, translucent secondary actions and small handwritten notes. On shorter landscape screens, results and actions form two compact columns. Portrait remains a poster-like composition with large tap targets and a visible clay adventurer.

Four original background assets were generated with the built-in image tool, using the attached completion reference and then the approved canyon artwork as visual inputs. Each preserves the rear-view orange adventurer, flag and dark text area while using the game's own biome: sunset canyon, emerald Wildwood, ember-lit cavern, and cobalt cloud city. Bead, flower, stopwatch and brush stroke were generated individually with true transparency. All are encoded as WebP; no UI text or scores are baked into the artwork.

Prompt direction: tactile Play-Doh cracks and fingerprints, matte sculpted surfaces, warm upper-left light, cinematic background depth, celebrating orange hooded figure and flag on the lower right, quiet dark left half for editable cream UI, no text or UI in scenery. Reward prompts specify a gold knob medal, cream five-petal flower with orange center, and cream/orange stopwatch with a northeast-pointing hand. The underline is a single tapered orange swipe.

Typography uses locally bundled, Latin-subset DM Serif Display, DM Sans and Caveat from Google Fonts. Their SIL Open Font Licenses ship alongside the fonts. Navigation icons reuse the game's Lucide bundle. Backgrounds, rewards and fonts are warmed during a chapter rather than blocking the initial game load.

Results use the actual run, not accumulated best collectible totals. The time badge is calculated before a new best is saved; ties and slower runs show the existing best. Comparisons require the same level layout. Reopening the world map preserves the result and badge. Chapter four leads back to the world map; other chapters lead to the next chapter. Restart and map navigation clear completion mode and restore game input correctly.

Verification: completion-record tests and app DOM integration passed. Generated images were visually inspected. Browser rendering and live responsive visual comparison were not performed; no pixel-perfect claim is made.
