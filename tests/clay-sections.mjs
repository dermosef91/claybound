// Clay in the chapters follows two rules a player can feel even if they could
// never name them:
//   · one piece, one input — working a piece of clay never moves any other;
//   · clay is not created or destroyed — what gets wider gets lower, so every
//     piece keeps (roughly) the same volume in both of its poses.
// And the mid-chapter clay sections are the way through, not decoration beside
// it: each station's bypass — the last solid ground before its clay to the
// first solid ground after — is impossible with that one piece unworked, even
// with every other piece in the chapter already shaped.
import assert from 'node:assert/strict';
import {crossing} from './routes.mjs';
import {LEVELS} from '../dist/levels.js';
import {Game,FIXED_DT as dt,RULES} from '../dist/simulation.js';

// Side-on area, as the mesh draws it. A ramp is a flat-bottomed wedge whose
// smoothstep top averages half its rise; any other sloped clay is a slab of
// constant thickness. (A 'landing' is drawn as a cap on a thin stem, which
// cannot hold its volume, so chapter clay never uses that role.)
const volume=(q,role)=>q.w*((q.h??0)+(role==='ramp'?(q.slope||0)/2:0));
const TOLERANCE=.1;

for(const L of LEVELS)for(const station of L.shaping||[]){
  assert.equal(station.parts.length,1,`${L.short}: ${station.id} moves ${station.parts.length} pieces from one input`);
  const piece=L.platforms.find(p=>p.id===station.parts[0]);
  assert(piece?.shape,`${L.short}: ${station.id} has its clay`);
  const before=volume(piece.shape.from,piece.clayRole),after=volume(piece.shape.to,piece.clayRole);
  assert(Math.abs(after-before)/before<=TOLERANCE,
    `${L.short}: ${piece.id} goes from ${before.toFixed(2)} to ${after.toFixed(2)} units of clay`);
  // Every gesture makes clay wider and lower; nothing is ever pulled taller.
  assert(piece.shape.to.w>=piece.shape.from.w,`${L.short}: ${piece.id} does not narrow`);
  assert.notEqual(piece.clayRole,'landing',`${L.short}: ${piece.id} is drawn as a stemmed cap, which loses its clay on screen`);
  assert(!station.lift&&!station.rule,`${L.short}: ${station.id} moves nothing but its own clay`);
  // And on the way between: the real simulation, stopped part-way. A stomp adds
  // half a shape and a tap three tenths, so these in-between poses are places
  // clay can be left sitting, not just frames it passes through.
  const index=LEVELS.indexOf(L);
  for(const amount of [.1,.3,.5,.7,.9]){
    const g=new Game();g.start(index);
    const live=g.level.shaping.find(s=>s.id===station.id);live.amount=live.target=amount;live.announced=true;
    g.tick(dt,{});
    const now=volume(g.level.platforms.find(p=>p.id===piece.id),piece.clayRole);
    assert(Math.abs(now-before)/before<=TOLERANCE,`${L.short}: ${piece.id} holds ${now.toFixed(2)} units of clay at ${amount} worked, not ${before.toFixed(2)}`);
  }
}
console.log('PASS every chapter station works exactly one piece of clay, and every piece keeps its volume within ten per cent at both ends and all the way between');

// How far above its own surface a player can get from a platform, measured in
// the real simulation rather than assumed: a held jump from standing (apex hang
// included), and for a mushroom every bounce it gives — landed on plainly, or
// mid-stomp, which adds to the launch. Landing forgives LANDING_SLACK, so a top
// has to clear the best of these by more than that.
const LANDING_SLACK=.14;
function highestFrom(level,id){
  // afterBounce: count heights only once the mushroom has thrown the player, so
  // the drop onto it is never mistaken for reach.
  const run=(setup,input,afterBounce)=>{
    const g=new Game();g.start(level);g.level.enemies=[];g.level.hazards=[];
    const a=g.level.platforms.find(p=>p.id===id);let top=-Infinity,bounced=false;
    g.onEvent=e=>{if(e.type==='spring')bounced=true;};
    setup(g,a);
    for(let f=0;f<420;f++){g.tick(dt,input(f));if(!afterBounce||bounced)top=Math.max(top,g.player.y);}
    assert(Number.isFinite(top),`reach from ${id} was measured`);
    return top-a.y;
  };
  const probe=new Game();probe.start(level);
  if(probe.level.platforms.find(p=>p.id===id).kind!=='spring')
    return run((g,a)=>Object.assign(g.player,{x:a.x+a.w/2,y:a.y,vx:0,vy:0,groundId:a.id,coyote:.13}),f=>({jumpPressed:f===0,jumpHeld:true}),false);
  const tries=[];
  for(const drop of [.5,1,2.5,4,6])for(const stompAt of [-1,0,2,6,15])
    tries.push(run((g,a)=>Object.assign(g.player,{x:a.x+a.w/2,y:a.y+drop,vx:0,vy:0,groundId:null}),f=>({jumpHeld:true,stompPressed:f===stompAt}),true));
  return Math.max(...tries);
}

const SECTIONS=[
  {level:0,station:'canyon-spire',bypass:{from:'pocket-dock',to:'canyon-lump',mode:'jump'}},
  {level:0,station:'canyon-lump',bypass:{from:'canyon-spire',to:'pocket-landing',mode:'jump'}},
  {level:1,station:'weave-bough',bypass:{from:'gap-brink',to:'weave-perch',mode:'jump'}},
  {level:1,station:'weave-mound',bypass:{from:'weave-spring',to:'canopy-nest',mode:'jump'}},
  // The tower is the one piece meant to be stood on while it is still tall.
  {level:2,station:'kiln-tower',bypass:{from:'kiln-ledge',to:'kiln-tunnel',mode:'jump'},rideable:true},
  {level:2,station:'kiln-plug',bypass:{from:'kiln-tunnel',to:'kiln-run',mode:'jump'}}
];

for(const {level,station,bypass,rideable} of SECTIONS){
  const L=LEVELS[level],s=(L.shaping||[]).find(s=>s.id===station);
  assert(s,`${L.short} has a station called ${station}`);
  for(const id of [bypass.from,bypass.to])assert(L.platforms.some(p=>p.id===id),`${L.short} has ${id}`);
  // Only this piece unworked. The bypass may well start or land on other clay,
  // which is then in its finished pose.
  assert.equal(crossing(level,bypass,{shaped:other=>other.id!==station}),null,
    `${L.short}: ${bypass.from} → ${bypass.to} is crossable without shaping ${station}, so that clay is optional`);
  // Nor is there a way onto the unworked clay itself, which would be a way over it.
  // Steering can always find a line a sweep did not, so this is settled by
  // height: the unworked top is out of reach of the best jump or bounce from
  // the ground before it, or rock sits too close above it to stand there.
  if(!rideable){
    const piece=L.platforms.find(p=>p.id===s.parts[0]),pose=piece.shape.from,source=L.platforms.find(p=>p.id===bypass.from);
    // Clay the bypass starts from is already worked, so it stands at its finished height.
    const reach=highestFrom(level,source.id),ground=source.shape?source.shape.to.y+(source.shape.to.slope||0):source.y;
    const capped=L.platforms.some(w=>w.kind==='wall'&&w.x<pose.x+pose.w&&w.x+w.w>pose.x&&w.y-(w.h??4)>=pose.y&&w.y-(w.h??4)<pose.y+RULES.height);
    assert(pose.y>ground+reach+LANDING_SLACK||capped,
      `${L.short}: the unworked ${piece.id} (top ${pose.y}) is within reach of ${source.id} (${ground} + ${reach.toFixed(2)})`);
  }
  if(!rideable)assert.equal(crossing(level,{from:bypass.from,to:s.parts[0],mode:'jump'},{shaped:other=>other.id!==station}),null,
    `${L.short}: the unworked ${s.parts[0]} can be landed on from ${bypass.from}`);
  const links=L.routeLinks.filter(l=>s.parts.includes(l.to)||s.parts.includes(l.from));
  assert(links.length>=2,`${station} is on the main route both in and out`);
  for(const link of links)assert(crossing(level,link),`${L.short}: ${link.from} → ${link.to} fails once ${station} is shaped`);
  console.log('PASS',L.short.padEnd(15),station.padEnd(13),`${bypass.from} → ${bypass.to} impossible unworked; ${links.length} links good once shaped`);
}

// Softening finished clay (R) while standing on it puts the player on top of the
// unworked pose. From there, the next piece in the section must still be
// impossible to get past.
for(const [k,here] of SECTIONS.entries()){
  const next=SECTIONS[k+1];if(!next||next.level!==here.level)continue;
  const L=LEVELS[here.level],piece=L.shaping.find(s=>s.id===here.station).parts[0];
  const unworked=other=>other.id!==here.station&&other.id!==next.station;
  for(const to of [L.shaping.find(s=>s.id===next.station).parts[0],next.bypass.to])
    assert.equal(crossing(here.level,{from:piece,to,mode:'jump'},{shaped:unworked}),null,
      `${L.short}: from on top of the unworked ${piece}, ${to} is reachable without shaping ${next.station}`);
}
console.log('PASS softening a finished piece underfoot never opens a way past the next one');

// Every gesture the game can ask for is taught before the chapter that leans on
// it, which was the point of putting clay in the first three chapters at all.
const taught=new Set(LEVELS.slice(0,3).flatMap(L=>(L.shaping||[]).map(s=>s.gesture)));
assert.deepEqual([...taught].sort(),['down','out','right']);
console.log('PASS all three gestures are taught before the final chapter');
