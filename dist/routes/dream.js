import {chapter,makeRoom,p} from '../route-authoring.js';
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
//
// The same assembly, applied to ONE module, is `soloSection`: a start deck, the
// section, and a plain goal deck after its exit — the mini chapter
// tests/dream-sections.mjs and scripts/review-dream.cjs work on while a
// section is being authored. Both attach `dreamSections` (plain data:
// {key,name,x,length} per section) so the renderer can find which section
// module owns a platform by its x.
export const MODULES=[garden,folding,orchard,corridor,parade,river,room,knot];
const FIRST=-8;

// Where each module's local 0 lands: end to end from `first`.
export function sectionTable(modules,first=FIRST){
  return modules.reduce((table,m)=>{
    const x=table.length?table.at(-1).x+table.at(-1).length:first;
    table.push({key:m.key,name:m.name,x,length:m.length});return table;
  },[]);
}

// The chapter's first platform has to be called `start`.
function rename(section,from,to){
  for(const s of section.platforms)if(s.id===from)s.id=to;
  const fix=e=>Array.isArray(e)?(e[0]===from?[to,e[1]]:e):(e===from?to:e);
  section.route=section.route.map(fix);
  for(const link of [...(section.detours||[]).flat(),...(section.recoveries||[]).flat()]){if(link.from===from)link.from=to;if(link.to===from)link.to=to;}
  for(const g of section.guides||[])if(g.platformId===from)g.platformId=to;
  for(const st of section.shaping||[]){if(st.spawn?.groundId===from)st.spawn.groundId=to;st.parts=st.parts.map(id=>id===from?to:id);}
  if(section.finale?.wake?.groundId===from)section.finale.wake.groundId=to;
  if(section.finale?.flowerId===from)section.finale.flowerId=to;
}

// Where the bell stands on the goal deck: ten in on the wide wake deck, and
// three and a half from the right edge on anything narrower.
const bellAt=goal=>Math.min(10,goal.w-3.5);

// Chain placed parts (sections already offset by makeRoom, plus any plain
// start/goal decks around them) into one chapter. Each later part's first
// route entry becomes a walk from the deck before it. `table` is the section
// table the parts were placed by; it is attached as L.dreamSections.
function assemble(parts,table,{spawn,name,short,label,intro}){
  const route=parts.flatMap((s,i)=>{
    const r=(s.route||[]).map(e=>Array.isArray(e)?[...e]:e);
    if(i>0&&r.length){const first=r[0];r[0]=[Array.isArray(first)?first[0]:first,'walk'];}
    return r;
  });
  const collect=key=>parts.flatMap(s=>s[key]||[]);
  const palettes=collect('palettes').sort((a,b)=>a.x-b.x);
  const camera=collect('camera').sort((a,b)=>a.x-b.x);
  if(!palettes.length)throw new Error('The Soft Dream needs at least one palette entry (a section module\'s `palettes` list)');
  const platforms=collect('platforms');
  const goal=platforms.find(s=>s.goal);
  if(!goal)throw new Error('The Soft Dream needs exactly one goal deck');
  const end=goal.x+bellAt(goal);
  const finale=parts.find(s=>s.finale)?.finale;
  const sections=parts.filter(s=>s.key).map(s=>({x:table.find(t=>t.key===s.key).x,name:s.name,landmark:s.landmark,...(s.quiet?{quiet:true}:{})}));
  // The first section reaches back over any plain deck laid before it, so the
  // spawn is always inside a section.
  sections[0].x=Math.min(sections[0].x,...platforms.map(s=>s.x));
  return chapter({
    layoutVersion:1,
    name,short,label,biome:'dream',intro,
    sky:palettes[0].sky,fog:palettes[0].fog,spawn,end,previousDistance:(end-spawn.x)/.3,cameraY:3,
    sections,
    platforms,route,
    detours:collect('detours'),recoveries:collect('recoveries'),
    coins:collect('coins'),stamps:collect('stamps'),enemies:collect('enemies'),hazards:collect('hazards'),
    hints:collect('hints'),winds:collect('winds'),triggers:collect('triggers'),shaping:collect('shaping'),
    palettes,camera,guides:collect('guides'),
    dreamSections:table,
    ...(finale?{finale}:{})
  });
}

// The whole chapter from a list of section modules laid end to end from `first`.
export function assembleDream(modules,{first=FIRST}={}){
  const table=sectionTable(modules,first);
  // makeRoom with a seam nobody is left of moves every x-bearing field the
  // engine knows about, so a section is offset by exactly the same list that
  // opens room inside a finished chapter — one list to keep, in one place.
  const placed=modules.map((m,i)=>makeRoom(m,-Infinity,table[i].x));
  rename(placed[0],placed[0].entryId,'start');placed[0].entryId='start';
  return assemble(placed,table,{
    spawn:{x:1.5,y:0},
    name:'The Soft Dream',short:'Soft Dream',label:'A half-remembered dream of warm clay',
    intro:'Somewhere between sleeping and waking, the clay forgot its rules.'
  });
}

// A mini chapter from ONE section module: a plain `start` deck at -8..0, the
// section placed so its entry deck begins at 0 (so `start` abuts it), and —
// unless the module carries the goal itself — a plain 12-wide goal deck
// abutting its exit. Palettes, camera, finale and the section table are
// handled exactly as the full assembler handles them. The spawn stands on
// `start`, so the walk onto the entry deck (and over its flag) is played.
export function soloSection(module){
  const entry=module.platforms.find(s=>s.id===module.entryId),exit=module.platforms.find(s=>s.id===module.exitId);
  if(!entry||!exit)throw new Error(`${module.key}: entryId (${module.entryId}) and exitId (${module.exitId}) must name platforms`);
  const shift=-entry.x||0;
  const table=[{key:module.key,name:module.name,x:shift,length:module.length}];
  const placed=makeRoom(module,-Infinity,shift);
  const parts=[{platforms:[p('start',-8,8,0)],route:['start']},placed];
  if(!placed.platforms.some(s=>s.goal)){
    const out=placed.platforms.find(s=>s.id===module.exitId),id=`${module.key}-goal`;
    parts.push({platforms:[p(id,out.x+out.w,12,out.y,'stone',{goal:true})],route:[id]});
  }
  return assemble(parts,table,{
    spawn:{x:-4,y:0},
    name:`${module.name} (solo)`,short:module.key,label:`One section of The Soft Dream, on its own`,
    intro:module.name
  });
}

const dream=assembleDream(MODULES);
export const DREAM_SECTIONS=dream.dreamSections;
export default dream;
