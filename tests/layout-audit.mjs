// Authoring audit: the mistakes that are invisible in a route file but obvious
// in play — a deck buried inside another deck's solid body, a hazard band that
// reaches a standing surface, a crossing outside the jump envelope, a bead
// inside a hazard. Run it while authoring: node tests/layout-audit.mjs [index]
import {LEVELS} from '../dist/levels.js';
import {instantiateLevel} from '../dist/levels.js';
import {RULES,FINALE,finaleFlower} from '../dist/simulation.js';
import {solveFormStation} from '../dist/clay-rules.js';
import {formHeight} from '../dist/clay-form.js';
import {foldWall} from '../dist/cavern-machines.js';

const HEIGHT=RULES.height;
// Measured with tests/routes.mjs physics: a running jump clears 5 units level,
// 4 at +2 and 3 at +2.5; nothing clears +2.8. Leave a little authoring margin.
const reach=rise=>rise>2.6?-1:rise>2.3?2.6:rise>1.8?3.4:rise>1?4.4:5;
// simulation.js blocks sideways travel against exactly these: stone masses,
// wall and gate blocks, kneadable clay in whichever pose it is holding, and a
// fold panel once it stands up — audited as the wall it then is.
const blockerDepth=s=>s.kind==='stone'?11:s.kind==='wall'?(s.h??4):s.kind==='gate'?(s.h||10):s.shape||s.kind==='clay'?(s.h??.65):0;
const foldBlocker=s=>{const b=foldWall(s);return {...s,kind:'wall',x:b.x,w:b.w,y:b.top,h:b.top-b.bottom};};
const standable=s=>!['switch','wall'].includes(s.kind);
// Decks whose height changes with the player on or near them; a link to or
// from one is judged by the pilot's ride, not by the reach table.
const machine=s=>['spring','lift','counter','ferry','orbit','sink','fold'].includes(s.kind);

export function auditLevel(L,index){
  const notes=[];
  const level=instantiateLevel(index,L);
  // A formable mass has no pose: it stands as its authored solution leaves it,
  // and a link meets it at the end nearest the other platform.
  for(const station of level.shaping||[])if(station.rule==='form'){const s=level.platforms.find(p=>p.id===station.parts[0]);if(s)solveFormStation(station,s);}
  const edge=(s,other)=>s.form?s.y-s.h+formHeight(s.form,other.x+other.w/2<s.x+s.w/2?0:s.w):null;
  const shaped=level.platforms.map(s=>{
    if(!s.shape)return s;
    return {...s,...s.shape.to,shapedFrom:s.shape.from};
  });
  const at=id=>shaped.find(s=>s.id===id);
  const right=s=>s.x+s.w;
  const surface=s=>s.y+(s.slope||0);

  for(const p of shaped)if(standable(p))for(const s of shaped){
    if(s===p)continue;
    // Kneadable clay has two poses and blocks in both, so check each — except
    // against its own station's clay, which always holds the matching pose.
    const sameStation=p.station&&p.station===s.station;
    for(const pose of s.shapedFrom&&!sameStation?[s,{...s,...s.shapedFrom}]:s.kind==='fold'?[foldBlocker(s)]:[s]){
      const depth=blockerDepth(pose);if(!depth)continue;
      const overlap=Math.min(pose.x+pose.w,right(p))-Math.max(p.x,pose.x);
      if(overlap<=.12)continue;
      const top=Math.max(p.y,surface(p));
      if(top<pose.y-.12&&top+HEIGHT>pose.y-depth)
        notes.push(`${p.id} (y ${top}) stands inside ${s.id}'s solid body (${pose.kind}, y ${pose.y}, ${depth} deep) over ${overlap.toFixed(2)} units`);
    }
  }

  for(const h of level.hazards)for(const p of shaped){
    if(!standable(p))continue;
    const overlap=Math.min(right(p),h.x+h.w)-Math.max(p.x,h.x);
    if(overlap<=.05)continue;
    const top=Math.min(p.y,surface(p));
    if(top<h.y+.7&&top+HEIGHT>h.y-.4)
      notes.push(`hazard at x ${h.x} reaches ${p.id} (deck y ${top}, hazard y ${h.y})`);
  }
  for(const [name,list]of [['bead',level.coins],['flower',level.stamps]])for(const c of list)
    for(const h of level.hazards)if(c.x>h.x-.3&&c.x<h.x+h.w+.3&&c.y>h.y-.5&&c.y<h.y+1.1)
      notes.push(`${name} at (${c.x}, ${c.y}) sits in the hazard band at x ${h.x}`);

  const windAt=(x,y)=>(level.winds||[]).some(w=>x>w.x-1&&x<w.x+w.w+1&&y>w.y-1&&y<w.y+w.h);
  for(const link of [...level.routeLinks,...level.detours.flat(),...level.recoveries.flat()]){
    const a=at(link.from),b=at(link.to);
    if(!a||!b){notes.push(`link ${link.from} → ${link.to} names a platform that does not exist`);continue;}
    if(['walk','fall','drop','ride','board','finale'].includes(link.mode))continue;
    if(machine(a)||b.kind==='lift'||b.kind==='counter'||b.kind==='sink'||b.kind==='fold')continue;
    const forward=b.x+b.w/2>a.x+a.w/2;
    const gap=forward?b.x-right(a):a.x-right(b);
    const rise=(edge(b,a)??b.y)-(a.kind==='balance'?a.y:edge(a,b)??surface(a));
    if(rise>2.6&&!windAt(forward?b.x:right(b),b.y))
      notes.push(`link ${link.from} → ${link.to} rises ${rise.toFixed(2)} with no draught: above the jump ceiling`);
    else if(gap>reach(rise)&&!windAt(forward?b.x:right(b),b.y))
      notes.push(`link ${link.from} → ${link.to} gaps ${gap.toFixed(2)} at +${rise.toFixed(2)}: past the ${reach(rise)} unit reach`);
  }
  // A flag is a breather. Nothing should be standing on one when you arrive.
  for(const cp of level.platforms.filter(s=>s.checkpoint))for(const e of level.enemies){
    const dx=Math.abs(cp.checkpoint-e.x),dy=Math.abs(cp.y-e.y);
    const crowds=dy<=3&&(dx<=1.5||(Number.isFinite(e.min)&&cp.checkpoint>=e.min-.8&&cp.checkpoint<=e.max+.8));
    if(crowds)notes.push(`${e.kind||'clayling'} at x ${e.x} crowds the ${cp.id} flag at x ${cp.checkpoint}`);
  }
  const flowers=level.stamps.map(c=>{
    const near=shaped.filter(s=>s.optional&&c.x>=s.x-1&&c.x<=right(s)+1&&c.y>s.y&&c.y<s.y+2.6);
    return near.length?null:`flower at (${c.x}, ${c.y}) has no optional ledge under it`;
  }).filter(Boolean);
  // The dream's wiring: a trigger zone should wake something, a waiting lift
  // or a fold should have something to wait for, and the ending should name
  // stations and a wake deck that exist, with its flower within a standing
  // player's reach and its wake deck out of everyone else's.
  const sources=new Set([...(level.triggers||[]).map(t=>t.channel),...level.platforms.flatMap(s=>s.releases?[s.releases]:s.channel&&['switch','balance'].includes(s.kind)?[s.channel]:[]),...(level.shaping||[]).flatMap(s=>s.channel?[s.channel]:[])]);
  const sinks=new Set([...level.platforms.flatMap(s=>[s.waitFor,['timed','counter','gate','fold'].includes(s.kind)?s.channel:null]),...(level.winds||[]).map(w=>w.channel),...(level.crushers||[]).map(c=>c.holdChannel),...(level.shaping||[]).map(s=>s.auto)].filter(Boolean));
  for(const t of level.triggers||[])if(!sinks.has(t.channel))notes.push(`trigger at x ${t.x} latches ${t.channel}, which nothing waits for`);
  for(const s of level.platforms){
    if(s.waitFor&&!sources.has(s.waitFor))notes.push(`${s.id} waits for ${s.waitFor}, which nothing latches`);
    if(s.kind==='fold'&&!sources.has(s.channel))notes.push(`${s.id} folds on ${s.channel}, which nothing latches`);
  }
  if(level.finale){
    const F=level.finale,{x:fx,y:fy}=finaleFlower(level);
    for(const id of F.requires||[])if(!(level.shaping||[]).some(s=>s.id===id))notes.push(`finale requires station ${id}, which does not exist`);
    const wake=at(F.wake?.groundId);
    if(!wake)notes.push(`finale wake deck ${F.wake?.groundId} does not exist`);
    else{
      if(F.wake.x<wake.x||F.wake.x>right(wake)||Math.abs(F.wake.y-wake.y)>.3)notes.push(`finale wake point (${F.wake.x}, ${F.wake.y}) is not on ${wake.id}`);
      for(const s of shaped)if(s!==wake&&standable(s)&&Math.max(s.x-right(wake),wake.x-right(s))<8&&Math.abs(s.y-wake.y)<7)notes.push(`${s.id} lies within ordinary reach of the wake deck ${wake.id}`);
    }
    if(!shaped.some(s=>standable(s)&&fx>=s.x-.3&&fx<=right(s)+.3&&fy>surface(s)&&fy<surface(s)+.8+FINALE.radius))notes.push(`finale flower at (${fx}, ${fy}) has no deck within a standing player's reach beneath it`);
  }
  return [...notes,...flowers];
}

const only=process.argv[2]===undefined?null:Number(process.argv[2]);
let total=0;
for(const [i,L]of LEVELS.entries()){
  if(only!==null&&i!==only)continue;
  const notes=auditLevel(L,i);total+=notes.length;
  console.log(`\n${L.short}: ${notes.length?notes.length+' notes':'clean'}`);
  for(const n of notes)console.log('  ·',n);
}
if(only===null)console.log(`\n${total} authoring notes across ${LEVELS.length} chapters`);
