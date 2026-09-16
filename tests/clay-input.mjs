import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT} from '../dist/simulation.js';
import {nearbyStation} from '../dist/shaping.js';

// Dragging is the primary way to work clay: you push or pull it and watch it
// follow your thumb. Tapping and stomping are the accessible extras. This runs
// the real pointer handlers against the real orthographic camera, at the clay's
// true screen position, so a regression in the drag path fails here and not in
// someone's hands.
function fixture({width=1080,height=2160,viewH=8.7,captureThrows=false}={}){
  const canvasHandlers={},windowHandlers={},captured=new Set();
  const canvas={
    addEventListener:(n,f)=>{(canvasHandlers[n]??=[]).push(f);},
    getBoundingClientRect:()=>({left:0,top:0,width,height}),
    setPointerCapture(id){if(captureThrows)throw new Error("NotFoundError: no active pointer with the given id is found.");captured.add(id);},
    releasePointerCapture:id=>captured.delete(id)
  };
  globalThis.window={addEventListener:(n,f)=>{(windowHandlers[n]??=[]).push(f);}};
  globalThis.document={getElementById:id=>id==='world'?canvas:null};
  globalThis.innerWidth=width;
  const viewW=viewH*width/height;
  const camera=new THREE.OrthographicCamera(-viewW/2,viewW/2,viewH/2,-viewH/2,.1,160);
  const emit=(name,e)=>{for(const f of canvasHandlers[name]||[])f({preventDefault(){},button:0,...e});};
  const key=(name,e)=>{for(const f of windowHandlers[name]||[])f({preventDefault(){},...e});};
  return {canvas,camera,emit,key,captured,viewW,viewH,width,height,
    // Aim the camera the way the world does, then project a world point onto
    // the screen, so pointer coordinates are the ones a player would produce.
    look(x,y){camera.position.set(x,y,26);camera.lookAt(x,y,0);camera.updateMatrixWorld();},
    screen(x,y){
      const v=new THREE.Vector3(x,y,1.4).project(camera);
      return {clientX:(v.x+1)/2*width,clientY:(1-v.y)/2*height};
    }};
}

// Standing at one of a chapter's clay docks. The player is put where the level
// says that clay is worked from and held there — these cases are about what a
// pointer and a key reach, not about where an unattended body drifts to — and
// the station under the hands is whichever one that spot belongs to. It is not
// always the dock's own: the canyon lump is worked from the bridge its
// neighbour becomes, so the lump's dock is the spire's, and clay the player is
// not standing at refuses a hand by design. `shape` finishes the named
// stations first, which is how a player reaches the later docks.
async function rig(dockId,{chapter=3,options,shape=[],standX}={}){
  const f=fixture(options);
  const game=new Game();game.start(chapter);
  const input={moveAxis:0,jumpHeld:false,jumpPressed:false,stompPressed:false};
  const stand={...game.level.shaping.find(s=>s.id===dockId).spawn};
  if(standX!==undefined)stand.x=standX;
  Object.assign(game.player,stand,{vx:0,vy:0});
  const {ShapingControls}=await import('../dist/shaping-controls.js');
  const controls=new ShapingControls({game,world:()=>({camera:f.camera}),input,picker:{}});
  const r={f,game,input,stand,controls};
  r.step=(frames=1)=>{for(let i=0;i<frames;i++){Object.assign(game.player,stand,{vx:0,vy:0,invuln:9});controls.update();game.tick(FIXED_DT,input);input.jumpPressed=false;input.stompPressed=false;}};
  for(const id of shape){const s=game.level.shaping.find(q=>q.id===id);s.target=1;}
  r.step(shape.length?240:2);
  r.station=nearbyStation(game);
  r.part=game.level.platforms.find(p=>r.station?.parts.includes(p.id));
  if(r.part)f.look(r.part.x+r.part.w/2,r.part.y);
  r.live=()=>game.level.shaping.find(s=>s.id===r.station.id);
  r.axis=r.station?.gesture==='down'?'clientY':'clientX';
  r.grip=()=>f.screen(r.part.x+r.part.w/2,r.part.y-Math.min(.4,r.part.h/2));
  return r;
}
// Every clay dock in the campaign, and the station each one actually works.
const docks=[0,1,2,3].flatMap(chapter=>{
  const probe=new Game();probe.start(chapter);
  return probe.level.shaping.map(s=>({chapter,dock:s.id}));
});

// Every chapter's clay, not just the one this file started with: a stroke that
// works in the Hanging Quarter and nowhere else is not a working stroke.
for(const {chapter,dock} of docks){
  const r=await rig(dock,{chapter});
  const id=r.station.id,live=r.live,axis=r.axis;
  // Grab the clay where it is, then drag it the way its gesture asks for.
  const grip=r.grip();
  r.f.emit('pointerdown',{pointerId:1,...grip});
  assert.equal(r.input.shapeId,id,`${chapter}/${id}: pressing the clay takes hold of it`);
  let moved=0;
  for(const px of [20,40,60,80,100,150]){
    r.f.emit('pointermove',{pointerId:1,...grip,[axis]:grip[axis]+px});
    r.step(2);
    assert(live().target>moved,`${chapter}/${id}: the clay follows the drag at ${px}px`);
    moved=live().target;
    // A short push has to show itself straight away, or the stroke reads as
    // dead and the player goes looking for another way in.
    if(px===40)assert(moved>.25,`${chapter}/${id}: a 40px push already moves it (got ${moved.toFixed(2)})`);
  }
  // And a stroke a thumb can make in one go has to finish the piece, or
  // dragging is not really the primary verb — it is a chore next to tapping.
  assert.equal(moved,1,`${chapter}/${id}: one 150px stroke finishes the clay`);
  r.f.emit('pointerup',{pointerId:1,...grip,[axis]:grip[axis]+150});
  assert.equal(r.input.shapeId,null,`${chapter}/${id}: letting go releases the clay`);
  r.step(240);
  assert.equal(live().amount,1,`${chapter}/${id}: a drag alone shapes it end to end`);
  // Nothing about the drag depends on the tap path: it moved the clay long
  // before the pointer came up, which is what "primary" has to mean.
  assert(live().announced,`${chapter}/${id}: the station reports itself shaped`);
}
// And the one station no dock of its own reaches: the canyon lump is worked
// from the bridge the spire becomes, so it is only draggable once that is done.
{
  const r=await rig('canyon-lump',{chapter:0,shape:['canyon-spire'],standX:134});
  assert.equal(r.station.id,'canyon-lump','the flattened spire puts the player at the lump');
  const grip=r.grip();
  r.f.emit('pointerdown',{pointerId:2,...grip});
  assert.equal(r.input.shapeId,'canyon-lump','pressing the lump takes hold of it');
  r.f.emit('pointermove',{pointerId:2,...grip,[r.axis]:grip[r.axis]+150});
  r.step(2);
  assert.equal(r.live().target,1,'one stroke finishes the lump');
}
console.log('PASS dragging clay: the pointer takes hold of it, it follows the thumb, and one stroke shapes it');

// Tapping sits on top of dragging for reach; it must not take the stroke over.
// A real drag has to end at exactly where the thumb left it, with no tap bonus
// added on release, or short strokes would quietly overshoot.
{
  const r=await rig('roof-ramp');
  const live=r.live,axis=r.axis,grip=r.grip();
  r.f.emit('pointerdown',{pointerId:3,...grip});
  r.f.emit('pointermove',{pointerId:3,...grip,[axis]:grip[axis]+30});
  r.step(2);
  const dragged=live().target;assert(dragged>0);
  r.f.emit('pointerup',{pointerId:3,...grip,[axis]:grip[axis]+30});
  assert.equal(live().target,dragged,'a drag ends where the thumb left it, with no tap added');

  // A touch that never travelled is a tap, and that one does press the clay.
  r.f.emit('pointerdown',{pointerId:4,...grip});
  r.f.emit('pointerup',{pointerId:4,...grip});
  assert(live().target>dragged,'a touch that never travelled still presses the clay');
}
console.log('PASS drag and tap stay distinct: a stroke is never nudged on release, a tap still presses');

// Holding E is the keyboard's whole way into the clay, and it went untested
// while the pointer path had this file to itself. The hold has no pointer to
// aim it, so what it must work is whichever station the player is standing at —
// every chapter, at every clay dock in it.
for(const {chapter,dock} of docks){
  const r=await rig(dock,{chapter});
  const id=r.station.id,live=r.live;
  r.f.key('keydown',{code:'KeyE'});
  assert.equal(r.input.shapeHeld,true,`${chapter}/${id}: E takes hold`);
  r.step(30);
  assert(live().target>.1,`${chapter}/${id}: holding E works the clay (got ${live().target.toFixed(2)})`);
  r.f.key('keyup',{code:'KeyE'});
  const stopped=live().target;r.step(30);
  assert.equal(live().target,stopped,`${chapter}/${id}: letting E go stops the clay`);
  // Long enough on the key finishes the piece, the same as one full stroke.
  r.f.key('keydown',{code:'KeyE'});r.step(240);
  assert.equal(live().target,1,`${chapter}/${id}: holding E through finishes it`);
}
console.log('PASS holding E works the station the player is standing at, in every chapter');

// The clay answers one hand exactly as it answers another. A spore's stun used
// to switch the hold and the drag off while leaving the tap working, which is
// indistinguishable from broken clay.
{
  const r=await rig('roof-ramp');
  r.f.key('keydown',{code:'KeyE'});
  // Held across the ticks rather than set once, since the tick that reads it
  // also winds it down.
  for(let i=0;i<8;i++){Object.assign(r.game.player,{stunTime:.36,invuln:9});r.step(1);}
  assert(r.live().target>0,'a stunned player can still knead the clay they are standing at');
  r.f.key('keyup',{code:'KeyE'});
  // And the drag reaches it through a stun too, the same as the tap always did.
  const r2=await rig('roof-ramp'),grip=r2.grip();
  r2.f.emit('pointerdown',{pointerId:21,...grip});
  r2.f.emit('pointermove',{pointerId:21,...grip,[r2.axis]:grip[r2.axis]+90});
  for(let i=0;i<8;i++){Object.assign(r2.game.player,{stunTime:.36,invuln:9});r2.step(1);}
  assert(r2.live().target>.25,'a stunned player can still drag the clay they are standing at');
}
console.log('PASS a stun no longer switches the hold and the drag off behind the tap');

// Capture is an enhancement, not a requirement: a pointer the browser has
// already let go of makes setPointerCapture throw, and that used to abort the
// whole press — no drag, and no tap on release either.
{
  const r=await rig('roof-ramp',{options:{captureThrows:true}}),grip=r.grip();
  r.f.emit('pointerdown',{pointerId:9,...grip});
  assert.equal(r.input.shapeId,r.station.id,'a press still takes the clay when capture is refused');
  r.f.emit('pointermove',{pointerId:9,...grip,[r.axis]:grip[r.axis]+90});
  r.step(2);
  assert(r.live().target>.25,'the stroke still works the clay when capture is refused');
  // And the tap on release, which the throw used to take down with it.
  const r2=await rig('roof-ramp',{options:{captureThrows:true}}),g2=r2.grip();
  r2.f.emit('pointerdown',{pointerId:10,...g2});r2.f.emit('pointerup',{pointerId:10,...g2});
  assert(r2.live().target>0,'a tap still presses the clay when capture is refused');
}
console.log('PASS a refused pointer capture no longer takes the whole press down with it');

// A pointer that never reports going up — a button released outside the window
// does this — used to leave a drag on record that swallowed every later press,
// so the clay went permanently dead to both dragging and tapping.
{
  const r=await rig('roof-ramp'),grip=r.grip(),axis=r.axis;
  r.f.emit('pointerdown',{pointerId:11,...grip});
  r.f.emit('pointermove',{pointerId:11,...grip,[axis]:grip[axis]+40});
  r.step(2);
  // ...and now that pointer simply disappears. A fresh press has to work.
  r.f.emit('pointerdown',{pointerId:12,...grip});
  assert.equal(r.input.shapeId,r.station.id,'a fresh press takes over from a pointer that vanished');
  const before=r.live().target;
  r.f.emit('pointermove',{pointerId:12,...grip,[axis]:grip[axis]+120});
  r.step(2);
  assert(r.live().target>before,'the clay follows the new stroke');
  r.f.emit('pointerup',{pointerId:12,...grip,[axis]:grip[axis]+120});
  assert.equal(r.input.shapeId,null,'and letting go releases it');
}
console.log('PASS a vanished pointer no longer leaves the clay dead to every later press');

// Losing capture mid-stroke is something the browser may do on its own. The
// thumb is still down, so the stroke carries on rather than the clay freezing.
{
  const r=await rig('roof-ramp'),grip=r.grip();
  r.f.emit('pointerdown',{pointerId:13,...grip});
  r.f.emit('lostpointercapture',{pointerId:13,...grip});
  const before=r.live().target;
  r.f.emit('pointermove',{pointerId:13,...grip,[r.axis]:grip[r.axis]+120});
  r.step(2);
  assert(r.live().target>before,'a stroke survives the browser taking capture back');
}
console.log('PASS losing capture mid-stroke no longer freezes the clay under the thumb');

// Going fullscreen fires a resize mid-stride. The keyboard never went
// anywhere, so a key that is still down is still kneading.
{
  const r=await rig('roof-ramp'),controls=r.controls,live=r.live;
  r.f.key('keydown',{code:'KeyE'});r.step(4);
  const before=live().target;assert(before>0);
  // What a resize does to the shared input: the pointer's share of it is let go.
  controls.release();r.input.shapeHeld=false;
  r.step(8);
  assert(live().target>before,'a held E keeps kneading across a resize');
}
console.log('PASS a resize no longer strands a held E');
