// Two Clay Lab experiments take a hand as well as a boot: the catapult lump
// packs under a held E or a downward drag, and each stamp slab can be sized by
// dragging it or holding E. This drives the real ShapingControls — its key and
// pointer handlers, against a real orthographic camera at the clay's true
// screen position — and real Game ticks, so it fails where a player's hands
// would. The sag clay is the control: weight is its only tool.
import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT,surfaceAt} from '../dist/simulation.js';
import lab from '../dist/routes/clay-lab.js';
import {visitStation,nudgeClay} from '../dist/shaping.js';
import {takesHands,heldPart,standingOn,shapedShare} from '../dist/clay-rules.js';
import {createShapeHands,animateShapeHands} from '../dist/shape-hand.js';

function fixture({width=1920,height=1080,viewH=10}={}){
  const canvasHandlers={},windowHandlers={},captured=new Set();
  const canvas={
    addEventListener:(n,f)=>{(canvasHandlers[n]??=[]).push(f);},
    getBoundingClientRect:()=>({left:0,top:0,width,height}),
    setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id)
  };
  globalThis.window={addEventListener:(n,f)=>{(windowHandlers[n]??=[]).push(f);}};
  globalThis.document={getElementById:id=>id==='world'?canvas:null};
  globalThis.innerWidth=width;
  const viewW=viewH*width/height;
  const camera=new THREE.OrthographicCamera(-viewW/2,viewW/2,viewH/2,-viewH/2,.1,160);
  const emit=(name,e)=>{for(const f of canvasHandlers[name]||[])f({preventDefault(){},button:0,...e});};
  const key=(name,e)=>{for(const f of windowHandlers[name]||[])f({preventDefault(){},...e});};
  return {canvas,camera,emit,key,captured,
    look(x,y){camera.position.set(x,y,26);camera.lookAt(x,y,0);camera.updateMatrixWorld();},
    screen(x,y){
      const v=new THREE.Vector3(x,y,1.4).project(camera);
      return {clientX:(v.x+1)/2*width,clientY:(1-v.y)/2*height};
    }};
}

// The fixture is 1920px wide, so a full press is the stroke's 140px cap.
const FULL=140;
const frames=seconds=>Math.round(seconds/FIXED_DT);

// A rig around one lab station: the player at its spawn, the camera on its
// clay, and the app's own frame order — controls.update, then a tick.
const {ShapingControls}=await import('../dist/shaping-controls.js');
function rig(stationId){
  const f=fixture();
  const game=new Game();game.start(3,lab);
  assert(visitStation(game,stationId),`teleport to ${stationId}`);
  const input={moveAxis:0,jumpHeld:false,jumpPressed:false,stompPressed:false};
  const controls=new ShapingControls({game,world:()=>({camera:f.camera}),input,picker:{}});
  const station=game.level.shaping.find(s=>s.id===stationId);
  const part=i=>game.level.platforms.find(p=>p.id===station.parts[i]);
  const first=part(0);f.look(first.x+first.w/2,first.y);
  const springs=[];game.onEvent=e=>{if(e.type==='spring')springs.push(e);};
  // Runs for a span of game time, stopping early the tick `until` holds.
  const run=(seconds,until)=>{
    for(let i=0;i<Math.max(1,frames(seconds));i++){controls.update();game.tick(FIXED_DT,input);input.jumpPressed=false;input.stompPressed=false;if(until?.())return true;}
    return false;
  };
  // Where a thumb lands on a piece of clay in its live pose.
  const grip=i=>{const s=part(i);return f.screen(s.x+s.w/2,s.y-Math.min(.4,(s.h??1)/2));};
  const place=i=>{const s=part(i),x=s.x+s.w/2;Object.assign(game.player,{x,y:surfaceAt(s,x),vx:0,vy:0,groundId:s.id,coyote:.135});};
  return {f,game,input,controls,station,part,run,grip,place,springs,
    holdE:()=>f.key('keydown',{code:'KeyE'}),releaseE:()=>f.key('keyup',{code:'KeyE'})};
}
const close=(a,b,eps=1e-6)=>Math.abs(a-b)<eps;

// --- which clay takes a hand -------------------------------------------------
{
  const byId=Object.fromEntries(lab.shaping.map(s=>[s.id,s]));
  assert(takesHands(byId.catapult)&&takesHands(byId.stamp),'the catapult and the stamp take hands');
  assert(!takesHands(byId.sag),'the sag clay does not');
  assert.equal(byId.catapult.gesture,'down','the lump is packed by dragging down');
  assert.equal(byId.stamp.gesture,'up','a slab is raised by dragging up');
  for(const id of ['catapult','stamp'])assert(/stomp/i.test(byId[id].hint)&&/drag/i.test(byId[id].hint)&&/hold E/.test(byId[id].hint)&&/\bR\b/.test(byId[id].hint),`${id}'s hint names every way in`);
}
console.log('PASS the catapult and stamp take hands, the sag clay does not, and their hints say how');

// --- CATAPULT ----------------------------------------------------------------
{
  // Holding E from the dock packs the lump with nobody on it, holds the charge
  // while the key is down, and lets it relax once the key comes up.
  const r=rig('catapult'),s=r.station;
  assert.equal(standingOn(s,r.game.player),-1,'the player starts on the dock');
  r.holdE();r.run(1);
  assert(s.target>.6&&s.target<.7,`a second of E packs it at the kneading rate (${s.target.toFixed(2)})`);
  assert(s.amount>.5,'and the lump visibly follows');
  r.run(2);
  assert.equal(s.target,1,'held long enough it is fully packed');
  assert.equal(s.amount,1,'and stays packed under the hand rather than relaxing');
  assert.equal(r.springs.length,0,'packing it from the dock throws nobody');
  r.releaseE();r.run(1.5);
  assert(s.target<.75&&s.amount<1,`let go, the charge relaxes (${s.target.toFixed(2)})`);
  assert(!r.game.deaths);
}
{
  // Dragging the lump down sets the charge directly, and holds it there.
  const r=rig('catapult'),s=r.station,at=r.grip(0);
  r.f.emit('pointerdown',{pointerId:1,...at});
  assert.equal(r.input.shapeId,'catapult','pressing the lump takes hold of it');
  r.f.emit('pointermove',{pointerId:1,...at,clientY:at.clientY+FULL/2});r.run(0);
  assert(close(s.target,.5),`a half drag down packs it halfway (${s.target.toFixed(3)})`);
  r.f.emit('pointermove',{pointerId:1,...at,clientY:at.clientY-30});r.run(0);
  assert.equal(s.target,0,'dragging back up lets the charge back out');
  r.f.emit('pointermove',{pointerId:1,...at,clientY:at.clientY+FULL+20});r.run(2);
  assert.equal(s.target,1,'a full drag packs it full');
  assert.equal(s.amount,1,'and a held thumb keeps the charge from relaxing');
  r.f.emit('pointerup',{pointerId:1,...at,clientY:at.clientY+FULL+20});
  assert.equal(r.input.shapeId,null,'letting go releases the lump');
  assert.equal(s.target,1,'a drag ends where the thumb left it, with no tap added');
  r.run(1);
  assert(s.target<.85,'and with the hand gone, the charge relaxes again');
}
{
  // Packing it while standing on it throws the player at full, and the hand
  // that armed it cannot re-arm it until it has let go.
  const r=rig('catapult'),s=r.station;
  r.place(0);r.run(.05);
  assert.equal(standingOn(s,r.game.player),0,'standing on the lump');
  const start=r.game.player.y;
  r.holdE();
  let sunk=start;
  assert(r.run(4,()=>{sunk=Math.min(sunk,r.game.player.y);return r.springs.length>0;}),`holding E while on it packs it until it throws (${s.amount.toFixed(2)})`);
  assert(sunk<start-.5,'the lump sank under the player while it packed');
  assert(r.game.player.vy>20,'and it throws them with real force');
  assert(s.spent,'the lump knows the hand that armed it is still on it');
  r.run(.35);
  // Put the player straight back on the lump with the key still down. This is
  // the endless trampoline the latch exists to stop.
  r.place(0);r.run(3);
  assert.equal(r.springs.length,1,'a held key does not re-arm the lump');
  assert(s.target<.01,`the charge stays spent under the held key (${s.target.toFixed(2)})`);
  assert.equal(standingOn(s,r.game.player),0,'and the player is still standing there, unthrown');
  r.releaseE();r.run(0);
  assert(!s.spent,'letting go of E frees the lump');
  r.holdE();
  assert(r.run(5,()=>r.springs.length>1),'a fresh press packs it and throws again');
  r.releaseE();
  // A thumb resting on the lump counts as a hand too.
  r.run(.35);r.place(0);r.run(.35);
  const at=r.grip(0);r.f.emit('pointerdown',{pointerId:2,...at});
  r.f.emit('pointermove',{pointerId:2,...at,clientY:at.clientY+FULL+60});
  assert(r.run(4,()=>r.springs.length>2),'dragging it full while standing on it throws the player');
  r.run(.35);r.place(0);r.run(2);
  assert.equal(r.springs.length,3,'and the thumb still on the lump does not re-arm it');
  assert(s.target<.01);
  r.f.emit('pointerup',{pointerId:2,...at,clientY:at.clientY+FULL+60});r.run(0);
  assert(!s.spent,'lifting the thumb frees it');
  // Pre-packed from the dock and then boarded, it still throws at full.
  visitStation(r.game,'catapult',{reset:true});
  r.holdE();r.run(2.5);
  assert.equal(s.amount,1,'packed full from the dock');
  r.place(0);
  assert(r.run(.2,()=>r.springs.length>3),'stepping onto a full lump throws the player');
  r.releaseE();
  assert(!r.game.deaths,'no deaths at the catapult');
}
{
  // A tap is one press, like a tap on any clay.
  const r=rig('catapult'),s=r.station,at=r.grip(0);
  r.f.emit('pointerdown',{pointerId:3,...at});r.f.emit('pointerup',{pointerId:3,...at});
  assert(close(s.target,.3),`a tap nudges the lump (${s.target.toFixed(3)})`);
  assert.equal(r.input.shapeId,null);
  assert(nudgeClay(r.game,'catapult'),'and a tap through the shared entry point does too');
  assert(close(s.target,.6));
}
console.log('PASS catapult: E and a downward drag pack it and hold the charge, a released charge relaxes, it throws at full, a held hand cannot re-arm it, a tap nudges');

// --- STAMP -------------------------------------------------------------------
{
  // A pointer on slab 2 works slab 2, from that slab's own height.
  const r=rig('stamp'),s=r.station;r.f.look(r.part(2).x+r.part(2).w/2,r.part(2).y);
  let at=r.grip(2);
  r.f.emit('pointerdown',{pointerId:1,...at});
  assert.equal(r.input.shapeId,'stamp');assert.equal(r.input.shapePart,2,'the pointer takes hold of the slab under it');
  r.f.emit('pointermove',{pointerId:1,...at,clientY:at.clientY-FULL/2});r.run(0);
  assert(close(s.targets[2],.5),`dragging up raises that slab (${s.targets[2].toFixed(3)})`);
  assert.deepEqual([0,1,3].map(i=>s.targets[i]),[0,0,0],'and only that slab');
  r.f.emit('pointerup',{pointerId:1,...at,clientY:at.clientY-FULL/2});
  assert.equal(r.input.shapePart,null,'letting go releases the slab');
  r.run(2);
  assert(close(s.amounts[2],.5),'the slab settles where it was left');
  // A second stroke starts from this slab's height, not from the row's lowest.
  at=r.grip(2);
  r.f.emit('pointerdown',{pointerId:2,...at});
  assert.equal(r.input.shapePart,2,'the risen slab is still the one under the thumb');
  r.f.emit('pointermove',{pointerId:2,...at,clientY:at.clientY-FULL*.2});r.run(0);
  assert(close(s.targets[2],.7),`a short push up continues from the slab's own height (${s.targets[2].toFixed(3)})`);
  r.f.emit('pointermove',{pointerId:2,...at,clientY:at.clientY+FULL*.4});r.run(0);
  assert(close(s.targets[2],.1),`dragging down lowers it (${s.targets[2].toFixed(3)})`);
  r.f.emit('pointermove',{pointerId:2,...at,clientY:at.clientY-FULL*3});r.run(2);
  assert.equal(s.amounts[2],1,'a long stroke up raises it all the way');
  r.f.emit('pointerup',{pointerId:2,...at,clientY:at.clientY-FULL*3});
  assert.equal(s.amount,0,'the station is still only as finished as its lowest slab');
  assert.equal(shapedShare(s),.25,'while the pause menu counts one slab of four as a quarter of the work');
  const slab=r.part(2);assert(close(slab.y,slab.shape.to.y,1e-9),'and the raised slab is a real step');
  assert.deepEqual([0,1,3].map(i=>s.amounts[i]),[0,0,0],'its neighbours never moved');
}
{
  // Slabs sit closer together than a thumb's grab allowance, so their grab
  // boxes overlap; the nearest slab wins, not the first in the list.
  const r=rig('stamp'),a=r.part(1),b=r.part(2);r.f.look(a.x+a.w,a.y);
  assert(b.x<a.x+a.w+1.1,'the two slabs do share a stretch of grab box');
  const probe=(x,id)=>{
    const at=r.f.screen(x,a.y-.4);
    r.f.emit('pointerdown',{pointerId:id,...at});const part=r.input.shapePart;r.f.emit('pointercancel',{pointerId:id,...at});
    return part;
  };
  assert.equal(probe(b.x+.4,5),2,'a touch on slab 2 inside slab 1\'s grab box takes slab 2');
  assert.equal(probe(a.x+a.w-.4,6),1,'a touch on slab 1 inside slab 2\'s grab box takes slab 1');
  const gap=b.x-(a.x+a.w);
  assert.equal(probe(a.x+a.w+gap*.25,7),1,'in the gap, the nearer edge wins');
  assert.equal(probe(b.x-gap*.25,8),2);
  // Those probes were taps; each pressed the slab it chose, and nothing else.
  assert.deepEqual(r.station.targets.map(t=>+t.toFixed(3)),[0,.6,.6,0],'each tap pressed only the slab it took');
}
{
  // Holding E on a slab raises that slab and carries the player up with it.
  const r=rig('stamp'),s=r.station;
  r.place(1);r.run(.05);
  assert.equal(standingOn(s,r.game.player),1);
  const start=r.game.player.y;
  let rode=true;
  r.holdE();r.run(1.5,()=>{rode&&=r.game.player.groundId==='stamp-step-1'&&close(r.game.player.y,surfaceAt(r.part(1),r.game.player.x),.05);return false;});
  assert(s.targets[1]>.9,`E grows the slab underfoot (${s.targets[1].toFixed(2)})`);
  assert.deepEqual([0,2,3].map(i=>s.targets[i]),[0,0,0],'and no other');
  assert(rode,'the player rides its surface the whole way');
  assert(r.game.player.y>start+1.5,`and is carried up (${start.toFixed(2)} -> ${r.game.player.y.toFixed(2)})`);
  r.releaseE();r.run(.5);
  const held=s.targets[1];r.run(2);
  assert.equal(s.targets[1],held,'a slab keeps its height once the hand lets go');
  assert(!r.game.deaths);
}
{
  // From the dock, E raises the first slab ahead of the player.
  const r=rig('stamp'),s=r.station;
  assert.equal(r.game.player.groundId,'stamp-dock');assert.equal(r.game.player.facing,1);
  r.holdE();r.run(1);
  assert(s.targets[0]>.6,`E from the dock grows the first slab ahead (${s.targets[0].toFixed(2)})`);
  assert.deepEqual(s.targets.slice(1),[0,0,0],'and only that one');
  r.releaseE();
  // Off the slabs, facing decides; with nothing ahead, the nearest slab does.
  const g=r.game,p=g.player,mid=r.part(2);
  Object.assign(p,{x:mid.x+.2,groundId:null,facing:1});assert.equal(heldPart(g,s),2,'hovering at slab 2 facing right, slab 2 is ahead');
  p.facing=-1;assert.equal(heldPart(g,s),1,'facing left, the nearest slab behind that point is ahead instead');
  Object.assign(p,{x:r.part(3).x+r.part(3).w+3,facing:1});assert.equal(heldPart(g,s),3,'with no slab ahead, the nearest one');
  Object.assign(p,{groundId:'stamp-step-0',facing:1});assert.equal(heldPart(g,s),0,'and underfoot beats both');
}
{
  // A tap raises the tapped slab by one press.
  const r=rig('stamp'),s=r.station;r.f.look(r.part(3).x,r.part(3).y);
  const at=r.grip(3);
  r.f.emit('pointerdown',{pointerId:1,...at});r.f.emit('pointerup',{pointerId:1,...at});
  assert(close(s.targets[3],.3),'a tap raises the tapped slab');
  assert.deepEqual(s.targets.slice(0,3),[0,0,0],'and nothing else');
  assert.equal(nudgeClay(r.game,'stamp'),false,'a tap that names no slab has nothing to raise');
}
{
  // The boot still works, and R still flattens the whole row.
  const r=rig('stamp'),s=r.station,b=r.part(2);
  Object.assign(r.game.player,{x:b.x+b.w/2,y:b.y+3,vx:0,vy:0,groundId:null,coyote:0});
  r.input.stompPressed=true;r.run(1.25);
  assert.equal(s.targets[2],1,'a stomp raises the landed slab to full');
  assert.deepEqual([0,1,3].map(i=>s.targets[i]),[0,0,0],'and only that slab');
  r.run(1.5);r.f.emit('pointerdown',{pointerId:4,...r.grip(0)});r.f.emit('pointerup',{pointerId:4,...r.grip(0)});
  assert(s.targets[0]>0&&s.amounts[2]===1,'the row is worked by boot and hand together');
  r.f.key('keydown',{code:'KeyR'});r.run(0);
  assert(s.targets.every(t=>t===0)&&s.amounts.every(a=>a===0),'R flattens the row');
  assert.equal(r.game.player.x,s.spawn.x,'and returns the player to the dock');
}
console.log('PASS stamp: a pointer takes the nearest slab and drags it up or down from its own height, E grows the slab underfoot or ahead, a tap raises one slab, stomp and R still work');

// --- SAG: hands do nothing ---------------------------------------------------
{
  // Two identical sag sessions, hands on only one of them. The simulation is
  // deterministic, so weight-only clay has to come out of both exactly alike,
  // whatever the rule itself does with the player's weight meanwhile.
  const touched=rig('sag'),alone=rig('sag');
  const at=touched.grip(0);
  touched.f.emit('pointerdown',{pointerId:1,...at});
  assert.equal(touched.input.shapeId??null,null,'a pointer does not take hold of the sag clay');
  assert.equal(touched.f.captured.size,0,'nor capture the pointer');
  touched.f.emit('pointermove',{pointerId:1,...at,clientY:at.clientY+200});touched.f.emit('pointerup',{pointerId:1,...at});
  touched.holdE();
  touched.run(1);alone.run(1);
  // A hand from outside the controls, as a stale drag might leave behind.
  Object.assign(touched.input,{shapeId:'sag',shapePart:0,shapeAmount:1});
  touched.run(1);alone.run(1);
  touched.releaseE();
  const state=r=>JSON.stringify({station:r.station,parts:r.station.parts.map((_,i)=>r.part(i)),player:r.game.player});
  assert.equal(state(touched),state(alone),'holding E and dragging leave the sag clay exactly as weight alone does');
  assert.equal(nudgeClay(touched.game,'sag'),false,'and a tap does not move it either');
  assert(!touched.station.hand,'the sag clay never registers a hand');
}
console.log('PASS sag: pointer, E and tap leave the sag clay alone');

// --- the cues: stamp teaches a rising stroke, the catapult a pressing one ----
{
  const g=new Game();g.start(3,lab);
  const w={levelRoot:new THREE.Group(),reducedMotion:false};
  w.shapeHands=createShapeHands(w,g.level);
  const view=id=>w.shapeHands.find(v=>v.station.id===id);
  for(const [id,sign] of [['stamp',1],['catapult',-1]]){
    assert(visitStation(g,id));
    const v=view(id),s=g.level.shaping.find(t=>t.id===id),first=g.level.platforms.find(p=>p.id===s.parts[0]);
    const travel=[];for(let i=0;i<114;i++){animateShapeHands(w,g,1/60,true);travel.push(v.hands[0].position.clone());}
    assert(v.root.visible,`${id}: the cue shows beside unworked clay`);
    const reach=travel.reduce((best,p)=>Math.abs(p.y)>Math.abs(best.y)?p:best);
    assert(Math.sign(reach.y)===sign&&Math.abs(reach.y)>.6&&Math.abs(reach.x)<.01,`${id}: the hand travels ${sign>0?'up':'down'}`);
    assert(v.marks.every(m=>Math.sign(m.position.y)===sign),`${id}: the run and arrow lie ${sign>0?'above':'below'} the hand`);
    const arrow=v.marks.find(m=>m.userData.arrow);
    assert(close(arrow.rotation.z,sign*Math.PI/2),`${id}: the arrowhead points ${sign>0?'up':'down'}`);
    if(id==='stamp'){
      assert(v.root.position.x>=first.x&&v.root.position.x<=first.x+first.w,'the stair cue sits on the first slab still to raise');
      assert(v.root.position.y>=first.y&&v.root.position.y<first.y+1,'on its top face');
      s.amounts[0]=s.targets[0]=1;animateShapeHands(w,g,1/60,true);
      const next=g.level.platforms.find(p=>p.id===s.parts[1]);
      assert(v.root.position.x>=next.x&&v.root.position.x<=next.x+next.w,'and moves on to the next slab once that one is up');
    }
  }
}
{
  // Someone who has built the stair before and is now sizing a slab other than
  // the lowest is working, not hesitating, so the cue stays away until they stall.
  const g=new Game();g.start(3,lab);
  const w={levelRoot:new THREE.Group(),reducedMotion:false,clayDone:new Set(['stamp'])};
  w.shapeHands=createShapeHands(w,g.level);assert(visitStation(g,'stamp'));
  const v=w.shapeHands.find(v=>v.station.id==='stamp'),s=v.station;
  for(let i=0;i<180;i++){s.amounts[2]=s.targets[2]=Math.min(1,i/170);animateShapeHands(w,g,1/60,true);}
  assert.equal(s.amount,0,'the lowest slab never moved');
  assert(!v.root.visible,'raising another slab keeps the cue quiet');
  for(let i=0;i<180;i++)animateShapeHands(w,g,1/60,true);
  assert(v.root.visible,'and a stall brings it back');
}
console.log('PASS cues: the stair shows a rising stroke on the next slab to raise, the lump a pressing one, and neither nags a working hand');
