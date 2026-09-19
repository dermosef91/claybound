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
import {FORM,MOULD,createForm,resetForm,formHeight,formShare,pullForm,pressForm,pokeForm,sagForm,stepForm,beginForm,easeForm,mouldProfile,mouldClump,mouldFit,formMatch} from './clay-form.js';
import {createMarble,resetMarble,stepMarble,stepRockFall} from './clay-marble.js';
import {PUSH,initPush,resetPush,stepPush} from './clay-push.js';
import {wallBox} from './cavern-machines.js';
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
    station.done=false;station.open=0;
    const s=L?.platforms.find(q=>q.id===station.parts[0]);
    if(s){
      const make=clump=>createForm(s.w,s.h,clump,{free:!!station.free,pace:station.pace});
      let f=make(station.clump);
      // A mould is a target the clay is cast into, authored as knots like a
      // clump and legalised like one, so it is always a shape a hand can make.
      // Unless the station says otherwise the mass starts as the flat slab that
      // holds exactly the mould's volume: every bit of the cast is in there.
      if(station.mould){
        const cast=mouldProfile(f,station.mould);
        if(!station.clump)f=make(mouldClump(f,cast));
        // A plug for a gap starts as the lump it was pushed in as, fitted to
        // hold exactly the gap's volume: cast to the mould, nothing is over.
        else if(station.fix)f=mouldFit(f,station.clump,cast);
        station.cast=s.mould=cast;
      }
      station.form=s.form=f;
      // The world builds a view from the platform alone (world.makePlatform),
      // so the station's throw is stamped on its clay: bouncy clay is drawn pink.
      s.bouncy=!!station.bouncy;
      // A marble run: the ball starts where the station says, in the form's
      // own x, and is home in the station's socket — or, with an open end
      // named, gone over it: a rock the clay is worked to drop off the mass.
      if(station.marble){station.ball=s.marble=createMarble(station.marble.x,{radius:station.marble.radius,spill:station.marble.spill});s.socket=station.marble.socket;s.marbleLook=station.marble.look;}
      if(station.fix)initFix(station,s,L);
    }
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
  // A plug not yet in its gap, or one already cast into the corner, is not
  // clay to be worked: the boots land on it as on any deck.
  if(!fixWorkable(station))return false;
  // A stomp is a knead, whatever the clay does with it.
  station.kneadPending=true;
  // A stomp into the soft block presses a crater where the boots land, on top
  // of what the fall alone does to it.
  if(station.rule==='sag'){station.punch=(station.punch||0)+GIVE.stomp;return true;}
  // A stomp into the formable mass is a crater where the boots land — and, on
  // a `bouncy` station, the clay throws the stomper back up on the next tick,
  // once it has them.
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
  // A plug takes no hand until it sits in its gap, and none again once cast.
  if(!fixWorkable(station)){station.grip=null;return false;}
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
  if(!takesHands(station)||station.spent||!fixWorkable(station))return false;
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
    // A plug has a life of its own before it is clay to work — the rot, the
    // block, the drop into the gap — and none after it is cast. Until it sits
    // in its gap, and once it is the corner again, the mass holds still.
    const workable=!station.fix||stepFix(game,station,s,dt);
    if(!workable){station.poke=null;station.stomped=false;station.punch=0;station.pressed=on;station.fall=on?0:p.vy;}
    else {
    if(station.poke){if(pokeForm(f,station.poke.x-s.x,station.poke.y-base))station.worked=true;station.poke=null;}
    // Arriving presses in proportion to the fall that was recorded while
    // airborne: the landing itself has already zeroed the player's speed.
    if(on&&!station.pressed)station.punch=(station.punch||0)+Math.min(FORM.landingMax,FORM.landing*Math.max(0,-(station.fall||0)));
    // Boots sinking in, walking or landing, are kneading; standing still once
    // the clay has given what it gives is not.
    if(on&&sagForm(f,x,dt,station.punch||0))station.worked=true;
    station.punch=0;
    stepForm(f,dt,{hand:!!station.hand,standing:on,relax:station.relax!==false});
    // A stomp that has landed: the crater is pressed. Only clay a station calls
    // `bouncy` — the lab's slab, lump and wet bench — throws the stomper
    // straight back up, as the packed lump does at full, on the first stomp
    // and every one after; nothing rearms. Everywhere else, the chapters
    // included, a stomp is a press and the boots stay in the crater: the throw
    // is a mechanic of its own, introduced later, and the clay that has it is
    // drawn pink (shaping-views.js) so it is never mistaken for the violet.
    const thrown=on&&station.stomped&&!!station.bouncy;
    if(on)station.stomped=false;
    if(thrown){
      p.vy=station.launch??FORM.launch;p.groundId=null;p.coyote=0;p.springing=true;p.stomping=false;p.stompWindup=0;
      game.event('spring',{platformId:s.id,x:p.x,y:p.y});
      station.pressed=false;station.fall=p.vy;
    } else {station.pressed=on;station.fall=on?0:p.vy;}
    }
    if(station.ball){stepMarble(station.ball,f,dt,station.marble?.socket);if(station.ball.spilled)stepSpilledRock(game,station,s,dt);}
    // What counts as progress. A mould reads how close the cast is, a marble
    // run how far the marble has come towards its socket, and everything else
    // how much clay has moved. A cast or a seated marble is done, and done
    // stays done — the clay may slump afterwards, the door it opened does not
    // close — until R. Done opens whatever channel the station names, the way
    // a switch or a counterweight would. A ball meant to go over an open end
    // reads its progress off the clay, like any chapter mass, and is done
    // once the rock is down — on what it smashed through, or on the floor
    // under it — which may be seconds after the last stroke.
    let share;
    if(station.cast){share=formMatch(f,station.cast);s.mouldMatch=share;if(share>=MOULD.cast&&workable)station.done=true;}
    else if(station.ball?.spill){share=formShare(f,station.shaped);if(station.ball.smashed||station.ball.landed)station.done=true;}
    else if(station.ball){share=marbleShare(station);if(station.ball.home)station.done=true;}
    else share=formShare(f,station.shaped);
    // A plug cast to its mould is the corner again: the surface snaps to the
    // mould — it holds exactly that volume — and is sealed, stone to every
    // hand from here on. What it read as shaped counts its phases: clearing
    // the rot, seating the plug, and then how far the cast has come from the
    // lump it was seated as.
    if(station.fix){
      if(station.done&&!station.sealed)sealFix(station,s,f);
      // A seated lump settling into its bulge passes near the mould on the
      // way; the outline reads the bulge it is settling into, not the pass.
      if(station.fix.phase==='settling')s.mouldMatch=Math.min(share,station.fix.match0??share);
      share=fixShare(station,share);
    }
    station.open=Math.min(1,Math.max(0,station.open+(station.done?dt:-dt)*CHASE));
    if(station.done&&station.channel)game.activate(station.channel,s.x+s.w/2,s.y,station.message||station.name+' · done');
    station.amount=station.target=station.done?1:Math.min(share,station.cast||station.ball?.99:1);
    if(station.fix)s.heal=station.open;
    return true;
  }
  return false;
}

// --- the plug: a broken corner, a block, and a cast that mends it ---------------
// The station's `fix` names the rot that fills the gap, the block that plugs
// it and the gap's floor. The mass is dormant until the block has dropped in,
// worked while it is seated, and sealed once it is cast.
function initFix(station,s,L){
  const fix=station.fix;
  fix.phase='rot';fix.mass=s;fix.rotPlatform=L.platforms.find(q=>q.id===fix.rot)??null;
  fix.blockPlatform=L.platforms.find(q=>q.id===fix.block)??null;
  fix.floorPlatform=L.platforms.find(q=>q.id===fix.floor)??null;
  // How far from the mould the seated lump reads, so the shaped share starts
  // from nothing once it is seated rather than from wherever the dome lands.
  fix.match0=formMatch(s.form,station.cast);
  station.sealed=false;
  // The mass keeps its view — its outline is drawn from it — and hides only
  // its body while it is dormant; `active` alone takes its collision away.
  s.active=false;s.outline=true;s.fixPhase='rot';s.heal=0;s.sealed=false;
  // The block wears a lump of its own — squared off, if the station says so —
  // holding the gap's volume exactly: its own heightfield, never worked, so it
  // stands, walks and draws as the very clay that will fill the gap.
  const block=fix.blockPlatform;
  if(block){block.form=mouldFit(s.form,fix.blockClump||station.clump,station.cast);block.clayRole='mass';initPush(block);}
}
// Whether the station's clay takes work right now: a plain form always, a plug
// only while it is seated and uncast.
const fixWorkable=station=>!station.fix||station.fix.phase==='shaping';
// One tick of the plug's life. Returns whether the mass is clay to be worked.
function stepFix(game,station,s,dt){
  const fix=station.fix,p=game.player,rot=fix.rotPlatform,block=fix.blockPlatform,floor=fix.floorPlatform;
  const open=!rot||rot.broken||rot.active===false;
  if(fix.phase==='rot'&&open)fix.phase='open';
  if(block&&(fix.phase==='rot'||fix.phase==='open')){
    const notch={x:s.x,w:s.w,floor:floor?floor.y:s.y-s.h};
    // The block comes back only once nobody is standing where it started.
    const crest=block.baseY-block.h+(block.form?block.form.ref:block.h);
    const clear=Math.abs(p.x-(block.baseX+block.w/2))>block.w/2+.6||p.y>=crest-1e-6;
    const t=stepPush(block,dt,{open,notch,clear});
    if(t){
      const at={x:block.x+block.w/2,y:block.y-block.h/2,w:block.w,platformId:block.id,id:station.id};
      if(t==='dissolve')game.event('push-dissolve',at);
      else if(t==='shatter')game.event('push-shatter',at);
      else if(t==='respawn')game.event('push-respawn',at);
      else if(t==='tip'){station.kneadPending=true;game.event('push-lock',at);}
      else if(t==='locked'){
        // The plug is seated: from here the mass stands in the block's place,
        // as the very lump the block was, and settles — a lump squeezed into a
        // hole bulges — into its own clump before it takes hands, boots and stomps.
        fix.phase='settling';fix.settleT=0;s.active=true;resetForm(s.form);
        fix.seatFrom=Float64Array.from(block.form?block.form.rest:s.form.rest);
        s.form.h.set(fix.seatFrom);s.form.prev.set(fix.seatFrom);s.form.version++;
        station.kneadPending=true;
        game.event('push-locked',{...at,y:s.y});
        game.event('land',{x:s.x+s.w/2,y:s.y,strong:true,impact:8,platformId:s.id});
      }
    }
  }
  if(fix.phase==='settling'){
    const f=s.form,from=fix.seatFrom,u=Math.min(1,(fix.settleT+=dt)/PUSH.settle),k=u*u*(3-2*u);
    // Between two legal shapes of one volume every step of the way is legal too.
    for(let i=0;i<f.n;i++)f.h[i]=from[i]+(f.rest[i]-from[i])*k;
    f.version++;
    if(u>=1){f.h.set(f.rest);fix.phase='shaping';station.kneadPending=true;}
  }
  s.fixPhase=fix.phase;
  return fix.phase==='shaping';
}
// The cast has read as done: snap the surface to the mould and seal it.
function sealFix(station,s,f){
  f.h.set(station.cast);f.prev.set(station.cast);f.dent.fill(0);f.idle=Infinity;f.settled=true;f.version++;
  station.sealed=true;station.fix.phase='healed';station.grip=null;station.hand=false;
  s.sealed=true;s.fixPhase='healed';s.mouldMatch=1;
}
// What the plug reads as shaped: nothing while the rot stands, a fifth once it
// is cleared, and then the cast's progress from the seated lump to the mould.
function fixShare(station,match){
  const phase=station.fix.phase;
  if(phase==='rot')return 0;
  if(phase==='open'||phase==='settling')return .2;
  const m0=station.fix.match0??0,k=Math.min(1,Math.max(0,(match-m0)/Math.max(1e-6,1-m0)));
  return .2+.79*k;
}
// R: the rot stands again, the block is back on the dock, the mass is dormant.
export function resetFix(station){
  const fix=station.fix;if(!fix)return;
  const rot=fix.rotPlatform,block=fix.blockPlatform,s=fix.mass;
  if(rot){rot.broken=false;rot.active=true;rot.timer=0;}
  if(block)resetPush(block);
  if(s){s.active=false;s.fixPhase='rot';s.heal=0;s.sealed=false;s.mouldMatch=0;}
  fix.phase='rot';station.sealed=false;
}
// A saved game that had the corner mended: mended again, without the show.
export function healFix(station){
  const fix=station.fix,s=fix?.mass;if(!fix||!s||!station.form||!station.cast)return;
  const rot=fix.rotPlatform,block=fix.blockPlatform;
  if(rot){rot.broken=true;rot.active=false;}
  if(block){block.pushPhase='locked';block.active=false;block.hidden=true;block.x=block.prevX=s.x;block.y=block.prevY=s.y;}
  s.active=true;
  fix.phase='shaping';sealFix(station,s,station.form);
  station.done=true;station.open=1;station.amount=station.target=1;station.announced=true;s.heal=1;
}

// How far along the marble is: from where it started to the middle of its
// socket, as a share, never quite one until it is seated.
function marbleShare(station){
  const m=station.ball,socket=station.marble?.socket;
  if(!m||!Array.isArray(socket))return 0;
  const goal=(socket[0]+socket[1])/2,span=Math.abs(m.start-goal)||1;
  return Math.min(.99,Math.max(0,1-Math.abs(m.x-goal)/span));
}
// A rock over the edge is the level's business: it falls in world space,
// breaks the planks that are its for the breaking, and lands on whatever floor
// the level put under them. The hand-off from the form's own x happens once,
// here, because only the mass knows where it stands.
// Seconds the fall is watched for after the rock has come to rest.
export const ROCK_WATCH=.9;
function stepSpilledRock(game,station,s,dt){
  const m=station.ball;
  if(m.wx===undefined){m.wx=s.x+m.x;m.wy=s.y-s.h+m.y;m.vy=0;game.event?.('spill',{x:m.wx,y:m.wy,r:m.r,platformId:s.id});}
  if(m.landed)stepRockFall(m,dt);
  else {
    const platforms=game.level?.platforms||[];
    const decks=[],walls=[];
    for(const q of platforms){
      if(q===s||q.active===false||q.broken)continue;
      const box=wallBox(q);if(box)walls.push(box);
      if(q.shape||q.form||q.kind==='zip'||q.kind==='lift'||q.kind==='bridge')continue;
      decks.push({id:q.id,x:q.x,w:q.w,top:q.y,breakable:q.kind==='break'&&!!q.rockOnly});
    }
    for(const hit of stepRockFall(m,dt,{decks,walls})){
      const deck=platforms.find(q=>q.id===hit.id);if(!deck)continue;
      if(hit.breakable){m.smashed=(m.smashed||0)+1;game.breakPlatform?.(deck,m.wx,m.wy-m.r);}
      else game.event?.('rock-land',{x:m.wx,y:m.wy-m.r,r:m.r,platformId:deck.id});
    }
  }
  // The fall is a scene: from the brink to a beat after the rock has come to
  // rest the game watches the rock rather than the player, who stands where
  // they worked the clay. `rested` outlives the watch so a resumed rock,
  // restored where it lay, is not watched again.
  if(!m.landed)game.cinema={x:m.wx,y:m.wy,rock:station.id};
  else if((m.rested=(m.rested||0)+dt)<ROCK_WATCH)game.cinema={x:m.wx,y:m.wy,rock:station.id};
  else if(game.cinema?.rock===station.id)game.cinema=null;
}
// The formable mass a station owns, built if it is not there yet.
const massOf=(station,s)=>station.form=s.form||(s.form=createForm(s.w,s.h,station.clump,{free:!!station.free,pace:station.pace}));

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
      // Bare footing ahead — a free mass's beam with no clay on it yet — is
      // drawn a first skim of clay whatever height the player stands at, so a
      // beam laid above them can still be opened by the key.
      const at=Math.max(0,Math.min(s.w,ahead)),under=ahead!==at,have=formHeight(f,under?Math.max(0,Math.min(s.w,p.x-s.x)):at);
      const want=have<FORM.minThick?Math.max(p.y-base+FORM.step*FORM.stepRise,FORM.minThick+.15):p.y-base+FORM.step*FORM.stepRise;
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
  if(station.ball)resetMarble(station.ball);
  // A plug's rot stands again, its block is back on the dock, its mass dormant.
  if(station.fix)resetFix(station);
  station.grip=null;station.poke=null;station.pressed=false;station.punch=0;station.fall=0;station.stomped=false;
  // A rock that has gone over the edge is not brought back, and what it opened
  // stays open: only the clay softens.
  if(!station.ball?.spilled){station.done=false;station.open=0;}
}
