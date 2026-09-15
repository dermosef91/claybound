import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/world.js';
import {Game} from '../dist/simulation.js';
import {prepareMotherPuff,createMotherPuff,animateMotherPuff,motherCamera} from '../dist/mother-puff.js';
import {updateMotherHUD} from '../dist/mother-puff-hud.js';
import {disposeBranch} from '../dist/streaming.js';
import {readGLB} from './load-player.mjs';
import {attachClay} from './load-clay.mjs';

const w=Object.assign(Object.create(World.prototype),{scene:new THREE.Scene(),levelRoot:new THREE.Group(),mat:{},reducedMotion:false});
for(const name of ['cream','bark','top'])w.mat[name]=new THREE.MeshStandardMaterial();
await attachClay(w);
for(const [pose,triangles]of [['idle',10448],['cast',10428]]){
 const url=new URL(`../dist/assets/mother-puff-${pose}.glb`,import.meta.url),gltf=await readGLB(url),bytes=await readFile(url),manifest=JSON.parse(await readFile(new URL(`../dist/assets/mother-puff-${pose}.json`,import.meta.url)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.shippedSha256);assert.equal(bytes.length,manifest.shippedBytes);assert(bytes.length<1100000);assert.equal(manifest.triangles,triangles);assert(manifest.geometryUnchanged);
 prepareMotherPuff(w,pose,gltf);const asset=w.motherAssets[pose];assert(asset.scale>4);assert.equal(gltf.animations.length,0);
 let count=0;asset.scene.traverse(o=>{if(o.isMesh){count+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert(w.assetGeometry.has(o.geometry));assert(w.assetMaterials.has(o.material));}});assert.equal(count,triangles);
}
const game=new Game();game.start(1);const b=game.level.boss;Object.assign(game.player,{x:281.5,y:b.y,groundId:'mother-arena'});
const v=w.motherView=createMotherPuff(w,b);animateMotherPuff(w,game);assert(v.models.idle.visible&&!v.models.cast.visible);
v.root.updateMatrixWorld(true);
for(const m of Object.values(v.models)){const box=new THREE.Box3().setFromObject(m,true);assert(Math.abs(box.min.y-b.y)<.001);assert(Math.abs(box.max.y-b.y-6.4)<.001);}
let disposed=0;for(const r of [...w.assetGeometry,...w.assetMaterials])r.addEventListener('dispose',()=>disposed++);
b.state='release';b.stateTime=.25;game.time=2.5;animateMotherPuff(w,game);assert(!v.models.idle.visible&&v.models.cast.visible);assert(v.gates.every(g=>g.visible));
game.pause();const pose=()=>JSON.stringify([v.pose.scale.toArray(),v.pose.rotation.toArray()]);const frozen=pose();game.tick(3);animateMotherPuff(w,game);assert.equal(pose(),frozen);
w.reducedMotion=true;b.state='sleeping';animateMotherPuff(w,game);const still=pose();game.time=20;animateMotherPuff(w,game);assert.equal(pose(),still);w.reducedMotion=false;
b.state='recover';b.spores=[{id:12,color:'orange',x:287,y:39,targetX:285.1,targetY:b.y,age:.4,duration:1.85}];animateMotherPuff(w,game);assert.equal(v.effects.size,1);
const air=v.effects.get('air:12');let rings=0;air.marker.traverse(o=>o.geometry?.addEventListener('dispose',()=>rings++));b.spores=[];b.patches=[{id:12,color:'orange',x:285.1,y:b.y,age:1,life:12,bounceAge:10}];animateMotherPuff(w,game);assert.equal(v.effects.size,1);assert(!air.marker.parent&&!air.root.parent);assert.equal(rings,1);
const cap=v.effects.get('ground:12');b.patches=[];animateMotherPuff(w,game);assert.equal(v.effects.size,0);assert(!cap.root.parent);
b.state='defeated';b.stateTime=2;animateMotherPuff(w,game);assert(!v.gates.some(g=>g.visible));assert(!v.crown.visible);assert(v.pose.scale.y<1);
disposeBranch(w,v.root);assert.equal(disposed,0,'unloading the clearing retains the supplied models and shared materials');
w.motherView=createMotherPuff(w,b);animateMotherPuff(w,game);assert(w.motherView.models.idle.visible);assert.equal(disposed,0);
const {document}=parseHTML(await readFile(new URL('../dist/index.html',import.meta.url),'utf8')),hud=document.getElementById('mother-hud'),mist=document.getElementById('mother-mist');
b.state='recover';b.hits=1;game.player.sporeSlow=1;game.status='playing';updateMotherHUD(game,hud,mist,true);assert(!hud.classList.contains('hidden'));assert(!mist.classList.contains('hidden'));assert.equal(hud.querySelectorAll('.spent').length,1);
updateMotherHUD(game,hud,mist,false);assert(hud.classList.contains('hidden')&&mist.classList.contains('hidden'));b.state='defeated';b.hits=3;game.player.sporeSlow=0;updateMotherHUD(game,hud,mist,true);assert.equal(hud.querySelector('[data-boss-hits]').textContent,'Resting');
const portrait=motherCamera(b,{...game.player,x:285.1},18.2,39.4,false);assert(Math.abs(portrait.x-b.x)<3);assert.equal(motherCamera(b,{x:1},30,18,true),null);
console.log('PASS Mother Puff assets: both supplied GLBs/maps/fingerprints, grounding, pose switch, pause/reduced motion, bounded effects, shared-resource cleanup, HUD and portrait crown framing');
