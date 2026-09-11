import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export function prepareWindmillAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!(size.x>0&&size.y>0&&size.z>0))throw new Error('Invalid windmill '+key+' model.');
  clayMaterials(gltf.scene);clayModel(w,gltf.scene);retainModel(w,gltf.scene);
  // The tower's front-facing axle sits just below the roof. Sample its front
  // surface so the rotating hub sits on the actual model, not inside the wall.
  let hub=null;
  if(key==='tower'){
    const y=bounds.min.y+size.y*.79;
    const hit=new THREE.Raycaster(new THREE.Vector3(center.x,y,bounds.max.z+1),new THREE.Vector3(0,0,-1)).intersectObject(gltf.scene,true)[0];
    hub=new THREE.Vector3(center.x,y,hit?.point.z??bounds.max.z);
  }
  w.windmillAssets??={};w.windmillAssets[key]={scene:gltf.scene,bounds,size,center,hub};
}
export async function loadWindmills(w,onProgress){
  if(w.windmillAssets?.tower&&w.windmillAssets?.sails){onProgress?.(1);return;}
  if(!w.windmillLoading){
    const progress=[0,0];
    w.windmillLoading=Promise.all(['tower','sails'].map(async(key,i)=>{
      if(w.windmillAssets?.[key]){progress[i]=1;return;}
      const gltf=await loadModel('windmill-'+key+'.glb',v=>{if(v!==null){progress[i]=v;onProgress?.((progress[0]+progress[1])/2);}});
      prepareWindmillAsset(w,key,gltf);progress[i]=1;
    })).catch(error=>{w.windmillLoading=null;throw error;});
  }
  await w.windmillLoading;onProgress?.(1);
}
export function windmillModel(w,parent){
  const {tower,sails}=w.windmillAssets||{};
  if(!tower||!sails)throw new Error('Load both windmill models before building the canyon.');
  const root=new THREE.Group();root.name='Autumn clay windmill';parent.add(root);
  const height=4.2,scale=height/tower.size.y,body=tower.scene.clone(true);
  body.name='Supplied windmill tower';body.scale.setScalar(scale);
  body.position.set(-tower.center.x*scale,-tower.bounds.min.y*scale,-tower.center.z*scale);root.add(body);
  const rotor=new THREE.Group();rotor.name='Rotating clay sails';
  rotor.position.copy(tower.hub).sub(new THREE.Vector3(tower.center.x,tower.bounds.min.y,tower.center.z)).multiplyScalar(scale);
  rotor.position.z+=.08;rotor.userData.spin=true;root.add(rotor);
  const blades=sails.scene.clone(true);blades.name='Supplied windmill sails';
  // The supplied sails are authored around their hub at the origin. Retain
  // that pivot; the bounding-box centre is not the rotation centre.
  blades.scale.setScalar(3.65/Math.max(sails.size.x,sails.size.y));rotor.add(blades);
  return root;
}
