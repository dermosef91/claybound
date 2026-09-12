import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export function prepareCityLaundry(w,gltf){
  // Tripo's source faces +X. The side-scrolling playfield faces the camera at +Z.
  gltf.scene.rotation.y=-Math.PI/2;
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!size.toArray().every(v=>Number.isFinite(v)&&v>0))throw new Error('Invalid laundry nook bounds');
  clayMaterials(gltf.scene,{orangeSource:.706});clayModel(w,gltf.scene);
  retainModel(w,gltf.scene);w.cityLaundry={scene:gltf.scene,box,size,center};
}
export async function loadCityLaundry(w,onProgress){
  if(w.cityLaundry){onProgress?.(1);return;}
  if(!w.cityLaundryLoading)w.cityLaundryLoading=loadModel('city-laundry.glb',onProgress).then(gltf=>prepareCityLaundry(w,gltf)).catch(error=>{w.cityLaundryLoading=null;throw error;});
  await w.cityLaundryLoading;onProgress?.(1);
}
export function cityLaundry(w,parent,x,y,z,width=3.8){
  const a=w.cityLaundry;if(!a)throw new Error('Load city laundry before building the chapter');
  const root=new THREE.Group(),model=a.scene.clone(true);root.name='Rooftop laundry nook';
  root.position.set(x,y,z);root.scale.setScalar(width/a.size.x);
  model.position.set(-a.center.x,-a.box.min.y,-a.center.z);root.add(model);parent.add(root);return root;
}
