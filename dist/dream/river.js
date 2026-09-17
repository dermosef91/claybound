// Section 6 — The Colour River (visual module, EMPTY).
// A yellow conveyor river and blue sinking rafts; the author builds the river bed, the bank props and the flowing colour bands of the backdrop.
//
// Hooks (all optional; see dist/dream/index.js for the full contract):
//   dress(w,s,g,section)            stone deck body; return true to skip the slab
//   deck(w,s,g,section)             any platform; return a view {root:g,...} or null
//   backdrop(w,L,section,layers)    far scenery via layers.at(factor) / layers.place(group,worldX,y,z)
//   props(section,L)                [{key,x,w?,y?,z?,make(w,parent,section)}] streamed by world x
//   animate(w,game,dt,section,ctx)  per frame near the section; ctx={playerX,time,reducedMotion}
// Look decks up by id (deck(L,'river-…') from ./support.js) rather than adding
// section.x by hand; register anything that should turn toward the player
// with lean(w,group,{x,y,strength}).
export default {key:'river'};
