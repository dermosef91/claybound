// The soft clay block's surface on its own: a row of springs that sinks under
// weight into one broad valley, swells into shoulders beside it, settles like a
// heavy material rather than ringing like jelly, gives back only a quarter of a
// press and keeps the rest, and never lifts or sinks where the benches hold its
// ends. No renderer
// and no game, so every number here is the heightfield's.
import assert from 'node:assert/strict';
import {GIVE,GIVE_TUNABLE,createGive,resetGive,giveDepth,giveSet,giveVelocity,pressGive,kickGive,holdUnder,stepGive,capGive,relaxGive,giveShare} from '../dist/clay-give.js';
import {FORM,createForm} from '../dist/clay-form.js';

const dt=1/120,W=15.5,mid=W/2,height=1.7;
const lowest=f=>Math.max(...f.depth),highest=f=>-Math.min(...f.depth);
// Every limit that has to hold on every tick, whatever is happening to the clay.
function limits(f,label){
  for(let i=0;i<f.n;i++){
    const d=f.depth[i],edge=Math.min(i*f.dx,f.w-i*f.dx);
    assert(Number.isFinite(d)&&Number.isFinite(f.velocity[i])&&Number.isFinite(f.set[i]),`${label}: node ${i} is finite`);
    assert(d<=f.floor[i]+1e-9&&d<=GIVE.maxDepth+1e-9,`${label}: node ${i} never sinks past its floor`);
    assert(-d<=GIVE.maxRise+1e-9,`${label}: node ${i} never swells past the cap`);
    if(edge<=GIVE.endReach)assert(-d<=GIVE.endRise+1e-9,`${label}: the clay beside a bench never rises into a step (${(-d).toFixed(3)} at ${edge.toFixed(2)})`);
    assert(f.set[i]>=0&&f.set[i]<=f.keep[i]+1e-9&&f.set[i]<=GIVE.setMax+1e-9,`${label}: node ${i} keeps no more than the set cap`);
    assert(f.velocity[i]<=GIVE.sink+1e-9,`${label}: node ${i} never sinks faster than a rider can follow`);
  }
}
const run=(f,ticks,each)=>{for(let t=0;t<ticks;t++){each?.(t);stepGive(f,dt);limits(f,'tick '+t);}};

// Direction changes in a trace, ignoring motion finer than eps: a ringing
// surface turns many times, a settling one at most once.
const turns=(trace,eps=1e-3)=>{let dir=0,count=0,ref=trace[0];for(const d of trace){if(Math.abs(d-ref)<eps)continue;const next=Math.sign(d-ref);if(dir&&next!==dir)count++;dir=next;ref=d;}return count;};
// Whether a depth trace only ever comes back up: it may pause, but it never
// sinks in again by more than tol, a thousandth of a unit unless said otherwise.
const recovering=(trace,tol=1e-3)=>{let least=Infinity;return trace.every(d=>(least=Math.min(least,d),d<=least+tol));};
// The first tick after which a trace stays within tol of where it ends.
const settledBy=(trace,tol)=>{for(let i=trace.length-1;i>=0;i--)if(Math.abs(trace[i]-trace.at(-1))>tol)return (i+1)*dt;return 0;};

// --- standing still: a deep, broad valley that settles like clay -------------
{
  const f=createGive(W);
  assert(f.n>=W/.25&&f.dx<=.25,'a node at least every quarter unit');
  assert.equal(stepGive(f,dt),false,'untouched clay does no work');
  const trace=[],sets=[];run(f,480,()=>{pressGive(f,mid);trace.push(giveDepth(f,mid));sets.push(giveSet(f,mid));});
  const settled=giveDepth(f,mid),shoulder=highest(f),below=(settled+shoulder)/height;
  assert(settled>1.75&&settled<2.3,`standing sinks the clay deep (${settled.toFixed(2)})`);
  assert(shoulder>.2,`the clay pushed aside swells into shoulders (${shoulder.toFixed(2)})`);
  assert(below>1.2&&below<1.45,`feet settle a player-height and a third below the shoulders (${below.toFixed(2)})`);
  // A valley, not a notch: still more than half as deep a unit and a half out,
  // and the deepest point is under the feet.
  assert(giveDepth(f,mid-1.5)>settled*.5&&giveDepth(f,mid+1.5)>settled*.5,'the dent is one broad valley');
  assert(Math.abs(f.depth.indexOf(lowest(f))*f.dx-mid)<f.dx*1.01,'centred on the feet');
  const shoulderAt=Array.from(f.depth,(d,i)=>[d,i*f.dx]).reduce((a,b)=>b[0]<a[0]?b:a)[1];
  assert(Math.abs(shoulderAt-mid)>2.5&&Math.abs(shoulderAt-mid)<5,`the shoulders sit beside the valley, not at the ends (${shoulderAt.toFixed(2)})`);
  // Heavy, not springy: at most one small overshoot, no ringing, and settled
  // inside six tenths of a second.
  const peak=Math.max(...trace);
  assert(peak<=settled*1.05,`it sinks at most a twentieth past where it settles (${peak.toFixed(3)} vs ${settled.toFixed(3)})`);
  assert(turns(trace)<=1,`without ringing (${turns(trace)} turns)`);
  assert(settledBy(trace,settled*.02)<=.6,`settled within six tenths of a second (${settledBy(trace,settled*.02).toFixed(2)}s)`);
  // Plasticity: held about a second, all but the elastic give is kept.
  const full=settled-GIVE.yield;
  assert(sets[Math.round(1.1/dt)]>=full-.1,`the set takes hold within about a second (${sets[Math.round(1.1/dt)].toFixed(2)} of ${full.toFixed(2)})`);
  assert(giveSet(f,mid)<=full+.02,`and a stand keeps no more than it pressed past the give (${giveSet(f,mid).toFixed(3)})`);
  assert.equal(giveShare(f),1,'which is what shaped means for this clay');
  // Weight on a dent it already made sinks it no further: the same stand again
  // is work the clay has already done.
  const again=Float64Array.from(f.set);run(f,360,()=>pressGive(f,mid));
  assert(Math.abs(giveSet(f,mid)-again[Math.round(mid/f.dx)])<.02,'standing again on the same dent does not dig it deeper');

  // --- stepping off: a small recovery that never swings past its shape --------
  const release=[];run(f,600,()=>release.push(giveDepth(f,mid)));
  const kept=release.at(-1),back=settled-kept;
  assert(back>settled*.1&&back<settled*.25,`released, it gives back only a little of the stand (${back.toFixed(2)} of ${settled.toFixed(2)})`);
  assert(recovering(release),'rising the whole way, never sinking back: no wobble');
  assert(Math.min(...release)>=kept-1e-3&&Math.min(...release)>0,'so it never swings past the shape it keeps, let alone above the rest surface');
  assert(settledBy(release,.03)<=1.05,`settling within about a second (${settledBy(release,.03).toFixed(2)}s)`);
  assert(kept>=giveSet(f,mid)-.15,`settling close to the shape it kept (${kept.toFixed(2)} vs ${giveSet(f,mid).toFixed(2)})`);
  assert(f.rest,'and then stops working');
  const version=f.version;assert.equal(stepGive(f,dt),false);assert.equal(f.version,version,'a resting surface never asks to be redrawn');
}
console.log('PASS standing sinks one broad valley with shoulders, settles without ringing and keeps all but its give; stepping off gives back a quarter at most, without a swing');

// --- the ends: a bench holds them ---------------------------------------------
{
  for(const x of [.1,.35,.6,W-.35,W-.1]){
    const f=createGive(W);run(f,360,()=>pressGive(f,x,GIVE.weight*1.5));
    // A player's edge reaches the bench at a radius from the end; the game reads
    // a rise of more than .12 there as a wall.
    const under=giveDepth(f,x<mid?.32:W-.32);
    assert(under<.12,`weight at the end (${x}) cannot sink a step beside the bench (${under.toFixed(3)})`);
  }
  // A dent just inside an end swells nothing on the bench side.
  const f=createGive(W);run(f,600,t=>{pressGive(f,2.4);if(t%40===0)kickGive(f,2.4,GIVE.sink);});
  for(let i=0;i<f.n&&i*f.dx<=GIVE.endReach;i++)assert(-f.depth[i]<=GIVE.endRise+1e-9);
}
console.log('PASS the ends of the block stay flush with the benches under any weight');

// --- a stomp: a deeper, heavier crater that comes back without sloshing ------
{
  // Stand, hop (the clay recovers while the player is in the air), and come
  // down in a stomp: the rule adds the stomp as a press that fades.
  const f=createGive(W);run(f,360,()=>pressGive(f,mid));
  const settled=giveDepth(f,mid);run(f,100);
  let punch=GIVE.stomp,deepest=0,deepAt=0;const trace=[];
  run(f,300,t=>{pressGive(f,mid,GIVE.weight+punch);punch*=Math.exp(-dt/GIVE.punch);const d=giveDepth(f,mid);trace.push(d);if(d>deepest){deepest=d;deepAt=t;}});
  assert(deepest>settled+1,`a stomp presses a crater a unit below a stand (${deepest.toFixed(2)} vs ${settled.toFixed(2)})`);
  assert(deepest<=GIVE.maxDepth+1e-9,'but no deeper than the clay can go');
  const back=trace.slice(deepAt);
  // The kept crater still sets for a moment after the clay has turned, which can
  // settle it back a hundredth: under a pixel, and nothing like a slosh.
  assert(recovering(back,.02),'it comes back up without sinking in again');
  assert(Math.min(...back)>settled-.05,`and never past the stand still pressing it (${Math.min(...back).toFixed(2)} vs ${settled.toFixed(2)})`);
  assert(back.at(-1)>deepest*.7,`a crater is mostly kept, not sprung back out (${back.at(-1).toFixed(2)} of ${deepest.toFixed(2)})`);
  // Standing in a crater deeper than a stand holds it where it is: weight never
  // lifts clay it has already pressed past its own reach.
  const crater=giveDepth(f,mid);run(f,360,()=>pressGive(f,mid));
  assert(giveDepth(f,mid)>crater-.03,`a stand in a deep crater does not lift it (${giveDepth(f,mid).toFixed(2)} vs ${crater.toFixed(2)})`);
  // The sink cap: however hard the press, the surface drops at most sink*dt a tick.
  let fastest=0;for(let i=1;i<trace.length;i++)fastest=Math.max(fastest,trace[i]-trace[i-1]);
  assert(fastest<=GIVE.sink*dt+1e-9,`a crater is pressed in, never knocked out from under the feet (${(fastest/dt).toFixed(1)}/s)`);
}
console.log('PASS a stomp presses a deeper crater at a speed feet can ride, keeps most of it, and a stand never lifts it');

// --- walking: the trough lags, and leaves a kept track with no wake -------------
{
  const f=createGive(W),start=3;let x=start,track=0,ahead=0,walking=true;
  const points=[6,8],traces=points.map(()=>[]);
  const watch=()=>{
    for(let i=0;i<f.n;i++){const at=i*f.dx;if(at>start+.5&&at<x-1.5)track=Math.min(track,f.depth[i]);if(at>x+.5&&walking)ahead=Math.min(ahead,f.depth[i]);}
    points.forEach((at,i)=>traces[i].push(giveDepth(f,at)));
  };
  run(f,150,()=>{pressGive(f,x);x+=6.7*dt;watch();});
  const deepAt=f.depth.indexOf(lowest(f))*f.dx;
  assert(deepAt<x-.3&&deepAt>x-2,`the trough drags gently behind a walker (${deepAt.toFixed(2)} behind ${x.toFixed(2)})`);
  assert(giveDepth(f,x)>.3,'while still sinking under their feet');
  assert(giveDepth(f,3.5)>.5,'and keeps where they have been');
  // The walker steps off here; the clay they leave keeps being watched.
  walking=false;run(f,360,watch);
  assert(track>=0,`the track behind a walker never bulges above rest (${track.toFixed(3)})`);
  assert(ahead>-.12,`and no more than a low shoulder of clay runs ahead of them (${ahead.toFixed(3)})`);
  traces.forEach((trace,i)=>{
    const top=trace.indexOf(Math.max(...trace)),back=trace.slice(top);
    assert(recovering(back),`behind them the clay at ${points[i]} only ever rises back, without a ripple`);
    assert(back.at(-1)>trace[top]*.75,`into a track that keeps most of the trough (${back.at(-1).toFixed(2)} of ${trace[top].toFixed(2)})`);
  });
}
console.log('PASS walking drags a trough that lags behind the feet and leaves a kept track with no wake');

// --- a rising player holds the clay under them ----------------------------------
{
  const f=createGive(W);run(f,360,()=>pressGive(f,mid));
  const feet=giveDepth(f,mid)-.05;
  run(f,20,()=>holdUnder(f,mid,feet,1));
  holdUnder(f,mid,feet,1);
  assert(giveDepth(f,mid)>=feet+.02-1e-9,'springing clay cannot pass the feet of a rising player');
  assert(giveVelocity(f,mid)>=-1-1e-9,'nor rise faster than they do');
}
console.log('PASS clay springing back never overtakes a rising player');

// --- determinism, garbage and reset ---------------------------------------------
{
  const script=f=>{run(f,300,t=>{pressGive(f,4+t*.02);if(t===100)kickGive(f,6,9);if(t>200)holdUnder(f,9,-.5,3);});return f;};
  const a=script(createGive(W)),b=script(createGive(W));
  for(const key of ['depth','velocity','set','previous'])assert.deepEqual(Array.from(a[key]),Array.from(b[key]),`the same presses give the same ${key}`);
  assert.equal(a.version,b.version);
  // Arrays are allocated once: stepping never replaces them.
  const arrays=['depth','velocity','set','previous','load'].map(k=>a[k]);
  run(a,30,()=>pressGive(a,mid));
  assert(['depth','velocity','set','previous','load'].every((k,i)=>a[k]===arrays[i]),'a tick allocates nothing new');
  // previous is the surface as it stood before the tick.
  const before=Float64Array.from(a.depth);pressGive(a,mid);stepGive(a,dt);
  assert.deepEqual(Array.from(a.previous),Array.from(before),'previous holds the surface from before the step');

  // Garbage in: nothing becomes NaN, nothing throws, and nonsense does nothing.
  const f=createGive(NaN);assert(f.n>=3&&f.w>=1,'a nonsense width still makes a usable field');
  const g=createGive(W);
  for(const bad of [NaN,Infinity,-Infinity,undefined,null,'x',{}]){
    pressGive(g,bad);pressGive(g,mid,bad);kickGive(g,bad,5);kickGive(g,mid,bad);holdUnder(g,bad,-5,1);holdUnder(g,mid,bad,1);holdUnder(g,mid,-5,bad);
    stepGive(g,bad);giveDepth(g,bad);
  }
  assert(g.depth.every(d=>d===0)&&g.velocity.every(v=>v===0),'unusable input moves nothing');
  pressGive(g,mid,1e12);kickGive(g,mid,-1e9);run(g,240);
  // Weight that lifts, and weight past what a number can hold, are nonsense too.
  run(g,70,()=>pressGive(g,mid));run(g,120,t=>{pressGive(g,mid+2,-1-t/6);for(let i=0;i<4;i++)pressGive(g,mid,Number.MAX_VALUE);});
  assert(giveDepth(g,mid)>GIVE.maxDepth-.5,`weight past what a number holds still presses the clay in, rather than jamming it (${giveDepth(g,mid).toFixed(2)})`);
  stepGive(g,-1);stepGive(g,1e9);limits(g,'absurd input');
  assert(Number.isFinite(giveDepth(g,mid))&&Number.isFinite(giveDepth(g,-50))&&Number.isFinite(giveDepth(g,1e6)),'sampling off either end reads the end');
  // Reset flattens the press, the motion and the set together.
  run(g,200,()=>pressGive(g,mid));
  const v=g.version;resetGive(g);
  assert(['depth','velocity','set','previous','load'].every(k=>g[k].every(n=>n===0)),'reset flattens depth, motion and set');
  assert(g.rest&&g.version>v,'and asks to be redrawn once');
  assert.equal(giveShare(g),0);
  assert.equal(stepGive(g,dt),false,'then rests');
}
console.log('PASS the heightfield is deterministic, allocation-free per tick, shrugs off garbage, and resets completely');

// --- a layer riding a formable mass: its grid, its tune, its cap, its healing ----
{
  // The bench's numbers unless a station says otherwise, and never the spacing.
  const plain=createGive(W);assert.deepEqual(plain.tune,GIVE,'a plain layer carries the bench\'s numbers');
  assert(!GIVE_TUNABLE.includes('spacing')&&GIVE_TUNABLE.every(k=>k in GIVE),'everything but the spacing can be tuned');
  const tuned=createGive(W,{tune:{weight:400,tension:30,spacing:.5,nonsense:2,damping:NaN}});
  assert.equal(tuned.tune.weight,400);assert.equal(tuned.tune.tension,30);assert.equal(tuned.tune.spacing,GIVE.spacing);assert.equal(tuned.tune.damping,GIVE.damping);
  assert(!('nonsense' in tuned.tune)&&Object.isFrozen(tuned.tune),'a tune takes only the table\'s own numbers, and is frozen');
  // Lighter weight, shallower stand.
  const heavy=createGive(W),light=createGive(W,{tune:{weight:400}});
  run(heavy,360,()=>pressGive(heavy,mid));run(light,360,()=>pressGive(light,mid));
  assert(giveDepth(light,mid)<giveDepth(heavy,mid)*.7,`a lighter tune sinks less (${giveDepth(light,mid).toFixed(2)} vs ${giveDepth(heavy,mid).toFixed(2)})`);
  // On a mass's grid the nodes are the mass's columns.
  const form=createForm(17.2,2.7,[[0,0],[1,0]],{free:true}),layer=createGive(17.2,{spacing:FORM.spacing});
  assert.equal(layer.n,form.n);assert(Math.abs(layer.dx-form.dx)<1e-12,'one node to a column');
  // The cap: never deeper than the column less the thinnest clay, nor than the
  // bench's own edge floor; the kept set is clipped with it; a field pressed
  // past a lowered cap is woken so the step can clamp it.
  run(layer,360,()=>pressGive(layer,8.6));
  const before=Math.max(...layer.depth);assert(before>1.5,'the bench\'s weight presses deep into a thick column');
  const tops=Float64Array.from(form.h);tops.fill(1.2,20,50);
  layer.rest=true;capGive(layer,tops,FORM.minThick);
  for(let i=0;i<layer.n;i++){
    assert(layer.floor[i]<=layer.edge[i]+1e-12&&layer.floor[i]<=Math.max(0,tops[i]-FORM.minThick)+1e-12,`node ${i} is capped by the column and the edge`);
    assert(layer.keep[i]<=layer.floor[i]+1e-12&&layer.set[i]<=layer.keep[i]+1e-12,`node ${i} keeps no more than its cap`);
  }
  assert.equal(layer.rest,false,'a field pressed past its new cap is woken');
  stepGive(layer,dt);
  for(let i=20;i<50;i++)assert(layer.depth[i]<=1.2-FORM.minThick+1e-9,`the step clamps node ${i} to the cap`);
  assert(Math.abs(layer.deepest-Math.max(...layer.floor))<1e-12,'deepest follows the cap');
  // Healing: the set flows back at the pace's rate and reaches nought; the
  // surface follows it up; nothing to heal is a no-op and so is no time.
  const wet=createGive(17.2,{spacing:FORM.spacing,tune:{weight:400}});
  run(wet,360,()=>pressGive(wet,8.6));
  const kept=Math.max(...wet.set);assert(kept>.3,`a stand sets the layer (${kept.toFixed(2)})`);
  assert.equal(relaxGive(wet,0,{relaxTime:5,relaxMin:.4}),false,'no time heals nothing');
  relaxGive(wet,dt,{relaxTime:5,relaxMin:.4});
  const once=Math.max(...wet.set),k=1-Math.exp(-dt/5);
  assert(Math.abs(once-kept*(1-k))<1e-9||Math.abs(once-(kept-.4*dt))<1e-9,`one tick heals a share of the set (${once.toFixed(4)} of ${kept.toFixed(4)})`);
  let t=0;while(Math.max(...wet.set)>0&&t<20){relaxGive(wet,dt,{relaxTime:5,relaxMin:.4});stepGive(wet,dt);t+=dt;}
  assert(t>1&&t<12,`the set is healed to nothing within the pace's seconds (${t.toFixed(2)}s)`);
  run(wet,240);
  assert(Math.max(...wet.depth)<.02,`and the surface has followed it up (${Math.max(...wet.depth).toFixed(3)})`);
  assert.equal(relaxGive(wet,dt,{relaxTime:5,relaxMin:.4}),false,'nothing left to heal');
  assert.equal(stepGive(wet,dt),false,'and the field rests');
  // Hold-under against columns of their own heights: the surface under a
  // rising player is measured from each column's top, not from a flat one.
  const hill=createGive(17.2,{spacing:FORM.spacing}),cols=Float64Array.from(form.h),i=35,x=i*hill.dx;
  for(let j=0;j<cols.length;j++)cols[j]=2.7+2*Math.exp(-((j*hill.dx-x)**2)/2);
  run(hill,360,()=>pressGive(hill,x));
  const feet=cols[i]-hill.depth[i]-.05;
  holdUnder(hill,x,feet,1,cols);
  assert(hill.depth[i]>=cols[i]-feet+.02-1e-9,'springing clay cannot pass the feet measured against its own column');
  assert(hill.velocity[i]>=-1-1e-9,'nor rise faster than they do');
}
console.log('PASS a layer on a mass takes the mass\'s grid and a station\'s tune, is capped by the columns, heals its set at a wet pace and holds under against its own tops');
