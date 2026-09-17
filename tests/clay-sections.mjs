// Clay in the chapters follows two rules a player can feel even if they could
// never name them:
//   · one piece, one input — working a piece of clay never moves any other;
//   · clay is not created or destroyed — what gets wider gets lower, so every
//     piece keeps (roughly) the same volume in both of its poses, and a
//     formable mass keeps it exactly, whatever it is dragged into.
// And the mid-chapter clay sections are the way through, not decoration beside
// it: each station's bypass — the last solid ground before its clay to the
// first solid ground after — is impossible with that one piece unworked, even
// with every other piece in the chapter already shaped.
//
// The canyon's Sandwright's Pocket is one free formable mass with no finished
// pose, so "shaped" there means the surface the station's authored solution
// strokes make (solveFormStation in clay-rules.js). The routes sweep copies
// that surface, the playthrough pilot plays the same strokes as real pointer
// inputs, and this file holds the two to be one and the same — and then walks
// the pocket itself, since two route links cannot prove the middle of one mass.
import assert from 'node:assert/strict';
import {crossing,solvedForm} from './routes.mjs';
import {LEVELS} from '../dist/levels.js';
import {Game,FIXED_DT as dt,RULES,surfaceAt} from '../dist/simulation.js';
import {solveFormStation,formSolutionInputs,standingOn} from '../dist/clay-rules.js';
import {FORM,formShare,formVolume} from '../dist/clay-form.js';
import {formSteepAt,nearbyStation} from '../dist/shaping.js';

// Side-on area, as the mesh draws it. A ramp is a flat-bottomed wedge whose
// smoothstep top averages half its rise; any other sloped clay is a slab of
// constant thickness. (A 'landing' is drawn as a cap on a thin stem, which
// cannot hold its volume, so chapter clay never uses that role.)
const volume=(q,role)=>q.w*((q.h??0)+(role==='ramp'?(q.slope||0)/2:0));
const TOLERANCE=.1;
const frames=seconds=>Math.round(seconds/dt);
const massOf=(g,station)=>g.level.platforms.find(p=>p.id===station.parts[0]);

for(const L of LEVELS)for(const station of L.shaping||[]){
  const index=LEVELS.indexOf(L);
  assert.equal(station.parts.length,1,`${L.short}: ${station.id} moves ${station.parts.length} pieces from one input`);
  const piece=L.platforms.find(p=>p.id===station.parts[0]);
  assert(piece?.shape,`${L.short}: ${station.id} has its clay`);
  assert.notEqual(piece.clayRole,'landing',`${L.short}: ${piece.id} is drawn as a stemmed cap, which loses its clay on screen`);
  assert(!station.lift,`${L.short}: ${station.id} moves nothing but its own clay`);
  // The formable mass is the one lab rule a chapter carries; every other rule
  // stays on the bench (tests/clay-lab.mjs holds the same line from its side).
  assert(!station.rule||station.rule==='form',`${L.short}: ${station.id} carries a rule that belongs in the lab`);
  if(station.rule==='form'){
    // A free mass with no pose: it rests as its clump and is shaped by its
    // authored solution, which has to be there for "shaped" to mean anything.
    assert.equal(piece.clayRole,'mass');assert(station.free,`${L.short}: ${station.id} sits free on its footing`);
    assert.deepEqual(piece.shape.from,piece.shape.to,`${L.short}: ${piece.id} has no pose, only a surface`);
    assert(Array.isArray(station.clump)&&station.clump.length>=2&&station.solution?.length,`${L.short}: ${station.id} has a clump and a solution`);
    // Solved from the clump: the volume is exact, and the work done is well
    // past what the station counts as shaped, so the toast never hangs on a
    // hair — and never fires on a dab, which is what the stiffer share is for.
    const g=new Game();g.start(index);
    const live=g.level.shaping.find(s=>s.id===station.id),f=solveFormStation(live,massOf(g,live),{dt});
    assert(Math.abs(formVolume(f)-f.volume)<1e-7,`${L.short}: ${piece.id} keeps its volume exactly when solved (${(formVolume(f)-f.volume).toExponential(2)})`);
    assert.equal(live.amount,1);assert(live.announced);
    assert(live.shaped>FORM.shaped*2,`${L.short}: ${station.id} asks for more than the lab's share before it reads as shaped`);
    assert.equal(formShare(f,live.shaped*1.2),1,`${L.short}: the solution moves a fifth more clay than the station needs`);
    // The same strokes as a player's pointer would make them, through the
    // real game with the player on the dock, come to the very same surface —
    // so the pilot's inputs and the routes sweep's cached surface agree, and
    // the pointer path is the solver path.
    const real=new Game();real.start(index);
    const rs=real.level.shaping.find(s=>s.id===station.id),rm=massOf(real,rs);
    Object.assign(real.player,rs.spawn,{vx:0,vy:0});real.tick(dt,{});
    assert.equal(nearbyStation(real)?.id,station.id,'the spawn is inside the stretch');
    let inputs=0;for(const input of formSolutionInputs(real,rs,{dt})){real.tick(dt,input);inputs++;}
    for(let i=0;i<60;i++)real.tick(dt,{});
    assert.equal(rs.amount,1);assert(rs.announced);assert.equal(real.deaths,0);
    const cached=solvedForm(index,station.id);let worst=0;
    for(let i=0;i<f.n;i++)worst=Math.max(worst,Math.abs(rm.form.h[i]-cached[i]),Math.abs(f.h[i]-cached[i]));
    assert.equal(worst,0,`${L.short}: ${inputs} real inputs make the solved surface bitwise (max |Δh| ${worst})`);
    continue;
  }
  const before=volume(piece.shape.from,piece.clayRole),after=volume(piece.shape.to,piece.clayRole);
  assert(Math.abs(after-before)/before<=TOLERANCE,
    `${L.short}: ${piece.id} goes from ${before.toFixed(2)} to ${after.toFixed(2)} units of clay`);
  // Every gesture makes clay wider and lower; nothing is ever pulled taller.
  assert(piece.shape.to.w>=piece.shape.from.w,`${L.short}: ${piece.id} does not narrow`);
  // And on the way between: the real simulation, stopped part-way. A stomp adds
  // half a shape and a tap three tenths, so these in-between poses are places
  // clay can be left sitting, not just frames it passes through.
  for(const amount of [.1,.3,.5,.7,.9]){
    const g=new Game();g.start(index);
    const live=g.level.shaping.find(s=>s.id===station.id);live.amount=live.target=amount;live.announced=true;
    g.tick(dt,{});
    const now=volume(g.level.platforms.find(p=>p.id===piece.id),piece.clayRole);
    assert(Math.abs(now-before)/before<=TOLERANCE,`${L.short}: ${piece.id} holds ${now.toFixed(2)} units of clay at ${amount} worked, not ${before.toFixed(2)}`);
  }
}
console.log('PASS every chapter station works exactly one piece of clay; every posed piece keeps its volume within ten per cent at both ends and all the way between, and the formable mass keeps it exactly, solved by the same strokes the pilot plays');

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
  // One formable mass spans the whole pocket, so its bypass is dock to landing.
  {level:0,station:'canyon-pocket',bypass:{from:'pocket-dock',to:'pocket-landing',mode:'jump'},form:true},
  {level:1,station:'weave-bough',bypass:{from:'gap-brink',to:'weave-perch',mode:'jump'},form:true},
  {level:1,station:'weave-mound',bypass:{from:'weave-spring',to:'canopy-nest',mode:'jump'},form:true},
  // The tower is the one piece meant to be stood on while it is still tall.
  {level:2,station:'kiln-tower',bypass:{from:'kiln-ledge',to:'kiln-tunnel',mode:'jump'},rideable:true},
  {level:2,station:'kiln-plug',bypass:{from:'kiln-tunnel',to:'kiln-run',mode:'jump'}},
  // The Soft Dream: one purple beat per section — three in the Folding Path,
  // whose two free masses are walked onto flat — and three strands in the knot.
  {level:4,station:'garden-roll',bypass:{from:'garden-slab-2',to:'garden-mound',mode:'jump'}},
  {level:4,station:'folding-tongue',bypass:{from:'folding-entry',to:'folding-wall-bridge',mode:'jump'}},
  // The slab is a floor under a hanging sheet until a trench is cast through it;
  // the wall's bed is bare nails until the wall is laid down over them.
  {level:4,station:'folding-cast',bypass:{from:'folding-land',to:'folding-cast-bridge',mode:'jump'},rideable:true,form:true},
  {level:4,station:'folding-wall',bypass:{from:'folding-far',to:'folding-wall-land',mode:'jump'},rideable:true,form:true},
  // The blob is walked onto flat before it is pulled up into a stair.
  {level:4,station:'orchard-blob',bypass:{from:'orchard-mid',to:'orchard-under',mode:'jump'},rideable:true,form:true},
  {level:4,station:'corridor-plug',bypass:{from:'corridor-floor-1',to:'corridor-floor-2',mode:'jump'}},
  {level:4,station:'parade-worm',bypass:{from:'parade-head',to:'parade-caterpillar',mode:'jump'}},
  // The clot is a stepping stone in the riverbed before it is pressed flat.
  {level:4,station:'river-clot',bypass:{from:'river-raft',to:'river-far-bank',mode:'jump'},rideable:true},
  {level:4,station:'room-floor-mass',bypass:{from:'room-doll-table',to:'room-shaft-foot',mode:'jump'},rideable:true,form:true},
  {level:4,station:'knot-strand-a',bypass:{from:'knot-pier-a',to:'knot-ledge-b',mode:'jump'}},
  {level:4,station:'knot-strand-b',bypass:{from:'knot-stand-b',to:'knot-ledge-c',mode:'jump'}},
  // Strand C is landed on unworked and spread while standing on it.
  {level:4,station:'knot-strand-c',bypass:{from:'knot-ledge-c',to:'knot-crown',mode:'jump'},rideable:true}
];

for(const {level,station,bypass,rideable,form} of SECTIONS){
  const L=LEVELS[level],s=(L.shaping||[]).find(s=>s.id===station);
  assert(s,`${L.short} has a station called ${station}`);
  assert.equal(!!s.rule,!!form,`${station} is ${form?'':'not '}a formable mass`);
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
    const piece=L.platforms.find(p=>p.id===s.parts[0]),source=L.platforms.find(p=>p.id===bypass.from);
    // Clay the bypass starts from is already worked, so it stands at its finished height.
    const reach=highestFrom(level,source.id),ground=source.shape?source.shape.to.y+(source.shape.to.slope||0):source.y;
    if(form){
      // A mass has no pose: its top is wherever its clump stands. The first
      // place on it, coming from the source, that is neither a face to slide
      // down nor sand to die on has to be out of reach — and that place is
      // the only way onto the mass, since everything beyond it is behind it.
      const g=new Game();g.start(level);const mass=massOf(g,g.level.shaping.find(q=>q.id===station));
      const band=g.level.hazards.find(h=>h.x<=mass.x&&h.x+h.w>=mass.x+mass.w&&h.y<mass.y-mass.h&&h.y>mass.y-mass.h-1);
      assert(band,`${L.short}: spikes lie just under ${piece.id}'s base, so bare footing kills`);
      const kill=band.y+.7,dir=source.x<mass.x?1:-1;
      let first=null;
      for(let x=dir>0?mass.x:mass.x+mass.w;x>=mass.x&&x<=mass.x+mass.w;x+=dir*.05)if(!formSteepAt(mass,x,RULES.radius)&&surfaceAt(mass,x)>=kill){first={x,top:surfaceAt(mass,x)};break;}
      assert(first,'somewhere on the mass can be stood on');
      assert(first.top>ground+reach+LANDING_SLACK,
        `${L.short}: the unworked ${piece.id} can first be stood on at x ${first.x.toFixed(2)}, ${first.top.toFixed(2)} high, within reach of ${source.id} (${ground} + ${reach.toFixed(2)})`);
      // The rest of the rest surface is safe wherever it is clay, and stays
      // so: between its ends a free mass never thins past minThick, which
      // puts the skim over the pit above the kill line by a margin that
      // boots (sag) cannot use up, since keepWhole re-floors it every tick.
      const f=mass.form,base=mass.y-mass.h;
      let lo=0,hi=f.n-1;while(lo<f.n&&f.h[lo]<=FORM.minThick)lo++;while(hi>lo&&f.h[hi]<=FORM.minThick)hi--;
      for(let i=lo;i<=hi;i++)assert(base+f.h[i]>=kill+.1,`${L.short}: rest column ${i} (${(base+f.h[i]).toFixed(2)}) sits on the spikes`);
      assert(base+FORM.minThick>kill,`${L.short}: the thinnest clay the mass allows (${(base+FORM.minThick).toFixed(2)}) is above the kill line (${kill.toFixed(2)})`);
      // And the solved surface: nowhere a walker can stand is within a stand's
      // sag of the kill line.
      const solved=solvedForm(level,station);
      for(let i=0;i<f.n;i++){
        const x=mass.x+i*f.dx,top=base+solved[i];
        f.h.set(solved);
        if(!formSteepAt(mass,x,RULES.radius))assert(top-FORM.sag>kill,`${L.short}: solved column ${i} (${top.toFixed(2)}) is a stand away from the spikes`);
      }
    } else {
      const pose=piece.shape.from;
      const capped=L.platforms.some(w=>w.kind==='wall'&&w.x<pose.x+pose.w&&w.x+w.w>pose.x&&w.y-(w.h??4)>=pose.y&&w.y-(w.h??4)<pose.y+RULES.height);
      assert(pose.y>ground+reach+LANDING_SLACK||capped,
        `${L.short}: the unworked ${piece.id} (top ${pose.y}) is within reach of ${source.id} (${ground} + ${reach.toFixed(2)})`);
    }
  }
  // A sweep onto the unworked clay keeps the spikes where the clay is a free
  // mass, since its bare base is walkable-but-deadly sand (see crossing()).
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

// --- the pocket, walked -------------------------------------------------------------
// Two links prove the dock reaches the clay and the clay's far end reaches the
// landing; only a body crossing the whole mass proves the middle. So: real
// inputs from the dock to the landing, over the solved surface and over every
// other shape a hand might make of it instead, and never over the clump.
{
  const level=0,id='canyon-pocket';
  const boot=()=>{
    const g=new Game();g.start(level);
    const station=g.level.shaping.find(s=>s.id===id),mass=massOf(g,station),dock=g.level.platforms.find(p=>p.id==='pocket-dock');
    Object.assign(g.player,{x:dock.checkpoint,y:dock.y,vx:0,vy:0,groundId:dock.id,coyote:.13});g.tick(dt,{});
    assert.equal(g.checkpointId,dock.id,'the dock flag is the pocket\'s checkpoint');
    return {g,station,mass,p:g.player};
  };
  // A pointer stroke as a player makes it: down at (x, the surface there +
  // lift), straight to (x+dx, y+dy) over t seconds, then up.
  const stroke=(g,mass,{x,lift,dx,dy,t})=>{
    const n=Math.round(t/dt),y0=surfaceAt(mass,x)+lift;
    for(let i=0;i<n;i++){const u=n>1?i/(n-1):0;g.tick(dt,{moveAxis:0,shapeId:id,shapeX:x+dx*u,shapeY:y0+dy*u});}
    g.tick(dt,{moveAxis:0});
  };
  // Walk towards x, and hop whenever the way is blocked — what a player does at
  // a rise they cannot step over. Reports where it got to.
  const hopTo=(g,x,seconds=12)=>{
    const p=g.player,deaths=g.deaths;let stuck=0,last=p.x;
    for(let i=0;i<seconds/dt;i++){
      stuck=Math.abs(p.x-last)<.004?stuck+1:0;last=p.x;
      const jump=stuck>6&&!!p.groundId;if(jump)stuck=0;
      const d=x-p.x;
      g.tick(dt,{moveAxis:Math.max(-1,Math.min(1,d*2)),jumpPressed:jump,jumpHeld:true});
      if(p.groundId==='pocket-landing')return 'landing';
      if(Math.abs(d)<.3&&p.groundId)return 'there';
      if(g.deaths>deaths)return 'dead';
    }
    return `stuck at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
  };
  const landing=g=>hopTo(g,g.level.platforms.find(p=>p.id==='pocket-landing').checkpoint);
  // The drills below are points on the mass, written as offsets from its own
  // left edge so the pocket can be moved as a block without rewriting them.
  const MASS=LEVELS[0].platforms.find(q=>q.id==='pocket-clay').x;
  const SAND=LEVELS[0].platforms.find(q=>q.id==='pocket-floor').y;
  const DOCK=LEVELS[0].platforms.find(q=>q.id==='pocket-dock').x;
  const END=(q=>q.x+q.w)(LEVELS[0].platforms.find(q=>q.id==='pocket-landing'));


  // Unworked, the pocket is a wall: twelve seconds of walking and hopping from
  // the dock never leave it.
  {const {g,p}=boot();const r=landing(g);assert(r.startsWith('stuck')&&p.x<MASS,`the clump keeps the dock shut (${r})`);assert.equal(g.deaths,0);}
  // 1. The authored solution: lean the spire into a bridge, slump the lump
  //    into a ramp, and the pocket is a walk with a hop at each end.
  {const {g,station,mass}=boot();solveFormStation(station,massOf(g,station),{dt});
   const r=landing(g);assert.equal(r,'landing',`the solved pocket is crossed (${r})`);assert.equal(g.deaths,0);
   assert(g.elapsed<8,`in good time (${g.elapsed.toFixed(1)}s)`);}
  // 2. Squash and slump: press the spire straight down from the air instead of
  //    leaning it, and it spreads into a mound with a bridge behind it.
  {const {g,station,mass}=boot();
   for(let k=0;k<3;k++)stroke(g,mass,{x:MASS+1,lift:1,dx:0,dy:-3,t:1});
   stroke(g,mass,{x:MASS+13.7,lift:0,dx:-5.5,dy:-2.6,t:1.8});
   assert.equal(station.amount,1,'squashing and slumping reads as shaped');
   const r=landing(g);assert.equal(r,'landing',`a squashed spire and a slumped lump cross the pocket (${r})`);assert.equal(g.deaths,0);}
  // 3. Lean, pillar, launch: lean the spire, walk to the lump's foot, pull the
  //    clay up under your own feet (it carries you), then jump and stomp back
  //    into it — the crater throws you over the lump onto the landing.
  {const {g,station,mass,p}=boot();
   stroke(g,mass,{x:MASS+1.2,lift:0,dx:6.5,dy:-3,t:1.7});
   assert.equal(hopTo(g,MASS+9.3,6),'there','the bridge carries a walker to the lump\'s foot');
   assert.equal(p.groundId,mass.id);
   const before=p.y;stroke(g,mass,{x:p.x,lift:0,dx:0,dy:2.2,t:1});
   assert(p.y>before+1.5&&p.groundId===mass.id,`a pull underfoot carries the player up (${(p.y-before).toFixed(2)})`);
   g.tick(dt,{jumpPressed:true,jumpHeld:true});for(let i=0;i<90&&p.vy>0;i++)g.tick(dt,{jumpHeld:true});
   g.tick(dt,{stompPressed:true});
   let sprung=false,apex=p.y,reached=false;g.onEvent=e=>{if(e.type==='spring')sprung=true;};
   for(let i=0;i<600;i++){g.tick(dt,{moveAxis:sprung?1:0,jumpHeld:true});apex=Math.max(apex,p.y);if(p.groundId==='pocket-landing'){reached=true;break;}if(g.deaths)break;}
   assert(sprung,'the stomp is thrown back');assert(apex>mass.y+5.75,`well over the lump (${apex.toFixed(2)})`);
   assert(reached&&g.deaths===0,'and the flight steers onto the landing');
   assert.equal(station.amount,1);}
  // 4. Lean, then keyboard steps: lean the spire, and from the bridge hold E a
  //    stride back from the lump's face so a step rises ahead, hop up, repeat.
  {const {g,station,mass,p}=boot();
   stroke(g,mass,{x:MASS+1.2,lift:0,dx:6.5,dy:-3,t:1.7});
   let r='',holds=0;
   for(let round=0;round<8&&r!=='landing';round++){
     r=hopTo(g,154,3);if(r==='landing')break;
     for(let i=0;i<120&&!p.groundId;i++)g.tick(dt,{});
     assert(p.groundId===mass.id&&!g.deaths,`blocked on the clay, not dead (${r})`);
     for(let i=0;i<12;i++)g.tick(dt,{moveAxis:-1});
     for(let i=0;i<60;i++)g.tick(dt,{moveAxis:0,shapeHeld:true});holds++;
     for(let i=0;i<40;i++)g.tick(dt,{moveAxis:1,jumpPressed:i===0,jumpHeld:true});
   }
   assert.equal(r,'landing',`E steps up the lump's face (${r}, ${holds} holds)`);assert(holds>=1&&holds<=5);assert.equal(g.deaths,0);}
  // 5. Keyboard only: no pointer at all. Facing the clay, E works whatever is
  //    ahead into a step — pressing the spire down, raising the pit, pressing
  //    the lump — and at the landing's wall, with nothing ahead to step onto,
  //    it lifts the ground underfoot instead. A plain rule does the whole
  //    pocket: hold E while the clay ahead is more than a step up or any way
  //    down, walk when it is a step or less, hop when the landing is in reach.
  {const {g,station,mass,p}=boot(),landingLedge=g.level.platforms.find(q=>q.id==='pocket-landing');
   let t=0,hopTimer=0,heldE=0;
   for(let i=0;i<150/dt&&p.groundId!=='pocket-landing'&&!g.deaths;i++){
     const aheadX=Math.max(mass.x,Math.min(mass.x+mass.w,p.x+FORM.stepReach)),rise=surfaceAt(mass,aheadX)-p.y,atWall=p.x>landingLedge.x-.6;
     let input;
     if(atWall&&landingLedge.y-p.y<2.4){input={moveAxis:1,jumpPressed:hopTimer<=0&&!!p.groundId,jumpHeld:true};if(input.jumpPressed)hopTimer=60;}
     else if(atWall||(p.x+FORM.stepReach>=mass.x-.3&&(rise>FORM.step||rise<-.05))){input={moveAxis:0,shapeHeld:true};p.facing=1;heldE++;}
     else input={moveAxis:1};
     hopTimer--;g.tick(dt,input);t+=dt;
   }
   assert.equal(p.groundId,'pocket-landing',`a keyboard alone crosses the pocket (ended at ${p.x.toFixed(1)}, ${p.y.toFixed(2)} after ${t.toFixed(0)}s)`);
   assert.equal(g.deaths,0,'without dying');assert(t<150,`in ${t.toFixed(0)}s`);assert(heldE>frames(5),'by holding E');
   assert.equal(station.amount,1,'and the key alone moves enough clay to read as shaped');}
  // Resuming. A saved game only rebuilds the pocket from its solution when its
  // checkpoint lies beyond the clay — "shaped" is a share of clay moved, not a
  // crossing, so a save at the dock with the spire worked resumes as the clump
  // and the pocket is worked again.
  {const {g,station,mass}=boot();
   stroke(g,mass,{x:MASS+1.2,lift:0,dx:6.5,dy:-3,t:1.7});
   const save=g.snapshot();save.shaped=[...new Set([...save.shaped,station.id])];
   assert.equal(save.checkpointId,'pocket-dock');
   const back=new Game();back.start(0);assert(back.restore(save),'the save restores');
   const restored=massOf(back,back.level.shaping.find(q=>q.id===station.id));
   assert(Array.from(restored.form.h).every((h,i)=>h===restored.form.rest[i]),'saved at the dock, the pocket resumes as its clump');
   // Crossed to the landing's flag, the same save rebuilds the solved pocket.
   const {g:crossed,station:cs,mass:cm,p}=boot();solveFormStation(cs,massOf(crossed,cs),{dt});
   assert.equal(landing(crossed),'landing');for(let i=0;i<300&&crossed.checkpointId!=='pocket-landing';i++)crossed.tick(dt,{moveAxis:Math.sign(154-p.x)});
   assert.equal(crossed.checkpointId,'pocket-landing','the landing flag is the next checkpoint');
   const later=crossed.snapshot();assert(later.shaped.includes(cs.id));
   const resumed=new Game();resumed.start(0);assert(resumed.restore(later));
   // The crossing itself dented the clay underfoot; a resume rebuilds the
   // clean solution, so that is what it is held to.
   const rm=massOf(resumed,resumed.level.shaping.find(q=>q.id===cs.id)),{g:clean,station:cst}=boot(),ref=solveFormStation(cst,massOf(clean,cst),{dt});
   let worst=0;for(let i=0;i<rm.form.n;i++)worst=Math.max(worst,Math.abs(rm.form.h[i]-ref.h[i]));
   assert(worst<1e-9,`saved beyond the clay, the pocket resumes solved (max |Δh| ${worst.toExponential(1)})`);
   assert.equal(resumed.player.groundId,'pocket-landing');}
  // R softens the pocket only from off the clay. In the air over it, or standing
  // on it, regrowing the towers would set the player on top of them.
  {const {g,station,mass,p}=boot();solveFormStation(station,massOf(g,station),{dt});
   const solved=Float64Array.from(mass.form.h);
   Object.assign(p,{x:MASS+6.7,y:surfaceAt(mass,MASS+6.7)+1.5,vx:0,vy:0,groundId:null,coyote:0});const y0=p.y;
   g.tick(dt,{shapeReset:true});
   assert.deepEqual(Array.from(mass.form.h),Array.from(solved),'R in the air over the clay changes nothing');
   assert(p.y<y0,'and the player keeps falling rather than riding a regrown tower');
   for(let i=0;i<90&&!p.groundId;i++)g.tick(dt,{});assert.equal(p.groundId,mass.id);g.tick(dt,{shapeReset:true});
   // Standing dents the clay a little; what R must not do is put the clump back.
   assert(!Array.from(mass.form.h).every((h,i)=>Math.abs(h-mass.form.rest[i])<1e-9),'nor does R standing on it put the clump back');
   assert(Math.max(...Array.from(mass.form.h).map((h,i)=>Math.abs(h-solved[i])))<.5,'the solved shape stands, dented only by the boots');
   const dock=LEVELS[0].platforms.find(q=>q.id==='pocket-dock');
   Object.assign(p,{x:dock.x+4,y:dock.y,vx:0,vy:0,groundId:'pocket-dock'});g.tick(dt,{shapeReset:true});
   assert(Array.from(mass.form.h).every((h,i)=>h===mass.form.rest[i]),'from the dock, R puts the clump back');}
  // The beads: every one in the pocket can be picked up on the way across the
  // solved clay, by walking or by a standing hop under it.
  {const {g,station,mass,p}=boot();solveFormStation(station,massOf(g,station),{dt});
   Object.assign(p,{x:DOCK+.5,vx:0});g.tick(dt,{});
   const pocket=g.level.coins.filter(c=>c.x>=DOCK&&c.x<=END);assert(pocket.length>=7);
   let stuck=0,last=p.x;
   for(let i=0;i<20/dt&&p.x<END-1;i++){
     stuck=Math.abs(p.x-last)<.004?stuck+1:0;last=p.x;
     const bead=pocket.find(c=>!c.taken&&c.x-p.x>-.3&&c.x-p.x<1.2&&c.y-(p.y+.65)>=.75);
     let axis=1,jump=false;
     if(bead){axis=Math.max(-1,Math.min(1,(bead.x-p.x)*3));if(Math.abs(bead.x-p.x)<.12&&Math.abs(p.vx)<1.5&&p.groundId)jump=true;}
     else if(stuck>6&&p.groundId){jump=true;stuck=0;}
     g.tick(dt,{moveAxis:axis,jumpPressed:jump,jumpHeld:true});
   }
   assert.equal(g.deaths,0);
   assert.deepEqual(pocket.filter(c=>!c.taken).map(c=>[c.x,c.y]),[],'every pocket bead is collected on one crossing');}
  // Dying with the clay half-made keeps the clay: the pocket does not slump
  // back (relax is off), the dock flag is the respawn, and the crossing still
  // stands. R softens it only from off the clay — never under the boots, which
  // would set them inside a regrown tower — and then the strokes work anew.
  {const {g,station,mass,p}=boot();solveFormStation(station,massOf(g,station),{dt});
   const solved=Float64Array.from(mass.form.h),dock=LEVELS[0].platforms.find(q=>q.id==='pocket-dock');
   assert.equal(hopTo(g,MASS+6.7,6),'there');g.damage(true);for(let i=0;i<70;i++)g.tick(dt,{});
   assert.equal(g.deaths,1);assert.equal(p.groundId,'pocket-dock');assert(Math.abs(p.x-LEVELS[0].platforms.find(q=>q.id==='pocket-dock').checkpoint)<.01,'respawned at the dock flag');
   for(let i=0;i<10/dt;i++)g.tick(dt,{});
   let worst=0;for(let i=0;i<mass.form.n;i++)worst=Math.max(worst,Math.abs(mass.form.h[i]-solved[i]));
   assert(worst<=FORM.sag+1e-9,`ten idle seconds later the bridge is as the boots left it, no slump (${worst.toFixed(3)})`);
   assert.equal(landing(g),'landing','and it still carries the player across');
   // R under the boots is refused; R from the dock puts the clump back. (A
   // death used to leave the respawn timer a hair below zero, which read as
   // "still respawning" and left every station deaf to hands for good.)
   Object.assign(p,{x:MASS+12.7,y:surfaceAt(mass,MASS+12.7),vx:0,vy:0,groundId:mass.id});g.tick(dt,{});assert(standingOn(station,p)>=0,'back on the ramp');
   g.tick(dt,{shapeReset:true});assert.equal(station.amount,1,'R while standing on the clay is refused');
   Object.assign(p,{x:dock.x+5,y:dock.y,vx:0,vy:0,groundId:'pocket-dock'});g.tick(dt,{});
   g.tick(dt,{shapeReset:true});assert.equal(station.amount,0,'R from the dock softens the pocket back');
   assert(mass.form.h.every((h,i)=>h===mass.form.rest[i]),'to its clump');
   for(const input of formSolutionInputs(g,station,{dt}))g.tick(dt,input);
   assert.equal(station.amount,1);assert.equal(landing(g),'landing','and the strokes open it again');assert.equal(g.deaths,1);}
  // Sand scraped bare is deadly: press the spire's clay away from the dock's
  // end and the footing there shows; a walker who comes back onto it dies and
  // respawns at the dock with the clay as they left it.
  {const {g,station,mass,p}=boot();
   for(let k=0;k<8;k++)stroke(g,mass,{x:MASS+.3,lift:1,dx:0,dy:-6,t:1});
   assert(mass.form.h[0]<.05&&surfaceAt(mass,MASS+.5)<SAND+.2,`the dock end is scraped to the sand (${surfaceAt(mass,MASS+.5).toFixed(2)})`);
   for(let i=0;i<1/dt;i++)g.tick(dt,{moveAxis:1});
   assert(p.groundId===mass.id&&p.x>MASS+1.2&&!g.deaths,`walking off the dock carries the player past the bare strip onto clay (${p.x.toFixed(2)}, ${p.groundId})`);
   const kept=Float64Array.from(mass.form.h);
   for(let i=0;i<3/dt&&!g.deaths;i++)g.tick(dt,{moveAxis:-1});
   assert.equal(g.deaths,1,'walking back onto the bare sand kills');
   for(let i=0;i<70;i++)g.tick(dt,{});
   assert.equal(p.groundId,'pocket-dock');
   let worst=0;for(let i=0;i<mass.form.n;i++)worst=Math.max(worst,Math.abs(mass.form.h[i]-kept[i]));
   assert(worst<=FORM.sag+1e-9,'the clay is as they left it');}
  // A checkpoint past the pocket resumes with the pocket shaped: the save
  // carries the fact, and restore rebuilds the authored surface from it.
  {const {g,station,mass}=boot();solveFormStation(station,massOf(g,station),{dt});
   assert.equal(landing(g),'landing');g.tick(dt,{});
   assert.equal(g.checkpointId,'pocket-landing','the landing has a flag of its own');
   const save=JSON.parse(JSON.stringify(g.snapshot()));assert.deepEqual(save.shaped,[id]);
   const r=new Game();r.start(level);assert(r.restore(save));
   const rs=r.level.shaping.find(s=>s.id===id),rm=massOf(r,rs);
   assert.equal(rs.amount,1);
   let worst=0;for(let i=0;i<rm.form.n;i++)worst=Math.max(worst,Math.abs(rm.form.h[i]-solvedForm(level,id)[i]));
   assert.equal(worst,0,'a resumed pocket carries the solved surface');
   for(let i=0;i<120;i++)r.tick(dt,{});assert.equal(rs.amount,1,'and stays shaped');}
  console.log('PASS the pocket: shut while unworked; crossed by the authored lean-and-slump, by squash-and-slump, by a pillar and a stomp-launch, and by E-steps; every bead taken; deaths keep the clay, R works only from off it, and a save resumes it solved');
}

// The Weaver's Gap by keyboard alone. The canyon's rule carries the brink to
// the perch over the bough — E presses the stub where it towers, draws a skim
// onto the bare bark ahead, and at the clay's end lifts the ground underfoot.
// The mound is the one piece a hand cannot reach from where it is opened, so
// the perch runs up to its bark with the mushroom at the very end: standing
// at the mushroom's edge the block is within E's reach, and the key held
// there slumps it until the bounce can land on it; from there the far side
// is walked and stepped off onto the nest.
{
  const g=new Game();g.start(1);g.level.enemies=[];
  const P=id=>g.level.platforms.find(q=>q.id===id),p=g.player,bough=P('weave-bough'),mound=P('weave-mound'),perch=P('weave-perch'),spring=P('weave-spring');
  const boughStation=g.level.shaping.find(q=>q.id==='weave-bough'),moundStation=g.level.shaping.find(q=>q.id==='weave-mound');
  assert(spring.x+spring.w>=mound.x-1e-9&&perch.x+perch.w>=spring.x+spring.w-1e-9,'the mushroom sits at the perch\'s end, against the mound\'s bark');
  assert(spring.x-RULES.radius+FORM.stepReach>mound.x-FORM.stepRadius+.2,'and a player at its edge has the block within E\'s reach');
  Object.assign(p,{x:194,y:21.6,vx:0,vy:0,groundId:'gap-brink',facing:1});
  let t=0,heldE=0,hopTimer=0;
  for(let i=0;i<150/dt&&p.groundId!=='weave-perch'&&!g.deaths;i++){
    const aheadX=Math.max(bough.x,Math.min(bough.x+bough.w,p.x+FORM.stepReach)),rise=surfaceAt(bough,aheadX)-p.y,atWall=p.x>perch.x-.6;
    let input;
    if(atWall&&perch.y-p.y<2.4){input={moveAxis:1,jumpPressed:hopTimer<=0&&!!p.groundId,jumpHeld:true};if(input.jumpPressed)hopTimer=60;}
    else if(atWall||(p.x+FORM.stepReach>=bough.x-.3&&(rise>FORM.step||rise<-.05))){input={moveAxis:0,shapeHeld:true};p.facing=1;heldE++;}
    else input={moveAxis:1};
    hopTimer--;g.tick(dt,input);t+=dt;
  }
  assert.equal(p.groundId,'weave-perch',`a keyboard alone crosses the bough (ended at ${p.x.toFixed(1)}, ${p.y.toFixed(2)} after ${t.toFixed(0)}s)`);
  assert.equal(g.deaths,0,'without dying');assert(t<90,`in ${t.toFixed(0)}s`);assert(heldE>frames(5),'by holding E');
  assert.equal(boughStation.amount,1,'and the key alone moves enough of the bough to read as shaped');
  // Across the mound: hold E at the mushroom's edge while the block still
  // stands above what the bounce reaches, then bounce and steer onto the
  // clay; on it, press what towers while pressing still lowers it, hop when
  // it does not, and walk down whatever falls away.
  const tA=t;heldE=0;let sprung=false;const hist=[];g.onEvent=e=>{if(e.type==='spring')sprung=true;};
  const peak=()=>{let m=0;for(let i=0;i<mound.form.n;i++)m=Math.max(m,mound.form.h[i]);return mound.y-mound.h+m;};
  const across=()=>p.groundId===mound.id&&p.x>mound.x+mound.w-.4||(p.groundId&&p.groundId!==mound.id&&p.x>mound.x+mound.w);
  for(let i=0;i<120/dt&&!across()&&!g.deaths;i++){
    const onMass=p.groundId===mound.id;
    const aheadX=Math.max(mound.x,Math.min(mound.x+mound.w,p.x+FORM.stepReach)),ahead=surfaceAt(mound,aheadX),rise=ahead-p.y;
    hist.push(ahead);if(hist.length>60)hist.shift();const progressing=hist.length<60||hist[0]-ahead>.01;
    let input;
    if(onMass&&rise>FORM.step&&progressing){input={moveAxis:0,shapeHeld:true};p.facing=1;heldE++;}
    else if(onMass)input={moveAxis:1,jumpPressed:!progressing&&rise>FORM.step&&hopTimer<=0,jumpHeld:true};
    else if(!p.groundId)input={moveAxis:sprung?1:0,jumpHeld:true};
    else if(p.groundId==='weave-perch'&&p.x+FORM.stepReach>mound.x-FORM.stepRadius+.05&&peak()>spring.y+7&&progressing){input={moveAxis:0,shapeHeld:true};p.facing=1;heldE++;}
    else {input={moveAxis:1,jumpHeld:true};hist.length=0;}
    if(input.jumpPressed)hopTimer=60;hopTimer--;
    g.tick(dt,input);t+=dt;
  }
  assert(across(),`a keyboard alone crosses the mound (ended at ${p.x.toFixed(1)}, ${p.y.toFixed(2)} on ${p.groundId} after ${(t-tA).toFixed(0)}s)`);
  assert.equal(g.deaths,0,'without dying');assert(t-tA<60,`in ${(t-tA).toFixed(0)}s`);assert(sprung,'by way of the mushroom');assert(heldE>frames(5),'after holding E at its edge');
  assert.equal(moundStation.amount,1,'and the key alone moves enough of the mound to read as shaped');
  console.log(`PASS the Weaver's Gap by keyboard alone: E over the bough in ${tA.toFixed(0)}s, E at the mushroom's edge, the bounce and a walk over the mound in ${(t-tA).toFixed(0)}s`);
}

// Every gesture the game can ask for is either taught before the chapter that
// leans on it or arrives with its own words. The canyon and the forest now
// teach the free hand ('up', three formable masses), the caverns down and out;
// the pull to the right is first asked for in the Hanging Quarter, whose two
// pulls each say so in their hint.
const taught=new Set(LEVELS.slice(0,3).flatMap(L=>(L.shaping||[]).map(s=>s.gesture)));
assert.deepEqual([...taught].sort(),['down','out','up']);
for(const s of LEVELS[3].shaping)if(!taught.has(s.gesture))assert(/right/i.test(s.hint||''),`${s.id} asks for an untaught gesture (${s.gesture}) and does not say so`);
console.log('PASS the gestures the final chapter leans on are taught before it, or say themselves what they want');
