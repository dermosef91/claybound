// Inspect the supplied meshes and embedded textures before placing them.
import * as THREE from '../dist/lib/three.module.js';
import {readGLB} from '../tests/load-player.mjs';
import {clayMaterials} from '../dist/model-assets.js';
import {exportReview} from './review-scene.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [upload,out]=process.argv.slice(2),scene=new THREE.Scene(),back=new THREE.Group(),images=new Map();scene.add(back);
const files=['Meshy_AI_Clay_Canopy_0910095554_texture.glb','Meshy_AI_Clay_Canopy_0910095548_texture(1).glb','Meshy_AI_Spotted_Scarlet_Mushr_0910095602_texture(1).glb','Meshy_AI_Clay_Garden_Bloom_0910095541_texture(1).glb'];
for(const [i,file]of files.entries()){
  const gltf=await readGLB(pathToFileURL(resolve(upload,file)));clayMaterials(gltf.scene);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),g=new THREE.Group();
  g.scale.setScalar(Math.min(5.2/size.x,4/size.y));g.position.set(i%2?3.4:-3.4,i<2?5:0,0);
  gltf.scene.position.set(-center.x,-box.min.y,-center.z);g.add(gltf.scene);scene.add(g);
  for(const [key,image]of gltf.cpuImages)images.set(key,image);
  console.log(i,file);
}
await exportReview(scene,back,out,{camera:{x:0,y:4.4,z:26,elevation:1.8,viewH:10,viewW:14},theme:{skyLight:0xe5f0d7,ambient:2.1,sun:0xffe5b7,sunPower:3.2},sky:'#b7ceba',fog:'#b7ceba',backgroundBlur:0},images);
