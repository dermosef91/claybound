import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export function prepareCottageAsset(w,gltf){
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('The cottage model has invalid bounds.');
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);
  gltf.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.normalScale?.setScalar(1);});
  retainModel(w,gltf.scene);
  w.cottageAsset={scene:gltf.scene,width:size.x,center:[center.x,bounds.min.y,center.z]};
}
export async function loadCottage(w,onProgress){
  if(w.cottageAsset){onProgress?.(1);return;}
  if(!w.cottageLoading)w.cottageLoading=loadModel('cottage.glb',onProgress).then(gltf=>prepareCottageAsset(w,gltf)).catch(error=>{w.cottageLoading=null;throw error;});
  await w.cottageLoading;onProgress?.(1);
}
// Width includes the laundry line. A single uniform scale preserves the house,
// plants and sculpted smoke; +Z is the supplied doorway's facing direction.
export function cottageModel(w,parent,x,y,z,width=3,turn=0){
  if(!w.cottageAsset)throw new Error('Load the cottage before building its scenery.');
  const asset=w.cottageAsset,root=new THREE.Group(),model=asset.scene.clone(true);
  root.name='Clay cottage with laundry';root.position.set(x,y,z);root.rotation.y=turn;root.scale.setScalar(width/asset.width);
  model.position.set(-asset.center[0],-asset.center[1],-asset.center[2]);
  root.add(model);parent.add(root);return root;
}
