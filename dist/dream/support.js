// Helpers every section's visual module can lean on. Kept apart from dream.js
// (which imports the modules) so a module importing these makes no cycle.
//
// Coordinates on the render side are WORLD coordinates: a platform `s` has
// its chapter x, `ctx.playerX` is the chapter x, and a section entry
// `{key,name,x,length}` tells you where the module's local 0 landed
// (`section.x`). The reliable way to place scenery on a deck is to look the
// deck up by id in `L.platforms` — ids are prefixed with the section key and
// never change between the full chapter and a solo build — rather than
// adding numbers to `section.x` by hand.

// The section whose [x, x+length) holds x, or null.
export function dreamSectionAt(L,x){
  const table=L?.dreamSections;if(!table)return null;
  return table.find(s=>x>=s.x&&x<s.x+s.length)??null;
}
// The platforms that lie in a section, left to right. In the full chapter the
// garden's entry deck is the chapter's `start`; in a solo build it keeps its
// own id — so "the entry deck" is decks(L,section)[0], not a fixed id.
export function sectionDecks(L,section){
  return L.platforms.filter(s=>s.x>=section.x&&s.x<section.x+section.length).sort((a,b)=>a.x-b.x);
}
// A platform by id, or null: `deck(L,'garden-arch')`.
export const deck=(L,id)=>L.platforms.find(s=>s.id===id)??null;

// Register a group as a leaner: dream.js turns it about z each frame so its
// top tilts toward the player, by atan2(dx, 6)*strength from `rest`, eased.
// `x` is the group's world x (pass undefined for parallax items, whose world
// x is read each frame). Entries whose group has streamed out are dropped
// automatically; reduced motion holds every leaner at rest.
export function lean(w,group,{x,y=0,strength=.15,rest=0}={}){
  (w.dreamLeaners??=[]).push({group,rest,strength,x,y});return group;
}

// A theme slot where the world has one, else a colour every world carries —
// so a module built against the dream's palette still draws in a bare test rig.
export const slot=(w,name,fallback='cream')=>w.mat?.[name]?name:fallback;

// A deterministic 0..1 from a number, for scattering props the same way on
// every build.
export const rand=n=>{const v=Math.sin(n*127.1+87.3)*43758.5453;return v-Math.floor(v);};
