import * as THREE from './lib/three.module.js';
import {SPITTER} from './spitter-rules.js';
import {clone} from './lib/SkeletonUtils.js';
import {loadModel,loadData,retainModel} from './model-assets.js';

export const SPITTER_FILES={character:'echo-spitter-gloob.glb',crystal:'echo-crystal.glb'};
export function prepareSpitterAsset(w,key,gltf){
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!size.toArray().every(v=>Number.isFinite(v)&&v>0))throw new Error('Invalid Echo Spitter asset: '+key);
  gltf.scene.traverse(o=>{if(o.isMesh){
    o.castShadow=key!=='crystal';o.receiveShadow=true;
    if(o.isSkinnedMesh)o.frustumCulled=false;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      // Preserve the supplied PBR maps, including the character's crystal finish.
      // Mark authored surfaces so CPU scene validation does not require a second
      // procedural fingerprint shader over their original texture maps.
      m.userData.clay={type:'authored'};
      if(m.map)m.map.anisotropy=4;
    }
  }});
  retainModel(w,gltf.scene);w.spitterAssets??={};w.spitterAssets[key]={scene:gltf.scene,box,size,center};
}
export async function loadSpitterAssets(w,onProgress){
  if(w.spitterMotion&&Object.keys(SPITTER_FILES).every(k=>w.spitterAssets?.[k])){onProgress?.(1);return;}
  if(!w.spitterLoading){
    const progress=[0,0];
    w.spitterLoading=Promise.all(Object.entries(SPITTER_FILES).map(async([key,file],i)=>{
      if(!w.spitterAssets?.[key])prepareSpitterAsset(w,key,await loadModel(file,v=>{if(v!==null){progress[i]=v;onProgress?.(progress.reduce((a,b)=>a+b)/2);}}));
      progress[i]=1;
    })).catch(e=>{w.spitterLoading=null;throw e;});
  }
  await w.spitterLoading;
  if(!w.spitterMotion)w.spitterMotion=await loadData('echo-spitter-motion.json');
  onProgress?.(1);
}
export function spitterModel(w,key,parent){
  const a=w.spitterAssets?.[key];if(!a)throw new Error('Load Echo Spitter assets before creating their views.');
  const root=new THREE.Group(),model=clone(a.scene),scale=key==='crystal'?(SPITTER.shotRadius*2)/Math.max(a.size.x,a.size.y,a.size.z):1.35/a.size.y;
  root.name='Supplied Echo '+key;root.scale.setScalar(scale);
  model.position.set(-a.center.x,key==='crystal'?-a.center.y:-a.box.min.y,-a.center.z);
  root.add(model);parent.add(root);return root;
}
