import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export function prepareCastleAsset(w,gltf){
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0))throw new Error('The castle model has invalid bounds.');
  clayMaterials(gltf.scene,{background:true,orangeSource:.859});clayModel(w,gltf.scene,{background:true});retainModel(w,gltf.scene);
  w.castleAsset={scene:gltf.scene,width:size.x,center: [center.x,bounds.min.y,center.z]};
}
export async function loadCastle(w,onProgress){
  if(w.castleAsset)return;
  if(!w.castleLoading)w.castleLoading=loadModel('castle.glb',onProgress).then(gltf=>prepareCastleAsset(w,gltf)).catch(error=>{w.castleLoading=null;throw error;});
  await w.castleLoading;onProgress?.(1);
}
export function castle(w,parent,x,y,z,width){
  if(!w.castleAsset)throw new Error('Load the castle before building Chapter Four.');
  const asset=w.castleAsset,root=new THREE.Group(),model=asset.scene.clone(true);
  root.name='Cloudtop Kingdom';root.position.set(x,y,z);root.scale.setScalar(width/asset.width);
  model.position.set(-asset.center[0],-asset.center[1],-asset.center[2]);root.add(model);parent.add(root);return root;
}
