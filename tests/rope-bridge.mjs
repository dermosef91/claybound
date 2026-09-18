import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {Game,FIXED_DT as dt,surfaceAt} from '../dist/simulation.js';
import {LEVELS} from '../dist/levels.js';
import {World} from '../dist/world.js';
import {DraftLibrary,DraftSession,selectedObject} from '../dist/editor-model.js';
import {attachClay} from './load-clay.mjs';
import {LevelEditor,jumpGuide} from '../dist/editor.js';

// Walk onto the span from the bank on its left, without a jump.
const game=new Game();game.start(0);
const s=game.level.platforms.find(p=>p.id==='arch-drop');
const bank=game.level.platforms
  .filter(p=>p.kind!=='wall'&&p.x+p.w<=s.x+.05)
  .reduce((best,p)=>p.x+p.w>best.x+best.w?p:best);
Object.assign(game.player,{x:bank.x+bank.w-.6,y:bank.y,vx:0,vy:0,groundId:bank.id});
let bridgeFrames=0,lowest=Infinity;
for(let i=0;i<280;i++){
  game.tick(dt,{right:true});
  if(game.player.groundId==='arch-drop'){
    bridgeFrames++;lowest=Math.min(lowest,game.player.y);
    assert.equal(game.player.vy,0,'the player stays grounded along the curve');
  }
  // What is under test is the span; the ground past its far bank is the
  // chapter's business and need not be continuous.
  if(game.player.x>s.x+s.w+.4)break;
}
assert(bridgeFrames>30&&Math.abs(lowest-surfaceAt(s,s.x+s.w/2))<.03,'the landing continues through the lowest part of the sag');
assert.equal(game.deaths,0);assert.equal(game.player.health,3);
assert(game.player.x>s.x+s.w,'one walk carries all the way over the span');

// Reverse across the curve, then jump from its middle without being snapped
// back onto it. Also land from above onto both slopes and the central plank.
const rightBank=game.level.platforms
  .filter(p=>p.kind!=='wall'&&p.x>=s.x+s.w-.05)
  .reduce((best,p)=>p.x<best.x?p:best);
Object.assign(game.player,{x:rightBank.x+rightBank.w*.5,y:rightBank.y,vx:0,vy:0,groundId:rightBank.id});
for(let i=0;i<260&&game.player.groundId!==bank.id;i++)game.tick(dt,{left:true});
assert.equal(game.player.groundId,bank.id,'and back again, off the far bank onto the near one');
for(const u of [.15,.5,.85]){
  const x=s.x+s.w*u;
  Object.assign(game.player,{x,y:surfaceAt(s,x)+1.8,vx:0,vy:-2,groundId:null});
  for(let i=0;i<90&&!game.player.groundId;i++)game.tick(dt,{});
  assert.equal(game.player.groundId,s.id);assert.equal(game.player.y,surfaceAt(s,x));
  game.tick(dt,{jumpPressed:true,jumpHeld:true});
  for(let i=0;i<18;i++)game.tick(dt,{jumpHeld:true});
  assert(game.player.y>surfaceAt(s,x)+1&&game.player.vy>0&&!game.player.groundId);
}
// One-way deck: an upward jump from below passes through and lands on top.
const center=s.x+s.w/2;
Object.assign(game.player,{x:center,y:surfaceAt(s,center)-1,vx:0,vy:11.8,groundId:null,coyote:0});
let roseThrough=false;
for(let i=0;i<160;i++){
  game.tick(dt,{jumpHeld:true});
  if(game.player.y>surfaceAt(s,center)+.8)roseThrough=true;
  if(roseThrough&&game.player.groundId===s.id)break;
}
assert(roseThrough&&game.player.groundId===s.id);
console.log('PASS bridge: both walking directions, slopes and centre landings, jumping, one-way passage, checkpoint and hazards');

const library=new DraftLibrary(LEVELS,{getItem:()=>null,setItem(){}}),session=new DraftSession(library,0);
session.selection={list:'platforms',index:session.level.platforms.findIndex(p=>p.id===s.id)};
session.set('w',9);session.set('x',177);session.undo();session.redo();
const edited=selectedObject(session.level,session.selection);
const roundtrip=library.read(library.export(0,session.level),0).platforms.find(p=>p.id===s.id);
assert.equal(roundtrip.kind,'bridge');assert.equal(roundtrip.w,9);assert.equal(roundtrip.x,177);
assert.deepEqual(roundtrip,edited);
const guide=jumpGuide(LEVELS[0],0,s,1);assert.equal(guide[0].y,surfaceAt(s,center));
const editor=Object.create(LevelEditor.prototype);editor.session=session;editor.camera={x:180,y:13.8,viewH:8};editor.dimensions=()=>({w:1200,h:800});
const plankPoint=editor.toScreen(edited.x+edited.w/2,edited.y-.7);
assert.deepEqual(editor.hit(plankPoint),session.selection,'clicking the lower curved plank selects the bridge');

// Raycast the actual sculpted planks against the gameplay surface, including
// a resized editor copy. This catches floating feet and an invisible flat deck.
const w=Object.create(World.prototype);w.levelRoot=new THREE.Group();w.mat={};
for(const key of ['bark','barkLight','rope','cream'])w.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff});
await attachClay(w);
for(const data of [s,{...s,...roundtrip}]){
  const view=w.makePlatform(data);view.root.updateMatrixWorld(true);
  const planks=view.root.children.filter(o=>o.name==='Bridge plank').map(o=>o.children[0]);
  for(let i=0;i<29;i++){
    const x=data.x+data.w*(i+.5)/29;
    const hit=new THREE.Raycaster(new THREE.Vector3(x,data.y+2,0),new THREE.Vector3(0,-1,0)).intersectObjects(planks)[0];
    assert(hit,'the plank deck has no hole at the walking plane');
    assert(Math.abs(hit.point.y-surfaceAt(data,x))<.09,'visible wood follows collision within clay surface relief');
  }
}
console.log('PASS bridge editor resize, move, undo/redo, export/import and rendered plank/collision agreement');
