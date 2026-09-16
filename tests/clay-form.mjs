// The fourth and fifth Clay Lab experiments: a mass of clay with no pose,
// dragged into whatever the player needs — once let into a trough, once sitting
// free on the bench. The pure heightfield first (one blob, one volume, nothing
// unusable, nothing sharp), then the real simulation walking, jumping, building
// and falling on it, the real pointer and key handlers, and the mesh reading
// the same surface the feet do.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT as dt,surfaceAt,RULES as PLAYER} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import lab from '../dist/routes/clay-lab.js';
import {visitStation,nearbyStation,nudgeClay,formSteepAt} from '../dist/shaping.js';
import {RULES,HANDS,isRule,takesHands,shapedShare} from '../dist/clay-rules.js';
import {FORM,createForm,resetForm,restProfile,formVolume,formHeight,formRest,formPeak,formShare,pullForm,pressForm,pokeForm,sagForm,stepForm} from '../dist/clay-form.js';

const source=JSON.stringify(lab),chapters=JSON.stringify(LEVELS);
const boot=()=>{const g=new Game();g.start(3,lab);return g;};
const stationOf=(g,id)=>g.level.shaping.find(s=>s.id===id);
const massOf=(g,id)=>g.level.platforms.find(s=>s.id===stationOf(g,id).parts[0]);
const clumpOf=id=>lab.shaping.find(s=>s.id===id).clump;
// A mound to test the tools on: the shapes the hand makes are easier to read
// against a clump with a peak than against a flat slab.
const MOUND=[[0,-2],[.15,-1.6],[.45,2.1],[.7,-.6],[1,-3.6]];
const close=(a,b,eps=1e-6)=>Math.abs(a-b)<eps;
const frames=seconds=>Math.round(seconds/dt);
// A stroke at the hand's top speed leaves a corner a little sharp for the tick
// it was made in; the ticks after ease it. This is those ticks, hand still on.
const settle=f=>{for(let i=0;i<30;i++)stepForm(f,dt,{hand:true});};

// The promises, checked over a whole surface: volume, one blob, the ceiling,
// no face too steep, no corner too sharp.
const CURVE=1/FORM.round;
function promises(f,label){
  assert(close(formVolume(f),f.volume,1e-7),`${label}: the clay keeps its volume (${(formVolume(f)-f.volume).toExponential(2)})`);
  let lo=0,hi=f.n-1;
  while(lo<f.n&&f.h[lo]<=FORM.minThick)lo++;
  while(hi>lo&&f.h[hi]<=FORM.minThick)hi--;
  for(let i=0;i<f.n;i++){
    assert(Number.isFinite(f.h[i]),`${label}: finite`);
    assert(f.h[i]>=f.floor-1e-9,`${label}: nothing below the floor (${f.h[i].toFixed(3)} at column ${i})`);
    if(i>lo&&i<hi)assert(f.h[i]>=FORM.minThick-1e-9,`${label}: one connected blob, never thinner than ${FORM.minThick} between its ends (${f.h[i].toFixed(3)} at column ${i})`);
    assert(f.h[i]<=FORM.maxHeight+1e-9,`${label}: never taller than ${FORM.maxHeight}`);
    if(i)assert(Math.abs(f.h[i]-f.h[i-1])/f.dx<=FORM.slope+.05,`${label}: no face steeper than ${FORM.slope} (${(Math.abs(f.h[i]-f.h[i-1])/f.dx).toFixed(2)} at column ${i})`);
    if(i&&i<f.n-1)assert(Math.abs(f.h[i-1]-2*f.h[i]+f.h[i+1])/(f.dx*f.dx)<=CURVE*1.35,`${label}: no corner sharper than a ${FORM.round} radius (${(Math.abs(f.h[i-1]-2*f.h[i]+f.h[i+1])/(f.dx*f.dx)).toFixed(2)} vs ${CURVE.toFixed(2)} at column ${i})`);
  }
}

// --- the heightfield on its own ---------------------------------------------------
{
  const f=createForm(18,4.5,MOUND);
  assert.equal(f.n,73);assert(close(f.dx,.25));
  assert(close(restProfile(MOUND,0,4.5),2.5)&&close(restProfile(MOUND,.45,4.5),6.6)&&close(restProfile(MOUND,1,4.5),.9),'a clump is read from its knots');
  assert(formHeight(f,8.1)>6.2&&formHeight(f,8.1)<=6.6,'and the mass starts as that clump, with its corners eased');
  assert.equal(formShare(f),0,'untouched, nothing is shaped');
  promises(f,'at rest');
  const flat=createForm(18,4.5,clumpOf('form'));
  assert(flat.rest.every(h=>close(h,3.7)),'the lab\'s slab starts flat and square: 3.7 of clay everywhere, a step below the benches');
  assert.equal(flat.floor,FORM.minThick,'a mass in a trough keeps its floor everywhere');

  // Pulling up raises a pillar and draws the clay for it out of the ground
  // around it, nearest first.
  for(let i=0;i<40;i++)assert(pullForm(f,9,0,.3));
  const sharp=Math.max(...Array.from({length:f.n-2},(_,i)=>Math.abs(f.h[i]-2*f.h[i+1]+f.h[i+2])/(f.dx*f.dx)));
  settle(f);
  promises(f,'pulled');
  assert(sharp>=Math.max(...Array.from({length:f.n-2},(_,i)=>Math.abs(f.h[i]-2*f.h[i+1]+f.h[i+2])/(f.dx*f.dx)))-1e-9,'the ticks after a fast stroke only ever round it further');
  assert(formPeak(f)>FORM.maxHeight-.6,`a long pull tops out at the ceiling, its crest rounded (${formPeak(f).toFixed(2)})`);
  const rest=x=>f.rest[Math.round(x/f.dx)];
  assert(formHeight(f,6)<rest(6)-.5&&formHeight(f,12)<rest(12)-.5,`the pillar dug a moat beside itself (${(rest(6)-formHeight(f,6)).toFixed(2)}, ${(rest(12)-formHeight(f,12)).toFixed(2)})`);
  assert(rest(0)-formHeight(f,0)<rest(6)-formHeight(f,6),'and drew less from far away than from near');
  assert(formShare(f)>.3,`moving a pillar's worth of clay reads as shaped (${formShare(f).toFixed(2)})`);
  // Pulling sideways leans it over: the clay travels with the hand, which
  // moves with the drag as a real grip does.
  const before=formHeight(f,13);
  for(let i=0;i<20;i++)pullForm(f,9+i*.3,.3,0);
  settle(f);
  promises(f,'leaned');
  assert(formHeight(f,9)<FORM.maxHeight-1.5&&formHeight(f,13)>before+1.5,`dragged right, the clay under the hand goes with it (${formHeight(f,9).toFixed(2)} at 9, ${formHeight(f,13).toFixed(2)} at 13)`);
  // Nothing moves for nothing, and garbage is refused.
  const still=Float64Array.from(f.h);
  assert.equal(pullForm(f,9,0,0),false);assert.equal(pullForm(f,NaN,1,1),false);assert.equal(pullForm(f,9,Infinity,0),false);
  assert.equal(pressForm(f,NaN,1),false);assert.equal(sagForm(f,'x',dt),false);
  assert.deepEqual(Array.from(f.h),Array.from(still),'refused input leaves the clay alone');

  // A press from outside dents the clay it enters and no more, and the clay it
  // pushes out rises around the dent as a rim.
  const g=createForm(18,4.5,MOUND),top=formHeight(g,8);
  assert.equal(pressForm(g,8,top+FORM.tool+.5),false,'a ball in the air over the clay touches nothing');
  assert.equal(formVolume(g),g.volume);
  for(let i=1;i<=30;i++)pressForm(g,8,top+FORM.tool-.1*i);
  settle(g);
  promises(g,'pressed');
  assert(formHeight(g,8)<top-2.5,`pressing in carves a bowl (${(top-formHeight(g,8)).toFixed(2)} deep)`);
  assert(formHeight(g,6)>g.rest[24]+.3&&formHeight(g,10)>g.rest[40]+.3,'with a rim on both sides');
  // Pushing all the way down stops at the floor and never tears.
  for(let i=0;i<60;i++)pressForm(g,8,-1);
  settle(g);
  promises(g,'pressed to the floor');
  assert(formHeight(g,8)>=FORM.minThick-1e-9&&formHeight(g,8)<FORM.minThick+.5,`the floor holds, and the bowl bottoms out round just above it (${formHeight(g,8).toFixed(2)})`);
  // A poke is one dent, tap deep.
  const k=createForm(18,4.5,MOUND),t8=formHeight(k,8);
  assert(pokeForm(k,8,t8+3),'a tap in the air over the clay still pokes it');
  assert(close(formHeight(k,8),t8-FORM.tap,.06),`by ${FORM.tap} (${(t8-formHeight(k,8)).toFixed(3)})`);
  settle(k);promises(k,'poked');
  // Weight sinks the feet a little and no more, however long the stand, and
  // landings only so much on top of that.
  const w=createForm(18,4.5,MOUND),t9=formHeight(w,9);
  for(let i=0;i<frames(3);i++)sagForm(w,9,dt);
  settle(w);promises(w,'stood on');
  assert(t9-formHeight(w,9)>FORM.sag*.8&&t9-formHeight(w,9)<=FORM.sag+1e-6,`a stand sinks about ${FORM.sag} (${(t9-formHeight(w,9)).toFixed(3)})`);
  assert(formHeight(w,8)>w.rest[32]||formHeight(w,10)>w.rest[40],'and the clay pushed aside rises beside the boots');
  sagForm(w,9,dt,FORM.stomp);
  // A crater the width of a pair of boots is rounded as it is pressed, so it
  // is deeper than a stand but never as deep as the boots alone would make it.
  assert(t9-formHeight(w,9)>FORM.sag+.15&&t9-formHeight(w,9)<FORM.sag+FORM.stomp,`a stomp presses past a stand, rounded (${(t9-formHeight(w,9)).toFixed(2)})`);
  for(let i=0;i<20;i++)sagForm(w,9,dt,FORM.stomp);
  assert(t9-formHeight(w,9)<=FORM.dentMax+.05,`but no amount of stomping digs past ${FORM.dentMax} (${(t9-formHeight(w,9)).toFixed(2)})`);
  settle(w);promises(w,'stomped');

  // Left alone, it all slumps back to the clump — not at once, and not while a
  // hand or a boot is on it.
  const r=createForm(18,4.5,MOUND);
  for(let i=0;i<40;i++)pullForm(r,9,0,.3);
  const raised=formHeight(r,9);
  for(let i=0;i<frames(2);i++)stepForm(r,dt,{hand:true});
  assert.equal(formHeight(r,9),raised,'a hand on it holds it');
  for(let i=0;i<frames(2);i++)stepForm(r,dt,{standing:true});
  assert.equal(formHeight(r,9),raised,'so does someone standing on it');
  for(let i=0;i<frames(FORM.settle-.5);i++)stepForm(r,dt);
  assert.equal(formHeight(r,9),raised,'and it settles for a moment before it starts');
  for(let i=0;i<frames(6);i++)stepForm(r,dt);
  const after6=formHeight(r,9);
  assert(after6<raised-.2&&after6>raised-1.5,`then it slumps slowly (${(raised-after6).toFixed(2)} in six seconds)`);
  promises(r,'relaxing');
  for(let i=0;i<frames(240);i++)stepForm(r,dt);
  assert(r.h.every((h,i)=>close(h,r.rest[i],1e-6)),'and comes all the way home');
  assert.equal(stepForm(r,dt),false,'at rest it does no work');
  assert.equal(stepForm(r,0),false,'and a zero step does nothing');
  pullForm(r,9,0,1);resetForm(r);
  assert(r.h.every((h,i)=>h===r.rest[i])&&r.dent.every(d=>d===0),'a reset is instant and complete');

  // A free lump on a bench: thins to nothing towards the ends of its footprint,
  // never between them.
  const free=createForm(14,.02,clumpOf('lump'),{free:true});
  assert.equal(free.floor,0);
  promises(free,'free lump at rest');
  const peak=formPeak(free);
  assert(peak>4.4&&peak<5.2,`a square lump about 4.6 tall (${peak.toFixed(2)})`);
  assert([5,6,7,8,9].every(x=>formHeight(free,x)>peak-.6),'with a broad flat top');
  assert([0,1,13,14].every(x=>formHeight(free,x)<.05),'and the bench bare on either side');
  assert(free.rest.some(h=>h>FORM.minThick)&&free.rest[0]<FORM.minThick,'the rest shape itself is a lump, not a slab');
  for(let i=0;i<120;i++)pressForm(free,7,Math.max(0,formHeight(free,7)-.1)+FORM.tool);
  settle(free);promises(free,'pressed through');
  assert(formHeight(free,7)<1.2&&formHeight(free,7)>=FORM.minThick-1e-9,`a press through the middle leaves a neck, never two lumps (${formHeight(free,7).toFixed(2)})`);
  for(let i=0;i<40;i++)pullForm(free,7,0,.3);
  settle(free);promises(free,'free pillar');
  assert(formPeak(free)>5.5,`and it can still be drawn up into a tall pillar (${formPeak(free).toFixed(2)})`);
  assert(formHeight(free,0)<.5&&formHeight(free,14)<.5,'with only a skim of what the press spread reaching the ends of the bench');
}
console.log('PASS the mass keeps its volume, stays one blob, tops out, rounds every corner, leans, dents, pokes, sags, slumps home, and a free lump thins only at its ends');

// --- the bench --------------------------------------------------------------------
{
  const by=Object.fromEntries(lab.shaping.map(s=>[s.id,s])),plat=id=>lab.platforms.find(p=>p.id===id);
  assert(isRule('form')&&RULES.includes('form')&&HANDS.includes('form'),'form is a ruled behaviour that takes a hand');
  for(const id of ['form','lump']){
    const s=by[id];
    assert.equal(s.rule,'form');assert(takesHands(s));assert.equal(s.gesture,'up');assert.equal(s.icon,'knead');
    assert(Array.isArray(s.clump)&&s.clump.length>=2,`${id} has an authored clump`);
    for(const word of [/drag|lean|spread/i,/pull|draw/i,/volume/i,/slump|relax/i,/\bR\b/])assert(word.test(s.hint),`${id}'s hint says ${word}`);
    const m=plat(s.parts[0]);
    assert.deepEqual(m.shape.from,m.shape.to,`${id}'s mass has no pose; only its surface is shaped`);
    assert.equal(m.clayRole,'mass');
  }
  for(const word of [/grab/i,/push/i,/hold E/,/stomp/i])assert(word.test(by.form.hint),`the slab's hint says ${word}`);
  // The slab: let into a trough, flush between two benches.
  const m=plat('form-mass'),depth=m.shape.from.h,dock=plat('form-dock'),exit=plat('form-exit'),perch=plat('form-perch');
  assert(m.w>=16&&depth>=4,'a big deep trough');
  assert.equal(dock.x+dock.w,m.x,'flush against the dock');assert.equal(exit.x,m.x+m.w,'and the exit bench');
  assert(perch.optional&&perch.kind==='ledge'&&perch.x>m.x&&perch.x+perch.w<m.x+m.w,'an optional perch over the clay');
  const flower=lab.stamps.find(f=>f.x>perch.x&&f.x<perch.x+perch.w);
  assert(flower&&flower.y>perch.y&&flower.y<perch.y+2.6,'holding a flower');
  assert(!by.form.free,'the slab is not free');
  // The lump: free on a bench that runs on under it, with a perch high above.
  const l=plat('form-lump'),bench=plat('lump-bench'),lperch=plat('lump-perch');
  assert(by.lump.free,'the lump is free');
  assert(l.shape.from.h<.1,'and sits on the bench, not in it');
  assert(bench.kind==='stone'&&bench.x===l.x&&bench.w===l.w&&bench.y===l.y,'the bench runs under the whole footprint');
  assert.equal(plat('form-exit').x+plat('form-exit').w,l.x,'flush with the bench before it');
  assert.equal(plat('lump-exit').x,l.x+l.w,'and the one after');
  assert(lperch.optional&&lperch.x>l.x&&lperch.x+lperch.w<l.x+l.w&&lperch.y>=8.5,'an optional perch high over the lump');
  const lflower=lab.stamps.find(f=>f.x>lperch.x&&f.x<lperch.x+lperch.w);
  assert(lflower&&lflower.y>lperch.y&&lflower.y<lperch.y+2.6,'holding a flower');
  assert(!lab.hazards.some(h=>h.x<l.x+l.w&&h.x+h.w>m.x),'no pit under either mass');
  assert(lab.sections.some(t=>t.name==='Fully Formable')&&lab.sections.some(t=>t.name==='A Lump on the Bench'),'each has its own section');
  assert(by.lump.x>=by.form.end&&by.lump.spawn.x>=by.lump.x,'the lump\'s stretch follows the slab\'s, and its spawn is inside it');
  assert(lab.end>lab.platforms.find(p=>p.goal).x,'and the bell still ends the lap');
  // Every bead over a mass floats a hop above its clump, never inside it.
  for(const [id,pl] of [['form',m],['lump',l]]){
    const f=createForm(pl.w,pl.shape.from.h,by[id].clump,{free:!!by[id].free});
    for(const c of lab.coins.filter(c=>c.x>pl.x&&c.x<pl.x+pl.w)){
      const top=pl.y-pl.shape.from.h+formHeight(f,c.x-pl.x);
      assert(c.y>top+.5&&c.y<top+1.6,`bead at ${c.x} sits over the ${id} clump (${(c.y-top).toFixed(2)} above)`);
    }
  }
}
console.log('PASS the fourth and fifth benches are wired: a slab let into a trough and a free lump on a bench, each ruled, hand-taking, with a perch, a flower and beads over its clump');

// A rig around one station, checking every tick what must never break: x moves
// at walking speed or less, feet never end inside the clay, a rider stands
// exactly on it, the volume holds, and nobody dies.
function rig(id='form'){
  const g=boot();assert(visitStation(g,id));
  const s=massOf(g,id),st=stationOf(g,id),p=g.player,base=s.y-s.h;
  let last=p.x,ticks=0;
  const tick=(input={})=>{
    g.tick(dt,input);ticks++;
    assert(Math.abs(p.x-last)<=6.7*dt+1e-3,`x moves continuously (tick ${ticks}: ${last.toFixed(3)} -> ${p.x.toFixed(3)})`);last=p.x;
    if(p.x>s.x&&p.x<s.x+s.w&&p.y<base+FORM.maxHeight){
      assert(p.y>=surfaceAt(s,p.x)-.12-1e-9,`feet never end a tick inside the clay (tick ${ticks}: ${p.y.toFixed(3)} under ${surfaceAt(s,p.x).toFixed(3)})`);
      if(p.groundId===s.id)assert(Math.abs(p.y-surfaceAt(s,p.x))<1e-9,`a rider stands exactly on the surface (tick ${ticks})`);
    }
    assert(close(formVolume(s.form),s.form.volume,1e-7),`volume holds (tick ${ticks})`);
    assert.equal(g.deaths,0,'nobody dies on the clay');
  };
  const hold=(n,input={})=>{for(let i=0;i<n;i++)tick({...input,jumpPressed:i===0&&!!input.jumpPressed,stompPressed:i===0&&!!input.stompPressed});};
  const walk=(x,n=2000,extra={})=>{for(let i=0;i<n;i++){const d=x-p.x;if(Math.abs(d)<.08)return true;tick({moveAxis:Math.max(-1,Math.min(1,d*3)),...extra});}return false;};
  // A held jump, all the way up and down onto something; returns the apex.
  const jump=(input={})=>{let top=-Infinity;hold(1,{...input,jumpPressed:true,jumpHeld:true});for(let i=0;i<400;i++){tick({...input,jumpHeld:true});top=Math.max(top,p.y);if(p.groundId&&p.vy===0)break;}return top;};
  // Walk towards x and hop whenever something blocks the way.
  const hopTo=(x,seconds=8)=>{let stuck=0,lastX=p.x;for(let i=0;i<frames(seconds);i++){const d=x-p.x;if(Math.abs(d)<.3)return true;stuck=Math.abs(p.x-lastX)<.004?stuck+1:0;lastX=p.x;const go=stuck>6&&!!p.groundId;if(go)stuck=0;tick({moveAxis:Math.max(-1,Math.min(1,d*2)),jumpPressed:go,jumpHeld:true});}return false;};
  // A stomp from a standing jump, then the flight it throws the player into,
  // all the way down onto something; returns the apex of that flight.
  const stomp=(input={})=>{
    hold(1,{...input,jumpPressed:true,jumpHeld:true});for(let i=0;i<90&&p.vy>0;i++)tick({...input,jumpHeld:true});
    hold(1,{...input,stompPressed:true});for(let i=0;i<150&&!p.groundId;i++)tick(input);
    let apex=p.y;for(let i=0;i<600;i++){tick(input);apex=Math.max(apex,p.y);if(i>2&&p.groundId&&Math.abs(p.vy)<1e-9)break;}
    return apex;
  };
  const place=(x,y)=>{Object.assign(p,{x,y,vx:0,vy:0,groundId:null,coyote:0,stomping:false});last=x;};
  // A pointer on the clay for one tick: a world point.
  const hand=(lx,ly,extra={})=>tick({shapeId:id,shapeX:s.x+lx,shapeY:base+ly,...extra});
  const release=()=>tick();
  return {g,s,st,p,base,tick,hold,walk,jump,stomp,hopTo,place,hand,release,top:lx=>surfaceAt(s,s.x+lx)};
}

// --- crossing the slab --------------------------------------------------------------
{
  const {g,s,st,p,tick,hold,walk,jump,hand,top}=rig('form');
  assert.equal(nearbyStation(g)?.id,'form');assert.equal(p.groundId,'form-dock');
  assert.equal(shapedShare(st),0);
  // Off the dock is a step down onto the slab, a level walk across, and a step
  // too tall to walk up at the far end.
  for(let i=0;i<frames(5);i++)tick({moveAxis:1});
  assert.equal(p.groundId,s.id,'walking right ends on the clay');
  assert(p.x>s.x+s.w-1&&p.y<-.7&&p.y>-1.9,`against the exit bench, a step below it (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  hold(frames(2));
  const rested=lx=>s.y-s.h+formRest(s.form,lx),floor=rested(p.x-s.x);
  assert(floor-p.y>.1&&floor-p.y<.8,`standing there the clay gives a little under the boots (${(floor-p.y).toFixed(2)})`);
  assert(top(p.x-s.x-.9)>rested(p.x-s.x-.9)+.03,`and rises beside them (${(top(p.x-s.x-.9)-rested(p.x-s.x-.9)).toFixed(3)})`);
  // The step is a hop.
  jump({moveAxis:1});
  assert.equal(p.groundId,'form-exit','a hop puts the player on the exit bench');
  // Back in the middle, pull the clay up under your own feet and it carries
  // you up with it: the hand takes hold of the surface and rises with the thumb.
  for(let i=0;i<frames(3)&&p.groundId!==s.id;i++)tick({moveAxis:-1});
  assert(walk(s.x+9));hold(30);
  const lx=p.x-s.x;let hy=formHeight(s.form,lx)+.2,t0=top(lx),y0=p.y;
  for(let i=0;i<frames(.5);i++){hy+=.04;hand(lx,hy);}
  assert(top(lx)>t0+1.8,`half a second's pull raises the clay underfoot (${(top(lx)-t0).toFixed(2)})`);
  assert.equal(p.groundId,s.id,'the player is still standing on it');
  assert(p.y>y0+1.6,`and has ridden up with it (${(p.y-y0).toFixed(2)})`);
  assert(shapedShare(st)>0,'and the station reads as worked');
  assert.equal(g.deaths,0);
  // A lab session edits neither the shipped chapters nor its own source.
  assert.equal(JSON.stringify(LEVELS),chapters);assert.equal(JSON.stringify(lab),source);
}
console.log('PASS the slab is a step down, a level walk and a hop up, weight dents it a little, and a pull underfoot carries the player up');

// --- walls, cliffs, and riding the clay ----------------------------------------------
{
  const {g,s,st,p,tick,hold,walk,jump,place,hand,top}=rig('form');
  const shaped=[];g.onEvent=e=>{if(e.type==='shape')shaped.push(e.message);};
  // Build a full-height pillar in the way. Its faces are walls: a walker who
  // drops onto one slides down it to the moat and stops at the foot rather than
  // being carried up, and a jumper who hits it slides back down, never onto it.
  for(let i=0;i<60;i++)pullForm(s.form,4,0,.3);
  hold(30);
  assert(formPeak(s.form)>FORM.maxHeight-.6,`a full-height pillar (${formPeak(s.form).toFixed(2)})`);
  promises(s.form,'a pillar in the slab');
  const wall=s.x+4,moat=Math.min(...[1,1.25,1.5,1.75,2].map(top));
  hold(frames(4),{moveAxis:1});
  assert.equal(p.groundId,s.id,'on the clay');
  assert(p.x<wall-1.2&&p.y<moat+.6,`stopped at the foot of the pillar (${p.x.toFixed(2)}, ${p.y.toFixed(2)} for a wall at ${wall} over a moat at ${moat.toFixed(2)})`);
  assert(top(p.x-s.x+PLAYER.radius)-p.y>FORM.step,'because the rise ahead is more than a step');
  for(let i=0;i<3;i++){jump({moveAxis:1});assert(p.x<wall-1&&p.y<moat+.6,`a jump into the wall slides back to its foot (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);}
  // From the top, walking off is a fall, not a slide down the face.
  place(wall,top(4));tick();
  assert.equal(p.groundId,s.id,'placed on the pillar top');
  const y0=p.y;let left=false,lowest=y0;
  for(let i=0;i<frames(1.5);i++){tick({moveAxis:1});if(p.groundId===null)left=true;lowest=Math.min(lowest,p.y);if(p.groundId&&Math.abs(p.vy)<1e-9&&p.y<y0-3)break;}
  assert(left,'walked off the edge into the air');
  assert(lowest<y0-3,`and fell (${(y0-lowest).toFixed(2)})`);
  // Clay pulled up under someone lifts them with it; clay pushed down under
  // them lowers them; neither loses them the ground.
  assert(walk(s.x+12));hold(30);
  const before=p.y;
  for(let i=0;i<frames(1);i++){pullForm(s.form,12,0,.02);tick();}
  assert(p.y>before+1&&p.groundId===s.id,`a rider rises with the clay (${(p.y-before).toFixed(2)})`);
  for(let i=0;i<frames(1);i++){pullForm(s.form,12,0,-.02);tick();}
  assert(p.y<before+.6&&p.groundId===s.id,`and sinks with it (${(p.y-before).toFixed(2)})`);
  // Clay that rises into someone in the air lifts them rather than throwing
  // them sideways.
  place(s.x+12,top(12)+.3);
  let hy=formHeight(s.form,12)+.2;
  for(let i=0;i<8;i++){hy+=.25;hand(12,hy);}
  assert(Math.abs(p.x-(s.x+12))<.05&&p.y>=top(12)-.12,`clay rising into airborne feet lifts them (${(p.x-s.x).toFixed(2)}, ${p.y.toFixed(2)} on ${top(12).toFixed(2)})`);
  assert(p.y>before+.8,`well above where they were (${p.y.toFixed(2)})`);
  // A pillar and a bowl together are a station's worth of work.
  for(let i=1;i<=20;i++)pressForm(s.form,9,formHeight(s.form,9)+FORM.tool-.1);
  tick();
  assert(shapedShare(st)>.9,`moving a pillar and a bowl of clay reads as shaped (${shapedShare(st).toFixed(2)})`);
  assert.equal(g.deaths,0);
}
console.log('PASS steep clay is a wall to slide down and a cliff to fall off, a rider goes up and down with the clay under them, and clay rising into airborne feet lifts them');

// --- the perch wants a pillar and a stomp ---------------------------------------------------
const LAUNCH=FORM.launch*FORM.launch/(2*PLAYER.gravity);
{
  const {g,s,st,p,tick,hold,walk,jump,stomp,hand,top}=rig('form');
  const perch=g.level.platforms.find(q=>q.id==='form-perch'),under=perch.x+perch.w/2,lx=under-s.x;
  const springs=[];g.onEvent=e=>{if(e.type==='spring')springs.push(e);};
  // At rest, neither a jump nor a stomp off the slab is enough.
  assert(walk(under));hold(60);
  const apex=jump();
  assert(apex<perch.y-2&&p.groundId!=='form-perch',`a jump off the slab stays far under the perch (${apex.toFixed(2)} vs ${perch.y})`);
  const stood=p.y,before=top(lx),flight=stomp();
  assert.equal(springs.length,1,'the first stomp into the clay throws the player');
  assert(flight>stood+LAUNCH-.6&&flight<stood+LAUNCH+.3,`straight up about ${LAUNCH.toFixed(1)} (${(flight-stood).toFixed(2)})`);
  assert(flight<perch.y-.3&&p.groundId!=='form-perch',`but still under the perch (${flight.toFixed(2)} vs ${perch.y})`);
  assert(top(lx)<before-.1,`and it left a crater (${(before-top(lx)).toFixed(2)})`);
  assert.equal(p.groundId,s.id,'and the player came back down onto the clay');
  // A low pillar pulled up under the perch — by hand, with the player riding
  // it — and a stomp from its top is.
  let hy=formHeight(s.form,lx)+.2;
  const want=perch.y-LAUNCH+.7;
  for(let i=0;i<120&&top(lx)<want;i++){hy+=.1;hand(lx,hy);}
  assert(top(lx)>=want-.05,`a low pillar rises under the perch (${top(lx).toFixed(2)})`);
  assert.equal(p.groundId,s.id,'carrying the player up with it');
  assert(p.y>top(lx)-.2,`to its top (${p.y.toFixed(2)})`);
  hold(30);promises(s.form,'a pillar under the perch');
  assert(jump()<perch.y-.5&&p.groundId===s.id,'a plain jump from it is still not enough');
  const flowers=g.stamps;
  stomp();
  assert.equal(springs.length,2,'a stomp from its top throws the player again');
  assert.equal(p.groundId,'form-perch','onto the perch');
  assert.equal(g.stamps,flowers+1,'where the flower is');
  assert(shapedShare(st)>.1,`a pillar that tall is real work (${shapedShare(st).toFixed(2)})`);
  // R in the lab: back to the clump, back to the dock.
  assert(visitStation(g,'form',{reset:true}));
  assert(s.form.h.every((h,i)=>h===s.form.rest[i]),'R flattens the mass back to its slab');
  assert.equal(shapedShare(st),0);assert.equal(p.groundId,'form-dock');
  assert.equal(g.deaths,0);
}
console.log('PASS the perch is out of reach of a jump or a stomp from the slab, and in reach of a stomp from a low pillar pulled up under the player; R puts the slab back');

// --- stomp, tap, E, and leaving it alone ------------------------------------------------
{
  const {g,s,st,p,tick,hold,walk,jump,stomp,top}=rig('form');
  const springs=[];g.onEvent=e=>{if(e.type==='spring')springs.push(e);};
  assert(walk(s.x+8));hold(frames(1));
  const stood=p.y,crater=top(8);
  const flight=stomp();
  assert(top(8)<crater-.1,`a stomp presses a crater past a stand (${(crater-top(8)).toFixed(2)})`);
  assert.equal(springs.length,1,'and throws the player');assert(flight>stood+5,`high (${(flight-stood).toFixed(2)})`);
  assert.equal(p.groundId,s.id,'who comes back down onto the clay');
  stomp();
  assert.equal(springs.length,2,'and a second stomp throws again: nothing to rearm');
  hold(30);
  // A tap through the shared entry point pokes where it landed.
  const lx=12,before=top(lx);
  assert(nudgeClay(g,'form',0,{x:s.x+lx,y:top(lx)+.1}),'a tap on the mass is taken');
  tick();
  assert(before-top(lx)>FORM.tap*.6&&before-top(lx)<FORM.tap*1.5,`and dents it about ${FORM.tap} (${(before-top(lx)).toFixed(2)})`);
  assert.equal(nudgeClay(g,'form',0),false,'a tap with nowhere to land does nothing');
  // Out of the crater and over to the dock end, then E: it raises a step ahead
  // of the player, not under them.
  for(let k=0;k<4&&p.x>s.x+6;k++)jump({moveAxis:-1});
  assert(walk(s.x+3),'over by the dock end');hold(30);p.facing=1;
  const here=p.y,at=3+FORM.stepReach,ahead=top(at);
  hold(frames(1),{shapeHeld:true});
  assert(top(at)>ahead+.6,`a second of E raises the clay ahead (${(top(at)-ahead).toFixed(2)})`);
  assert(Math.abs(p.y-here)<.4,`and leaves the player's own footing (${(p.y-here).toFixed(2)})`);
  assert(top(at)-p.y>FORM.step,'into a step too tall to walk up');
  // With the player standing on the clay, nothing slumps; once they are back
  // on the dock and the clay has settled, the step slumps.
  const raised=formHeight(s.form,at);
  hold(frames(FORM.settle+3));
  // The step may still be rounding off, and the stand beside it pressing its
  // shoulders; what it must not do is head home, which a slump this long would
  // show as more than a tenth.
  assert(close(formHeight(s.form,at),raised,.05),`standing on the clay, nothing slumps (${(raised-formHeight(s.form,at)).toFixed(3)})`);
  assert(walk(s.x+.6),'back to the dock end');
  for(let i=0;i<120&&p.groundId!=='form-dock';i++)tick({moveAxis:-1,jumpPressed:i===0,jumpHeld:true});
  assert.equal(p.groundId,'form-dock','and up onto the dock');
  hold(frames(FORM.settle+6));
  assert(formHeight(s.form,at)<raised-.1,`left alone, the step slumps (${(raised-formHeight(s.form,at)).toFixed(2)})`);
  // Paused, nothing moves.
  const frozen=Float64Array.from(s.form.h);g.pause();hold(60);
  assert.deepEqual(Array.from(s.form.h),Array.from(frozen),'a paused game freezes the clay');
  g.resume();
  assert.equal(g.deaths,0);
}
console.log('PASS a stomp craters and throws, a tap pokes, E raises a step ahead, a stander holds the clay still, and clay left alone slumps');

// --- the lump on the bench -----------------------------------------------------------------
{
  const {g,s,st,p,tick,hold,walk,jump,stomp,hopTo,place,hand,release,top}=rig('lump');
  assert.equal(nearbyStation(g)?.id,'lump');assert.equal(p.groundId,'form-exit');
  // The foot of the lump is rounded, so the first half-unit of its face is a
  // slope; above that it is a wall.
  const peak=formPeak(s.form),foot=s.x+3.6;
  assert(peak>4.4&&peak<5.2,`a square lump about 4.6 tall (${peak.toFixed(2)})`);
  assert(formSteepAt(s,s.x+3.9,PLAYER.radius)&&formSteepAt(s,s.x+10.1,PLAYER.radius),'with faces too steep to stand on');
  assert(!formSteepAt(s,s.x+7,PLAYER.radius),'and a top to stand on');
  // The bench runs bare up to the lump's foot; the lump stops a walker there,
  // and a jump into its face slides back down: too steep to climb, too tall to
  // jump to.
  hold(frames(4),{moveAxis:1});
  assert(p.x>s.x+.5&&p.x<foot&&p.y<1,`stopped at the foot of the lump (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  for(let i=0;i<3;i++){const apex=jump({moveAxis:1});assert(p.x<foot+.4&&p.y<1.2&&apex<peak,`a jump into the lump slides back to its foot (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);}
  assert.equal(g.deaths,0);
  // Pat it flat: pressing in from the air, across the top, spreads the lump
  // out along the bench into a low mound the player can hop onto and cross.
  for(let pass=0;pass<5;pass++)for(let lx=.5;lx<=13.5;lx+=.5){
    release();
    let y=top(lx)+.9;hand(lx,y);
    for(let i=0;i<8;i++){y=Math.max(2.15,y-.25);hand(lx,y);}
  }
  for(let i=0;i<30;i++)release();
  promises(s.form,'patted flat');
  assert(formPeak(s.form)<2.75,`patted down to a low mound (${formPeak(s.form).toFixed(2)})`);
  assert(formHeight(s.form,1)>.6&&formHeight(s.form,13)>.6,'that has spread along the bench');
  assert(hopTo(s.x+s.w+3),'and the player hops onto it and crosses');
  assert.equal(p.groundId,'lump-exit','to the bench beyond');
  assert(shapedShare(st)>.5,`spreading the lump is real work (${shapedShare(st).toFixed(2)})`);
  // Reset, and draw it up under the player into a pillar for the perch.
  assert(visitStation(g,'lump',{reset:true}));
  assert(s.form.h.every((h,i)=>h===s.form.rest[i]),'R puts the lump back');
  const perch=g.level.platforms.find(q=>q.id==='lump-perch'),under=perch.x+perch.w/2,lx=under-s.x;
  place(under,top(lx));tick();
  assert.equal(p.groundId,s.id,'standing on the lump');
  const apex=jump();
  assert(apex<perch.y-4&&p.groundId!=='lump-perch',`a jump off the lump stays far under its perch (${apex.toFixed(2)} vs ${perch.y})`);
  const springs=[];g.onEvent=e=>{if(e.type==='spring')springs.push(e);};
  const flight=stomp();
  assert.equal(springs.length,1,'a stomp on the lump throws the player');
  assert(flight<perch.y-.3&&p.groundId!=='lump-perch',`but from the lump as it starts, still under the perch (${flight.toFixed(2)} vs ${perch.y})`);
  assert.equal(p.groundId,s.id);
  // A lump this size draws up to about six and a half at most; the perch sits
  // where that and a stomp are just enough.
  let hy=formHeight(s.form,lx)+.2;
  const want=perch.y-LAUNCH+.5;
  for(let i=0;i<300&&top(lx)<want;i++){hy+=.15;hand(lx,hy);}
  for(let i=0;i<30;i++)release();
  assert(top(lx)>=want-.05,`a pillar rises under the perch (${top(lx).toFixed(2)})`);
  assert.equal(p.groundId,s.id,'carrying the player up with it');
  promises(s.form,'a free pillar');
  assert(formHeight(s.form,0)<.05&&formHeight(s.form,s.w)<.05,'the bench either side is still bare');
  const flowers=g.stamps;
  stomp();
  assert.equal(springs.length,2,'and a stomp from the top of that');
  assert.equal(p.groundId,'lump-perch','reaches the perch');
  assert.equal(g.stamps,flowers+1,'where the flower is');
  // Left alone from the bench, the pillar slumps back into a lump.
  place(s.x-2,0);tick();
  assert.equal(p.groundId,'form-exit');
  const tall=formPeak(s.form);
  hold(frames(FORM.settle+10));
  assert(formPeak(s.form)<tall-.3,`left alone, the pillar slumps (${(tall-formPeak(s.form)).toFixed(2)})`);
  promises(s.form,'slumping');
  assert.equal(g.deaths,0);
}
console.log('PASS the lump stops a walker and a jumper, pats flat into a mound to cross, draws up into a pillar a stomp reaches its perch from, and slumps back when left');

// --- the real pointer and key handlers ----------------------------------------------------
{
  function fixture({width=1920,height=1080,viewH=10}={}){
    const canvasHandlers={},windowHandlers={},captured=new Set();
    const canvas={addEventListener:(n,f)=>{(canvasHandlers[n]??=[]).push(f);},getBoundingClientRect:()=>({left:0,top:0,width,height}),setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id)};
    globalThis.window={addEventListener:(n,f)=>{(windowHandlers[n]??=[]).push(f);}};
    globalThis.document={getElementById:id=>id==='world'?canvas:null};
    globalThis.innerWidth=width;
    const viewW=viewH*width/height,camera=new THREE.OrthographicCamera(-viewW/2,viewW/2,viewH/2,-viewH/2,.1,160);
    const emit=(name,e)=>{for(const f of canvasHandlers[name]||[])f({preventDefault(){},button:0,...e});};
    const key=(name,e)=>{for(const f of windowHandlers[name]||[])f({preventDefault(){},...e});};
    return {camera,emit,key,captured,look(x,y){camera.position.set(x,y,26);camera.lookAt(x,y,0);camera.updateMatrixWorld();},
      screen(x,y){const v=new THREE.Vector3(x,y,1.4).project(camera);return {clientX:(v.x+1)/2*width,clientY:(1-v.y)/2*height};}};
  }
  const {ShapingControls}=await import('../dist/shaping-controls.js');
  const f=fixture(),game=boot();assert(visitStation(game,'form'));
  const input={moveAxis:0,jumpHeld:false,jumpPressed:false,stompPressed:false};
  const controls=new ShapingControls({game,world:()=>({camera:f.camera}),input,picker:{}});
  const s=massOf(game,'form'),st=stationOf(game,'form'),top=lx=>surfaceAt(s,s.x+lx);
  const run=seconds=>{for(let i=0;i<Math.max(1,frames(seconds));i++){controls.update();game.tick(dt,input);}};
  f.look(s.x+8,top(8));
  // Taking hold of the surface and dragging up raises it, by about as far as
  // the thumb travelled; the hand follows the thumb, so dragging back down
  // lowers it again.
  let at=f.screen(s.x+8,top(8));
  f.emit('pointerdown',{pointerId:1,...at});
  assert.equal(input.shapeId,'form','the pointer takes hold of the mass');
  assert(close(input.shapeX,s.x+8,.01)&&close(input.shapeY,top(8),.01),'and carries a world point');
  run(0);
  assert.equal(st.grip?.mode,'grab','on the surface, it is a grab');
  const t0=top(8);
  f.emit('pointermove',{pointerId:1,...at,clientY:at.clientY-108});run(.2);
  assert(top(8)>t0+.6&&top(8)<t0+1.3,`a unit's drag up raises the clay about a unit (${(top(8)-t0).toFixed(2)})`);
  f.emit('pointermove',{pointerId:1,...at,clientY:at.clientY-54});run(.2);
  assert(top(8)<t0+.8,`dragging back down lowers it again (${(top(8)-t0).toFixed(2)})`);
  f.emit('pointerup',{pointerId:1,...at});
  assert.equal(input.shapeId,null);assert.equal(input.shapeX,null);
  run(0);assert.equal(st.grip,null,'letting go drops the grip');
  // A drag is not a tap: no poke was added on release.
  const kept=top(8);run(.1);assert(close(top(8),kept,1e-9),'a drag ends where the thumb left it');
  // Pressing in from the air above dents where the ball enters.
  const t12=top(12);
  at=f.screen(s.x+12,t12+1.5);
  f.emit('pointerdown',{pointerId:2,...at});run(0);
  assert.equal(st.grip?.mode,'press','in the air over the clay, it is a press');
  assert(close(top(12),t12,1e-9),'that touches nothing yet');
  f.emit('pointermove',{pointerId:2,...at,clientY:at.clientY+108*2.2});run(.3);
  assert(t12-top(12)>.5,`pushed down into the clay, it dents (${(t12-top(12)).toFixed(2)})`);
  f.emit('pointerup',{pointerId:2,...at});run(0);
  // A tap pokes.
  const t4=top(4);at=f.screen(s.x+4,t4);
  f.emit('pointerdown',{pointerId:3,...at});f.emit('pointerup',{pointerId:3,...at});run(0);
  assert(t4-top(4)>FORM.tap*.6,`a tap pokes the clay (${(t4-top(4)).toFixed(2)})`);
  // A pointer off the trough does nothing to it.
  at=f.screen(s.x-4,3);f.emit('pointerdown',{pointerId:4,...at});
  assert.equal(input.shapeId,null,'a touch over the dock takes nothing');
  // R resets and returns the player to the dock.
  f.key('keydown',{code:'KeyR'});
  assert(s.form.h.every((h,i)=>h===s.form.rest[i]),'R puts the slab back');
  assert.equal(game.player.groundId,'form-dock');
  // The same hands work the lump, from its own bench.
  assert(visitStation(game,'lump'));
  const l=massOf(game,'lump'),lst=stationOf(game,'lump'),ltop=lx=>surfaceAt(l,l.x+lx);
  f.look(l.x+7,ltop(7));
  at=f.screen(l.x+7,ltop(7));const lt=ltop(7);
  f.emit('pointerdown',{pointerId:5,...at});run(0);
  assert.equal(input.shapeId,'lump');assert.equal(lst.grip?.mode,'grab','the pointer takes hold of the lump');
  f.emit('pointermove',{pointerId:5,...at,clientY:at.clientY+108*1.5});run(.3);
  assert(ltop(7)<lt-1,`dragging its top down squashes it (${(lt-ltop(7)).toFixed(2)})`);
  assert(ltop(3)>formRest(l.form,3)+.3||ltop(11)>formRest(l.form,11)+.3,'and it spreads sideways');
  f.emit('pointerup',{pointerId:5,...at});run(0);
  assert.equal(game.deaths,0);
}
console.log('PASS pointer: grab-and-drag raises and lowers, a press from the air dents, a tap pokes, off the clay nothing happens, the lump squashes and spreads; R works');

// --- the mesh reads the surface the feet do --------------------------------------------
{
  const {World}=await import('../dist/world.js');
  const {createClayView,updateClayView,animateClayView,MAGIC_CLAY}=await import('../dist/shaping-views.js');
  const w=Object.create(World.prototype);w.mat={};
  const g=boot();
  for(const id of ['form','lump']){
    assert(visitStation(g,id));
    const s=massOf(g,id),view=createClayView(w,s,new THREE.Group()),mesh=view.clay.pieces[0].mesh,position=mesh.geometry.attributes.position,array=position.array;
    const meshes=[];view.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
    assert.equal(meshes.length,1,`${id}: one unadorned lump`);assert.equal(mesh.material.color.getHex(),MAGIC_CLAY,`${id}: in the magic violet`);
    const check=label=>{
      updateClayView(view,s);
      assert(position.array.every(Number.isFinite)&&mesh.geometry.attributes.normal.array.every(Number.isFinite),`${id} ${label}: finite positions and normals`);
      const rest=view.clay.pieces[0].rest;let tops=0;
      for(let i=0;i<position.count;i++){
        const x=position.getX(i),y=position.getY(i),lx=Math.min(Math.max(x,0),s.w);
        if(rest[i*3+1]===0){tops++;assert(Math.abs(y-(surfaceAt(s,s.x+x)-s.y))<1e-4,`${id} ${label}: the top of the clay is exactly where the feet stand (${y.toFixed(3)} vs ${(surfaceAt(s,s.x+x)-s.y).toFixed(3)} at ${x.toFixed(2)})`);}
        // Relief nudges a vertex a hair sideways; on a column squashed almost
        // flat beside a steep face that can read as a few thousandths high.
        assert(y<=surfaceAt(s,s.x+lx)-s.y+5e-3,`${id} ${label}: nothing drawn rises above the walking surface (${y.toFixed(3)} over ${(surfaceAt(s,s.x+lx)-s.y).toFixed(3)} at ${x.toFixed(2)})`);
        assert(y>=-s.h-.6,`${id} ${label}: and nothing sinks under the base`);
        assert(mesh.geometry.boundingSphere.containsPoint(new THREE.Vector3(x,y,position.getZ(i))),`${id} ${label}: inside the bounding sphere`);
      }
      assert(tops>=s.form.n,`${id} ${label}: a vertex on every column of the surface`);
    };
    check('at rest');
    for(let i=0;i<40;i++)pullForm(s.form,4,0,.3);
    for(let i=0;i<30;i++)pressForm(s.form,s.w-5,formHeight(s.form,s.w-5)+FORM.tool-.1*(i+1));
    check('with a pillar and a bowl');
    assert.equal(position.array,array,`${id}: one private buffer, reused`);
    position.array[1]=123;updateClayView(view,s);
    assert.equal(position.array[1],123,`${id}: an unchanged surface is not rebuilt`);
    pullForm(s.form,8,0,.1);updateClayView(view,s);
    assert.notEqual(position.array[1],123,`${id}: a moved one is`);
    for(let i=0;i<120;i++)animateClayView(view,s,1/60,{near:true});
    assert(view.root.scale.x===1&&view.root.scale.y===1,`${id}: a mass this size does not breathe`);
  }
}
console.log('PASS both masses are drawn from the columns the feet stand on, top exactly on the surface, nothing above it, one buffer, rebuilt only when they move');
