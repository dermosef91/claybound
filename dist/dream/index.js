import garden from './garden.js';
import folding from './folding.js';
import orchard from './orchard.js';
import corridor from './corridor.js';
import parade from './parade.js';
import river from './river.js';
import room from './room.js';
import knot from './knot.js';
// The Soft Dream's visual modules, one per section, keyed like the route
// modules in dist/routes/dream-sections/. dream.js looks a platform's section
// up by x (L.dreamSections, attached by the assembler) and asks that module:
//
//   dress(w,s,g,section)       stone decks: build the deck's body into g (local
//                              coords, top at y 0, 0..s.w across) and return
//                              true to skip the default rolled slab. Flag and
//                              bell are placed for you.
//   deck(w,s,g,section)        any platform, offered FIRST: return a view
//                              {root:g, ...} to replace the ordinary view (the
//                              dream's own kinds in dream-views.js, or
//                              world.js's), or null to decline. Flag and bell
//                              are added if you left them out.
//   backdrop(w,L,section,layers)  far scenery: layers.at(factor) is a
//                              parallax group (no wrapping); layers.place(
//                              group, worldX, y, z, {until}) returns a child
//                              group that appears at worldX when the camera is
//                              there and, given `until`, retires once the
//                              player is past that x. Shadows are switched
//                              off for you.
//   quietBackdrop: true        the module paints a whole sky of its own: the
//                              chapter's placeholder blobs and columns sink
//                              while the player is in the section.
//   foreground(w,g,variant,section)  the near scenery in front of a stone
//                              deck (depth-scenery.js): build into g (the
//                              deck's line is ≈ y +2.1 above g) and return
//                              true; it fades when it would cover the player.
//   props(section,L)           → [{key,x,w?,y?,z?,make(w,parent,section)}]:
//                              scenery streamed by WORLD x like decoration;
//                              `parent` is a group already at (x,y,z) under
//                              levelRoot. Keys are prefixed dream:<key>: for you.
//   animate(w,game,dt,section,ctx)  per frame while the player is within 40 of
//                              the section; ctx = {playerX,time,reducedMotion}.
//
// Every hook is optional. A module with none of them gets the chapter's
// default look: rolled slabs, the shared placeholder backdrop, no props.
export const DREAM_VISUALS={garden,folding,orchard,corridor,parade,river,room,knot};
export const dreamVisual=key=>DREAM_VISUALS[key]??null;
