import * as THREE from '../dist/lib/three.module.js';
import {readGLB} from '../tests/load-player.mjs';
import {clayMaterials} from '../dist/model-assets.js';
import {exportReview} from './review-scene.mjs';
const scene=new THREE.Scene(),images=new Map();
for(const [i,name]of ['cactus.glb','canyon-arch.glb','canyon-summit.glb'].entries()){
 const gltf=await readGLB(new URL('../dist/assets/'+name,import.meta.url));clayMaterials(gltf.scene);
 for(const [key,data]of gltf.cpuImages)images.set(key,data);
 const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const root=new THREE.Group();root.scale.setScalar(5/size.y);root.position.set((i-1)*7,-2.5,0);gltf.scene.position.set(-center.x,-bounds.min.y,-center.z);root.add(gltf.scene);scene.add(root);
}
await exportReview(scene,null,process.argv[2],{camera:{x:0,y:.1,z:26,elevation:1.25,viewW:24,viewH:24*941/1672},theme:{skyLight:0xffedda,ambient:2,sun:0xffe0b0,sunPower:3},sky:'#b8c7d2',fog:'#b8c7d2'},images);
