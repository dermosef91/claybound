import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {Game,FIXED_DT} from '../dist/simulation.js';
import {prepareMotherPuff,createMotherArenaFloor,createMotherPuff,animateMotherPuff,motherCamera,motherViewHeight} from '../dist/mother-puff.js';
import {MOTHER_PUFF as M,motherIntroTarget,motherCapHeight} from '../dist/mother-puff-rules.js';
import {updateMotherAtmosphere} from '../dist/mother-puff-hud.js';
import {disposeBranch} from '../dist/streaming.js';
import {readGLB} from './load-player.mjs';
import {attachForest} from './load-forest.mjs';
import {attachClay} from './load-clay.mjs';

const w=Object.assign(Object.create(World.prototype),{scene:new THREE.Scene(),levelRoot:new THREE.Group(),mat:{},reducedMotion:false});
for(const name of ['cream','bark','top','terrain','terrain2'])w.mat[name]=new THREE.MeshStandardMaterial();
await attachClay(w);await attachForest(w);
for(const [pose,triangles]of [['idle',10448],['cast',10428],['friendly',18749]]){
 const url=new URL(`../dist/assets/mother-puff-${pose}.glb`,import.meta.url),gltf=await readGLB(url),bytes=await readFile(url),manifest=JSON.parse(await readFile(new URL(`../dist/assets/mother-puff-${pose}.json`,import.meta.url)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.shippedSha256);assert.equal(bytes.length,manifest.shippedBytes);assert(bytes.length<(pose==='friendly'?1300000:1100000));assert.equal(manifest.triangles,triangles);assert(manifest.geometryUnchanged);
 assert.equal(manifest.textures.length,3);assert(manifest.textures.every(size=>Math.max(...size)<=1024),'every pose ships mobile-sized textures');
 prepareMotherPuff(w,pose,gltf);const asset=w.motherAssets[pose];assert(asset.scale>0);assert.equal(gltf.animations.length,0);
 let count=0;asset.scene.traverse(o=>{if(o.isMesh){count+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert(w.assetGeometry.has(o.geometry));assert(w.assetMaterials.has(o.material));}});assert.equal(count,triangles);
}
const game=new Game();game.start(1);w.currentLevel=game.level;const b=game.level.boss;Object.assign(game.player,{x:281.5,y:b.y,groundId:'mother-arena'});
const floor=new THREE.Group();createMotherArenaFloor(w,game.level.platforms.find(p=>p.motherArena),floor);w.platforms=new Map([['mother-arena',{root:floor}]]);
assert.equal(floor.userData.motherCorruption.length,2);assert(floor.userData.motherPorous.every(p=>p.poreCount>0),'ground uses the actual porous ledge geometry');
const v=w.motherView=createMotherPuff(w,b);animateMotherPuff(w,game);assert(v.models.idle.visible&&!v.models.cast.visible);assert.equal(v.pose.rotation.y,-Math.PI/4);assert.equal(v.bodyGrey.value,.38,'undisturbed boss begins slightly afflicted');
v.root.updateMatrixWorld(true);
for(const m of Object.values(v.models)){const box=new THREE.Box3().setFromObject(m,true);assert(Math.abs(box.min.y-b.y)<.001);assert(Math.abs(box.max.y-b.y-6.4)<.001);}
let disposed=0;for(const r of [...w.assetGeometry,...w.assetMaterials])r.addEventListener('dispose',()=>disposed++);
b.state='release';b.stateTime=.25;game.time=2.5;b.lastShotTime=2.31;animateMotherPuff(w,game);assert(!v.models.idle.visible&&v.models.cast.visible);assert.equal(v.pose.rotation.y,-Math.PI/4,'casting keeps the same turn toward the player');assert(!v.root.getObjectByName('Blocking black arch')&&!v.root.getObjectByName('Rigid root curtain'));
assert(v.pose.scale.y<1&&v.pose.scale.x>1&&v.pose.rotation.x>0,'each shot compresses the body and nods forward');
game.pause();const pose=()=>JSON.stringify([v.pose.scale.toArray(),v.pose.rotation.toArray()]);const frozen=pose();game.tick(3);animateMotherPuff(w,game);assert.equal(pose(),frozen);game.time+=.5;animateMotherPuff(w,game);assert.equal(v.pose.scale.y,1);assert.equal(v.pose.rotation.x,0,'the firing pulse settles between shots');
w.reducedMotion=true;b.state='sleeping';animateMotherPuff(w,game);const still=pose();game.time=20;animateMotherPuff(w,game);assert.equal(pose(),still);w.reducedMotion=false;
b.state='recover';b.spores=[{id:12,color:'orange',x:287,y:39,targetX:285.1,targetY:b.y,age:.4,duration:1.85}];animateMotherPuff(w,game);assert.equal(v.effects.size,1);
const air=v.effects.get('air:12');let rings=0;air.marker.traverse(o=>o.geometry?.addEventListener('dispose',()=>rings++));b.spores=[];b.patches=[{id:12,color:'orange',x:285.1,y:b.y,age:1,life:12,bounceAge:10}];animateMotherPuff(w,game);assert.equal(v.effects.size,1);assert(!air.marker.parent&&!air.root.parent);assert.equal(rings,1);
const cap=v.effects.get('ground:12');assert(cap.springPad?.pad.getObjectByName('Forest springPad'),'orange pads reuse the established bounce-pad model');cap.root.updateWorldMatrix(true,true);const padBox=new THREE.Box3().setFromObject(cap.springPad.pad,true);assert(Math.abs(padBox.max.y-(b.y+M.padHeight))<.001,'the asset top matches the bounce collision plane');b.patches=[];animateMotherPuff(w,game);assert.equal(v.effects.size,0);assert(!cap.root.parent);
b.state='defeated';b.stateTime=2;animateMotherPuff(w,game);assert(!v.pose.visible);
disposeBranch(w,v.root);assert.equal(disposed,0,'unloading the clearing retains the supplied models and shared materials');
w.motherView=createMotherPuff(w,b);animateMotherPuff(w,game);assert(!w.motherView.pose.visible,'a rebuilt arena stays hidden after victory');assert.equal(disposed,0);
const {document}=parseHTML(await readFile(new URL('../dist/index.html',import.meta.url),'utf8')),mist=document.getElementById('mother-mist');
assert.equal(document.getElementById('mother-hud'),null,'no boss name, description or health bar');
b.state='recover';b.hits=1;game.player.sporeSlow=1;game.status='playing';updateMotherAtmosphere(game,mist,true);assert(!mist.classList.contains('hidden'));
updateMotherAtmosphere(game,mist,false);assert(mist.classList.contains('hidden'));game.player.sporeSlow=0;updateMotherAtmosphere(game,mist,true);assert(mist.classList.contains('hidden'));
const view=w.motherView;
b.hits=0;b.state='recover';b.healing=0;animateMotherPuff(w,game);assert.equal(view.growth.bands.filter(x=>x.root.visible).length,3);
view.root.updateMatrixWorld(true);const swollen=new THREE.Box3().setFromObject(view.growth.bands[0].root,true);assert(swollen.max.y>b.y+6.4&&swollen.max.y<b.y+7.6,'separate plugs sit close to the original cap');assert(view.growth.bands.every(x=>!x.sack),'no balloon-shaped cap is added');assert(view.environment.corruption.filter(p=>p.side==='right').every(p=>p.amount===1));assert(view.environment.corruption.some(p=>p.side==='left'&&p.amount>.6));assert(view.environment.corruption.some(p=>p.side==='left'&&p.amount<.2));assert(view.environment.porous.every(p=>p.poreCount>0));
const baseColor=w.motherAssets.idle.scene.children[0]?.material?.color?.getHex();
b.hits=1;animateMotherPuff(w,game);assert.equal(view.growth.bands.filter(x=>x.root.visible).length,2);assert.equal(view.bodyGrey.value,.25);
b.hits=2;animateMotherPuff(w,game);assert.equal(view.growth.bands.filter(x=>x.root.visible).length,1);assert.equal(view.bodyGrey.value,.12);
b.hits=3;b.state='veil';b.stateTime=1.4;animateMotherPuff(w,game);assert.equal(view.growth.bands.filter(x=>x.root.visible).length,0);assert.equal(view.pose.scale.y,1);assert(view.pose.visible&&!view.healed.visible);assert.equal(view.clouds.material.opacity,1);assert(view.environment.porous.every(p=>!p.root.visible));assert(floor.userData.motherPorous.every(p=>!p.root.visible),'all porous bricks disappear on the final landing');
b.state='transform';b.stateTime=.5;animateMotherPuff(w,game);assert(!view.pose.visible&&view.healed.visible);assert.equal(view.clouds.material.opacity,1,'models exchange only under an opaque veil');assert.equal(view.healed.scale.y,1);
b.state='reveal-form';b.stateTime=2.6;animateMotherPuff(w,game);assert(!view.pose.visible&&view.healed.visible);assert.equal(view.clouds.material.opacity,0);view.healed.updateWorldMatrix(true,true);const healedBox=new THREE.Box3().setFromObject(view.healed,true);assert(Math.abs(healedBox.min.y-b.y)<.001&&Math.abs(healedBox.max.y-b.y-M.friendlyHeight)<.001,'friendly model is fully formed on the ground');assert(M.friendlyHeight>=M.height*.9,'healed form remains large relative to the original body');assert.equal(view.healed.rotation.y,-Math.PI/4);
assert(!view.root.getObjectByName('Blocking black arch')&&!view.root.getObjectByName('Rigid root curtain'),'arches are absent throughout the encounter');
b.state='bloom';b.stateTime=2;b.healing=.6;animateMotherPuff(w,game);assert(!view.pose.visible&&!view.healed.visible);assert(!view.environment.flowers,'victory adds no new plants');assert(view.environment.winds.every(v=>v.spore&&v.root.visible&&v.bits.length===24&&v.clouds.length===9),'healing reuses established spore winds');assert(view.environment.corruption.filter(p=>p.amount).every(p=>p.uniform.value<p.amount));
b.state='defeated';b.healing=1;b.stateTime=3;animateMotherPuff(w,game);assert(!view.friendly.root.visible);assert(view.environment.winds.every(v=>!v.root.visible));assert(floor.userData.motherCorruption.every(p=>p.uniform.value<.1),'ground recovers its color');assert(view.environment.porous.every(p=>!p.root.visible)&&floor.userData.motherPorous.every(p=>!p.root.visible),'porous bricks stay absent after victory');
assert.equal(w.motherAssets.idle.scene.children[0]?.material?.color?.getHex(),baseColor,'original asset material stays unchanged');
let afflicted;view.models.idle.traverse(o=>{if(o.isMesh)afflicted=o.material;});
const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};afflicted.onBeforeCompile(shader);
assert(shader.fragmentShader.includes('motherGrey'));assert(shader.fragmentShader.includes('claySurface'));assert(shader.uniforms.motherCorruption===view.bodyGrey,'corruption preserves the clay shading and uses view-owned state');
assert.equal(motherCamera(b,{...game.player,x:b.x+1},30,18,true),null,'victory releases the camera before the right exit');
b.state='reveal';b.hits=0;b.stateTime=0;
assert.equal(motherViewHeight(b,1280,720,true,14),14,'entrance begins with the normal camera scale');
b.stateTime=M.reveal/2;assert.equal(motherViewHeight(b,1280,720,true,14),16.4,'camera opens gradually throughout the walk');
b.stateTime=M.reveal;
const introHeight=motherViewHeight(b,390,844,false),introWidth=introHeight*390/844,intro=motherCamera(b,{x:motherIntroTarget(b),y:b.y},introWidth,introHeight,false);
assert(intro.x-introWidth/2<motherIntroTarget(b)-.32&&intro.x+introWidth/2>b.x+3.5,'portrait reveal contains the entrance destination and the full cap');
for(const state of ['reveal','inhale','release','recover','hurt']){b.state=state;b.hits=0;animateMotherPuff(w,game);assert(view.pose.visible,'the battle body stays on screen');assert.equal(view.pose.rotation.y,-Math.PI/4);assert(view.environment.porous.every(p=>p.root.visible)&&floor.userData.motherPorous.every(p=>p.root.visible),'retry restores the corrupted brick scenery');}
b.hits=3;b.state='farewell';b.stateTime=.8;animateMotherPuff(w,game);assert.equal(view.clouds.material.opacity,1);const envelope=view.clouds.parts.map(p=>p.m.position.y+p.m.scale.y);assert(Math.max(...envelope)>M.friendlyHeight,'farewell veil expands to cover the larger healed form');
{
 // The two battle sculptures stand in for animation frames, so drive a real
 // volley and confirm hard cuts: alert only around each cast, resting between.
 const g=new Game();g.start(1);const boss=g.level.boss,frames=w.motherView=createMotherPuff(w,boss);
 g.tick(FIXED_DT);animateMotherPuff(w,g);
 assert.equal(boss.state,'sleeping');assert(frames.models.idle.visible&&!frames.models.cast.visible,'the undisturbed clearing rests on the idle sculpture');
 Object.assign(g.player,{x:boss.triggerX,y:boss.y,groundId:'mother-arena'});g.tick(FIXED_DT);assert.equal(boss.state,'reveal');
 for(let i=0;i<Math.round(M.reveal*.6/FIXED_DT);i++)g.tick(FIXED_DT);
 animateMotherPuff(w,g);assert(frames.models.idle.visible,'the walk-in holds the idle sculpture until the first wind-up');
 const seen=new Set(),held=[];let casts=0,total=0,alert=0,run=0;
 while(casts<10&&total<Math.round(20/FIXED_DT)){
  // Park above the combat plane: this measures pose timing, not survival.
  Object.assign(g.player,{x:boss.left+2,y:boss.y+12,vy:0,groundId:null});
  g.tick(FIXED_DT);animateMotherPuff(w,g);total++;
  const casting=frames.models.cast.visible;
  assert.equal(frames.models.idle.visible,!casting,'exactly one battle sculpture is on screen');
  for(const s of boss.spores)if(!seen.has(s.id)){seen.add(s.id);casts++;assert(casting,'the alert sculpture is on screen as each spore leaves the crown');}
  if(casting){alert++;run++;}else if(run){held.push(run*FIXED_DT);run=0;}
 }
 assert.equal(casts,10,'the loop covers a full ten-cast volley');
 assert.equal(held.length,9,'each cast holds its own alert frame, then cuts back to rest');
 assert(held.slice(1).every(seconds=>seconds>.5&&seconds<.7),'an alert frame lasts the wind-up plus the throw, well inside the 1.4s gap');
 assert(alert<total*.55,'the idle sculpture holds the majority of the volley');
 Object.assign(boss,{state:'recover',stateTime:0,spores:[],patches:[],queue:[]});
 Object.assign(g.player,{x:boss.x-1,y:boss.y+motherCapHeight(boss)+.05,vx:0,vy:-15,groundId:null,motherBounce:false,stomping:false,motherPush:0});
 g.tick(FIXED_DT);assert.equal(boss.state,'hurt');animateMotherPuff(w,g);
 assert(frames.models.idle.visible,'a struck boss drops out of the casting pose');
 w.reducedMotion=true;animateMotherPuff(w,g);assert(frames.models.cast.visible,'reduced motion holds the alert pose rather than cutting between frames');w.reducedMotion=false;
}
console.log('PASS Mother Puff assets: supplied GLBs, grounding, stop-motion cast/idle frames, pause, effects cleanup, porous corruption, absent arches, opaque transformation, healing winds and gradual/released camera');
