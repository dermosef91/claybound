import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {attachSpitter} from './load-spitter.mjs';
import {createSpitterView,animateSpitter,syncShots} from '../dist/spitter.js';
import {releaseEnemyView} from '../dist/enemies.js';
import {SPITTER,spitterMuzzle} from '../dist/spitter-rules.js';
import {disposeBranch} from '../dist/streaming.js';
const w={mat:{},levelRoot:new THREE.Group(),fxRoot:new THREE.Group()};await attachSpitter(w);
let disposed=0;for(const r of [...w.assetGeometry,...w.assetMaterials])r.addEventListener('dispose',()=>disposed++);
const e={id:1,x:2,y:3,dir:-1,alive:true,aiState:'watch',stateTime:0};
const a=createSpitterView(w,e),b=createSpitterView(w,{...e,id:2});
const skin=root=>{let mesh;root.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});return mesh;};
assert.notEqual(skin(a.model).skeleton,skin(b.model).skeleton,'enemies own independent skeletons');
assert.equal(skin(a.model).geometry,skin(b.model).geometry,'geometry is shared');
assert(a.head&&a.tail);assert.equal(a.body.children.length,1,'one continuous character mesh for every state');
a.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(a.root,true);assert(Math.abs(box.min.y-e.y)<.003);assert(Math.abs(box.max.y-box.min.y-1.35)<.01);
const rest=a.head.quaternion.clone();e.aiState='charge';e.stateTime=.6;animateSpitter(a,e,1/60,'playing');assert(a.head.quaternion.angleTo(rest)>.01);
const pose=()=>a.bones.map(r=>[...r.bone.position.toArray(),...r.bone.quaternion.toArray(),...r.bone.scale.toArray()]);
const before=pose();animateSpitter(a,e,.5,'paused');assert.deepEqual(pose(),before,'paused skeletal pose stays exact');
e.aiState='recover';e.stateTime=.1;animateSpitter(a,e,.016,'playing');assert(pose().flat().every(Number.isFinite));
e.aiState='watch';for(let i=0;i<60;i++){e.x+=.7/60;animateSpitter(a,e,1/60,'playing');}
const walkingPose=pose();animateSpitter(a,e,.5,'paused');assert.deepEqual(pose(),walkingPose,'pause preserves a moving skeletal pose too');
assert(a.walkWeight>.95);assert(a.walkPhase>0);assert.equal(a.model.getObjectByName('Hips').scale.x,1,'walk does not shrink the character');
for(let i=0;i<90;i++)animateSpitter(a,e,1/60,'playing');assert(a.walkWeight<.001,'stationary enemy settles rather than walking in place');
const clip=a.clip;for(const track of clip.tracks){const n=track.getValueSize();assert.deepEqual(Array.from(track.values.slice(0,n)),Array.from(track.values.slice(-n)),'walk endpoints are seamless');}
a.reducedMotion=true;animateSpitter(a,e,.016,'playing');const quiet=pose();animateSpitter(a,e,.3,'playing');assert.deepEqual(pose(),quiet,'reduced motion removes ambient movement');
syncShots(w,{shots:[{id:1,x:4,y:5,vx:-6.5,vy:1,age:.1}]});assert.equal(w.shotViews.size,1);
let triangles=0;w.spitterAssets.crystal.scene.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});assert.equal(triangles,3045);
syncShots(w,{shots:[]});assert.equal(w.shotViews.size,0);
// Measure the mouth on the actual head rig, then check both firing directions.
for(const dir of [-1,1]){
 const actor={id:0,x:0,y:0,dir:0,alive:true,aiState:'watch',stateTime:0};
 const v=createSpitterView(w,actor);v.root.updateMatrixWorld(true);
 const anchor=new THREE.Object3D();anchor.position.copy(v.head.worldToLocal(new THREE.Vector3(0,.40,.92)));v.head.add(anchor);
 Object.assign(actor,{dir,aiState:'charge',stateTime:SPITTER.charge});animateSpitter(v,actor,0,'playing');v.root.updateMatrixWorld(true);
 const mouth=anchor.getWorldPosition(new THREE.Vector3()),spawn=spitterMuzzle(actor);
 assert(mouth.distanceTo(new THREE.Vector3(spawn.x,spawn.y,spawn.z))<.001,'physics muzzle matches animated head');
 releaseEnemyView(v);disposeBranch(w,v.root);
}
syncShots(w,{shots:[{id:2,x:0,y:1,z:.62,vx:6.5,vy:0,age:0}]});w.fxRoot.updateMatrixWorld(true);
const shotView=w.shotViews.get(2),shotBox=new THREE.Box3().setFromObject(shotView.root,true),size=shotBox.getSize(new THREE.Vector3());
assert(Math.abs(Math.max(size.x,size.y,size.z)-SPITTER.shotRadius*2)<1e-5);assert.equal(shotView.root.position.z,.62);
syncShots(w,{shots:[]});
e.alive=false;animateSpitter(a,e,.05,'playing');const death=a.deathTime;animateSpitter(a,e,.5,'paused');assert.equal(a.deathTime,death);
releaseEnemyView(a);disposeBranch(w,a.root);assert.equal(disposed,0,'streaming never disposes retained model resources');
console.log('PASS Gloobasnout rig, grounded normalization, seamless walking, stationary idle, charge/recoil, pause/reduced motion, independent skeletons, cleanup and unchanged crystal');
