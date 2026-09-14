import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT} from '../dist/simulation.js';

// Dragging is the primary way to work clay: you push or pull it and watch it
// follow your thumb. Tapping and stomping are the accessible extras. This runs
// the real pointer handlers against the real orthographic camera, at the clay's
// true screen position, so a regression in the drag path fails here and not in
// someone's hands.
function fixture({width=1080,height=2160,viewH=8.7}={}){
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
  return {canvas,camera,emit,key,captured,viewW,viewH,width,height,
    // Aim the camera the way the world does, then project a world point onto
    // the screen, so pointer coordinates are the ones a player would produce.
    look(x,y){camera.position.set(x,y,26);camera.lookAt(x,y,0);camera.updateMatrixWorld();},
    screen(x,y){
      const v=new THREE.Vector3(x,y,1.4).project(camera);
      return {clientX:(v.x+1)/2*width,clientY:(1-v.y)/2*height};
    }};
}

// A rig around one station: the player stands at its spawn, the camera looks at
// the clay, and the app's own frame order (controls.update, then ticks) runs.
function rig(stationId){
  const f=fixture();
  const game=new Game();game.start(3);
  const input={moveAxis:0,jumpHeld:false,jumpPressed:false,stompPressed:false};
  const station=game.level.shaping.find(s=>s.id===stationId);
  const part=game.level.platforms.find(p=>station.parts.includes(p.id));
  Object.assign(game.player,station.spawn,{vx:0,vy:0});
  f.look(part.x+part.w/2,part.y);
  return {f,game,input,station,part};
}
async function controlsFor(r){
  const {ShapingControls}=await import('../dist/shaping-controls.js');
  const controls=new ShapingControls({game:r.game,world:()=>({camera:r.f.camera}),input:r.input,picker:{}});
  r.step=(frames=1)=>{for(let i=0;i<frames;i++){controls.update();r.game.tick(FIXED_DT,r.input);r.input.jumpPressed=false;r.input.stompPressed=false;}};
  return controls;
}

const game0=new Game();game0.start(3);
for(const station of game0.level.shaping){
  const r=rig(station.id);await controlsFor(r);
  const live=()=>r.game.level.shaping.find(s=>s.id===station.id);
  // Grab the clay where it is, then drag it the way its gesture asks for.
  const grip=r.f.screen(r.part.x+r.part.w/2,r.part.y-Math.min(.4,r.part.h/2));
  r.f.emit('pointerdown',{pointerId:1,...grip});
  assert.equal(r.input.shapeId,station.id,`${station.id}: pressing the clay takes hold of it`);
  // A press-down station is dragged down the screen; the others are dragged right.
  const axis=station.gesture==='down'?'clientY':'clientX';
  let moved=0;
  for(const px of [20,40,60,80,100,150]){
    r.f.emit('pointermove',{pointerId:1,...grip,[axis]:grip[axis]+px});
    r.step(2);
    assert(live().target>moved,`${station.id}: the clay follows the drag at ${px}px`);
    moved=live().target;
    // A short push has to show itself straight away, or the stroke reads as
    // dead and the player goes looking for another way in.
    if(px===40)assert(moved>.25,`${station.id}: a 40px push already moves it (got ${moved.toFixed(2)})`);
  }
  // And a stroke a thumb can make in one go has to finish the piece, or
  // dragging is not really the primary verb — it is a chore next to tapping.
  assert.equal(moved,1,`${station.id}: one 150px stroke finishes the clay`);
  r.f.emit('pointerup',{pointerId:1,...grip,[axis]:grip[axis]+150});
  assert.equal(r.input.shapeId,null,`${station.id}: letting go releases the clay`);
  r.step(240);
  assert.equal(live().amount,1,`${station.id}: a drag alone shapes it end to end`);
  // Nothing about the drag depends on the tap path: it moved the clay long
  // before the pointer came up, which is what "primary" has to mean.
  assert(live().announced,`${station.id}: the station reports itself shaped`);
}
console.log('PASS dragging clay: the pointer takes hold of it, it follows the thumb, and one stroke shapes it');

// Tapping sits on top of dragging for reach; it must not take the stroke over.
// A real drag has to end at exactly where the thumb left it, with no tap bonus
// added on release, or short strokes would quietly overshoot.
{
  const station=game0.level.shaping[0];
  const r=rig(station.id);await controlsFor(r);
  const live=()=>r.game.level.shaping.find(s=>s.id===station.id);
  const part=r.part,grip=r.f.screen(part.x+part.w/2,part.y-Math.min(.4,part.h/2));
  const axis=station.gesture==='down'?'clientY':'clientX';
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
