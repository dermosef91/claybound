# Title button artwork provenance

Created 2026-09-12 using the built-in image_gen tool, guided by the user-supplied title-screen reference.

Reference: /var/folders/j4/485vsp3j51978zn1l3rrc7v40000gn/T/codex-clipboard-aaf02e68-2998-4bef-9557-d8d2fa9e805a.png

Selected source: /Users/moritzgrassy/.codex/generated_images/01a092fc-e0ad-7e51-a0e7-dcde2a082f96/exec-ca033830-59aa-4d0a-b356-2a15413863b5.png

Workspace source: docs/title-rebuild/button-atlas.png (1774×887 RGBA)

Outputs:
- dist/assets/title/button-orange.webp — 1060×240 RGBA WebP
- dist/assets/title/button-cream.webp — 1060×206 RGBA WebP

The first generated atlas was selected because it has genuine alpha transparency. Two attempted edge-cleanup generations returned opaque checkerboard backgrounds and were rejected. The original alpha was preserved through Sharp extraction, resize, and WebP conversion (quality 95, alphaQuality 100). Orange extraction rectangle: x112 y107 width1553 height351. Cream extraction rectangle: x144 y495 width1492 height290. Both resized to 1060 px width. No labels, icons, or code are embedded in either sprite.

## Final generation prompt

Use case: stylized-concept.
Asset type: a transparent PNG UI button sprite atlas for a handmade clay video game.
Input image: the supplied title-screen reference is a style and material reference only. Recreate its two blank pill button surfaces without any text or icons.
Primary request: Exactly two horizontal handpressed clay pill buttons, isolated on a genuinely transparent background with preserved alpha. The top button is saturated warm persimmon orange matching the reference Play button. The bottom button is warm ivory cream matching its Chapters button. Each is a broad softly rounded capsule with a flattened gently convex front face, thick soft molded bevel, warm top and right highlights, darker clay lower rim, slight handmade asymmetry, natural shallow thumb impressions and delicate clay seams. Fine tactile handmade clay texture, soft cinematic lighting, premium 3D stop-motion material. Match the reference closely.
Composition: 1200 x 600 landscape atlas. Orange top button about 1060 px wide and 244 px high centered near y=155. Cream lower button about 992 px wide and 196 px high centered near y=440. Clearly separated, aligned center horizontally, fully inside the image with transparent margins. Flat front view of the UI, no perspective foreshortening. Straight long horizontal upper/lower edges becoming semicircular rounded ends, not a thin oval. Keep face mostly flat for text overlay.
Lighting: soft warm illumination from upper right, soft bevel shading on left and lower edges. No external ground plane or cast drop shadow, only the button's own internal edge shading.
Constraints: no text, no typography, no symbols, no icons, no labels, no border, no watermark, no checkerboard pattern, no scenery. Alpha transparency outside the buttons. Exactly two separate blank button sprites.

## Rejected edge-refinement prompt

Use case: background-extraction.
Edit target: supplied transparent image of two blank clay buttons.
Make a production-ready clean sprite atlas by cleaning only the silhouettes and transparent background of both pills. Preserve the clay faces, colors, warm top-right highlights, internal bevel shadows, proportions, positions, and all surface material detail exactly. Remove every detached speck, every white fringe, every red/yellow fringe and all stray pixels outside the capsules. Clean continuous antialiased capsule silhouettes, with very gently handmade rounded edges. The orange and ivory clay must end precisely at the smooth outer silhouette, without halos. True alpha transparency everywhere beyond the button edges. No shadows outside the buttons. Do not add text or icons. Output same two separate buttons in their same composition.

## Rejected alpha-correction prompt

Use case: background-extraction. Edit the supplied image. Remove the checkerboard completely and replace it with actual transparent alpha background. The checkerboard must not be drawn into any pixel. Output a genuine RGBA transparent PNG cutout containing only the two clay pill buttons. All pixels outside the button silhouettes must have alpha 0. Preserve the exact two blank buttons with their colors, textures, dimensions, locations, and clean rounded silhouettes unchanged. No additional artwork, no text, no icons, no drop shadow. This is a production sprite atlas requiring actual transparency, not a visual representation of transparency.

## Rejected fresh atlas prompt

Generate an actual transparent RGBA PNG sprite sheet for a handmade clay video game. The entire background is transparent alpha zero. Exactly two wide capsule-shaped blank buttons stacked with a little space between them: upper button saturated persimmon orange, lower button warm ivory cream. No text and no icons. The orange pill has proportions about 4.35:1 and the cream about 5:1. Both about 1400 pixels wide, no overlap, completely inside the image with clear transparent margin around them. These are flat front-facing UI objects with softly rounded thick molded bevels, long level horizontal top and bottom edges, semicircular ends. Handmade modeling clay with faint cracks, delicate shallow thumb impressions, natural small unevenness only on the faces. Clean smooth antialiased silhouettes without any fringes or isolated particles. Orange clay should be cheerful vivid and warm, not dark red; ivory clay warm pale vanilla. Cinematic soft warm lighting from upper right, slightly brighter top-right rim, matte face, dark underside bevel shading. No external shadows. Photorealistic stop-motion sculpted plasticine material, premium high quality. Do not draw a checkerboard, any colored matte, background objects, ground, labels, icons or frames. Two isolated objects only, genuine transparency outside.

The fresh atlas was rejected because its surface detailing was less faithful to the supplied reference and its alpha silhouette still contained small fringe pixels. Consumers may use native rounded-pill clipping with a small inset to keep the original selected artwork's minor exterior fringe outside the visible button.
