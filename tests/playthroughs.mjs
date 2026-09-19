// Execute each complete route through normal inputs. A look-ahead pilot tries
// take-off timing and jump holds; it never edits position, channels or hazards.
//
// Finding a route is a search over take-off points, jump holds and waits, and
// it costs minutes. Playing one is a few seconds. So a found route is recorded
// to tests/fixtures/ and replayed on later runs: the assertion that matters —
// this input stream completes the chapter with hazards, timers and enemies
// live — is made either way. The search runs again whenever it could reach a
// different answer, which is whenever the simulation or the chapter layouts
// change, and also whenever a recording fails to play, so a stale or
// environment-specific recording heals itself instead of passing. SEARCH=1
// skips the recordings and searches from scratch.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Game,FIXED_DT as dt} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {cloneGame,steer} from './routes.mjs';
import {nearbyStation} from '../dist/shaping.js';
import {formSolutionInputs} from '../dist/clay-rules.js';
import {machineTransfer,finaleTransfer} from './machine-pilot.mjs';
import {motherTransfer} from './mother-puff-pilot.mjs';
import {fingerprint} from './support/fingerprint.mjs';
import {encode,decode} from './support/trace.mjs';

const FLOWERS=!!process.env.FLOWERS,SEARCH=process.env.SEARCH==='1',VERSION=1;
// Only what decides how the game answers an input belongs in here. The pilots
// are deliberately left out: a recording is raw input, so rewriting the search
// cannot invalidate one.
const RULES=await fingerprint([new URL('../dist/simulation.js',import.meta.url),new URL('../dist/levels.js',import.meta.url)]);
const recording=i=>new URL(`./fixtures/playthrough-${i}${FLOWERS?'-flowers':''}.json`,import.meta.url);
const summarize=(i,g,frames)=>({index:i,seconds:g.elapsed,frames,coins:g.coins,flowers:g.stamps,checkpoint:g.checkpointId,latched:g.latched});

// Play a recording from an untouched game. Returns its trace, or null with a
// reason to search, having asserted nothing — a recording that does not hold
// up is a reason to go looking again, not a failure on its own.
async function fromRecording(i,L){
  if(SEARCH)return null;
  let saved;
  try{saved=JSON.parse(await readFile(recording(i),'utf8'));}
  catch{return null;}
  if(saved.version!==VERSION){console.log('SEARCH',L.short,'— this route was recorded in an older format');return null;}
  if(saved.fingerprint!==RULES){console.log('SEARCH',L.short,'— the simulation or the chapter layouts have changed since this route was recorded');return null;}
  try{
    const controls=decode(saved.controls),g=new Game();g.start(i);
    for(const input of controls)g.tick(dt,input);
    assert.equal(g.status,'complete');assert.equal(g.deaths,0);
    if(FLOWERS)assert.equal(g.stamps,L.stamps.length,'all optional flower routes collect their rewards');
    // The recorded outcome, not merely a completion: the same clock, the same
    // beads and flowers, the same checkpoint and the same solved systems.
    const trace=summarize(i,g,controls.length);
    assert.deepEqual({...trace,index:undefined},{...saved.result,index:undefined});
    return trace;
  }catch(err){
    console.log('SEARCH',L.short,'— the recorded route no longer plays through here:',err.message.split('\n')[0]);
    return null;
  }
}

async function record(i,controls,result){
  await mkdir(new URL('./fixtures/',import.meta.url),{recursive:true});
  await writeFile(recording(i),JSON.stringify({version:VERSION,fingerprint:RULES,result,controls:encode(controls)})+'\n');
}

function attempt(original,link,{offset,wait,hold}){
 if(link.mode==='boss')return motherTransfer(original,link);
 if(link.mode==='finale')return finaleTransfer(original,link);
 const g=cloneGame(original),a=g.level.platforms.find(p=>p.id===link.from),b=g.level.platforms.find(p=>p.id===link.to);
 if(a.kind==='ferry'||(link.mode==='ride'||link.mode==='board'))return machineTransfer(original,link);
 let spring=false;g.onEvent=e=>{if(e.type==='spring'&&b.kind==='spring'&&Math.abs(e.y-b.y)<.2&&e.x>b.x-.25&&e.x<b.x+b.w+.25)spring=true;};
 const dir=Math.sign(b.x+b.w/2-a.x-a.w/2)||1,overlap=a.x<b.x+b.w&&a.x+a.w>b.x,drop=link.mode==='drop',fall=link.mode==='fall',walk=link.mode==='walk';
 const controls=[];let launched=!g.player.groundId&&g.player.springing,jumpAge=0,waiting=wait,stomped=false,lastX=g.player.x,stuck=0;
 for(let f=0;f<1080;f++){
  const p=g.player;let jumpPressed=false,stompPressed=false,aim=fall&&overlap?b.x+Math.min(offset,b.w/2):b.x+b.w/2;
  // Kneadable clay blocks the way until it is shaped. Stand still and hold the
  // knead input, like the station prompt asks, then carry on with the crossing.
  // A formable mass has no pose for E to work towards; journey() plays its
  // authored strokes before any candidate gets here. A station that works
  // itself once its channel opens takes no hand at all, so it is walked past.
  const station=nearbyStation(g);
  if(station&&!station.rule&&!station.auto&&station.amount<1&&p.groundId){const knead={moveAxis:0,shapeHeld:true};controls.push(knead);g.tick(dt,knead);continue;}
  // Walking on formable clay, a rise too tall to step up stops the walk — or,
  // pressed into, is leant on and pushed ahead, which is not the way up it
  // either; a player hops it, and so does the pilot — a real jump, nothing
  // edited.
  const ground=p.groundId&&g.level.platforms.find(s=>s.id===p.groundId);
  if(!launched&&(ground?.form||p.lean)){stuck=Math.abs(p.x-lastX)<.004||p.lean?stuck+1:0;if(stuck>6){jumpPressed=true;stuck=0;}}else stuck=0;
  lastX=p.x;
  if(a.kind==='balance'&&a.channel&&!g.latched[a.channel])aim=a.x+a.w-.7;
  else if(!launched&&!walk&&!fall){
   const takeoff=drop?Math.max(a.x+.4,Math.min(a.x+a.w-.4,b.x+b.w/2)):overlap&&b.y>a.y?Math.max(a.x+.4,Math.min(a.x+a.w-.4,b.x+b.w/2-dir*offset)):dir>0?a.x+a.w-offset:a.x+offset;
   aim=takeoff;
   const gap=dir>0?b.x-(a.x+a.w):a.x-(b.x+b.w),running=!wait&&!drop&&gap>=3.5&&b.y>a.y+1.8;
   if(running)aim=b.x+b.w/2;
   if(a.kind==='spring'&&!p.groundId){launched=true;aim=b.x+b.w/2;}
   else if(p.groundId===a.id&&(running?(p.x-takeoff)*dir>=0:Math.abs(p.x-takeoff)<.14)){
    if(waiting>0)waiting--;else{jumpPressed=true;launched=true;aim=b.x+b.w/2;}
   }
  }
  if(fall&&overlap&&a.kind==='ledge'&&!stomped&&p.groundId===a.id&&Math.abs(p.x-aim)<.16){stompPressed=true;stomped=true;launched=true;}
  // A Dust Drifter is a soft walking obstacle. Hop across its body while
  // approaching the takeoff point, using the same jump input as a player.
  if(!launched&&p.groundId===a.id&&g.level.enemies.some(e=>e.alive&&['drifter','spitter'].includes(e.kind)&&
    Math.abs(e.x-p.x)<1.9&&(e.x-p.x)*(aim-p.x)>0&&e.y>=p.y-.1&&e.y<p.y+2.1))jumpPressed=true;
  if(drop&&launched&&jumpAge>12&&!stomped){stompPressed=true;stomped=true;}
  // A flower directly over a spring needs the vertical part of the bounce
  // before steering towards the next landing, especially on a return descent.
  const flower=a.kind==='spring'&&g.level.stamps.find(s=>!s.taken&&s.y>a.y+2&&s.x>=a.x&&s.x<=a.x+a.w);
  if(flower&&launched)aim=flower.x;
  const input={moveAxis:steer(g,aim),jumpPressed,jumpHeld:!launched||jumpAge<hold,stompPressed};controls.push(input);
  g.tick(dt,input);if(launched)jumpAge++;
  if(p.groundId===b.id||spring)return {g,controls};
  if(g.respawnTimer>0||g.deaths>original.deaths||g.status!=='playing')return null;
  // A wrong landing may be harmless, but cannot silently skip an intended beat.
  if(launched&&jumpAge>20&&p.groundId&&p.groundId!==a.id&&p.groundId!==b.id)return null;
 }
 return null;
}

// The search itself, for one level: `L` is the chapter (or a synthetic level
// such as a solo section from dist/routes/dream.js, passed again as `source`
// so the game starts from it). Returns {g,controls} for a completed run, or
// {blocked,furthest,attempts} when the budget ran out. Exported so
// tests/dream-sections.mjs pilots one section with the same search.
export function searchRoute(i,L,{source,flowers=FLOWERS}={}){
 let g=new Game();g.start(i,source);let attempts=0,furthest=0;
 const links=structuredClone(L.routeLinks);
 // A board or a ride can only be taken when the machine comes round, and some
 // of those boardings launch from a crumbling ledge that gives way in a sixth
 // of a second — there is nowhere to wait except the step before it. So the
 // step before a machine searches waits across one full cycle of that machine;
 // sampling less turns an ordinary "stand and watch it come back" into a false
 // block, and which side of that line a route falls on changes every time the
 // route before it gets longer. Every other step keeps the short ladder.
 const SHORT=[0,24,60,120,180,240,330];
 const waitsBefore=li=>{
   const l=links[li+1];if(!l)return SHORT;
   const from=L.platforms.find(s=>s.id===l.from),to=L.platforms.find(s=>s.id===l.to);
   // A lift that waits on a channel is a machine like a ferry: once woken it
   // has a period to come round in, and the step before it waits that long.
   const machine=from?.kind==='ferry'||l.mode==='ride'||from?.waitFor?from:l.mode==='board'||to?.waitFor?to:null;
   if(!machine)return SHORT;
   const waits=[...SHORT];for(let f=420;f<=Math.ceil((machine.period||5)*120);f+=90)waits.push(f);
   return waits;
 };
 const budget=Math.max(6000,links.length*220);
 if(flowers)for(const detour of L.detours){
   const start=links.findIndex(l=>l.from===detour[0].from),end=detour.at(-1).to;
   const count=end===detour[0].from?0:links.findIndex((l,k)=>k>=start&&l.to===end)-start+1;
   assert(start>=0&&count>=0);links.splice(start,count,...detour);
 }
 // A greedy arrival can reach a pulse ledge just before it disappears. If its
 // exit is impossible at that instant, retry an earlier takeoff/wait decision
 // instead of reporting a false block. Every candidate still uses real input.
 function journey(state,li){
  if(li>furthest&&process.env.TRACE)console.log('Reached',li,links[li]?.from||'bell');furthest=Math.max(furthest,li);if(li===links.length)return {g:state,parts:[]};
  if(attempts>=budget)return null;
  // A formable mass has no pose to hold E for: standing at its dock, the pilot
  // plays the station's authored solution as real pointer inputs — once, here,
  // so a failed take-off candidate never replays the strokes — then crosses.
  const station=nearbyStation(state);
  if(station?.rule==='form'&&station.amount<1&&state.player.groundId){
   attempts++;const g=cloneGame(state),live=g.level.shaping.find(s=>s.id===station.id),inputs=[];
   for(const input of formSolutionInputs(g,live,{dt})){inputs.push(input);g.tick(dt,input);}
   // A rock run is done when the rock is down, seconds after the last stroke:
   // the pilot stands and watches it go, as a player would.
   for(let f=0;live.ball&&(live.amount<1||g.cinema)&&f<1440;f++){const idle={moveAxis:0};inputs.push(idle);g.tick(dt,idle);}
   if(live.amount<1||g.deaths>state.deaths)return null;
   const rest=journey(g,li);return rest?{g:rest.g,parts:[inputs,...rest.parts]}:null;
  }
  // Machine transfers ignore jump offsets/holds/waits. Repeating their exact
  // input search 112 times cannot discover another result; backtrack upstream.
  const link=links[li],from=state.level.platforms.find(p=>p.id===link.from);
  if(from.kind==='ferry'||link.mode==='ride'||link.mode==='board'||link.mode==='boss'||link.mode==='finale'){
   if(link.mode==='boss'){attempts++;const r=motherTransfer(state,link);if(!r)return null;const rest=journey(r.g,li+1);return rest?{g:rest.g,parts:[r.controls,...rest.parts]}:null;}
   attempts++;const r=link.mode==='finale'?finaleTransfer(state,link):machineTransfer(state,link);if(!r)return null;
   const rest=journey(r.g,li+1);return rest?{g:rest.g,parts:[r.controls,...rest.parts]}:null;
  }
  for(const wait of waitsBefore(li))for(const offset of [.55,1.1,1.75,2.4])for(const hold of [600,48,30,18]){
   if(++attempts>budget)return null;
   const r=attempt(state,links[li],{wait,offset,hold});if(!r)continue;
   const rest=journey(r.g,li+1);if(rest)return {g:rest.g,parts:[r.controls,...rest.parts]};
  }return null;
 }
 const run=journey(g,0);
 if(!run)return {blocked:true,furthest,attempts};
 g=run.g;const controls=run.parts.flat();
 for(let f=0;f<480&&g.status==='playing';f++){const input={right:true,jumpHeld:false};controls.push(input);g.tick(dt,input);}
 return {g,controls,attempts};
}

// Run as a script: every chapter, recorded routes replayed, searched routes
// recorded. Imported, this file only lends its search.
if(process.argv[1]?.endsWith('playthroughs.mjs')){
const traces=[];
for(const [i,L]of LEVELS.entries()){
 if(process.env.LEVEL!==undefined&&i!==+process.env.LEVEL)continue;
 const played=await fromRecording(i,L);
 if(played){
  traces.push(played);
  console.log('REPLAY',L.short,played.seconds.toFixed(1)+'s',played.coins,'beads;',played.flowers,'flowers; recorded input, replayed from a clean start');
  continue;
 }
 const run=searchRoute(i,L);
 if(run.blocked){console.log('BLOCKED',i,'after',run.furthest,'crossings;',run.attempts,'input candidates');process.exitCode=1;continue;}
 const g=run.g,controls=run.controls;
 assert.equal(g.status,'complete');assert.equal(g.deaths,0);
 if(FLOWERS)assert.equal(g.stamps,L.stamps.length,'all optional flower routes collect their rewards');
 // Replay the recorded input stream from a clean start to prove determinism.
 const replay=new Game();replay.start(i);for(const input of controls)replay.tick(dt,input);
 assert.equal(replay.status,'complete');assert.equal(replay.deaths,0);assert.equal(replay.coins,g.coins);
 const trace=summarize(i,g,controls.length);
 traces.push(trace);
 await record(i,controls,trace);
 console.log('COMPLETE',L.short,g.elapsed.toFixed(1)+'s',g.coins,'beads;',g.stamps,'flowers; no resets or state edits');
}
if(!process.exitCode)await writeFile(new URL(process.env.RESULTS_PATH||(FLOWERS?'./flower-playthrough-results.json':'./playthrough-results.json'),import.meta.url),JSON.stringify(traces,null,2)+'\n');
}
