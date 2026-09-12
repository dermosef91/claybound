import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {TitleScene} from '../dist/title-scene.js';
import {loadTitleWorld} from './load-title.mjs';
import {Game} from '../dist/simulation.js';
import {checkpointFlag,raiseCheckpoint,animateCheckpoints} from '../dist/checkpoints.js';
const {world:w}=await loadTitleWorld(),title=new TitleScene(w);
title.show();assert.equal(w.character.root.parent,title.foreground);
assert.equal(title.mesa.name,'Supplied clay cactus mesa');
assert.equal(title.foreground.children.filter(o=>o.isGroup&&o.name==='Supplied clay cactus mesa').length,1);
title.mesa.traverse(o=>{if(o.isMesh){
  assert(o.material.map&&o.material.normalMap,'the supplied texture maps are retained');
  for(const name of ['position','normal'])assert(o.geometry.attributes[name].array.every(Number.isFinite));
}});
const bodyMat=title.view.mat.orange,sharedGeo=new Set(w.assetGeometry);
assert.notEqual(bodyMat,w.mat.orange);const color=bodyMat.color.getHex();w.mat.orange.color.set('#ffffff');assert.equal(bodyMat.color.getHex(),color);
assert.notEqual(title.view.clay.boxes,w.clay.boxes,'chapter eviction cannot dispose title geometry');
for(const [width,height]of [[390,844],[768,1024],[1280,720],[1536,691]]){
  title.resize(width,height);title.update(1/60);title.view.scene.updateMatrixWorld(true);title.camera.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(w.character.root,true),feet=w.character.root.getWorldPosition(new THREE.Vector3()).project(title.camera);
  assert(feet.x>0&&feet.x<.75,'hero stays beside the menu in both orientations');assert(feet.y<-.45&&feet.y>-.76,'hero remains above the footer');
  assert(box.max.y-box.min.y>2,'custom rig is large enough to read');
  let textured=0;title.view.scene.traverse(o=>{if(o.isMesh&&o.material.map)textured++;});assert(textured>=10,'scene uses source models and their textures');
}
const pose=w.character.model.getObjectByName('Hips').quaternion.toArray();for(let i=0;i<30;i++)title.update(1/60);
assert.notDeepEqual(w.character.model.getObjectByName('Hips').quaternion.toArray(),pose,'title uses the supplied skeletal idle');
w.reducedMotion=true;const t=title.time;title.update(.5);assert.equal(title.time,t);w.reducedMotion=false;
for(let i=0;i<6;i++){title.hide();assert.equal(w.character.root.parent,w.scene);assert.deepEqual(w.character.root.scale.toArray(),[1,1,1]);assert.equal(w.character.root.rotation.y,0);title.show();assert.equal(w.character.root.parent,title.foreground);}
assert([...sharedGeo].every(g=>w.assetGeometry.has(g)));title.hide();
console.log('PASS live title: responsive hero composition, source textures, skeletal idle, reduced motion, single hero ownership and independent scene caches');

// Exercise real saved-checkpoint events and the real hoist, including a pause
// halfway through, a streamed replacement, an old save, and a fresh restart.
for(let index=0;index<4;index++){
  const g=new Game(),events=[];g.start(index);
  const cp=g.level.platforms.find(s=>s.checkpoint);
  w.flags=[];w.biome='desert';w.mat.bark=title.view.mat.bark;w.mat.dust=title.view.mat.dust;w.particles=[];
  const group=w.flag(0,0,w.scene,1,cp.id),flag=w.flags[0];
  animateCheckpoints(w,g,0);const low=flag.position.y;
  g.onEvent=e=>{events.push(e);if(e.type==='checkpoint')raiseCheckpoint(w,e);};
  Object.assign(g.player,{x:cp.checkpoint,y:cp.y,groundId:cp.id});g.tick(1/120,{});
  assert(events.some(e=>e.type==='checkpoint'&&e.platformId===cp.id));assert(g.activatedCheckpoints.has(cp.id));
  for(let i=0;i<24;i++)animateCheckpoints(w,g,1/60);
  assert(flag.position.y>low+.9);const halfway=flag.position.y;g.pause();animateCheckpoints(w,g,1);assert.equal(flag.position.y,halfway);
  g.resume();for(let i=0;i<85;i++)animateCheckpoints(w,g,1/60);
  assert(Math.abs(flag.position.y-2.52)<.001);assert.equal(w.particles.length,18,'one bounded celebration burst');
  raiseCheckpoint(w,{platformId:cp.id});animateCheckpoints(w,g,1);assert.equal(w.particles.length,18,'standing at/revisiting a raised flag does not repeat the burst');
  const save=JSON.parse(JSON.stringify(g.snapshot())),restored=new Game();restored.start(index);assert(restored.restore(save));assert(restored.activatedCheckpoints.has(cp.id));
  checkpointFlag(w,flag,group,cp.id);animateCheckpoints(w,restored,0);assert.equal(flag.position.y,2.52,'streamed/restored flags are already raised');
  delete save.activatedCheckpoints;restored.start(index);assert(restored.restore(save));assert(restored.activatedCheckpoints.has(cp.id),'existing saves stay compatible');
  restored.start(index);checkpointFlag(w,flag,group,cp.id);animateCheckpoints(w,restored,0);assert.equal(flag.position.y,low);
  group.removeFromParent();
}
console.log('PASS checkpoint hoist: four chapters, pause/resume, single burst, streaming state, old/new saves and restart');
