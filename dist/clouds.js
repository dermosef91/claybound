import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export function prepareCloudAsset(w,gltf){
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.z>0))throw new Error('The cloud has invalid bounds.');
  clayMaterials(gltf.scene,{background:true});clayModel(w,gltf.scene,{background:true});retainModel(w,gltf.scene);
  w.cloudAsset={scene:gltf.scene,width:size.x,center};
}
export async function loadClouds(w,onProgress){prepareCloudAsset(w,await loadModel('cloud.glb',onProgress));onProgress?.(1);}
export function cloudModel(w,parent,x,y,z,width=5,turn=0){
  if(!w.cloudAsset)return new THREE.Group(); // Loading overlay remains until ready.
  const root=new THREE.Group(),model=w.cloudAsset.scene.clone(true),a=w.cloudAsset;
  root.name='Ivory cloud';root.position.set(x,y,z);root.scale.setScalar(width/a.width);root.rotation.y=turn;
  model.position.copy(a.center).multiplyScalar(-1);root.add(model);parent.add(root);return root;
}
