import * as THREE from './lib/three.module.js';
import {loadModel,retainModel,clayMaterials} from './model-assets.js';
import {clayModel} from './clay.js';

export const CANYON_FILES={arch:'canyon-arch.glb',summit:'canyon-summit.glb',cactus:'cactus.glb',tent:'canyon-tent.glb'};
export function prepareCanyonAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!(size.y>0&&size.x>0))throw new Error('Invalid canyon model: '+key);
  const background=key==='arch'||key==='summit',orangeSource={arch:.875,summit:.820,tent:.824}[key]||0;
  clayMaterials(gltf.scene,{background,orangeSource});clayModel(w,gltf.scene,{background});
  // Continue the lowest foot of each formation down into the canyon. The
  // authored arch and summit stay intact above the base, instead of floating.
  if(background)gltf.scene.traverse(o=>{if(o.isMesh){
    const g=o.geometry.clone();g.computeBoundingBox();const low=g.boundingBox.min.y,span=g.boundingBox.max.y-low,p=g.attributes.position;
    for(let i=0;i<p.count;i++){const t=Math.max(0,1-(p.getY(i)-low)/(span*.12));p.setY(i,p.getY(i)-span*2.5*t*t);}
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;
  }});
  gltf.scene.traverse(o=>{if(o.isMesh){o.material.normalScale?.setScalar(.9);o.material.roughness=.93;}});
  retainModel(w,gltf.scene);w.canyonAssets??={};w.canyonAssets[key]={scene:gltf.scene,height:size.y,base:bounds.min.y,center};
}
export async function loadCanyonAssets(w,onProgress){
  const progress=Object.keys(CANYON_FILES).map(()=>0);
  await Promise.all(Object.entries(CANYON_FILES).map(async([key,file],i)=>{
    const report=v=>{if(v!==null){progress[i]=v;onProgress?.(progress.reduce((a,b)=>a+b,0)/progress.length);}};
    prepareCanyonAsset(w,key,await loadModel(file,report));report(1);
  }));
}
export function canyonModel(w,key,parent,x,y,z,height,turn=0){
  const asset=w.canyonAssets?.[key];if(!asset)return new THREE.Group();
  const root=new THREE.Group(),model=asset.scene.clone(true);root.name='Canyon '+key;
  root.position.set(x,y,z);root.rotation.y=turn;root.scale.setScalar(height/asset.height);
  model.position.set(-asset.center.x,-asset.base,-asset.center.z);root.add(model);parent.add(root);return root;
}
