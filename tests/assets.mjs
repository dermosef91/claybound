import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {readGLB} from './load-player.mjs';
import {prepareEnemyAsset,createEnemyView,animateEnemy} from '../dist/enemies.js';
import {prepareCastleAsset,castle} from '../dist/castle.js';
import {prepareCottageAsset,cottageModel} from '../dist/cottage.js';
import {prepareDreamAsset,dreamFlower} from '../dist/dream-assets.js';
import {World} from '../dist/world.js';
const url=name=>new URL('../dist/assets/'+name,import.meta.url),w={levelRoot:new THREE.Group()};
const gltf=await readGLB(url('enemy.glb')),motion=JSON.parse(await readFile(url('enemy-motion.json')));
assert.equal(createHash('sha256').update(await readFile(url('enemy.glb'))).digest('hex'),motion.shippedSha256);
prepareEnemyAsset(w,gltf,motion);
const e={id:0,x:12,y:3.9,dir:1,speed:1.8,alive:true},a=createEnemyView(w,e),b=createEnemyView(w,{...e,id:1,x:15});
const ma=a.model.getObjectByName('char1'),mb=b.model.getObjectByName('char1');
assert.equal(ma.skeleton.bones.length,27);assert.notEqual(ma.skeleton.bones[0],mb.skeleton.bones[0]);assert.equal(ma.geometry,mb.geometry);assert.equal(ma.material.map,mb.material.map);
const before=b.mixer.time;animateEnemy(a,e,.03,'playing');assert.equal(b.mixer.time,before);
for(let i=0;i<61;i++){
  a.action.time=i/60;a.mixer.update(0);a.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(a.root,true);
  assert(Math.abs(bounds.min.y-e.y-.065)<.025,`walking foot contact: ${bounds.min.y}`);
  assert(bounds.max.y-e.y<1.05&&bounds.max.y-e.y>.65);assert(Math.abs(bounds.getCenter(new THREE.Vector3()).x-e.x)<.15);
}
const clock=a.mixer.time,pose=ma.skeleton.bones[0].quaternion.toArray();animateEnemy(a,e,.5,'paused');
assert.equal(a.mixer.time,clock);assert.deepEqual(ma.skeleton.bones[0].quaternion.toArray(),pose);
e.dir=-1;for(let i=0;i<100;i++)animateEnemy(a,e,1/120,'playing');a.root.updateMatrixWorld(true);
assert(new THREE.Vector3(0,0,1).applyQuaternion(a.orientation.getWorldQuaternion(new THREE.Quaternion())).x<-.99);
// Stomped, it is pressed flat and left lying there to be seen, rather than
// deleted on contact; only then does it peel away.
e.alive=false;for(let i=0;i<30;i++)animateEnemy(a,e,1/120,'playing');
assert(a.root.visible&&a.root.scale.y<.2&&a.root.scale.x>1.3,'a quarter second after the stomp it is a disc on the deck');
for(let i=0;i<90;i++)animateEnemy(a,e,1/120,'playing');assert.equal(a.root.visible,false,'and a second later it is gone');
console.log('PASS custom enemy rig, independent walk cycles, shared textures, stable feet, turn direction, pause and pressed-flat defeat');
const castleGLB=await readGLB(url('castle.glb'));prepareCastleAsset(w,castleGLB);const parent=new THREE.Group();
const first=castle(w,parent,0,-5,-27,19.4),second=castle(w,parent,25,-5,-27,19.4);
const one=first.getObjectByName('mesh_node'),two=second.getObjectByName('mesh_node');assert.equal(one.geometry,two.geometry);assert.equal(one.material,two.material);assert(one.material.map&&one.material.normalMap&&one.material.roughnessMap);
parent.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(first,true);assert(Math.abs(bounds.max.x-bounds.min.x-19.4)<.001);assert(bounds.max.z<0);assert.equal(one.castShadow,false);
console.log('PASS original textured castle, normalized framing, shared geometry and background-only placement');

const cottageGLB=await readGLB(url('cottage.glb')),cottageInfo=JSON.parse(await readFile(url('cottage.json')));
assert.equal(createHash('sha256').update(await readFile(url('cottage.glb'))).digest('hex'),cottageInfo.shippedSha256);
prepareCottageAsset(w,cottageGLB);
const near=cottageModel(w,parent,0,-2.6,4,3),roof=cottageModel(w,parent,5,4.19,-1.9,3.4);
const nearMesh=near.getObjectByName('mesh_node'),roofMesh=roof.getObjectByName('mesh_node');
assert.equal(nearMesh.geometry.index.count/3,10398);assert.equal(nearMesh.geometry,roofMesh.geometry);assert.equal(nearMesh.material,roofMesh.material);
assert(nearMesh.material.map&&nearMesh.material.normalMap&&nearMesh.material.roughnessMap);assert.equal(nearMesh.material.normalScale.x,1);
assert(w.assetGeometry.has(nearMesh.geometry)&&w.assetMaterials.has(nearMesh.material));
assert.equal(near.scale.x,near.scale.y);assert.equal(near.scale.x,near.scale.z);
parent.updateMatrixWorld(true);const cottageBounds=new THREE.Box3().setFromObject(near,true);
assert(Math.abs(cottageBounds.min.y+2.6)<1e-6,'cottage and laundry post sit at the terrace base');
assert(Math.abs(cottageBounds.getSize(new THREE.Vector3()).x-3)<1e-6,'width includes the entire garden and laundry line');
console.log('PASS supplied cottage geometry, all three maps, base placement, uniform scale and retained shared resources');

// The Soft Dream's watching flower: the shipped file matches its manifest, the
// one mesh is cut into a head and a stem at load with every triangle kept,
// the eyeball is found where the sculpt puts it, and a built flower stands
// its requested height on its root with a pupil in front of the eyeball.
const flowerGLB=await readGLB(url('dream-flower.glb')),flowerInfo=JSON.parse(await readFile(url('dream-assets.json')))['dream-flower.glb'];
assert.equal(createHash('sha256').update(await readFile(url('dream-flower.glb'))).digest('hex'),flowerInfo.shippedSha256);
let flowerMesh=null;flowerGLB.scene.traverse(o=>{if(o.isMesh&&!flowerMesh)flowerMesh=o;});
const flowerTriangles=flowerMesh.geometry.index.count/3;
// The flower's rig builds its pupil and lid with the world's own primitives,
// so this stub is a World without a renderer.
const fw=Object.create(World.prototype);fw.mat={};for(const key of ['cream','dark','orange','gold'])fw.mat[key]=new THREE.MeshStandardMaterial({color:0xffffff});
fw.scene=new THREE.Scene();fw.levelRoot=new THREE.Group();fw.scene.add(fw.levelRoot);
prepareDreamAsset(fw,'flower',flowerGLB);
const flower=fw.dreamAssets.flower;
assert.equal(flower.head.index.count/3+flower.stem.index.count/3,flowerTriangles,'the cut keeps every triangle');
assert(flower.head.index.count>0&&flower.stem.index.count>0,'both halves have triangles');
assert(flower.material.map?.isTexture,'the flower keeps its painted colour map');
assert(fw.assetGeometry.has(flower.head)&&fw.assetGeometry.has(flower.stem)&&fw.assetMaterials.has(flower.material));
assert(Math.abs(flower.size.y-1)<1e-3,'the model is normalised to one unit tall');
assert(flower.eye.radius>.09&&flower.eye.radius<.14,'the eyeball is about an eighth of the height across');
assert(flower.eye.centre.y>.72&&flower.eye.centre.y<.85&&Math.abs(flower.eye.centre.x)<.05,'the eyeball sits in the head');
const bloom=dreamFlower(fw,fw.levelRoot,{height:2.5});fw.levelRoot.updateMatrixWorld(true);
const bloomBounds=new THREE.Box3().setFromObject(bloom.root,true);
assert(Math.abs(bloomBounds.min.y-0)<1e-6&&Math.abs(bloomBounds.max.y-2.5)<.02,'a flower stands its height on its root');
const pupil=bloom.pupil.getWorldPosition(new THREE.Vector3()),gaze=bloom.gaze.getWorldPosition(new THREE.Vector3());
assert(pupil.z>gaze.z+.2,'the pupil sits on the front of the eyeball');
assert.equal(bloom.lid.rotation.x,-Math.PI/2,'the lid starts open');
console.log('PASS supplied watching flower: manifest hash, head/stem cut, eyeball fit, rigged placement');
