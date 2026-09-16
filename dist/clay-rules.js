// Experimental clay behaviours, kept out of shaping.js on purpose. These are
// the ideas that ask what clay does beyond holding a shape you pushed it into —
// it gives under weight and keeps part of it, it stores the energy you press into
// it, it takes an impression, and it can be formed freely. Only the last has
// left the lab: the canyon's Sandwright's Pocket is one formable mass, and
// tests/clay-lab.mjs holds that no other rule reaches a chapter. Sag, catapult
// and stamp stay on the bench.
//
// Every rule is a pure function of the station, the player and dt, so the whole
// set can be driven headlessly.
import {clampShape} from './shaping.js';
import {GIVE,createGive,pressGive,kickGive,holdUnder,stepGive,giveDepth,giveVelocity,giveShare} from './clay-give.js';
import {FORM,createForm,resetForm,formHeight,formShare,pullForm,pressForm,pokeForm,sagForm,stepForm,beginForm,easeForm} from './clay-form.js';
// The fixed tick, the same as simulation.js's FIXED_DT; named here so the
// solver below needs nothing from the simulation.
const TICK=1/120;

export const RULES=Object.freeze(['sag','catapult','stamp','form']);
export const isRule=name=>RULES.includes(name);

// How fast any amount chases its target. Matches the hand-worked rate in
// shaping.js so ruled clay never feels like a different material.
export const CHASE=.9;

// Stations whose parts move independently carry an amount each. Everything
// else keeps the single amount the chapters use.
export const perPart=station=>station.rule==='stamp';

export function initializeRule(station,L){
  if(!station.rule)return;
  if(!isRule(station.rule))throw new Error(`Unknown clay rule: ${station.rule}`);
  // The formable mass needs its surface before the first tick collides with
  // it, so it is built here rather than lazily like the sag block's springs.
  if(station.rule==='form'){
    station.grip=null;station.poke=null;station.pressed=false;station.punch=0;station.fall=0;station.stomped=false;
    const s=L?.platforms.find(q=>q.id===station.parts[0]);
    if(s)station.form=s.form=createForm(s.w,s.h,station.clump,{free:!!station.free});
  }
  if(perPart(station)){
    station.amounts=station.parts.map(()=>0);
    station.targets=station.parts.map(()=>0);
  }
  station.charge=0;station.standing=false;station.launched=0;
}

// The shared chase, per part where a station has parts that move apart.
export function stepAmounts(station,dt){
  if(!perPart(station))return false;
  for(let i=0;i<station.amounts.length;i++){
    const target=station.targets[i],amount=station.amounts[i];
    station.amounts[i]=amount+Math.sign(target-amount)*Math.min(Math.abs(target-amount),dt*CHASE);
  }
  // The station as a whole is only finished when its slowest part is, which is
  // what the checkpoint save and the "shaped" announcement both want to know.
  station.amount=Math.min(...station.amounts);
  station.target=Math.min(...station.targets);
  return true;
}

export const partAmount=(station,index)=>perPart(station)?station.amounts[index]:station.amount;

// How much of a station reads as worked in the pause menu. A stair is only
// shaped once its lowest slab is up, but three risen slabs out of four is not
// "0% shaped", so a row of slabs reports the share of the work that is done.
export const shapedShare=station=>perPart(station)?station.amounts.reduce((sum,a)=>sum+a,0)/station.amounts.length:station.amount;

// Which of a station's parts the player is standing on, or -1.
export function standingOn(station,player){
  return station.parts.indexOf(player.groundId);
}

// A stomp lands on one piece of clay. A stamping station raises only that
// piece; every other rule takes the press across the whole station.
export function stompRule(station,partIndex){
  if(!station.rule)return false;
  // A stomp is a knead, whatever the clay does with it.
  station.kneadPending=true;
  // A stomp into the soft block presses a crater where the boots land, on top
  // of what the fall alone does to it.
  if(station.rule==='sag'){station.punch=(station.punch||0)+GIVE.stomp;return true;}
  // A stomp into the formable mass is a crater where the boots land, and the
  // clay throws the stomper back up on the next tick, once it has them.
  if(station.rule==='form'){station.punch=(station.punch||0)+FORM.stomp;station.stomped=true;return true;}
  if(perPart(station)){
    if(partIndex<0)return false;
    station.targets[partIndex]=1;return true;
  }
  station.target=clampShape(station.target+.5);return true;
}

// Which ruled clay also answers to a hand. Packing a lump and raising a slab
// are things palms do as naturally as boots, so those take the hold, the drag
// and the tap. The sag clay does not: weight is the whole idea there, and a
// hand on it would turn it back into ordinary kneaded clay. Clay with no rule
// is hand-worked by definition.
export const HANDS=Object.freeze(['catapult','stamp','form']);
export const takesHands=station=>!station.rule||HANDS.includes(station.rule);

// The hand rates match the hand-worked clay in shaping.js, for the same reason
// the chase does.
const KNEAD=.65,NUDGE=.3;

// Holding E has no pointer to aim it, so on a row of slabs it works the one the
// player plainly means: the slab underfoot, which carries them up with it, else
// the nearest slab they are facing, else simply the nearest.
export function heldPart(game,station){
  const p=game.player,under=standingOn(station,p);if(under>=0)return under;
  const slabs=station.parts.map((id,i)=>({i,s:game.level.platforms.find(q=>q.id===id)})).filter(o=>o.s);
  const gap=({s})=>Math.max(s.x-p.x,0,p.x-s.x-s.w),nearest=list=>list.reduce((best,o)=>!best||gap(o)<gap(best)?o:best,null);
  return (nearest(slabs.filter(({s})=>(s.x+s.w/2-p.x)*(p.facing||1)>0))??nearest(slabs))?.i??-1;
}

// The hold and the drag on ruled clay that takes hands. It runs before the rule
// each tick so the rule can see whether a hand is on the clay. `live` says the
// player is in this station's stretch and able to work it; the latch below
// reads the raw input regardless, because a launch can carry the player right
// out of the stretch with the key still down.
export function handRule(game,station,dt,input,{live=false}={}){
  if(!takesHands(station))return false;
  station.hand=false;
  // The formable mass remembers its surface here, before anything moves it.
  if(station.rule==='form'&&station.form)beginForm(station.form);
  const touching=!!(input.shapeHeld||input.shapeId===station.id);
  // A lump that has just thrown the player ignores the hand that armed it until
  // that hand lets go. Otherwise a held key, or a thumb resting on the clay,
  // re-packs it underfoot and the experiment becomes an endless trampoline.
  if(!touching)station.spent=false;
  // A grip on the formable mass lasts exactly as long as the pointer is down
  // and the player is in the stretch; the next touch starts afresh.
  if(!live||!touching||station.spent){if(station.rule==='form')station.grip=null;return false;}
  station.hand=true;
  if(station.rule==='form')return formHand(game,station,dt,input);
  const dragging=input.shapeId===station.id&&Number.isFinite(input.shapeAmount);
  // A hand that moves a target is kneading; one resting on finished clay is not.
  const set=(list,i,value)=>{if(list[i]!==value){list[i]=value;station.worked=true;}};
  if(perPart(station)){
    const part=input.shapePart;
    if(dragging&&Number.isInteger(part)&&part>=0&&part<station.targets.length)set(station.targets,part,clampShape(input.shapeAmount));
    if(input.shapeHeld){const i=heldPart(game,station);if(i>=0)set(station.targets,i,clampShape(station.targets[i]+dt*KNEAD));}
    return true;
  }
  if(input.shapeHeld)set(station,'target',clampShape(station.target+dt*KNEAD));
  if(dragging)set(station,'target',clampShape(input.shapeAmount));
  return true;
}

// A tap on ruled clay that takes hands: one press, on the slab that was tapped
// where the station has slabs.
export function nudgeRule(station,part,point){
  if(!takesHands(station)||station.spent)return false;
  // A tap on the formable mass is a poke where it landed; it is applied on the
  // next tick, where the rule has the clay to hand.
  if(station.rule==='form'){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
    station.poke={x:point.x,y:point.y};station.kneadPending=true;return true;
  }
  if(perPart(station)){
    if(!(Number.isInteger(part)&&part>=0&&part<station.targets.length)||station.targets[part]>=1)return false;
    station.targets[part]=clampShape(station.targets[part]+NUDGE);station.kneadPending=true;return true;
  }
  if(station.target>=1)return false;
  station.target=clampShape(station.target+NUDGE);station.kneadPending=true;return true;
}

// One tick of a ruled station. Returns true when it has taken charge of the
// station's target. Hands never fall through to ruled clay either way: they
// reach it only through handRule, and only where takesHands allows.
export function applyRule(game,station,dt,{near=false}={}){
  const p=game.player,index=standingOn(station,p),on=index>=0;
  station.standing=on;

  if(station.rule==='sag'){
    // Weight is the tool. The block gives wherever the player stands, gives
    // back only a little when they leave, and keeps the rest: the surface lives
    // in clay-give.js and the collider reads it directly.
    const s=game.level.platforms.find(q=>q.id===station.parts[0]);if(!s)return true;
    const f=station.give=s.give||(s.give=createGive(s.w)),x=p.x-s.x;
    // The tick after a jump off the clay: a little of whatever was pressed in
    // past a settled stand comes back as height, and the push-off drives the
    // clay in behind.
    // The press is measured from the rest surface, not from the kept dent, since
    // weight sinks a kept dent exactly as deep as fresh clay.
    if(!on&&station.pressed&&p.groundId===null&&p.vy>0){
      const extra=Math.max(0,station.press-GIVE.reboundFrom),boost=Math.min(GIVE.reboundMax,extra*extra*GIVE.reboundGain);
      p.vy+=boost;kickGive(f,x,GIVE.recoil*p.vy);
      if(boost>3)game.event('spring',{platformId:s.id,x:p.x,y:p.y});
    }
    // Arriving, the clay takes the fall that was recorded while airborne: the
    // landing itself has already zeroed the player's speed by now.
    if(on&&!station.pressed)station.punch=(station.punch||0)+GIVE.landing*Math.min(GIVE.landingMax,Math.max(0,-(station.fall||0)));
    if(on)pressGive(f,x,GIVE.weight+(station.punch||0));
    station.punch=on?(station.punch||0)*Math.exp(-dt/GIVE.punch):0;
    // Weight working the block is kneading too, for as long as the clay under
    // the boots is still sinking: standing on a settled dent, which only ever
    // creeps and sets, is not.
    stepGive(f,dt);
    if(on&&giveVelocity(f,x)>.08)station.worked=true;
    if(!on&&p.vy>0&&p.x>s.x&&p.x<s.x+s.w)holdUnder(f,x,s.y-p.y,p.vy);
    if(on)station.press=giveDepth(f,x)+Math.max(0,-giveVelocity(f,x))*GIVE.reboundLead;
    station.pressed=on;station.fall=on?0:p.vy;
    // Shaped means set: the deepest press the clay has kept, as a share of the
    // most it keeps. One good stand does it, which is what the name promises.
    station.amount=station.target=giveShare(f);
    return true;
  }

  if(station.rule==='catapult'){
    // Compression you can feel: every stomp or press packs the lump tighter,
    // and the moment it cannot take another it throws back whatever is standing
    // on it. Packing it from the dock only arms it; it fires when someone is on.
    if(station.amount>=.999&&on&&!(station.launched>0)){
      p.vy=station.launch??19;p.groundId=null;p.coyote=0;p.springing=true;p.stomping=false;p.stompWindup=0;
      // Let the lump swell back at its own pace rather than snapping: a surface
      // that leaps a unit in one tick is moving upward faster than the launch,
      // and the landing check catches the player straight back onto it.
      station.launched=.35;station.target=0;station.spent=true;station.hand=false;
      game.event('spring',{platformId:station.parts[index],x:p.x,y:p.y});
      return true;
    }
    station.launched=Math.max(0,(station.launched||0)-dt);
    // Packed clay only relaxes with nobody on it and no hand on it. Relaxing
    // underfoot would bleed the charge faster than a stomp could top it up, and
    // relaxing under a hand would fight the very press that is packing it.
    if(!on&&!station.hand)station.target=clampShape(station.target-dt*(station.relax??.22));
    return true;
  }

  if(station.rule==='stamp'){
    // The print of your own landing is the step, and a hand can size each slab
    // too. Nothing rises until you work it, so the staircase is exactly the one
    // you made; handRule has already applied any hold or drag this tick.
    return true;
  }

  if(station.rule==='form'){
    // The whole lump is the player's. The hand has already worked it this tick
    // through formHand; here weight has its say, a tap lands, and the clay
    // slumps back towards its clump when everyone has left it alone.
    const s=game.level.platforms.find(q=>q.id===station.parts[0]);if(!s)return true;
    const f=massOf(station,s),x=p.x-s.x,base=s.y-s.h;
    if(station.poke){if(pokeForm(f,station.poke.x-s.x,station.poke.y-base))station.worked=true;station.poke=null;}
    // Arriving presses in proportion to the fall that was recorded while
    // airborne: the landing itself has already zeroed the player's speed.
    if(on&&!station.pressed)station.punch=(station.punch||0)+Math.min(FORM.landingMax,FORM.landing*Math.max(0,-(station.fall||0)));
    // Boots sinking in, walking or landing, are kneading; standing still once
    // the clay has given what it gives is not.
    if(on&&sagForm(f,x,dt,station.punch||0))station.worked=true;
    station.punch=0;
    stepForm(f,dt,{hand:!!station.hand,standing:on,relax:station.relax!==false});
    // A stomp that has landed: the crater is pressed, and the clay throws the
    // stomper straight back up, as the packed lump does at full — here on the
    // first stomp, every time. Nothing rearms; the next stomp throws again.
    if(on&&station.stomped){
      station.stomped=false;
      p.vy=station.launch??FORM.launch;p.groundId=null;p.coyote=0;p.springing=true;p.stomping=false;p.stompWindup=0;
      game.event('spring',{platformId:s.id,x:p.x,y:p.y});
      station.pressed=false;station.fall=p.vy;
    } else {station.pressed=on;station.fall=on?0:p.vy;}
    station.amount=station.target=formShare(f,station.shaped);
    return true;
  }
  return false;
}

// The formable mass a station owns, built if it is not there yet.
const massOf=(station,s)=>station.form=s.form||(s.form=createForm(s.w,s.h,station.clump,{free:!!station.free}));

// The hand on the formable mass. A pointer carries a world point every tick it
// is down: the first tick decides whether it took hold of the clay (on or just
// off the surface) or is pressing in from outside (in the air above it), and
// every tick after moves the clay by however far the point has travelled, at
// most `maxMove` per tick. Holding E raises a step ahead of the player, so a
// keyboard alone can still build a stair.
function formHand(game,station,dt,input){
  const s=game.level.platforms.find(q=>q.id===station.parts[0]);if(!s)return true;
  const f=massOf(station,s);
  const pointing=input.shapeId===station.id&&Number.isFinite(input.shapeX)&&Number.isFinite(input.shapeY);
  if(!pointing)station.grip=null;
  else formPoint(station,s,input.shapeX,input.shapeY);
  if(input.shapeHeld&&dt>0){
    // Holding E works the clay ahead into a step the player can walk up:
    // raised where it lies below their feet, pressed down where it towers over
    // them. A key alone can therefore open a pocket a pointer would lean and
    // slump — more slowly, a step at a time — and the step it makes is never a
    // tower, so the key builds stairs rather than walls.
    const p=game.player,base=s.y-s.h,ahead=p.x+(p.facing||1)*FORM.stepReach-s.x;
    if(ahead>-FORM.stepRadius&&ahead<s.w+FORM.stepRadius){
      // Past the end of the clay there is nothing ahead to step onto, so E
      // there lifts the ground the player stands on instead, a step at a time.
      const at=Math.max(0,Math.min(s.w,ahead)),under=ahead!==at,want=p.y-base+FORM.step*FORM.stepRise,have=formHeight(f,under?Math.max(0,Math.min(s.w,p.x-s.x)):at);
      const move=have<want-.03?Math.min(FORM.knead*dt,want-have):have>want+.03?-Math.min(FORM.knead*dt,have-want):0;
      // The clay the step is drawn from is never the clay under the player.
      if(move&&pullForm(f,at,0,move,FORM.stepRadius,{x:p.x-s.x,radius:FORM.foot+.2}))station.worked=true;
    }
  }
  return true;
}

// One tick of a pointer at a world point over the mass: the grab-or-press
// decision on the first tick, the clamped move and the pull or press on every
// tick after. The pointer path and the authored solution below both come
// through here, so what a player's hand does and what "shaped" means are one
// and the same code.
export function formPoint(station,s,px,py){
  const f=massOf(station,s),x=px-s.x,y=py-(s.y-s.h);
  let g=station.grip;
  if(!g){
    g=station.grip={mode:y<=formHeight(f,x)+FORM.grab?'grab':'press',x,y};
    if(g.mode==='press'&&pressForm(f,x,y,FORM.tool))station.worked=true;
    return;
  }
  let dxh=x-g.x,dyh=y-g.y;
  const m=Math.hypot(dxh,dyh);
  if(m>FORM.maxMove){dxh*=FORM.maxMove/m;dyh*=FORM.maxMove/m;}
  if(g.mode==='grab'){
    if((dxh||dyh)&&pullForm(f,g.x,dxh,dyh))station.worked=true;
    g.x+=dxh;g.y+=dyh;
    // The hand stays on the clay it holds: once the clay can rise or sink
    // no further, the grip does not run on ahead of it, so reversing the
    // stroke moves the clay straight away.
    const top=formHeight(f,g.x);g.y=Math.min(top+FORM.grab,Math.max(top-2*FORM.grab,g.y));
  } else {
    g.x+=dxh;g.y+=dyh;
    if(pressForm(f,g.x,g.y,FORM.tool))station.worked=true;
  }
}

// --- the authored solution -------------------------------------------------------
// A chapter's formable mass has no finished pose, so "shaped" has to be said
// some other way: the station carries a `solution`, a list of pointer strokes
// {x,lift,dx,dy,t} in world units and seconds — pointer down at (x, the
// surface there + lift), moved in a straight line by (dx,dy) over t seconds,
// then let go. Replayed through formPoint from the clump, those strokes make
// THE solved surface: the routes sweep, the playthrough pilot and a resumed
// checkpoint all read this one function, and the pilot plays the very same
// inputs through the real game. It is one way across, not the only one.

// The per-tick inputs for the strokes, as a player's pointer would produce
// them. Each stroke starts where the surface is at that moment, so a stroke
// after a lean lands on the leaned clay; hence a generator read against the
// live mass, which the pilot ticks between inputs.
export function* formSolutionInputs(game,station,{dt=TICK}={}){
  const s=game.level.platforms.find(q=>q.id===station.parts[0]);if(!s)return;
  for(const stroke of station.solution||[]){
    const n=Math.max(1,Math.round(stroke.t/dt)),x0=stroke.x,y0=s.y-s.h+formHeight(massOf(station,s),x0-s.x)+stroke.lift;
    for(let i=0;i<n;i++){const u=n>1?i/(n-1):0;yield {moveAxis:0,shapeId:station.id,shapeX:x0+stroke.dx*u,shapeY:y0+stroke.dy*u};}
    yield {moveAxis:0};
  }
}

// The solved surface, from the clump: the strokes through the real hand, tick
// by tick, then left to ease until nothing is left to do. Needs only the
// station and its platform, no Game. Leaves the station shaped.
export function solveFormStation(station,s,{dt=TICK}={}){
  const f=massOf(station,s),relax=station.relax!==false;
  resetForm(f);station.grip=null;
  for(const input of formSolutionInputs({level:{platforms:[s]}},station,{dt})){
    beginForm(f);
    if(input.shapeId)formPoint(station,s,input.shapeX,input.shapeY);else station.grip=null;
    stepForm(f,dt,{hand:!!input.shapeId,relax});
  }
  for(let k=0;k<600&&easeForm(f);k++);
  station.amount=station.target=formShare(f,station.shaped);station.announced=true;
  return f;
}

// Flatten the formable mass back to its clump and forget every hand on it.
export function resetFormStation(station){
  if(station.form)resetForm(station.form);
  station.grip=null;station.poke=null;station.pressed=false;station.punch=0;station.fall=0;station.stomped=false;
}
