// Section 3 — The Upside-Down Orchard (visual module, EMPTY).
// Hanging saucer platforms under an inverted canopy and spherical dome islands the player runs over; the author builds the canopy, the roots-in-the-sky backdrop and the drips' trees.
//
// Hooks (all optional; see dist/dream/index.js for the full contract):
//   dress(w,s,g,section)            stone deck body; return true to skip the slab
//   deck(w,s,g,section)             any platform; return a view {root:g,...} or null
//   backdrop(w,L,section,layers)    far scenery via layers.at(factor) / layers.place(group,worldX,y,z)
//   props(section,L)                [{key,x,w?,y?,z?,make(w,parent,section)}] streamed by world x
//   animate(w,game,dt,section,ctx)  per frame near the section; ctx={playerX,time,reducedMotion}
// Look decks up by id (deck(L,'orchard-…') from ./support.js) rather than adding
// section.x by hand; register anything that should turn toward the player
// with lean(w,group,{x,y,strength}).
export default {key:'orchard'};
