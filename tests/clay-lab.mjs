// The experimental clay rules, driven through the real simulation with real
// inputs. Each experiment has to actually do the thing its hint promises, and
// none of it may leak into a chapter.
import assert from 'node:assert/strict';
import {Game,FIXED_DT as dt,surfaceAt} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import lab from '../dist/routes/clay-lab.js';
import {nearbyStation,visitStation,resetStation} from '../dist/shaping.js';
import {RULES,isRule,perPart,standingOn} from '../dist/clay-rules.js';

const source=JSON.stringify(lab),chapters=JSON.stringify(LEVELS);
const boot=()=>{const g=new Game();g.start(3,lab);return g;};
const step=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick(dt,{...input,jumpPressed:i===0&&input.jumpPressed,stompPressed:i===0&&input.stompPressed});};
const station=(g,id)=>g.level.shaping.find(s=>s.id===id);
const part=(g,id)=>g.level.platforms.find(s=>s.id===id);
// Walk towards a target x the way the player would, with the real move axis.
const walkTo=(g,x,frames=900)=>{for(let i=0;i<frames;i++){const d=x-g.player.x;if(Math.abs(d)<.12)return true;g.tick(dt,{moveAxis:Math.max(-1,Math.min(1,d*2))});}return false;};
// Walk towards a target and hop when something blocks the way, which is what a
// player does at a mound they cannot step over.
const hopTo=(g,x,frames=1400)=>{
  let stuck=0,last=g.player.x;
  for(let i=0;i<frames;i++){
    const d=x-g.player.x;if(Math.abs(d)<.3)return true;
    stuck=Math.abs(g.player.x-last)<.004?stuck+1:0;last=g.player.x;
    const jump=stuck>6&&!!g.player.groundId;if(jump)stuck=0;
    g.tick(dt,{moveAxis:Math.max(-1,Math.min(1,d*2)),jumpPressed:jump,jumpHeld:true});
  }
  return false;
};

// --- the level itself -------------------------------------------------------
{
  assert.equal(new Set(lab.platforms.map(p=>p.id)).size,lab.platforms.length,'platform ids are unique');
  assert(lab.playground,'the lab is a playground, so the station teleport works');
  assert.deepEqual(lab.shaping.map(s=>s.id),['sag','catapult','stamp','form','lump','dig','lintel','mould','wet','marble']);
  for(const s of lab.shaping){
    assert(isRule(s.rule),`${s.id} carries a known rule`);
    assert(s.end>s.x,`${s.id} owns a stretch of the bench`);
    assert(s.parts.length&&s.parts.every(id=>lab.platforms.some(p=>p.id===id&&p.shape)),`${s.id}'s clay exists`);
    assert(s.hint&&s.name&&s.spawn,`${s.id} is teachable`);
  }
  const ranges=lab.shaping.map(s=>[s.x,s.end]).sort((a,b)=>a[0]-b[0]);
  for(let i=1;i<ranges.length;i++)assert(ranges[i][0]>=ranges[i-1][1]-1e-9,'station stretches do not overlap');
  // No chapter may ever take a rule: that is the whole containment story.
  for(const L of LEVELS)for(const s of L.shaping||[])assert(!s.rule,`${L.short} station ${s.id} is hand-worked`);
  assert.equal(RULES.length,4);
  assert(!isRule('wear')&&!lab.platforms.some(p=>p.id.startsWith('wear-')),'wear through is gone from the bench');
}
console.log('PASS the bench is well formed, its stations are ruled, and no chapter station is');

// --- 01 SAG: a big block of soft clay that gives under weight ----------------
{
  const {GIVE,giveDepth,giveSet}=await import('../dist/clay-give.js');
  const {shapedShare}=await import('../dist/clay-rules.js');
  const height=1.7,session=()=>{const g=boot();assert(visitStation(g,'sag'));return g;};
  // Every tick of every sag session goes through one checked step, so what must
  // never break is asserted on all of it: x only ever moves at walking speed (no
  // side wall throws anyone to the block's edge), feet never sit inside the
  // clay, a rider stands exactly on it, and nobody dies.
  const play=g=>{
    const b=part(g,'sag-block');let last=g.player.x,ticks=0;
    const tick=(input={})=>{
      g.tick(dt,input);const p=g.player;ticks++;
      assert(Math.abs(p.x-last)<=6.7*dt+1e-9,`x moves continuously (tick ${ticks}: ${last.toFixed(3)} -> ${p.x.toFixed(3)})`);last=p.x;
      if(p.x>b.x&&p.x<b.x+b.w){
        assert(p.y>=surfaceAt(b,p.x)-.12-1e-9,`feet never end a tick inside the clay (tick ${ticks})`);
        if(p.groundId===b.id)assert(Math.abs(p.y-surfaceAt(b,p.x))<1e-9,`a rider stands exactly on the surface (tick ${ticks})`);
      }
      assert.equal(g.deaths,0,'nobody dies on soft clay');
    };
    const hold=(n,input={})=>{for(let i=0;i<n;i++)tick({...input,jumpPressed:i===0&&!!input.jumpPressed,stompPressed:i===0&&!!input.stompPressed});};
    const walk=(x,frames=1500)=>{for(let i=0;i<frames;i++){const d=x-g.player.x;if(Math.abs(d)<.05)return true;tick({moveAxis:Math.max(-1,Math.min(1,d*3))});}return false;};
    // Ride the clay down until it stops sinking under the player: the bottom of
    // a landing or a crater, where it starts, however slowly, to come back.
    const bottom=()=>{let prev=g.player.y;for(let i=0;i<150;i++){tick();if(g.player.y>=prev-1e-5)return true;prev=g.player.y;}return false;};
    // A held jump, all the way up and back onto something.
    const jump=(input={})=>{let top=-Infinity;hold(1,{...input,jumpPressed:true,jumpHeld:true});for(let i=0;i<400;i++){tick({...input,jumpHeld:true});top=Math.max(top,g.player.y);if(g.player.groundId&&g.player.vy===0)break;}return top;};
    const stomp=()=>{hold(1,{jumpPressed:true,jumpHeld:true});for(let i=0;i<90&&g.player.vy>0;i++)tick({jumpHeld:true});hold(1,{stompPressed:true});for(let i=0;i<150&&!g.player.groundId;i++)tick();};
    // Deliberate placements outside the checked step start a fresh trace.
    const sync=()=>{last=g.player.x;};
    return {b,tick,hold,walk,bottom,jump,stomp,sync};
  };

  // The layout: one deep block laid flush between two benches, and a perch over
  // the clay that belongs to a running jump off the start bench.
  {
    const g=session(),b=part(g,'sag-block'),s=station(g,'sag'),perch=part(g,'sag-perch');
    assert.deepEqual(s.parts,['sag-block']);assert.equal(b.clayRole,'block');assert.equal(b.station,'sag');
    assert.deepEqual(b.shape.from,b.shape.to,'the block never changes pose; only its surface gives');
    assert(b.w>=14&&b.w<=16&&b.h>=8,`a big deep block (${b.w} x ${b.h})`);
    assert.equal(part(g,'lab-start').x+part(g,'lab-start').w,b.x,'flush against the start bench');
    assert.equal(part(g,'sag-exit').x,b.x+b.w,'and against the exit bench');
    assert(b.y===0&&part(g,'lab-start').y===0&&part(g,'sag-exit').y===0,'with every top level');
    assert(perch.kind==='ledge'&&perch.optional&&perch.x>b.x&&perch.x+perch.w<b.x+b.w,'an optional perch over the clay');
    const flower=g.level.stamps.find(f=>f.x>perch.x&&f.x<perch.x+perch.w);
    assert(flower&&flower.y>perch.y&&flower.y<perch.y+2.6,'holds the flower');
    assert(!g.level.hazards.some(h=>h.x<b.x+b.w&&h.x+h.w>b.x),'no pit is left under the clay');
    assert(/stand/i.test(s.hint)&&/stomp/i.test(s.hint)&&/\bR\b/.test(s.hint),'the hint names the stand, the stomp and R');
    assert.equal(shapedShare(s),0,'untouched clay is not shaped');
  }

  // Walking on, it gives: a deep valley with shoulders that carries the player
  // down and settles like heavy clay, keeps a set, and announces it once.
  const g=session(),s=station(g,'sag'),{b,tick,hold,walk,bottom,jump,stomp}=play(g);
  const shaped=[];g.onEvent=e=>{if(e.type==='shape')shaped.push(e);};
  const centre=b.x+b.w/2,depthAt=x=>giveDepth(b.give,x-b.x),setAt=x=>giveSet(b.give,x-b.x);
  // Walking in from the bench, the clay sinks and slopes under the feet in the
  // same step; they never lose the ground.
  for(let i=0;i<1500&&g.player.x<centre-.05;i++){tick({moveAxis:1});if(g.player.x>b.x+.4)assert.equal(g.player.groundId,b.id,`walking into the clay never loses the ground (x ${g.player.x.toFixed(2)})`);}
  assert(walk(centre),'walked onto the block');
  assert.equal(standingOn(s,g.player),0,'and stands on it');
  const sinking=[];for(let i=0;i<360;i++){tick();sinking.push(g.player.y);}
  const settled=g.player.y,shoulder=-Math.min(...b.give.depth),below=(shoulder-settled)/height;
  assert(settled<-1.75&&settled>-2.3,`standing sinks the feet deep into the clay (${settled.toFixed(2)})`);
  assert(shoulder>.2&&shoulder<=GIVE.maxRise,`the clay pushed aside rises into shoulders (${shoulder.toFixed(2)})`);
  assert(below>1.2&&below<1.45,`feet settle about a player-height and a third below them (${below.toFixed(2)})`);
  // Clay, not jelly: the feet sink at most a twentieth past where they settle,
  // turn at most once on the way, and are still inside six tenths of a second.
  let turns=0,heading=0,from=sinking[0],still=0;
  for(const y of sinking){if(Math.abs(y-from)<1e-3)continue;const next=Math.sign(y-from);if(heading&&next!==heading)turns++;heading=next;from=y;}
  sinking.forEach((y,i)=>{if(Math.abs(y-settled)>-settled*.02)still=(i+1)*dt;});
  assert(Math.min(...sinking)>=settled*1.05,`at most one small overshoot (${Math.min(...sinking).toFixed(2)} vs ${settled.toFixed(2)})`);
  assert(turns<=1&&still<=.6,`and no ringing: ${turns} turns, settled after ${still.toFixed(2)}s`);
  assert.equal(shapedShare(s),1,'a good stand sets the clay: 100% shaped');
  assert.deepEqual(shaped.map(e=>e.message),['Sag & set · shaped'],'announced once');

  // The trough follows a walker and lags behind them.
  hold(45,{moveAxis:1});
  const deepAt=b.x+b.give.depth.indexOf(Math.max(...b.give.depth))*b.give.dx;
  assert.equal(g.player.groundId,b.id,'walking on through the clay');
  assert(deepAt<g.player.x-.3&&deepAt>g.player.x-3,`the trough drags behind the feet (${deepAt.toFixed(2)} behind ${g.player.x.toFixed(2)})`);

  // Stepping off: it gives back only a little, never swinging past the dent it
  // keeps, and the track the walk leaves never bulges above rest.
  assert(walk(centre));hold(300);
  // A trace that only ever comes back up: it may pause, but it never sinks in
  // again by more than tol, a thousandth of a unit unless said otherwise.
  const recovering=(trace,tol=1e-3)=>{let least=Infinity;return trace.every(d=>(least=Math.min(least,d),d<=least+tol));};
  const x0=g.player.x,after=[];let wake=0;
  const track=()=>{const f=b.give;for(let i=0;i<f.n;i++){const at=b.x+i*f.dx;if(at>x0&&at<g.player.x-1.5)wake=Math.min(wake,f.depth[i]);}};
  for(let i=0;i<1400&&g.player.groundId!=='sag-exit';i++){tick({moveAxis:1});track();if(Math.abs(g.player.x-x0)>2.5)after.push(depthAt(x0));}
  assert.equal(g.player.groundId,'sag-exit','walked off the right end onto the bench');
  assert.equal(g.player.y,0,'without a step');
  for(let i=0;i<420;i++){tick();after.push(depthAt(x0));}
  const kept=after.at(-1);
  // The dent keeps setting for a moment after the clay turns, which can settle
  // it back a few thousandths: under a pixel, and nothing like a wobble.
  assert(recovering(after,.01),'released, the clay only ever rises back: no wobble');
  assert(Math.min(...after)>=kept-.01,'so it never swings past the dent it keeps');
  assert(-settled-kept<=-settled*.25&&-settled-kept>.05,`it gives back a little, a quarter of the stand at most (${(-settled-kept).toFixed(2)} of ${(-settled).toFixed(2)})`);
  assert(setAt(x0)>=-settled-GIVE.yield-.1&&surfaceAt(b,x0)<-1.2,`and keeps the rest as a deep imprint (${surfaceAt(b,x0).toFixed(2)})`);
  assert(wake>=0,`and the walk out left a track with no wake above rest (${wake.toFixed(3)})`);
  assert(walk(15),'and walked back across');
  assert.equal(g.player.groundId,'lab-start','off the left end onto the start bench');
  assert.equal(g.player.y,0);

  // The perch is a running jump off the start bench. Clay this dead gives
  // nothing back to jump with: a plain jump from a stand, bounce after bounce,
  // or a jump from the bottom of a stomp crater never gets there.
  const perch=part(g,'sag-perch'),under=perch.x+perch.w/2;
  {
    const h=session(),p=h.player,flowers=h.stamps;
    walkTo(h,part(h,'lab-start').x+part(h,'lab-start').w-7,1500);
    let jumped=false;
    for(let i=0;i<400&&!(jumped&&p.groundId&&p.vy===0);i++){const go=!jumped&&p.x>=17.6;jumped||=go;h.tick(dt,{moveAxis:1,jumpPressed:go,jumpHeld:jumped});}
    assert.equal(p.groundId,'sag-perch','a running jump off the start bench lands on the perch');
    assert.equal(h.stamps,flowers+1,'where the flower is');
    const k=boot();Object.assign(k.player,{x:part(k,'sag-exit').x+4,y:0,vx:0,vy:0,groundId:'sag-exit',coyote:.1});step(k,10);
    let from=false;
    for(let i=0;i<400&&!(from&&k.player.groundId&&k.player.vy===0);i++){const go=!from&&k.player.x<=part(k,'sag-exit').x+.3;from||=go;k.tick(dt,{moveAxis:-1,jumpPressed:go,jumpHeld:from});}
    assert.notEqual(k.player.groundId,'sag-perch','the exit bench is too far away to reach it');
  }
  assert(walk(under));hold(360);
  const stand=g.player.y;
  const plain=jump();
  assert(plain<perch.y-.8,`a plain jump from a settled stand stays well below the perch (${plain.toFixed(2)})`);
  assert.equal(g.player.groundId,b.id);
  hold(240);
  const bounces=[];for(let i=0;i<10;i++){assert(bottom(),'each landing bottoms out');bounces.push(jump());}
  assert(Math.max(...bounces)<perch.y-.8,`timed bounces stay well below the perch (${Math.max(...bounces).toFixed(2)})`);
  assert(Math.max(...bounces)<plain+.3,`heavy clay is no trampoline: a bounce is about a plain jump (${bounces.map(b=>b.toFixed(2)).join(' ')})`);
  assert(Math.max(...bounces.slice(5))<=Math.max(...bounces.slice(0,5))+.05,'and never keeps climbing');
  hold(360);
  const settledStand=g.player.y;
  stomp();
  let crater=Infinity;const ride=[];
  for(let i=0;i<240;i++){tick();ride.push(g.player.y);crater=Math.min(crater,g.player.y);}
  assert(crater<settledStand-.8&&crater>=-GIVE.maxDepth-1e-9,`a stomp presses a crater well below a stand (${crater.toFixed(2)} vs ${settledStand.toFixed(2)})`);
  const recovery=ride.slice(ride.indexOf(crater));
  assert(recovering(recovery.map(y=>-y),.02),'it comes back up a little without sloshing');
  hold(420);
  assert(-g.player.y>-crater*.7,`and the crater is mostly kept (${g.player.y.toFixed(2)} of ${crater.toFixed(2)})`);
  {
    // Jumps timed every six ticks after a stomp lands, from the crater's first
    // bottom to well after: none is thrown anywhere near the perch.
    let highest=-Infinity;const springs=[];
    for(let wait=0;wait<=60;wait+=6){
      const h=session(),p=h.player;h.onEvent=e=>{if(e.type==='spring')springs.push(e);};
      walkTo(h,under,1500);step(h,360);
      step(h,1,{jumpPressed:true,jumpHeld:true});for(let i=0;i<90&&p.vy>0;i++)h.tick(dt,{jumpHeld:true});
      step(h,1,{stompPressed:true});for(let i=0;i<150&&!p.groundId;i++)h.tick(dt,{});
      step(h,wait);step(h,1,{jumpPressed:true,jumpHeld:true});
      for(let i=0;i<400&&!(p.groundId&&p.vy===0);i++){h.tick(dt,{jumpHeld:true});highest=Math.max(highest,p.y);}
      assert.notEqual(p.groundId,'sag-perch',`a jump ${wait} ticks after the stomp does not reach the perch`);
    }
    assert(highest<perch.y-.5,`the crater gives back a nudge, never a throw (${highest.toFixed(2)})`);
    assert.equal(springs.length,0,'and never sounds like a spring');
  }

  // Hazards that have to stay designed out: clay springing back over airborne
  // feet lifts them rather than throwing them to the block's edge, and a surface
  // rising fast never lets a falling player through.
  {
    const h=session(),{b:hb,walk:hw,hold:hh,stomp:hs,bottom:hbot,sync}=play(h),p=h.player;
    hw(24);hh(300);hs();hbot();
    // Feet caught inside a crater wall on the way down, the way a sideways hop
    // into a steep wall leaves them.
    const x=p.x+1.1;Object.assign(p,{x,y:surfaceAt(hb,x)-.3,vx:0,vy:-1,groundId:null,coyote:0,stomping:false});
    h.tick(dt,{});
    assert(Math.abs(p.x-x)<.02,`overtaken feet stay where they are (${x.toFixed(2)} -> ${p.x.toFixed(2)})`);
    assert(p.y>=surfaceAt(hb,p.x)-.12,'lifted back onto the clay');
    // Rising more slowly than the crater springs back: the clay gives way to the
    // feet instead of catching the jump as a landing.
    sync();hh(240);hs();hbot();hh(6);
    const rising=(surfaceAt(hb,p.x)-surfaceAt(hb,p.x,true))/dt;
    assert(rising>.5,`the crater is still coming back (${rising.toFixed(1)}/s)`);
    Object.assign(p,{y:surfaceAt(hb,p.x)+.01,vy:rising*.6,groundId:null,coyote:0});
    for(let i=0;i<8;i++){h.tick(dt,{jumpHeld:true});assert(p.groundId===null,`clay springing back never catches a rising player (tick ${i})`);}
    sync();hh(240);hs();hbot();
    for(let i=0;i<6;i++)h.tick(dt,{});
    Object.assign(p,{y:surfaceAt(hb,p.x)+.02,vy:0,groundId:null,coyote:0});
    let caught=false;
    for(let i=0;i<60;i++){h.tick(dt,{});assert(p.y>=surfaceAt(hb,p.x)-.12,'a rising surface never passes a falling player');caught||=p.groundId===hb.id;}
    assert(caught,'it catches them');
    sync();hh(120);
  }

  // A long, messy session: hops in and out of the dent at both ends, stomps
  // everywhere, walking across and back. play() checks every tick of it.
  {
    const h=session(),{hold:hh,sync}=play(h);let seed=7;
    const rand=()=>(seed=seed*16807%2147483647)/2147483647;
    for(let i=0;i<120;i++){
      const target=18+rand()*15.5,axis=Math.sign(target-h.player.x)*(rand()<.3?.4:1);
      hh(10+Math.floor(rand()*40),{moveAxis:axis,jumpPressed:rand()<.45,jumpHeld:rand()<.7});
      if(rand()<.35)hh(12,{stompPressed:true,moveAxis:axis});
    }
    for(const [x,dir] of [[18.4,-1],[33.1,1],[18.9,-1],[32.6,1]]){
      for(let i=0;i<900&&Math.abs(h.player.x-x)>.05;i++)h.tick(dt,{moveAxis:Math.max(-1,Math.min(1,(x-h.player.x)*3))});
      sync();hh(120);hh(40,{moveAxis:dir});
      assert.equal(h.player.groundId,dir<0?'lab-start':'sag-exit',`standing at the very edge (${x}), the bench is one step away`);
      hh(1,{moveAxis:-dir,jumpPressed:true,jumpHeld:true});hh(80,{moveAxis:-dir,jumpHeld:true});
    }
  }

  // R in the lab is a visit with a reset: the clay comes back perfectly flat.
  assert(visitStation(g,'sag',{reset:true}));
  const f=b.give;
  assert(['depth','velocity','set','previous'].every(k=>f[k].every(n=>n===0)),'R flattens the press, its motion and the set');
  assert(s.amount===0&&!s.announced&&shapedShare(s)===0,'and the station reads unshaped again');
  step(g,120);
  assert(f.depth.every(n=>n===0)&&surfaceAt(b,centre)===0,'and stays flat with nobody on it');

  // Paused, nothing moves.
  walkTo(g,centre,1500);step(g,20);
  const frozen=Float64Array.from(f.depth);g.pause();step(g,60);
  assert.deepEqual(Array.from(f.depth),Array.from(frozen),'a paused game freezes the clay');
  g.resume();step(g,5);
  assert.notDeepEqual(Array.from(f.depth),Array.from(frozen),'and it carries on after');

  // The view reads the same surface the feet do.
  const THREE=await import('../dist/lib/three.module.js');
  const {World}=await import('../dist/world.js');
  const {createClayView,updateClayView,animateClayView}=await import('../dist/shaping-views.js');
  const w=Object.create(World.prototype);w.mat={};
  const view=createClayView(w,b,new THREE.Group()),mesh=view.clay.pieces[0].mesh,position=mesh.geometry.attributes.position,array=position.array;
  step(g,60);updateClayView(view,b);
  assert.equal(position.array,array,'one private buffer, reused');
  assert(position.array.every(Number.isFinite)&&mesh.geometry.attributes.normal.array.every(Number.isFinite),'finite positions and normals');
  const rest=view.clay.pieces[0].rest;let top=0;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i);
    if(rest[i*3+1]===0){top++;assert(Math.abs(y-(surfaceAt(b,b.x+x)-b.y))<1e-5,'the top of the clay is exactly where the feet stand');}
    if(x>=0&&x<=b.w)assert(y<=surfaceAt(b,b.x+x)-b.y+1e-3,'and nothing drawn rises above it');
  }
  assert(top>=b.give.n,'with a vertex on every node of the surface');
  position.array[1]=123;updateClayView(view,b);
  assert.equal(position.array[1],123,'an unchanged surface is not rebuilt');
  step(g,1);updateClayView(view,b);
  assert.notEqual(position.array[1],123,'a moving one is');
  for(let i=0;i<120;i++)animateClayView(view,b,1/60,{near:true});
  assert(view.root.scale.x===1&&view.root.scale.y===1,'a block this size does not breathe');
}
console.log('PASS sag: the block gives under a stand and settles like clay, drags a trough with no wake, gives back a quarter and keeps the rest, keeps its craters, throws nobody, and never teleports, traps or leaks through');

// --- 02 CATAPULT: pack it until it throws you --------------------------------
{
  const g=boot();assert(visitStation(g,'catapult'));
  const s=station(g,'catapult'),lump=part(g,'catapult-lump');
  assert(hopTo(g,lump.x+lump.w/2,1600),'hopped onto the lump');
  step(g,60);
  assert(standingOn(s,g.player)>=0,'and settled onto it');
  const launches=[];g.onEvent=e=>{if(e.type==='spring')launches.push(e);};
  // Two stomps pack it full: hop, then stomp back down onto it.
  for(let i=0;i<3&&!launches.length;i++){
    step(g,1,{jumpPressed:true});step(g,14);
    step(g,1,{stompPressed:true});step(g,50);
  }
  assert(launches.length>=1,`packing it full throws the player (${s.amount.toFixed(2)} charge)`);
  assert(g.player.vy>12||g.player.y>lump.y+2,'and throws them upward with real force');
  step(g,90);
  assert(s.amount<.4,'the charge is spent by the launch');
  // Left alone, a packed lump relaxes rather than staying armed forever.
  assert(walkTo(g,part(g,'catapult-dock').x+3,1500)||true);
  s.target=.8;s.amount=.8;step(g,300);
  assert(s.amount<.8,'an abandoned charge relaxes');
  assert(!g.deaths,'no deaths at the catapult');
}
console.log('PASS catapult: stomping packs the lump, a full lump throws the player, and a charge left alone relaxes');

// --- 03 STAMP: each slab rises only where you put your weight through it -----
{
  const g=boot();assert(visitStation(g,'stamp'));
  const s=station(g,'stamp');
  assert(perPart(s)&&s.amounts.length===4,'the stair keeps an amount per step');
  const first=part(g,'stamp-step-0'),base=first.y;
  assert(walkTo(g,first.x+first.w/2,1200),'walked onto the first slab');
  step(g,1,{jumpPressed:true});step(g,14);step(g,1,{stompPressed:true});step(g,200);
  assert(s.amounts[0]>.9,`the slab you stamped rose (${s.amounts[0].toFixed(2)})`);
  assert.deepEqual(s.amounts.slice(1).map(a=>a<.05),[true,true,true],'and only that one');
  assert(part(g,'stamp-step-0').y>base+.8,'it is now a real step');
  assert.equal(s.amount,Math.min(...s.amounts),'the station is only finished when its slowest step is');
  // A second stamp on a different slab raises that one too.
  const second=part(g,'stamp-step-1');
  Object.assign(g.player,{x:second.x+second.w/2,y:second.y+4,vx:0,vy:0,groundId:null,coyote:0});
  step(g,1,{stompPressed:true});step(g,200);
  assert(s.amounts[1]>.9,'the next stamp raises the next slab');
  assert(s.amounts[2]<.05&&s.amounts[3]<.05,'still only where you stamped');
  resetStation(s);step(g,200);
  assert(s.amounts.every(a=>a<.05),'R flattens the whole row');
}
console.log('PASS stamp: a slab rises only where the player stamped it, and the row resets together');

// --- containment ------------------------------------------------------------
{
  // Hands reach ruled clay only where clay-rules.js says that rule takes them.
  // Weight-only clay must ignore them, or the rule stops being the rule; the
  // hand drills themselves live in tests/clay-lab-hands.mjs.
  const {nudgeClay}=await import('../dist/shaping.js');
  const {HANDS,takesHands}=await import('../dist/clay-rules.js');
  assert.deepEqual([...HANDS],['catapult','stamp','form'],'the catapult, the stamp and the formable mass take a hand');
  assert(HANDS.every(isRule)&&!takesHands(lab.shaping.find(s=>s.id==='sag')),'and the sag clay is not one of them');
  for(const L of LEVELS)for(const s of L.shaping||[])assert(takesHands(s),`${L.short} station ${s.id} still takes a hand`);
  // Two identical sag sessions, one kneaded, dragged and tapped: the simulation
  // is deterministic, so they must come out exactly alike.
  const held=boot(),still=boot();assert(visitStation(held,'sag')&&visitStation(still,'sag'));
  const hands={shapeHeld:true,shapeId:'sag',shapePart:0,shapeAmount:1};
  step(held,180,hands);step(still,180);
  assert.equal(nudgeClay(held,'sag'),false,'a tap does not press the sag clay');
  assert.equal(JSON.stringify(station(held,'sag')),JSON.stringify(station(still,'sag')),'holding knead and dragging do not shape it either');
  // A hand only works the station whose stretch the player is standing in.
  step(held,180,{shapeHeld:true,shapeId:'catapult',shapeAmount:1});
  assert.equal(station(held,'catapult').target,0,'a hand in the sag stretch leaves the catapult alone');
  assert(station(held,'stamp').targets.every(t=>t===0),'and the stair');
  // Hand-worked chapter clay still takes the hold exactly as it always has.
  const chapter=new Game();chapter.start(3);
  const first=chapter.level.shaping[0];Object.assign(chapter.player,first.spawn,{vx:0,vy:0});
  step(chapter,120,{shapeHeld:true});
  assert(Math.abs(first.target-.65)<1e-9,`a second of E kneads chapter clay at the usual rate (${first.target.toFixed(3)})`);
  assert(!('hand' in first)&&!('spent' in first),'and none of the lab\'s hand bookkeeping reaches it');
  // The lab never edits the shipped chapters or its own source module.
  for(const id of ['catapult','stamp']){assert(visitStation(held,id));step(held,120,{shapeHeld:true});}
  assert(station(held,'catapult').target>0&&station(held,'stamp').targets[0]>0,'hands did work the lab this session');
  assert.equal(JSON.stringify(LEVELS),chapters,'chapters are untouched by a lab session');
  assert.equal(JSON.stringify(lab),source,'and so is the lab module itself');
}
console.log('PASS hands reach only the clay whose rule takes them, chapter clay is worked as before, and a lab session leaves the chapters and its own source alone');

// --- a lap of the bench ------------------------------------------------------
{
  const g=boot();
  for(const s of lab.shaping){
    assert(visitStation(g,s.id),`teleport to ${s.id}`);
    assert.equal(nearbyStation(g)?.id,s.id,`${s.id} is the station you land in`);
    assert.equal(g.player.health,3,'and you arrive whole');
  }
  assert.equal(g.deaths,0,'walking the bench between experiments costs nothing');
}
console.log('PASS every experiment can be reached directly from the pause menu, in any order');
