import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/lib/three.module.js';
import {attachWindmills} from './load-windmills.mjs';
import {windmillModel} from '../dist/windmill.js';

const w={};await attachWindmills(w);
const manifest=JSON.parse(await readFile(new URL('../dist/assets/windmill-assets.json',import.meta.url)));
for(const [key,triangles]of [['tower',3132],['sails',3082]]){
  const asset=w.windmillAssets[key];let count=0;
  asset.scene.traverse(o=>{if(o.isMesh){count+=o.geometry.index.count/3;assert(o.material.map&&o.material.normalMap&&o.material.roughnessMap);assert(w.assetGeometry.has(o.geometry)&&w.assetMaterials.has(o.material));}});
  assert.equal(count,triangles);assert.equal(createHash('sha256').update(await readFile(new URL('../dist/assets/windmill-'+key+'.glb',import.meta.url))).digest('hex'),manifest['windmill-'+key+'.glb'].shippedSha256);
}
const parent=new THREE.Group(),a=windmillModel(w,parent),b=windmillModel(w,parent),rotor=a.getObjectByName('Rotating clay sails');
const box=new THREE.Box3().setFromObject(a.getObjectByName('Supplied windmill tower'));
assert(Math.abs(box.min.y)<1e-6);assert(Math.abs(box.max.y-4.2)<1e-6);
assert(rotor.position.y>3.2&&rotor.position.y<3.4);assert(rotor.position.z>0);
const hub=rotor.position.clone(),body=a.getObjectByName('Supplied windmill tower');
for(let i=0;i<32;i++){
  rotor.rotation.z=i*Math.PI/16;a.updateMatrixWorld(true);
  assert(rotor.position.equals(hub));assert(Math.abs(body.rotation.z)<1e-10);
  const bounds=new THREE.Box3().setFromObject(rotor,true);
  assert(bounds.max.y-bounds.min.y<4.9);assert(bounds.min.y>1,'sails stay above the walking surface');
}
assert.equal(b.getObjectByName('Rotating clay sails').rotation.z,0);
assert.equal(a.getObjectByName('mesh_0').geometry,b.getObjectByName('mesh_0').geometry);
console.log('PASS supplied windmill topology/materials, source fingerprints, uniform scale, axle placement, rotating sails, fixed towers and shared resources');
