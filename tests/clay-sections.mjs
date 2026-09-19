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
import {solveFormStation,formSolutionInputs,standingOn,healFix} from '../dist/clay-rules.js';
import {fixPilot} from './fix-pilot.mjs';
import {FORM,formShare,formVolume,formRest} from '../dist/clay-form.js';
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
  if(station.rule==='form'&&station.fix){
    // A plug station (the lab's Fix the Structure): the mass is nowhere until
    // the block is pushed into the gap the rot leaves, and "shaped" is the
    // corner mended — the seated lump cast to the mould exactly. The rot fills
    // the bite the mass will, the block is a pushable stone the bite's size,
    // and the gap's floor is where it seats.
    assert.equal(piece.clayRole,'mass');assert(!station.free,`${L.short}: ${station.id} sits in its gap, not free on a footing`);
    assert.deepEqual(piece.shape.from,piece.shape.to,`${L.short}: ${piece.id} has no pose, only a surface`);
    assert(Array.isArray(station.clump)&&station.clump.length>=2&&Array.isArray(station.mould)&&station.mould.length>=2,`${L.short}: ${station.id} has a clump and a mould`);
    const rot=L.platforms.find(p=>p.id===station.fix.rot),block=L.platforms.find(p=>p.id===station.fix.block),floor=L.platforms.find(p=>p.id===station.fix.floor),depth=piece.shape.from.h;
    assert(rot?.kind==='crumble'&&rot.rot&&rot.delay<=.15&&rot.x===piece.x&&rot.w===piece.w&&rot.y===piece.y&&rot.h===depth,`${L.short}: ${rot?.id} fills ${piece.id}'s bite exactly and gives at once`);
    assert(block?.kind==='stone'&&block.push&&block.w===piece.w&&block.h===depth,`${L.short}: ${block?.id} is a pushable stone the bite's size`);
    assert(floor&&floor.x===piece.x&&floor.w===piece.w&&Math.abs(floor.y-(piece.y-depth))<1e-9,`${L.short}: ${floor?.id} is the gap's floor`);
    // The real game, from the station's spawn, through the plug pilot the
    // playthroughs use: the corner mends, to the mould exactly, the volume
    // kept and nobody hurt.
    const real=new Game();real.start(index);
    const rs=real.level.shaping.find(s=>s.id===station.id),rm=massOf(real,rs);
    Object.assign(real.player,rs.spawn,{vx:0,vy:0});real.tick(dt,{});
    assert.equal(nearbyStation(real)?.id,station.id,'the spawn is inside the stretch');
    let inputs=0;for(const input of fixPilot(real,rs)){real.tick(dt,input);inputs++;}
    assert(rs.done&&rs.sealed&&rs.fix.phase==='healed'&&rs.amount===1&&rs.announced,`${L.short}: the pilot mends ${station.id} (${rs.fix.phase} after ${inputs} inputs)`);
    assert(rm.active&&rm.form.h.every((h,i)=>h===rs.cast[i]),`${L.short}: ${piece.id} is cast to the mould exactly`);
    assert(Math.abs(formVolume(rm.form)-rm.form.volume)<1e-7,`${L.short}: ${piece.id} keeps its volume exactly when cast`);
    assert.equal(real.deaths,0);
    // The sweep's "shaped" (routes.mjs applySolvedForm → healFix) is the very
    // same corner.
    const swept=new Game();swept.start(index);const ss=swept.level.shaping.find(s=>s.id===station.id);healFix(ss);
    const sm=massOf(swept,ss);
    assert(sm.active&&ss.done&&sm.form.h.every((h,i)=>h===rm.form.h[i]),`${L.short}: the sweep heals ${piece.id} to the surface the pilot casts`);
    continue;
  }
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
    // A rock run is not shaped by a share of clay moved but by its rock going
    // over the edge: solved from the clump, the surface alone has to send it
    // off, and the station reads as done only once the rock is down.
    const rock=!!live.marble?.spill;
    if(rock){
      assert(live.amount<1,`${L.short}: ${station.id} is not shaped before its rock has gone`);
      for(let i=0;i<2400&&!live.done;i++)g.tick(dt,{});
      assert(live.done&&live.ball.spilled,`${L.short}: ${station.id}'s solved surface sends the rock over the edge`);
      assert.equal(live.amount,1);
    } else {
      assert.equal(live.amount,1);assert(live.announced);
      assert(live.shaped>FORM.shaped*2,`${L.short}: ${station.id} asks for more than the lab's share before it reads as shaped`);
      assert.equal(formShare(f,live.shaped*1.2),1,`${L.short}: the solution moves a fifth more clay than the station needs`);
    }
    // The same strokes as a player's pointer would make them, through the
    // real game with the player on the dock, come to the very same surface —
    // so the pilot's inputs and the routes sweep's cached surface agree, and
    // the pointer path is the solver path.
    const real=new Game();real.start(index);
    const rs=real.level.shaping.find(s=>s.id===station.id),rm=massOf(real,rs);
    Object.assign(real.player,rs.spawn,{vx:0,vy:0});real.tick(dt,{});
    assert.equal(nearbyStation(real)?.id,station.id,'the spawn is inside the stretch');
    let inputs=0;for(const input of formSolutionInputs(real,rs,{dt})){real.tick(dt,input);inputs++;}
    for(let i=0;i<(rock?2400:60)&&!(rock&&rs.done);i++)real.tick(dt,{});
    assert.equal(rs.amount,1);assert(rs.announced);assert.equal(real.deaths,0);
    const cached=solvedForm(index,station.id);let worst=0;
    for(let i=0;i<f.n;i++)worst=Math.max(worst,Math.abs(rm.form.h[i]-cached[i]),Math.abs(f.h[i]-cached[i]));
    // Wet clay has begun to slump in the half second since the hand left it,
    // so it is held to the solved surface within that slump rather than bitwise.
    if(rs.pace)assert(worst<1e-3,`${L.short}: ${inputs} real inputs make the solved surface, less half a second's slump (max |Δh| ${worst})`);
    else assert.equal(worst,0,`${L.short}: ${inputs} real inputs make the solved surface bitwise (max |Δh| ${worst})`);
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
  // The canyon's pocket is not here: since layout 12 it is level wet clay the
  // riverbed is walked across, and what it gates is a flower, not the way on.
  // Its own drill is below.
  // The mesa's pool is walked onto flat; what it guards is the cave below,
  // floored over with planks only its boulder breaks — so the bypass is the
  // drop off the pool's edge, which lands on whole planks until it is worked.
  {level:0,station:'boulder-run',bypass:{from:'boulder-pool',to:'cave-floor',mode:'fall'},rideable:true,form:true},
  {level:1,station:'weave-bough',bypass:{from:'gap-brink',to:'weave-perch',mode:'jump'},form:true},
  {level:1,station:'weave-mound',bypass:{from:'weave-spring',to:'canopy-nest',mode:'jump'},form:true},
  // The gallery's rotten corner: the mass is nowhere until the block is seated,
  // the rot in its place gives under a stand and is no take-off, and from the
  // gap's floor the watch deck is out of reach.
  {level:2,station:'gallery-fix',bypass:{from:'gallery-corner',to:'gallery-watch',mode:'jump'},form:true,plug:true},
  // The Soft Dream: one purple beat per section — three in the Folding Path,
  // whose two free masses are walked onto flat — and three strands in the knot.
  // The garden's is a free mass whose bulb bars the bed until it is worked.
  {level:4,station:'garden-bed',bypass:{from:'garden-dock',to:'garden-exit',mode:'jump'},form:true},
  // The roll hangs beside the cliff within a hop's reach; standing on it gains nothing while the wall beyond stands.
  {level:4,station:'folding-tongue',bypass:{from:'folding-entry',to:'folding-wall-bridge',mode:'jump'},rideable:true},
  // The slab is a floor under a hanging sheet until a trench is cast through it;
  // the wall's bed is bare nails until the wall is laid down over them.
  {level:4,station:'folding-cast',bypass:{from:'folding-land',to:'folding-cast-bridge',mode:'jump'},rideable:true,form:true},
  {level:4,station:'folding-wall',bypass:{from:'folding-far',to:'folding-wall-land',mode:'jump'},rideable:true,form:true},
  // The blob is walked onto flat before it is pulled up into a stair.
  {level:4,station:'orchard-blob',bypass:{from:'orchard-mid',to:'orchard-under',mode:'jump'},rideable:true,form:true},
  {level:4,station:'corridor-plug',bypass:{from:'corridor-floor-1',to:'corridor-floor-2',mode:'jump'}},
  // The clot is a stepping stone in the riverbed before it is pressed flat.
  {level:4,station:'river-clot',bypass:{from:'river-raft',to:'river-far-bank',mode:'jump'},rideable:true},
  {level:4,station:'room-floor-mass',bypass:{from:'room-doll-table',to:'room-shaft-foot',mode:'jump'},rideable:true,form:true},
  {level:4,station:'knot-strand-a',bypass:{from:'knot-pier-a',to:'knot-ledge-b',mode:'jump'}},
  {level:4,station:'knot-strand-b',bypass:{from:'knot-stand-b',to:'knot-ledge-c',mode:'jump'}},
  // Strand C is landed on unworked and spread while standing on it.
  {level:4,station:'knot-strand-c',bypass:{from:'knot-ledge-c',to:'knot-crown',mode:'jump'},rideable:true}
];

for(const {level,station,bypass,rideable,form,plug} of SECTIONS){
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
    if(plug){
      // A plug's mass is no ground at all until the block is seated: the rot
      // fills its bite, gives within a beat of a stand and grants no jump, and
      // the gap's floor under it is too low for the way on.
      const g=new Game();g.start(level);const live=g.level.shaping.find(q=>q.id===station),mass=massOf(g,live);
      assert.equal(mass.active,false,`${L.short}: the unworked ${piece.id} has no body to land on`);
      const rot=g.level.platforms.find(q=>q.id===live.fix.rot),p=g.player;
      Object.assign(p,{x:rot.x+rot.w/2,y:rot.y+.5,vx:0,vy:0,groundId:null,coyote:0});
      let stood=false,fell=-1;
      for(let i=0;i<frames(1);i++){g.tick(dt,{jumpPressed:true,jumpHeld:true});if(p.groundId===rot.id){stood=true;assert.equal(p.coyote,0,`${L.short}: a stand on ${rot.id} is a take-off`);}if(rot.broken){fell=i;break;}}
      assert(stood&&rot.broken&&fell*dt<rot.delay+.3,`${L.short}: ${rot.id} gives within a beat of a stand (${(fell*dt).toFixed(2)}s)`);
      assert.equal(crossing(level,{from:live.fix.floor,to:bypass.to,mode:'jump'},{shaped:other=>other.id!==station}),null,
        `${L.short}: ${bypass.to} is reachable from the gap's floor ${live.fix.floor} with ${station} unworked`);
    } else if(form){
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
// impossible to get past. A next piece that is stood on unworked (rideable) is
// reached by design — it is walked onto to be worked — so for it only the way
// past, its bypass, has to stay out of reach.
for(const [k,here] of SECTIONS.entries()){
  const next=SECTIONS[k+1];if(!next||next.level!==here.level)continue;
  const L=LEVELS[here.level],piece=L.shaping.find(s=>s.id===here.station).parts[0];
  const unworked=other=>other.id!==here.station&&other.id!==next.station;
  const nextPiece=L.shaping.find(s=>s.id===next.station).parts[0];
  for(const to of next.rideable?[next.bypass.to]:[nextPiece,next.bypass.to])
    assert.equal(crossing(here.level,{from:piece,to,mode:'jump'},{shaped:unworked}),null,
      `${L.short}: from on top of the unworked ${piece}, ${to} is reachable without shaping ${next.station}`);
}
console.log('PASS softening a finished piece underfoot never opens a way past the next one');

// --- the pocket, walked and climbed ---------------------------------------------------
// Since layout 12 the pocket is wet clay resting level with its dock and its
// landing: the riverbed is a walk, and the clay is for the flower on the perch
// over it. So: the walk unworked, the perch out of reach of a jump and of a
// stomp off the level clay, reached off the pillar the authored stroke pulls
// up, the pillar melting unless a hand is on it, R, the beads, the sand under
// it all, and a resume.
{
  const level=0,id='canyon-pocket';
  const boot=()=>{
    const g=new Game();g.start(level);g.level.enemies=[];
    const station=g.level.shaping.find(s=>s.id===id),mass=massOf(g,station),dock=g.level.platforms.find(p=>p.id==='pocket-dock');
    Object.assign(g.player,{x:dock.checkpoint,y:dock.y,vx:0,vy:0,groundId:dock.id,coyote:.13});g.tick(dt,{});
    assert.equal(g.checkpointId,dock.id,'the dock flag is the pocket\'s checkpoint');
    return {g,station,mass,p:g.player};
  };
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
  const PERCH=LEVELS[0].platforms.find(q=>q.id==='pocket-perch'),FLOWER=LEVELS[0].stamps.find(c=>c.x>PERCH.x&&c.x<PERCH.x+PERCH.w);
  const UNDER=PERCH.x+PERCH.w/2,DOCK=LEVELS[0].platforms.find(q=>q.id==='pocket-dock').x,END=(q=>q.x+q.w)(LEVELS[0].platforms.find(q=>q.id==='pocket-landing'));
  assert(PERCH.optional&&FLOWER,'the perch is an optional ledge with a flower over it');
  const under=(g,mass)=>Object.assign(g.player,{x:UNDER,y:surfaceAt(mass,UNDER),vx:0,vy:0,groundId:mass.id,coyote:.13});
  // Jump, or jump and stomp, straight up under the perch; report the feet's
  // apex and whether the perch was landed on.
  const leap=(g,stomp)=>{const p=g.player;let apex=p.y,landed=false;
    for(let i=0;i<300;i++){g.tick(dt,{jumpPressed:i===0,jumpHeld:true,stompPressed:stomp&&i===15});apex=Math.max(apex,p.y);if(p.groundId==='pocket-perch'){landed=true;break;}}
    return {apex,landed};};

  // Unworked, the riverbed is a walk: dock to landing without a hand on the clay.
  {const {g,station}=boot();const r=landing(g);assert.equal(r,'landing',`the level pocket is walked across unworked (${r})`);assert.equal(g.deaths,0);
   assert(station.amount<.5,`walking across is not shaping it (${station.amount.toFixed(2)})`);}
  // The river gives: a straight walk across wades it, boots on the clay every
  // tick and never held up — the dent the walker presses is no wall to the
  // clay ahead — and the wader rides well below the level top.
  {const {g,mass,p}=boot();let low=Infinity,stalls=0,air=0,last=p.x;
   for(let i=0;i<20/dt&&p.groundId!=='pocket-landing';i++){
     g.tick(dt,{moveAxis:1});
     if(p.x>mass.x+.5&&p.x<mass.x+mass.w-.5){low=Math.min(low,p.y);if(!p.groundId)air++;if(Math.abs(p.x-last)<.004)stalls++;}
     last=p.x;
   }
   assert.equal(p.groundId,'pocket-landing','the wade reaches the landing');assert.equal(g.deaths,0);
   assert.equal(stalls,0,'the walker is never held up on the clay');assert(air<=6,`the walker keeps the clay under their boots (${air} ticks in the air)`);
   assert(low<mass.y-.3,`a walker wades the river, well below its level top (${(mass.y-low).toFixed(2)} deep)`);}
  // The perch is out of reach from the level clay, by jump and by stomp.
  {const {g,mass}=boot();under(g,mass);const j=leap(g,false);assert(!j.landed&&j.apex<PERCH.y-1,`a jump off the level clay falls short of the perch (feet to ${j.apex.toFixed(2)}, perch ${PERCH.y})`);}
  // The pocket is not bouncy: a stomp into it is a crater and nothing more —
  // no throw, no `spring`, and the boots stay in the clay they pressed.
  // Wet clay heals a crater in seconds, so the crater is read at its deepest.
  {const {g,mass,p}=boot();under(g,mass);const springs=[];g.onEvent=e=>{if(e.type==='spring')springs.push(e);};
   const before=surfaceAt(mass,UNDER);let apex=p.y,lowest=before;
   for(let i=0;i<300;i++){g.tick(dt,{jumpPressed:i===0,jumpHeld:true,stompPressed:i===15});apex=Math.max(apex,p.y);lowest=Math.min(lowest,surfaceAt(mass,UNDER));assert.notEqual(p.groundId,'pocket-perch','a stomp off the level clay never reaches the perch');}
   assert(apex<PERCH.y-.5,`a stomp off the level clay falls short too (feet to ${apex.toFixed(2)})`);
   assert.equal(springs.length,0,'the first chapter\'s clay does not throw a stomper back up');
   assert(lowest<before-.1,`the stomp craters the clay (${(before-lowest).toFixed(2)})`);
   assert.equal(p.groundId,mass.id,'and the stomper stays on the clay');
   // The crater is the give's, and the give can never thin the clay past what
   // the mass allows over the spikes.
   const f=mass.form,thinnest=Math.min(...Array.from(f.h,(h,i)=>h-mass.give.depth[i]));
   assert(Math.max(...mass.give.depth)>1,`the crater is pressed into the give (${Math.max(...mass.give.depth).toFixed(2)})`);
   assert(thinnest>=FORM.minThick-1e-9,`the clay under the crater is never thinner than the mass allows (${thinnest.toFixed(2)})`);}
  // The river gives under weight like the lab's Sag & Set: a stand sinks the
  // boots about a unit within the second, smoothly — no tick moves the surface
  // faster than the springs' sink — with soft shoulders swelling beside them.
  {const {g,mass,p}=boot();under(g,mass);const f=mass.form,base=mass.y-mass.h,y0=p.y;let worst=0,last=surfaceAt(mass,UNDER);
   for(let i=0;i<120;i++){g.tick(dt,{});const y=surfaceAt(mass,UNDER);worst=Math.max(worst,Math.abs(y-last));last=y;}
   assert.equal(p.groundId,mass.id,'the stander stays on the clay');
   assert(y0-p.y>.8&&y0-p.y<1.5,`a stand sinks the boots about a unit (${(y0-p.y).toFixed(2)})`);
   assert(worst<=mass.give.tune.sink*dt+1e-6,`the surface sinks no faster than the springs allow (${worst.toFixed(4)} a tick)`);
   const shoulder=Math.max(...[2,2.5,3,-2,-2.5,-3].map(d=>surfaceAt(mass,UNDER+d)-(base+formRest(f,UNDER+d-mass.x))));
   assert(shoulder>.08,`the clay pushed aside swells into shoulders beside the boots (${shoulder.toFixed(2)})`);
   assert(mass.form.h.every((h,i)=>Math.abs(h-mass.form.rest[i])<.05),'the stand works the give, not the columns');
   // Off it, the river flows back: the dent and what it kept are gone within
   // the wet pace's seconds, and the surface is level again.
   Object.assign(p,{x:DOCK+4,y:6.25,vx:0,vy:0,groundId:'pocket-dock'});let t=0;
   while((Math.max(...mass.give.depth)>.05||Math.max(...mass.give.set)>.02)&&t<12){g.tick(dt,{});t+=dt;}
   assert(t>.3&&t<8,`the river heals its dent once the boots have left (${t.toFixed(2)}s)`);
   assert(Math.abs(surfaceAt(mass,UNDER)-(base+formRest(f,UNDER-mass.x)))<.08,`and lies at its rest again (${surfaceAt(mass,UNDER).toFixed(2)})`);}
  // A walk leaves a track, and the track flows back too — once the walker is
  // off the clay altogether: a stand on its very lip still weighs on it.
  {const {g,mass,p}=boot();assert.equal(landing(g),'landing');
   const kept=Math.max(...mass.give.set);assert(kept>.1,`the walk across leaves a kept track (${kept.toFixed(2)})`);
   Object.assign(p,{x:END-2,y:6.2,vx:0,vy:0,groundId:'pocket-landing'});
   for(let i=0;i<8/dt;i++)g.tick(dt,{});
   assert(Math.max(...mass.give.depth)<.05&&Math.max(...mass.give.set)<.02,`the track has flowed back eight seconds on (${Math.max(...mass.give.depth).toFixed(3)} deep, ${Math.max(...mass.give.set).toFixed(3)} kept)`);}
  // The give is lighter than the bench's so the flower stays in reach: stand a
  // whole second on the pulled pillar — sinking into it while it melts — and
  // the jump still lands on the perch.
  {const {g,station,mass}=boot();
   for(const input of formSolutionInputs(g,station,{dt}))g.tick(dt,input);
   under(g,mass);for(let i=0;i<120;i++)g.tick(dt,{});
   const j=leap(g,false);assert(j.landed,`a jump off the pillar after a second's stand still lands on the perch (feet to ${j.apex.toFixed(2)})`);}
  // The authored stroke pulls a pillar up under the perch; a jump off it lands
  // there and the flower is taken.
  {const {g,station,mass,p}=boot();
   for(const input of formSolutionInputs(g,station,{dt}))g.tick(dt,input);
   assert.equal(station.amount,1,'the pull reads as shaped');
   const top=surfaceAt(mass,UNDER);assert(top>PERCH.y-2.6,`the pillar's top (${top.toFixed(2)}) is within a jump of the perch`);
   under(g,mass);const j=leap(g,false);assert(j.landed,`a jump off the pillar lands on the perch (feet to ${j.apex.toFixed(2)})`);
   for(let i=0;i<30;i++)g.tick(dt,{});assert(g.level.stamps.find(c=>c===FLOWER||c.x===FLOWER.x&&c.y===FLOWER.y).taken,'and takes the flower');assert.equal(g.deaths,0);
   // Off the perch, the way on is the landing.
   assert.equal(landing(g),'landing');}
  // Wet: left alone the pillar melts in seconds; a rider's weight does not hold it; a hand does.
  {const {g,station,mass}=boot();
   for(const input of formSolutionInputs(g,station,{dt}))g.tick(dt,input);
   const top=surfaceAt(mass,UNDER),level=6.2;let t=0;
   while(surfaceAt(mass,UNDER)>level+(top-level)*.25&&t<20){g.tick(dt,{});t+=dt;}
   assert(t>.6&&t<8,`the pillar has slumped three quarters of the way back after ${t.toFixed(1)}s`);}
  {const {g,station,mass,p}=boot();
   for(const input of formSolutionInputs(g,station,{dt}))g.tick(dt,input);
   under(g,mass);const y0=p.y;for(let i=0;i<4/dt;i++)g.tick(dt,{});
   assert(p.groundId===mass.id&&p.y<y0-1,`standing on the pillar does not hold it: the rider sinks with it (${(y0-p.y).toFixed(2)})`);}
  {const {g,station,mass}=boot();
   for(const input of formSolutionInputs(g,station,{dt}))g.tick(dt,input);
   const top=surfaceAt(mass,UNDER);
   for(let i=0;i<4/dt;i++)g.tick(dt,{moveAxis:0,shapeId:id,shapeX:UNDER,shapeY:top});
   assert(surfaceAt(mass,UNDER)>top-.3,`a hand on the pillar holds it (${surfaceAt(mass,UNDER).toFixed(2)} of ${top.toFixed(2)})`);}
  // R softens the pocket from off the clay, and is refused under the boots.
  {const {g,station,mass,p}=boot();
   for(const input of formSolutionInputs(g,station,{dt}))g.tick(dt,input);
   under(g,mass);g.tick(dt,{});g.tick(dt,{shapeReset:true});
   assert(surfaceAt(mass,UNDER)>7,'R while standing on the clay is refused');
   const dock=LEVELS[0].platforms.find(q=>q.id==='pocket-dock');
   Object.assign(p,{x:dock.x+4,y:dock.y,vx:0,vy:0,groundId:'pocket-dock'});g.tick(dt,{});g.tick(dt,{shapeReset:true});
   assert(mass.form.h.every((h,i)=>h===mass.form.rest[i]),'from the dock, R puts the level clump back');assert.equal(station.amount,0);
   assert(mass.give.depth.every(d=>d===0)&&mass.give.set.every(d=>d===0)&&mass.give.velocity.every(v=>v===0),'and flattens the give with it');}
  // The beads: every one in the pocket is picked up on the walk across, by
  // walking or by a standing hop under it.
  {const {g,p}=boot();
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
  // The sand under it all: spikes lie just under the clay's base, so bare
  // sandstone kills; the rest surface, the thinnest clay the mass allows and
  // the solved surface all stand clear of them — the last with the deepest
  // the give can press a stander in, which is capped at the thinnest clay.
  {const {g,station,mass}=boot();
   const band=g.level.hazards.find(h=>h.x<=mass.x&&h.x+h.w>=mass.x+mass.w&&h.y<mass.y-mass.h&&h.y>mass.y-mass.h-1);
   assert(band,'spikes lie just under the pocket\'s base');
   const kill=band.y+.7,f=mass.form,base=mass.y-mass.h;
   for(let i=0;i<f.n;i++)assert(base+f.rest[i]>=kill+.1,`rest column ${i} sits on the spikes`);
   assert(base+FORM.minThick>kill,'the thinnest clay the mass allows is above the kill line');
   const solved=solvedForm(level,id),deepest=h=>Math.min(mass.give.tune.maxDepth,Math.max(0,h-FORM.minThick));
   for(let i=0;i<f.n;i++){f.h.set(solved);if(!formSteepAt(mass,mass.x+i*f.dx,RULES.radius))assert(base+solved[i]-deepest(solved[i])>kill,`solved column ${i} is a stand away from the spikes`);}}
  // A save past the pocket resumes with the riverbed walkable and the flower kept.
  {const {g,station,mass,p}=boot();
   for(const input of formSolutionInputs(g,station,{dt}))g.tick(dt,input);
   under(g,mass);assert(leap(g,false).landed);for(let i=0;i<30;i++)g.tick(dt,{});
   assert.equal(landing(g),'landing');for(let i=0;i<300&&g.checkpointId!=='pocket-landing';i++)g.tick(dt,{moveAxis:1});
   assert.equal(g.checkpointId,'pocket-landing','the landing has a flag of its own');
   const save=JSON.parse(JSON.stringify(g.snapshot()));assert(save.stamps.length>=1,'the flower is in the save');
   const r=new Game();r.start(level);assert(r.restore(save));
   assert(r.level.stamps.some(c=>c.taken&&c.x===FLOWER.x),'a resume keeps the flower');
   assert.equal(r.player.groundId,'pocket-landing');
   const rs=r.level.shaping.find(s=>s.id===id),rm=massOf(r,rs);
   Object.assign(r.player,{x:DOCK+8,y:6.25,vx:0,vy:0,groundId:'pocket-dock'});r.tick(dt,{});
   assert.equal(hopTo(r,LEVELS[0].platforms.find(q=>q.id==='pocket-landing').checkpoint),'landing','and the riverbed is still a walk');void rm;}
  console.log('PASS the pocket: walked unworked; the perch past a jump and a stomp off the level clay (a stomp that craters but does not throw) and reached off the pulled-up pillar with its flower; the pillar melts unless a hand holds it; R from the dock; every bead; the sand under it; a save keeps the flower');
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
// teach the free hand ('up', three formable masses), the caverns down (the
// gallery's plug is stomped out and pressed flat; the Kiln's tower and plug,
// which taught down and out, are gone since layout 11); the pull to the right
// is first asked for in the Hanging Quarter, whose two pulls each say so in
// their hint.
const taught=new Set(LEVELS.slice(0,3).flatMap(L=>(L.shaping||[]).map(s=>s.gesture)));
assert.deepEqual([...taught].sort(),['down','up']);
for(const s of LEVELS[3].shaping)if(!taught.has(s.gesture))assert(/right/i.test(s.hint||''),`${s.id} asks for an untaught gesture (${s.gesture}) and does not say so`);
console.log('PASS the gestures the final chapter leans on are taught before it, or say themselves what they want');
