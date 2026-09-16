import {chapter,makeRoom} from '../route-authoring.js';
import garden from './dream-sections/garden.js';
import folding from './dream-sections/folding.js';
import orchard from './dream-sections/orchard.js';
import corridor from './dream-sections/corridor.js';
import parade from './dream-sections/parade.js';
import river from './dream-sections/river.js';
import room from './dream-sections/room.js';
import knot from './dream-sections/knot.js';
// The Soft Dream is assembled from section modules written in LOCAL
// coordinates (dist/routes/dream-sections/*.js, x from 0). Each one starts
// with a safe deck at 0..8 on y 0 carrying a checkpoint and ends with a deck
// at y 0 that runs out exactly at its `length`, so laying them end to end
// makes every seam a pair of abutting decks a player simply walks across.
// The garden is placed at -8 so its entry deck is the chapter's `start`
// platform at -8..0 and the spawn at 1.5 stands on it, like every chapter.
// Sections 7 and 8 were skipped by design; splicing one in later is a new
// module in this list and nothing else moves by hand.
const MODULES=[garden,folding,orchard,corridor,parade,river,room,knot];
const FIRST=-8;
export const DREAM_SECTIONS=MODULES.reduce((table,m)=>{
  const x=table.length?table.at(-1).x+table.at(-1).length:FIRST;
  table.push({key:m.key,name:m.name,x,length:m.length});return table;
},[]);
// makeRoom with a seam nobody is left of moves every x-bearing field the
// engine knows about, so a section is offset by exactly the same list that
// opens room inside a finished chapter — one list to keep, in one place.
const placed=MODULES.map((m,i)=>makeRoom(m,-Infinity,DREAM_SECTIONS[i].x));
// The chapter's first platform has to be called `start`.
function rename(section,from,to){
  for(const s of section.platforms)if(s.id===from)s.id=to;
  const fix=e=>Array.isArray(e)?(e[0]===from?[to,e[1]]:e):(e===from?to:e);
  section.route=section.route.map(fix);
  for(const link of [...section.detours.flat(),...section.recoveries.flat()]){if(link.from===from)link.from=to;if(link.to===from)link.to=to;}
  for(const g of section.guides)if(g.platformId===from)g.platformId=to;
  for(const st of section.shaping){if(st.spawn?.groundId===from)st.spawn.groundId=to;st.parts=st.parts.map(id=>id===from?to:id);}
  if(section.finale?.wake?.groundId===from)section.finale.wake.groundId=to;
  if(section.finale?.flowerId===from)section.finale.flowerId=to;
}
rename(placed[0],placed[0].entryId,'start');placed[0].entryId='start';
// One route: each section's list as authored, with the first entry of every
// later section turned into a walk from the deck before it.
const route=placed.flatMap((s,i)=>{
  const r=s.route.map(e=>Array.isArray(e)?[...e]:e);
  if(i>0){const first=r[0];r[0]=[Array.isArray(first)?first[0]:first,'walk'];}
  return r;
});
const collect=key=>placed.flatMap(s=>s[key]||[]);
const palettes=collect('palettes').sort((a,b)=>a.x-b.x);
const camera=collect('camera').sort((a,b)=>a.x-b.x);
const platforms=collect('platforms');
const goal=platforms.find(s=>s.goal);
const end=goal.x+10,spawn={x:1.5,y:0};
const finale=placed.find(s=>s.finale)?.finale;
export default chapter({
  layoutVersion:1,
  name:'The Soft Dream',short:'Soft Dream',label:'A half-remembered dream of warm clay',biome:'dream',
  intro:'Somewhere between sleeping and waking, the clay forgot its rules.',
  sky:palettes[0].sky,fog:palettes[0].fog,spawn,end,previousDistance:(end-spawn.x)/.3,cameraY:3,
  sections:placed.map((s,i)=>({x:DREAM_SECTIONS[i].x,name:s.name,landmark:s.landmark,...(s.quiet?{quiet:true}:{})})),
  platforms,route,
  detours:collect('detours'),recoveries:collect('recoveries'),
  coins:collect('coins'),stamps:collect('stamps'),enemies:collect('enemies'),hazards:collect('hazards'),
  hints:collect('hints'),winds:collect('winds'),triggers:collect('triggers'),shaping:collect('shaping'),
  palettes,camera,guides:collect('guides'),
  ...(finale?{finale}:{})
});
